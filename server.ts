import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { ZipArchive, type ArchiverError } from 'archiver';
import { createServer as createViteServer } from 'vite';
import {
  db,
  DB_PATH,
  initDatabase,
  getAllProducts,
  getProductById,
  getSiteSettings,
  saveSiteSettings,
  recalculateProductMetrics,
  recalculateProductRating,
  hydrateOrder,
  restoreDatabaseFromFile,
  verifyProductUpload,
} from './server/db.ts';
import {
  attachOptionalAuth,
  requireAuth,
  requireAdmin,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  isValidSafeUrl,
  sanitizeString,
  type AuthenticatedRequest,
} from './server/security.ts';
import { sendTelegramAlert, isTelegramConfigured } from './server/telegram.ts';
import { isGatewayEnvConfigured, verifyGatewayTransaction } from './server/payments.ts';
import type { OrderStatus, PaymentMethod, PaymentStatus } from './src/types.ts';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(attachOptionalAuth);

// Secure uploads directory
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported media format'));
    }
  },
});

const TMP_RESTORE_DIR = path.resolve(path.dirname(DB_PATH), 'tmp-restore');
if (!fs.existsSync(TMP_RESTORE_DIR)) {
  fs.mkdirSync(TMP_RESTORE_DIR, { recursive: true });
}

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_RESTORE_DIR),
    filename: (_req, _file, cb) => {
      cb(null, `restore-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.db`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
      cb(null, true);
    } else {
      cb(new Error('Please select a valid .db SQLite backup file'));
    }
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

function logServerError(route: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  try {
    db.prepare(`INSERT INTO error_logs (level, route, message) VALUES ('error', ?, ?)`).run(
      route,
      message.slice(0, 1000)
    );
  } catch {
    // ignore logging failure
  }
}

function createNotification(userId: number | null, type: string, title: string, message: string): void {
  try {
    db.prepare(`INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`).run(
      userId,
      type,
      title,
      message
    );
  } catch {
    // ignore
  }
}

// ---------- LIVE EXCHANGE RATES ----------
let cachedRates: { base: string; rates: Record<string, number>; fetchedAt: number } = {
  base: 'USD',
  rates: {
    USD: 1,
    BDT: 119.5,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    SGD: 1.34,
    CAD: 1.39,
    AUD: 1.52,
    INR: 84.4,
  },
  fetchedAt: 0,
};

app.get('/api/exchange-rates', async (_req, res) => {
  const now = Date.now();
  if (now - cachedRates.fetchedAt > 1000 * 60 * 60 * 6) {
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/USD');
      if (resp.ok) {
        const data = (await resp.json()) as { rates?: Record<string, number> };
        if (data.rates && data.rates.BDT) {
          cachedRates = {
            base: 'USD',
            rates: {
              USD: 1,
              BDT: Number(data.rates.BDT.toFixed(2)),
              EUR: Number((data.rates.EUR || 0.92).toFixed(4)),
              GBP: Number((data.rates.GBP || 0.79).toFixed(4)),
              AED: Number((data.rates.AED || 3.67).toFixed(4)),
              SGD: Number((data.rates.SGD || 1.34).toFixed(4)),
              CAD: Number((data.rates.CAD || 1.39).toFixed(4)),
              AUD: Number((data.rates.AUD || 1.52).toFixed(4)),
              INR: Number((data.rates.INR || 84.4).toFixed(2)),
            },
            fetchedAt: now,
          };
        }
      }
    } catch {
      // keep fallback cached rates
    }
  }
  res.json(cachedRates);
});

// ---------- STOREFRONT BOOTSTRAP ----------
app.get('/api/store/bootstrap', (_req, res) => {
  const settings = getSiteSettings();
  const categories = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status != 'draft' AND p.product_type = 'own') AS product_count
       FROM categories c
       ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();
  const products = getAllProducts().filter((p) => p.status !== 'draft' && p.product_type === 'own');
  const paymentSettings = (db.prepare(`SELECT * FROM payment_settings ORDER BY id ASC`).all() as any[]).map((p) => ({
    ...p,
    is_enabled: p.is_enabled === 1,
    sandbox_mode: p.sandbox_mode === 1,
    env_configured: isGatewayEnvConfigured(p.gateway),
  }));
  const shippingZones = (db.prepare(`SELECT * FROM shipping_zones WHERE is_active = 1`).all() as any[]).map((z) => ({
    ...z,
    is_active: z.is_active === 1,
  }));
  const approvedReviews = (
    db
      .prepare(
        `SELECT r.*, p.name AS product_name
         FROM reviews r
         LEFT JOIN products p ON p.id = r.product_id
         WHERE r.status = 'approved'
         ORDER BY r.id DESC
         LIMIT 24`
      )
      .all() as any[]
  ).map((r) => ({
    ...r,
    images: JSON.parse(r.images_json || '[]'),
    is_verified_purchase: r.is_verified_purchase === 1,
  }));

  res.json({
    settings: { ...settings, telegram_configured: isTelegramConfigured() },
    categories,
    products,
    paymentSettings,
    shippingZones,
    reviews: approvedReviews,
  });
});

const SUPPORTED_CURRENCIES = new Set(['BDT', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'INR']);

function parseSafeNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const normalized = String(val)
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/,/g, '')
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

function convertCurrencyServer(amount: number, fromCurrency: string, toCurrency = 'USD'): number {
  const safe = Number.isFinite(amount) ? amount : 0;
  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();
  if (from === to) return safe;
  const rates = cachedRates.rates;
  const fromRate = rates[from] && rates[from] > 0 ? rates[from] : 1;
  const toRate = rates[to] && rates[to] > 0 ? rates[to] : 1;
  return Number(((safe / fromRate) * toRate).toFixed(4));
}

function productError(
  res: express.Response,
  status: number,
  field: string,
  code: string,
  error: string,
  fixHint: string
): void {
  res.status(status).json({
    ok: false,
    field,
    code,
    error,
    fix_hint: fixHint,
  });
}

// ---------- FILE UPLOAD (Hardened with explicit error detection & disk verification) ----------
app.post('/api/upload', requireAuth, (req, res) => {
  try {
    fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
  } catch (permErr) {
    logServerError('/api/upload PERMISSION', permErr);
    productError(
      res,
      500,
      'images',
      'STORAGE_NOT_WRITABLE',
      'সার্ভারের ফাইল স্টোরেজ ফোল্ডারে ছবি সংরক্ষণের অনুমতি নেই।',
      'সার্ভারের uploads ফোল্ডারের write permission পরীক্ষা করুন বা কিছুক্ষণ পর আবার চেষ্টা করুন।'
    );
    return;
  }

  upload.single('file')(req, res, (uploadErr: unknown) => {
    if (uploadErr) {
      logServerError('/api/upload MULTER', uploadErr);
      if (uploadErr instanceof multer.MulterError) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          productError(
            res,
            413,
            'images',
            'FILE_TOO_LARGE',
            'ছবির ফাইলের সাইজ ২০ MB-এর চেয়ে বেশি।',
            'দয়া করে ২০ MB-এর কম সাইজের ছবি (JPG, PNG বা WEBP) আপলোড করুন।'
          );
          return;
        }
        productError(
          res,
          400,
          'images',
          uploadErr.code || 'UPLOAD_ERROR',
          `ফাইল আপলোড ব্যর্থ হয়েছে: ${uploadErr.message}`,
          'সঠিক ছবি বা ভিডিও ফাইল বেছে নিয়ে আবার চেষ্টা করুন।'
        );
        return;
      }
      const msg = uploadErr instanceof Error ? uploadErr.message : 'Unsupported media format';
      if (msg.toLowerCase().includes('unsupported')) {
        productError(
          res,
          415,
          'images',
          'UNSUPPORTED_FORMAT',
          'এই ফাইল ফরম্যাটটি সাপোর্টেড নয়।',
          'শুধুমাত্র JPG, PNG, WEBP, GIF ছবি অথবা MP4/WebM ভিডিও আপলোড করুন।'
        );
        return;
      }
      productError(
        res,
        400,
        'images',
        'UPLOAD_FAILED',
        msg,
        'ফাইলটি সঠিক ফরম্যাটে আছে কিনা যাচাই করে আবার চেষ্টা করুন।'
      );
      return;
    }

    if (!req.file) {
      productError(
        res,
        400,
        'images',
        'NO_FILE',
        'কোনো বৈধ ছবি বা মিডিয়া ফাইল পাওয়া যায়নি।',
        'দয়া করে আপনার ডিভাইস থেকে একটি ছবি বাছাই করুন।'
      );
      return;
    }

    const savedPath = path.resolve(req.file.path);
    if (!fs.existsSync(savedPath) || fs.statSync(savedPath).size <= 0) {
      productError(
        res,
        500,
        'images',
        'DISK_WRITE_VERIFY_FAILED',
        'ছবিটি সার্ভারে সঠিকভাবে সেভ হয়নি।',
        'অনুগ্রহ করে আবার ছবিটি আপলোড করুন।'
      );
      return;
    }

    res.json({
      ok: true,
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });
});

// ---------- CUSTOMER AUTHENTICATION ----------
app.post('/api/auth/register', authLimiter, (req, res) => {
  const name = sanitizeString(req.body.name, 120);
  const email = sanitizeString(req.body.email, 160).toLowerCase();
  const phone = sanitizeString(req.body.phone, 40);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name || !email || !email.includes('@') || password.length < 6) {
    res.status(400).json({ error: 'Valid name, email, and password (min 6 characters) are required.' });
    return;
  }

  const blockedEmail = db.prepare(`SELECT id FROM blocked_gmails WHERE email = ?`).get(email);
  if (blockedEmail) {
    res.status(403).json({ error: 'This Gmail address has been blocked due to unauthorized admin access activity.' });
    return;
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = hashPassword(password);
  const result = db
    .prepare(`INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, 'customer', 'active')`)
    .run(name, email, phone, passwordHash);

  const userId = Number(result.lastInsertRowid);
  createNotification(
    userId,
    'registration',
    'Welcome to SHOPNEXA ROBI HUB',
    `Your customer account (${email}) is active. Enjoy direct checkout and order tracking.`
  );
  void sendTelegramAlert('new_customer', `New Customer Registered: ${name} (${email})`);

  const user = db
    .prepare(`SELECT id, name, email, phone, role, avatar_url, status, created_at FROM users WHERE id = ?`)
    .get(userId) as any;

  const token = signToken({ userId: user.id, email: user.email, role: 'customer' });
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const email = sanitizeString(req.body.email, 160).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const blockedEmail = db.prepare(`SELECT id FROM blocked_gmails WHERE email = ?`).get(email);
  if (blockedEmail) {
    res.status(403).json({ error: 'This Gmail address has been blocked due to unauthorized admin access activity.' });
    return;
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any;
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  if (user.status === 'suspended' || user.status === 'blocked') {
    res.status(403).json({ error: 'This account is currently blocked/suspended. Contact SHOPNEXA ROBI HUB Support.' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  const { password_hash: _p, reset_token: _r, reset_expires: _e, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const email = sanitizeString(req.body.email, 160).toLowerCase();
  const user = db.prepare(`SELECT id, name FROM users WHERE email = ?`).get(email) as
    | { id: number; name: string }
    | undefined;
  if (!user) {
    res.json({ message: 'If an account matches that email, a reset code has been generated.' });
    return;
  }
  const resetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expires = Math.floor(Date.now() / 1000) + 1800;
  db.prepare(`UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`).run(resetToken, expires, user.id);
  createNotification(
    user.id,
    'security',
    'Password Reset Requested',
    `Your password reset code is ${resetToken}. Valid for 30 minutes.`
  );
  res.json({
    message: 'Reset code generated and recorded in your account notification log.',
    resetCodePreview: resetToken,
  });
});

app.post('/api/auth/reset-password', authLimiter, (req, res) => {
  const email = sanitizeString(req.body.email, 160).toLowerCase();
  const resetCode = sanitizeString(req.body.resetCode, 32).toUpperCase();
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any;
  const now = Math.floor(Date.now() / 1000);
  if (!user || !user.reset_token || user.reset_token !== resetCode || user.reset_expires < now) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  db.prepare(`UPDATE users SET password_hash = ?, reset_token = '', reset_expires = 0 WHERE id = ?`).run(
    hashPassword(newPassword),
    user.id
  );
  res.json({ message: 'Password reset successfully. You may now sign in.' });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.auth!.role === 'admin' && req.auth!.userId === 0) {
    res.json({
      user: {
        id: 0,
        name: 'SHOPNEXA ROBI HUB Administrator',
        email: req.auth!.email,
        phone: '',
        role: 'admin',
        avatar_url: '',
        status: 'active',
        created_at: new Date().toISOString(),
      },
    });
    return;
  }
  const user = db
    .prepare(`SELECT id, name, email, phone, role, avatar_url, status, created_at FROM users WHERE id = ?`)
    .get(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
});

app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const name = sanitizeString(req.body.name, 120);
  const phone = sanitizeString(req.body.phone, 40);
  const avatarUrl = sanitizeString(req.body.avatar_url, 500);
  if (avatarUrl && !isValidSafeUrl(avatarUrl)) {
    res.status(400).json({ error: 'Invalid avatar URL' });
    return;
  }
  db.prepare(`UPDATE users SET name = COALESCE(NULLIF(?, ''), name), phone = ?, avatar_url = ? WHERE id = ?`).run(
    name,
    phone,
    avatarUrl,
    req.auth!.userId
  );
  const updated = db
    .prepare(`SELECT id, name, email, phone, role, avatar_url, status, created_at FROM users WHERE id = ?`)
    .get(req.auth!.userId);
  res.json({ user: updated });
});

app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }
  const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.auth!.userId) as any;
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(newPassword), req.auth!.userId);
  res.json({ message: 'Password updated successfully.' });
});

// ---------- ADMIN AUTHENTICATION (username + password + hidden Gmail verification) ----------
app.get('/api/admin/auth/status', (_req, res) => {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  const row = db.prepare(`SELECT setup_completed FROM admin_config WHERE id = 1`).get() as
    | { setup_completed: number }
    | undefined;
  res.json({
    envConfigured: Boolean(envPass),
    needsInitialSetup: !envPass && (!row || row.setup_completed !== 1),
    requiresUsername: true,
    requiresGmailVerification: true,
  });
});

app.post('/api/admin/auth/setup', authLimiter, (req, res) => {
  if (process.env.ADMIN_PASSCODE?.trim()) {
    res.status(403).json({ error: 'Admin passcode is managed via server environment secret.' });
    return;
  }
  const row = db.prepare(`SELECT setup_completed FROM admin_config WHERE id = 1`).get() as
    | { setup_completed: number }
    | undefined;
  if (row && row.setup_completed === 1) {
    res.status(409).json({ error: 'Admin access has already been claimed.' });
    return;
  }
  const username = sanitizeString(req.body.username || 'Robiul', 60);
  const passcode = typeof req.body.passcode === 'string' ? req.body.passcode : '';
  const gmail = sanitizeString(req.body.gmail, 160).toLowerCase();
  if (passcode.length < 6 || !gmail || !gmail.includes('@')) {
    res.status(400).json({ error: 'Admin username, password (min 6 characters), and valid Gmail are required.' });
    return;
  }
  db.prepare(
    `UPDATE admin_config SET admin_username = ?, admin_password_hash = ?, admin_email_hash = ?, setup_completed = 1, gmail_v2_migrated = 1, updated_at = datetime('now') WHERE id = 1`
  ).run(username, hashPassword(passcode), hashPassword(gmail));
  const token = signToken({ userId: 0, email: 'admin@shopnexa.global', role: 'admin' });
  res.json({ token, role: 'admin', username });
});

const burnedChallengeTokens = new Map<string, number>();

function burnChallengeToken(token: string, expSeconds: number): void {
  const nowMs = Date.now();
  for (const [k, expMs] of burnedChallengeTokens.entries()) {
    if (expMs <= nowMs) burnedChallengeTokens.delete(k);
  }
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  burnedChallengeTokens.set(digest, Math.max(nowMs + 300_000, expSeconds * 1000));
}

function isChallengeTokenBurned(token: string): boolean {
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  return burnedChallengeTokens.has(digest);
}

app.post('/api/admin/auth/login', authLimiter, (req, res) => {
  const usernameInput = sanitizeString(req.body.username || '', 60);
  const passcode = typeof req.body.passcode === 'string' ? req.body.passcode : '';
  const envPass = process.env.ADMIN_PASSCODE?.trim();

  const row = db
    .prepare(`SELECT admin_username, admin_password_hash, setup_completed FROM admin_config WHERE id = 1`)
    .get() as { admin_username: string; admin_password_hash: string; setup_completed: number } | undefined;

  const expectedUsername = (row?.admin_username || 'Robiul').toLowerCase();
  if (!usernameInput || usernameInput.toLowerCase() !== expectedUsername) {
    res.status(401).json({ error: 'Invalid administrator username or password.' });
    return;
  }

  if (envPass) {
    if (passcode !== envPass) {
      res.status(401).json({ error: 'Invalid administrator username or password.' });
      return;
    }
  } else {
    if (!row || row.setup_completed !== 1) {
      res.status(400).json({ error: 'Initial administrator setup is required first.' });
      return;
    }
    if (!verifyPassword(passcode, row.admin_password_hash)) {
      res.status(401).json({ error: 'Invalid administrator username or password.' });
      return;
    }
  }

  const challengeToken = signToken(
    { userId: 0, email: `admin-mfa:${crypto.randomBytes(8).toString('hex')}`, role: 'admin_mfa_pending' },
    300
  );
  res.json({ requiresGmailVerification: true, challengeToken });
});

app.post('/api/admin/auth/verify-gmail', authLimiter, (req, res) => {
  const challengeToken = typeof req.body.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
  const gmailInput = sanitizeString(req.body.gmail, 160).toLowerCase();

  const payload = verifyToken(challengeToken);
  if (!payload || payload.role !== 'admin_mfa_pending' || isChallengeTokenBurned(challengeToken)) {
    res.status(401).json({ blocked: true, error: 'Verification session locked or expired. Please sign in again.' });
    return;
  }

  // Every verification challenge is strictly single-use
  burnChallengeToken(challengeToken, payload.exp);

  const row = db
    .prepare(`SELECT admin_username, admin_email_hash FROM admin_config WHERE id = 1`)
    .get() as { admin_username: string; admin_email_hash: string } | undefined;

  const alreadyBlocked = gmailInput
    ? db.prepare(`SELECT id FROM blocked_gmails WHERE email = ?`).get(gmailInput)
    : undefined;
  if (alreadyBlocked) {
    res.status(403).json({
      blocked: true,
      error: 'Access Blocked: This Gmail address has been permanently blocked for unauthorized admin access.',
    });
    return;
  }

  if (!row || !gmailInput || !verifyPassword(gmailInput, row.admin_email_hash)) {
    const clientIp =
      req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || '';
    if (gmailInput && gmailInput.includes('@')) {
      db.prepare(
        `INSERT OR IGNORE INTO blocked_gmails (email, ip_address, attempted_username, reason) VALUES (?, ?, ?, ?)`
      ).run(
        gmailInput,
        clientIp,
        row?.admin_username || 'Robiul',
        'Entered wrong Gmail during admin Step 2 verification'
      );
      db.prepare(`UPDATE users SET status = 'blocked' WHERE email = ? AND role != 'admin'`).run(gmailInput);
    }
    logServerError('/api/admin/auth/verify-gmail', `Blocked unauthorized Gmail attempt: ${gmailInput || '(empty)'}`);
    void sendTelegramAlert(
      'support',
      `Security Alert: Unauthorized admin Gmail attempt blocked (${gmailInput || 'unknown'}, IP: ${clientIp || 'unknown'}).`
    );
    res.status(403).json({
      blocked: true,
      error: 'Unauthorized Gmail! This Gmail address has been blocked immediately.',
    });
    return;
  }

  const token = signToken({ userId: 0, email: 'admin@shopnexa.global', role: 'admin' });
  res.json({ token, role: 'admin', username: row.admin_username });
});

app.get('/api/admin/auth/me', requireAdmin, (_req, res) => {
  const row = db.prepare(`SELECT admin_username FROM admin_config WHERE id = 1`).get() as
    | { admin_username: string }
    | undefined;
  res.json({ username: row?.admin_username || '' });
});

app.put('/api/admin/auth/credentials', requireAdmin, (req, res) => {
  const newUsername = sanitizeString(req.body.newUsername || req.body.username, 60);
  const currentPasscode = typeof req.body.currentPasscode === 'string' ? req.body.currentPasscode : '';
  const newPassword = typeof req.body.newPasscode === 'string'
    ? req.body.newPasscode
    : typeof req.body.newPassword === 'string'
    ? req.body.newPassword
    : '';
  const newGmail = sanitizeString(req.body.newGmail, 160).toLowerCase();

  const row = db
    .prepare(`SELECT admin_username, admin_password_hash, admin_email_hash FROM admin_config WHERE id = 1`)
    .get() as { admin_username: string; admin_password_hash: string; admin_email_hash: string } | undefined;

  if (!row || !verifyPassword(currentPasscode, row.admin_password_hash)) {
    res.status(401).json({ error: 'Current admin password is incorrect.' });
    return;
  }
  if (newPassword && newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }
  if (newGmail && !newGmail.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid Gmail address.' });
    return;
  }

  const finalUsername = newUsername || row.admin_username;
  const finalPassHash = newPassword ? hashPassword(newPassword) : row.admin_password_hash;
  const finalEmailHash = newGmail ? hashPassword(newGmail) : row.admin_email_hash;

  db.prepare(
    `UPDATE admin_config SET admin_username = ?, admin_password_hash = ?, admin_email_hash = ?, gmail_v2_migrated = 1, updated_at = datetime('now') WHERE id = 1`
  ).run(finalUsername, finalPassHash, finalEmailHash);

  res.json({ success: true, username: finalUsername });
});

// ---------- CUSTOMER ADDRESSES ----------
app.get('/api/addresses', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`)
    .all(req.auth!.userId) as any[];
  res.json(rows.map((r) => ({ ...r, is_default: r.is_default === 1 })));
});

app.post('/api/addresses', requireAuth, (req: AuthenticatedRequest, res) => {
  const b = req.body || {};
  const fullName = sanitizeString(b.full_name, 120);
  const mobile = sanitizeString(b.mobile, 40);
  const country = sanitizeString(b.country || 'Bangladesh', 80);
  if (!fullName || !mobile) {
    res.status(400).json({ error: 'Full name and mobile number are required.' });
    return;
  }
  if (b.is_default) {
    db.prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`).run(req.auth!.userId);
  }
  const result = db
    .prepare(
      `INSERT INTO addresses (
        user_id, label, is_default, full_name, mobile, alt_phone, email, country,
        division, district, upazila, thana, post_office, union_name, municipality, city, village, area,
        road_number, house_number, apartment_number, floor_number, state_province, street_address,
        postal_code, landmark, instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.auth!.userId,
      sanitizeString(b.label || 'Home', 40),
      b.is_default ? 1 : 0,
      fullName,
      mobile,
      sanitizeString(b.alt_phone, 40),
      sanitizeString(b.email, 160),
      country,
      sanitizeString(b.division, 80),
      sanitizeString(b.district, 80),
      sanitizeString(b.upazila, 80),
      sanitizeString(b.thana, 80),
      sanitizeString(b.post_office, 100),
      sanitizeString(b.union_name, 80),
      sanitizeString(b.municipality, 80),
      sanitizeString(b.city, 80),
      sanitizeString(b.village, 80),
      sanitizeString(b.area, 120),
      sanitizeString(b.road_number, 60),
      sanitizeString(b.house_number, 60),
      sanitizeString(b.apartment_number, 60),
      sanitizeString(b.floor_number, 40),
      sanitizeString(b.state_province, 80),
      sanitizeString(b.street_address, 240),
      sanitizeString(b.postal_code, 30),
      sanitizeString(b.landmark, 160),
      sanitizeString(b.instructions, 300)
    );
  const created = db.prepare(`SELECT * FROM addresses WHERE id = ?`).get(result.lastInsertRowid) as any;
  res.status(201).json({ ...created, is_default: created.is_default === 1 });
});

app.put('/api/addresses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT id FROM addresses WHERE id = ? AND user_id = ?`).get(id, req.auth!.userId);
  if (!existing) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  const b = req.body || {};
  if (b.is_default) {
    db.prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`).run(req.auth!.userId);
  }
  db.prepare(
    `UPDATE addresses SET
      label = ?, is_default = ?, full_name = ?, mobile = ?, alt_phone = ?, email = ?, country = ?,
      division = ?, district = ?, upazila = ?, thana = ?, post_office = ?, union_name = ?, municipality = ?, city = ?,
      village = ?, area = ?, road_number = ?, house_number = ?, apartment_number = ?, floor_number = ?,
      state_province = ?, street_address = ?, postal_code = ?, landmark = ?, instructions = ?
    WHERE id = ? AND user_id = ?`
  ).run(
    sanitizeString(b.label || 'Home', 40),
    b.is_default ? 1 : 0,
    sanitizeString(b.full_name, 120),
    sanitizeString(b.mobile, 40),
    sanitizeString(b.alt_phone, 40),
    sanitizeString(b.email, 160),
    sanitizeString(b.country || 'Bangladesh', 80),
    sanitizeString(b.division, 80),
    sanitizeString(b.district, 80),
    sanitizeString(b.upazila, 80),
    sanitizeString(b.thana, 80),
    sanitizeString(b.post_office, 100),
    sanitizeString(b.union_name, 80),
    sanitizeString(b.municipality, 80),
    sanitizeString(b.city, 80),
    sanitizeString(b.village, 80),
    sanitizeString(b.area, 120),
    sanitizeString(b.road_number, 60),
    sanitizeString(b.house_number, 60),
    sanitizeString(b.apartment_number, 60),
    sanitizeString(b.floor_number, 40),
    sanitizeString(b.state_province, 80),
    sanitizeString(b.street_address, 240),
    sanitizeString(b.postal_code, 30),
    sanitizeString(b.landmark, 160),
    sanitizeString(b.instructions, 300),
    id,
    req.auth!.userId
  );
  const updated = db.prepare(`SELECT * FROM addresses WHERE id = ?`).get(id) as any;
  res.json({ ...updated, is_default: updated.is_default === 1 });
});

app.delete('/api/addresses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare(`DELETE FROM addresses WHERE id = ? AND user_id = ?`).run(Number(req.params.id), req.auth!.userId);
  res.json({ success: true });
});

// ---------- WISHLIST ----------
app.get('/api/wishlist', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db.prepare(`SELECT product_id FROM wishlist_items WHERE user_id = ?`).all(req.auth!.userId) as Array<{
    product_id: number;
  }>;
  res.json(rows.map((r) => r.product_id));
});

app.post('/api/wishlist/toggle', requireAuth, (req: AuthenticatedRequest, res) => {
  const productId = Number(req.body.productId);
  const existing = db
    .prepare(`SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?`)
    .get(req.auth!.userId, productId);
  if (existing) {
    db.prepare(`DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?`).run(req.auth!.userId, productId);
    res.json({ wishlisted: false });
  } else {
    db.prepare(`INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)`).run(req.auth!.userId, productId);
    res.json({ wishlisted: true });
  }
});

// ---------- CART PERSISTENCE (DB-backed for signed-in customers) ----------
app.get('/api/cart', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db.prepare(`SELECT * FROM cart_items WHERE user_id = ?`).all(req.auth!.userId) as any[];
  res.json(rows);
});

app.post('/api/cart/sync', requireAuth, (req: AuthenticatedRequest, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.auth!.userId);
    const ins = db.prepare(
      `INSERT INTO cart_items (user_id, product_id, color_id, size_id, variation_id, quantity) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        ins.run(
          req.auth!.userId,
          Number(item.product_id),
          item.color_id ? Number(item.color_id) : null,
          item.size_id ? Number(item.size_id) : null,
          item.variation_id ? Number(item.variation_id) : null,
          Math.max(1, Number(item.quantity))
        );
      }
    }
  });
  tx();
  res.json({ success: true });
});

// ---------- AFFILIATE CLICK TRACKING (Admin Dashboard Only) ----------
app.post('/api/affiliate/track', requireAdmin, (req: AuthenticatedRequest, res) => {
  const productId = Number(req.body.product_id);
  const product = getProductById(productId);
  if (!product || product.product_type !== 'affiliate' || !product.affiliate_url) {
    res.status(404).json({ error: 'Affiliate product or URL not found' });
    return;
  }
  if (!isValidSafeUrl(product.affiliate_url)) {
    res.status(400).json({ error: 'Invalid affiliate URL' });
    return;
  }

  db.prepare(
    `INSERT INTO affiliate_clicks (product_id, user_id, selected_color, selected_size, selected_model, destination_url, referrer)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    product.id,
    req.auth?.userId ?? null,
    sanitizeString(req.body.selected_color, 80),
    sanitizeString(req.body.selected_size, 80),
    sanitizeString(req.body.selected_model, 120),
    product.affiliate_url,
    sanitizeString(req.headers.referer || '', 240)
  );

  res.json({ redirectUrl: product.affiliate_url });
});

// ---------- COUPONS & SHIPPING CALCULATION ----------
app.post('/api/coupons/validate', (req, res) => {
  const code = sanitizeString(req.body.code, 40).toUpperCase();
  const subtotal = Number(req.body.subtotal || 0);
  const coupon = db.prepare(`SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1`).get(code) as any;
  if (!coupon) {
    res.status(404).json({ error: 'Coupon code is invalid or inactive.' });
    return;
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'This coupon has expired.' });
    return;
  }
  if (coupon.used_count >= coupon.max_uses) {
    res.status(400).json({ error: 'Coupon usage limit reached.' });
    return;
  }
  if (subtotal < coupon.min_order_value) {
    res.status(400).json({ error: `Minimum order value of $${coupon.min_order_value} required.` });
    return;
  }
  const discount =
    coupon.discount_type === 'percentage'
      ? Number(((subtotal * coupon.discount_value) / 100).toFixed(2))
      : Math.min(subtotal, coupon.discount_value);
  res.json({
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discount_amount: discount,
    campaign_name: coupon.campaign_name,
  });
});

app.post('/api/shipping/calculate', (req, res) => {
  const rawCountry = sanitizeString(req.body.country || 'Bangladesh', 80);
  const country = rawCountry === 'বাংলাদেশ' ? 'Bangladesh' : rawCountry;
  const rawDistrict = sanitizeString(req.body.district, 80);
  const districtBnMap: Record<string, string> = {
    'ঢাকা': 'dhaka',
    'রংপুর': 'rangpur',
    'চট্টগ্রাম': 'chattogram',
    'রাজশাহী': 'rajshahi',
    'খুলনা': 'khulna',
    'বরিশাল': 'barishal',
    'সিলেট': 'sylhet',
    'ময়মনসিংহ': 'mymensingh',
  };
  const normalizedDistrict = (districtBnMap[rawDistrict] || rawDistrict).toLowerCase();
  const subtotal = Number(req.body.subtotal || 0);

  const zones = db.prepare(`SELECT * FROM shipping_zones WHERE is_active = 1`).all() as any[];
  let matched =
    zones.find(
      (z) =>
        z.country.toLowerCase() === country.toLowerCase() &&
        z.district.toLowerCase() === normalizedDistrict
    ) ||
    zones.find((z) => z.country.toLowerCase() === country.toLowerCase()) ||
    zones.find((z) => z.country.toLowerCase() === 'international') ||
    zones[0];

  if (!matched) {
    res.json({ shipping_charge: 0, estimated_days: '3–7 Business Days', zone_name: 'Standard' });
    return;
  }

  const freeThreshold = Number(matched.free_shipping_threshold || 0);
  const charge = freeThreshold > 0 && subtotal >= freeThreshold ? 0 : Number(matched.base_fee || 0);
  res.json({
    shipping_charge: charge,
    estimated_days: matched.estimated_days,
    zone_name: matched.name,
    free_shipping_threshold: freeThreshold,
  });
});

// ---------- DIRECT ORDER CHECKOUT (OWN PRODUCTS ONLY) ----------
app.post('/api/orders', async (req: AuthenticatedRequest, res) => {
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const address = b.address || {};
    const customerName = sanitizeString(address.full_name || b.customer_name, 120);
    const customerEmail = sanitizeString(address.email || b.customer_email, 160);
    const customerPhone = sanitizeString(address.mobile || b.customer_phone, 40);
    const country = sanitizeString(address.country || 'Bangladesh', 80);
    const paymentMethod = sanitizeString(b.payment_method, 40) as PaymentMethod;
    const transactionId = sanitizeString(b.transaction_id, 120);
    const couponCode = sanitizeString(b.coupon_code, 40).toUpperCase();

    if (!customerName || !customerEmail || !customerPhone) {
      res.status(400).json({ error: 'Customer name, email, and mobile number are required.' });
      return;
    }

    if (country.toLowerCase() === 'bangladesh') {
      if (!address.district || !address.postal_code) {
        res.status(400).json({ error: 'District and Postal Code are required for Bangladesh delivery.' });
        return;
      }
      if (!['bkash', 'nagad', 'cod'].includes(paymentMethod)) {
        res.status(400).json({ error: 'Select bKash, Nagad, or Cash on Delivery for Bangladesh orders.' });
        return;
      }
    } else {
      if (!address.city || !address.street_address || !address.postal_code) {
        res.status(400).json({ error: 'City, street address, and postal/ZIP code are required.' });
        return;
      }
    }

    if ((paymentMethod === 'bkash' || paymentMethod === 'nagad') && !transactionId) {
      res.status(400).json({
        error: `Please enter your ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} Transaction ID (TrxID). Never enter your PIN or OTP.`,
      });
      return;
    }

    const paySetting = db.prepare(`SELECT * FROM payment_settings WHERE gateway = ?`).get(paymentMethod) as any;
    if (!paySetting || paySetting.is_enabled !== 1) {
      res.status(400).json({ error: 'Selected payment method is currently disabled.' });
      return;
    }

    const txResult = db.transaction(() => {
      let subtotal = 0;
      const preparedItems: Array<{
        productId: number;
        name: string;
        image: string;
        sku: string;
        colorName: string;
        sizeLabel: string;
        modelName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        colorId: number | null;
        sizeId: number | null;
        variationId: number | null;
      }> = [];

      for (const reqItem of items) {
        const prod = getProductById(Number(reqItem.product_id));
        if (!prod) {
          throw new Error(`Product #${reqItem.product_id} does not exist.`);
        }
        if (prod.product_type !== 'own') {
          throw new Error(`${prod.name} is an affiliate partner product and cannot be ordered via SHOPNEXA ROBI HUB checkout.`);
        }
        const qty = Math.max(1, Number(reqItem.quantity || 1));

        const selectedColor = reqItem.color_id ? prod.colors.find((c) => c.id === Number(reqItem.color_id)) : undefined;
        const selectedSize = reqItem.size_id ? prod.sizes.find((s) => s.id === Number(reqItem.size_id)) : undefined;
        const selectedVar = reqItem.variation_id
          ? prod.variations.find((v) => v.id === Number(reqItem.variation_id))
          : undefined;

        const availableStock = selectedVar
          ? selectedVar.stock
          : selectedColor && selectedSize
          ? Math.min(selectedColor.stock, selectedSize.stock)
          : selectedColor
          ? selectedColor.stock
          : selectedSize
          ? selectedSize.stock
          : prod.total_stock;

        if (availableStock < qty) {
          throw new Error(`Insufficient stock for ${prod.name}. Available: ${availableStock}`);
        }

        const rawUnitPrice =
          selectedVar?.price ??
          selectedSize?.price_override ??
          selectedColor?.price_override ??
          (prod.sale_price > 0 ? prod.sale_price : prod.selling_price);

        const unitPrice = convertCurrencyServer(rawUnitPrice, prod.currency || 'USD', 'USD');
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotal += lineTotal;

        preparedItems.push({
          productId: prod.id,
          name: prod.name,
          image: selectedVar?.image_url || selectedColor?.images?.[0] || prod.images[0] || '',
          sku: selectedVar?.sku || selectedColor?.sku || prod.sku,
          colorName: selectedColor?.name || selectedVar?.color_name || '',
          sizeLabel: selectedSize?.label || selectedVar?.size_label || '',
          modelName: selectedVar?.model_name || selectedVar?.variant_name || '',
          quantity: qty,
          unitPrice,
          lineTotal,
          colorId: selectedColor?.id ?? null,
          sizeId: selectedSize?.id ?? null,
          variationId: selectedVar?.id ?? null,
        });
      }

      let discountAmount = 0;
      let appliedCoupon = '';
      if (couponCode) {
        const coupon = db.prepare(`SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1`).get(couponCode) as any;
        if (
          coupon &&
          (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= Date.now()) &&
          coupon.used_count < coupon.max_uses &&
          subtotal >= coupon.min_order_value
        ) {
          discountAmount =
            coupon.discount_type === 'percentage'
              ? Number(((subtotal * coupon.discount_value) / 100).toFixed(2))
              : Math.min(subtotal, coupon.discount_value);
          appliedCoupon = coupon.code;
          db.prepare(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`).run(coupon.id);
        }
      }

      const zones = db.prepare(`SELECT * FROM shipping_zones WHERE is_active = 1`).all() as any[];
      const zone =
        zones.find(
          (z) =>
            z.country.toLowerCase() === country.toLowerCase() &&
            z.district.toLowerCase() === String(address.district || '').toLowerCase()
        ) ||
        zones.find((z) => z.country.toLowerCase() === country.toLowerCase()) ||
        zones.find((z) => z.country.toLowerCase() === 'international');

      const shippingCharge =
        zone && (zone.free_shipping_threshold === 0 || subtotal < zone.free_shipping_threshold)
          ? Number(zone.base_fee || 0)
          : 0;
      const estimatedDelivery = zone?.estimated_days || '3–7 Business Days';
      const taxAmount = 0;
      const finalTotal = Number(Math.max(0, subtotal - discountAmount + shippingCharge + taxAmount).toFixed(2));
      const orderNumber = `SNX-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const orderRes = db
        .prepare(
          `INSERT INTO orders (
            order_number, user_id, customer_name, customer_email, customer_phone, alt_phone,
            address_json, country, payment_method, payment_status, transaction_id, gateway_reference,
            order_status, subtotal, discount_amount, coupon_code, shipping_charge, tax_amount, final_total,
            currency, estimated_delivery, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, '', 'Pending', ?, ?, ?, ?, ?, ?, 'USD', ?, ?)`
        )
        .run(
          orderNumber,
          req.auth?.userId ?? null,
          customerName,
          customerEmail,
          customerPhone,
          sanitizeString(address.alt_phone, 40),
          JSON.stringify(address),
          country,
          paymentMethod,
          transactionId,
          subtotal,
          discountAmount,
          appliedCoupon,
          shippingCharge,
          taxAmount,
          finalTotal,
          estimatedDelivery,
          sanitizeString(b.notes, 300)
        );

      const orderId = Number(orderRes.lastInsertRowid);
      const insItem = db.prepare(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_image, sku, color_name, size_label, model_name, quantity, unit_price, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const pItem of preparedItems) {
        insItem.run(
          orderId,
          pItem.productId,
          pItem.name,
          pItem.image,
          pItem.sku,
          pItem.colorName,
          pItem.sizeLabel,
          pItem.modelName,
          pItem.quantity,
          pItem.unitPrice,
          pItem.lineTotal
        );
        if (pItem.variationId) {
          db.prepare(`UPDATE product_variations SET stock = MAX(0, stock - ?) WHERE id = ?`).run(
            pItem.quantity,
            pItem.variationId
          );
        }
        if (pItem.colorId) {
          db.prepare(`UPDATE product_colors SET stock = MAX(0, stock - ?) WHERE id = ?`).run(
            pItem.quantity,
            pItem.colorId
          );
        }
        if (pItem.sizeId) {
          db.prepare(`UPDATE product_sizes SET stock = MAX(0, stock - ?) WHERE id = ?`).run(
            pItem.quantity,
            pItem.sizeId
          );
        }
        if (!pItem.variationId && !pItem.colorId && !pItem.sizeId) {
          db.prepare(`UPDATE products SET total_stock = MAX(0, total_stock - ?) WHERE id = ?`).run(
            pItem.quantity,
            pItem.productId
          );
        }
        recalculateProductMetrics(pItem.productId);

        const updatedProd = db.prepare(`SELECT name, total_stock, low_stock_threshold FROM products WHERE id = ?`).get(
          pItem.productId
        ) as { name: string; total_stock: number; low_stock_threshold: number };
        if (updatedProd.total_stock <= updatedProd.low_stock_threshold) {
          void sendTelegramAlert(
            'low_stock',
            `Low Stock Warning: ${updatedProd.name} has ${updatedProd.total_stock} units remaining.`
          );
        }
      }

      db.prepare(
        `INSERT INTO payment_records (order_id, gateway, transaction_id, amount, currency, status, notes)
         VALUES (?, ?, ?, ?, 'USD', 'pending', ?)`
      ).run(orderId, paymentMethod, transactionId, finalTotal, 'Order placed via SHOPNEXA ROBI HUB checkout');

      if (req.auth?.userId) {
        db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.auth.userId);
        createNotification(
          req.auth.userId,
          'order',
          `Order ${orderNumber} Placed`,
          `Thank you ${customerName}. Your order total is $${finalTotal.toFixed(2)} via ${paymentMethod.toUpperCase()}.`
        );
      }

      return { orderId, orderNumber, finalTotal };
    })();

    // Perform server-side payment gateway check outside SQLite transaction
    const verification = await verifyGatewayTransaction(
      paymentMethod,
      transactionId,
      txResult.finalTotal,
      paySetting.sandbox_mode === 1
    );

    if (verification.verified) {
      db.prepare(
        `UPDATE orders SET payment_status = 'verified', gateway_reference = ?, order_status = 'Confirmed' WHERE id = ?`
      ).run(verification.gatewayReference, txResult.orderId);
      db.prepare(
        `UPDATE payment_records SET status = 'verified', verified_by = 'Gateway API', verified_at = datetime('now'), notes = ? WHERE order_id = ?`
      ).run(verification.message, txResult.orderId);
      void sendTelegramAlert(
        'payment',
        `Payment Verified for ${txResult.orderNumber}: $${txResult.finalTotal.toFixed(2)} (${paymentMethod.toUpperCase()})`
      );
    }

    void sendTelegramAlert(
      'new_order',
      `New Order ${txResult.orderNumber}\nCustomer: ${customerName} (${country})\nTotal: $${txResult.finalTotal.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}`
    );

    const createdOrder = hydrateOrder(db.prepare(`SELECT * FROM orders WHERE id = ?`).get(txResult.orderId));
    res.status(201).json({ order: createdOrder, verification });
  } catch (err: any) {
    logServerError('/api/orders', err);
    res.status(400).json({ error: err?.message || 'Unable to place order' });
  }
});

app.get('/api/orders/my', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`).all(req.auth!.userId) as any[];
  res.json(rows.map(hydrateOrder));
});

app.get('/api/orders/track/:orderNumber', (req, res) => {
  const orderNumber = sanitizeString(req.params.orderNumber, 60).toUpperCase();
  const row = db.prepare(`SELECT * FROM orders WHERE UPPER(order_number) = ?`).get(orderNumber) as any;
  if (!row) {
    res.status(404).json({ error: 'No order found matching that Order ID.' });
    return;
  }
  const order = hydrateOrder(row);
  let courierTrackingUrl = '';
  if (order.courier_id && order.tracking_number) {
    const courierRow = db
      .prepare(`SELECT tracking_url_template FROM couriers WHERE id = ?`)
      .get(order.courier_id) as { tracking_url_template?: string } | undefined;
    const tmpl = courierRow?.tracking_url_template?.trim() || '';
    if (tmpl) {
      const candidate = tmpl
        .replace(/\{tracking(_number)?\}/gi, encodeURIComponent(order.tracking_number))
        .replace(/%s/g, encodeURIComponent(order.tracking_number));
      const finalUrl = candidate === tmpl ? `${tmpl}${encodeURIComponent(order.tracking_number)}` : candidate;
      if (isValidSafeUrl(finalUrl)) {
        courierTrackingUrl = finalUrl;
      }
    }
  }
  const addr = order.address || ({} as any);
  res.json({
    order_number: order.order_number,
    order_status: order.order_status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    tracking_number: order.tracking_number,
    courier_name: order.courier_name,
    courier_tracking_url: courierTrackingUrl,
    estimated_delivery: order.estimated_delivery,
    final_total: order.final_total,
    currency: order.currency,
    created_at: order.created_at,
    updated_at: order.updated_at,
    delivery_destination: {
      country: order.country || addr.country || '',
      division: addr.division || '',
      district: addr.district || '',
      upazila: addr.upazila || '',
      thana: addr.thana || '',
      post_office: addr.post_office || '',
      union_name: addr.union_name || '',
      municipality: addr.municipality || '',
      city: addr.city || '',
      village: addr.village || '',
      area: addr.area || '',
      postal_code: addr.postal_code || '',
    },
    items: order.items,
  });
});

// ---------- NOTIFICATIONS ----------
app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40`)
    .all(req.auth!.userId) as any[];
  res.json(rows.map((r) => ({ ...r, is_read: r.is_read === 1 })));
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.auth!.userId);
  res.json({ success: true });
});

// ---------- CUSTOMER REVIEWS & Q&A ----------
app.get('/api/reviews/:productId', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY id DESC`)
    .all(Number(req.params.productId)) as any[];
  res.json(
    rows.map((r) => ({
      ...r,
      images: JSON.parse(r.images_json || '[]'),
      is_verified_purchase: r.is_verified_purchase === 1,
    }))
  );
});

app.post('/api/reviews', (req: AuthenticatedRequest, res) => {
  const b = req.body || {};
  const productId = Number(b.product_id);
  const authorName = sanitizeString(b.author_name, 80);
  const comment = sanitizeString(b.comment, 1500);
  const question = sanitizeString(b.question, 600);
  const rating = b.question ? 0 : Math.min(5, Math.max(1, Number(b.rating || 5)));

  if (!productId || !authorName || (!comment && !question)) {
    res.status(400).json({ error: 'Product, author name, and review comment or question are required.' });
    return;
  }

  let isVerifiedPurchase = 0;
  if (req.auth?.userId) {
    const purchased = db
      .prepare(
        `SELECT o.id FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.user_id = ? AND oi.product_id = ?`
      )
      .get(req.auth.userId, productId);
    if (purchased) isVerifiedPurchase = 1;
  }

  const images = Array.isArray(b.images) ? b.images.filter((u: string) => isValidSafeUrl(u)).slice(0, 4) : [];

  const result = db
    .prepare(
      `INSERT INTO reviews (
        product_id, user_id, author_name, rating, title, comment, images_json, question, is_verified_purchase, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`
    )
    .run(
      productId,
      req.auth?.userId ?? null,
      authorName,
      rating,
      sanitizeString(b.title, 120),
      comment,
      JSON.stringify(images),
      question,
      isVerifiedPurchase
    );

  recalculateProductRating(productId);
  const created = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(result.lastInsertRowid) as any;
  res.status(201).json({
    ...created,
    images: JSON.parse(created.images_json || '[]'),
    is_verified_purchase: created.is_verified_purchase === 1,
  });
});

// ---------- NEWSLETTER ----------
app.post('/api/newsletter', (req, res) => {
  const email = sanitizeString(req.body.email, 160).toLowerCase();
  const language = sanitizeString(req.body.language || 'en', 10);
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  db.prepare(`INSERT OR IGNORE INTO newsletter_subscribers (email, language) VALUES (?, ?)`).run(email, language);
  res.json({ message: 'Subscribed to SHOPNEXA ROBI HUB releases and private offers.' });
});

// ============================================================================
// PROTECTED ADMIN ROUTES
// ============================================================================
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days || 30)));
  const orders = db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all() as any[];
  const products = getAllProducts();
  const customers = db
    .prepare(`SELECT id, name, email, phone, role, avatar_url, status, created_at FROM users WHERE role = 'customer' ORDER BY id DESC`)
    .all();
  const clicks = db.prepare(`SELECT * FROM affiliate_clicks ORDER BY id DESC`).all() as any[];

  const totalRevenue = orders
    .filter((o) => !['Cancelled', 'Refunded'].includes(o.order_status))
    .reduce((sum, o) => sum + Number(o.final_total || 0), 0);

  const ownProducts = products.filter((p) => p.product_type === 'own');
  const affiliateProducts = products.filter((p) => p.product_type === 'affiliate');
  const totalStock = ownProducts.reduce((sum, p) => sum + p.total_stock, 0);
  const lowStockProducts = ownProducts.filter((p) => p.total_stock <= p.low_stock_threshold);

  // Daily revenue buckets for chart
  const cutoff = Date.now() - days * 86400000;
  const chartMap = new Map<string, { date: string; revenue: number; orders: number; clicks: number }>();
  for (const o of orders) {
    const t = new Date(o.created_at).getTime();
    if (t >= cutoff) {
      const day = o.created_at.slice(0, 10);
      const entry = chartMap.get(day) || { date: day, revenue: 0, orders: 0, clicks: 0 };
      if (!['Cancelled', 'Refunded'].includes(o.order_status)) {
        entry.revenue += Number(o.final_total || 0);
      }
      entry.orders += 1;
      chartMap.set(day, entry);
    }
  }
  for (const c of clicks) {
    const t = new Date(c.clicked_at).getTime();
    if (t >= cutoff) {
      const day = c.clicked_at.slice(0, 10);
      const entry = chartMap.get(day) || { date: day, revenue: 0, orders: 0, clicks: 0 };
      entry.clicks += 1;
      chartMap.set(day, entry);
    }
  }

  res.json({
    metrics: {
      totalSales: orders.filter((o) => o.order_status !== 'Cancelled').length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.order_status === 'Pending').length,
      confirmedOrders: orders.filter((o) => o.order_status === 'Confirmed').length,
      deliveredOrders: orders.filter((o) => o.order_status === 'Delivered').length,
      cancelledOrders: orders.filter((o) => o.order_status === 'Cancelled').length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      ownProductCount: ownProducts.length,
      affiliateProductCount: affiliateProducts.length,
      totalStock,
      lowStockCount: lowStockProducts.length,
      affiliateClicks: clicks.length,
    },
    lowStockProducts,
    recentOrders: orders.slice(0, 10).map(hydrateOrder),
    recentCustomers: customers.slice(0, 10),
    salesSeries: Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  });
});

// Admin Category CRUD
app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const name = sanitizeString(req.body.name, 80);
  if (!name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  const slug =
    sanitizeString(req.body.slug, 80) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  const result = db
    .prepare(`INSERT INTO categories (name, slug, description, image_url, sort_order, is_featured) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(
      name,
      slug,
      sanitizeString(req.body.description, 300),
      sanitizeString(req.body.image_url, 500),
      Number(req.body.sort_order || 99),
      req.body.is_featured ? 1 : 0
    );
  res.status(201).json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(result.lastInsertRowid));
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  try {
    db.prepare(`DELETE FROM categories WHERE id = ?`).run(Number(req.params.id));
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Cannot delete a category that currently holds products.' });
  }
});

// Admin Product CRUD (Own & Affiliate)
function upsertProductChildren(productId: number, b: any): void {
  db.prepare(`DELETE FROM product_variations WHERE product_id = ?`).run(productId);
  db.prepare(`DELETE FROM product_colors WHERE product_id = ?`).run(productId);
  db.prepare(`DELETE FROM product_sizes WHERE product_id = ?`).run(productId);

  const colors = Array.isArray(b.colors) ? b.colors : [];
  const sizes = Array.isArray(b.sizes) ? b.sizes : [];
  const variations = Array.isArray(b.variations) ? b.variations : [];

  const insColor = db.prepare(
    `INSERT INTO product_colors (product_id, name, hex_code, images_json, is_available, stock, sku, price_override) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const colorIdByName = new Map<string, number>();
  for (const c of colors) {
    const res = insColor.run(
      productId,
      sanitizeString(c.name, 60),
      sanitizeString(c.hex_code || '#09090B', 20),
      JSON.stringify(Array.isArray(c.images) ? c.images : []),
      c.is_available === false ? 0 : 1,
      Math.max(0, Number(c.stock || 0)),
      sanitizeString(c.sku, 60),
      c.price_override !== null && c.price_override !== '' && c.price_override !== undefined
        ? Number(c.price_override)
        : null
    );
    colorIdByName.set(String(c.name || ''), Number(res.lastInsertRowid));
  }

  const insSize = db.prepare(
    `INSERT INTO product_sizes (product_id, category_type, size_system, label, measurements_json, stock, price_override, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const sizeIdByLabel = new Map<string, number>();
  for (const s of sizes) {
    const res = insSize.run(
      productId,
      sanitizeString(s.category_type || 'general', 30),
      sanitizeString(s.size_system || 'Standard', 30),
      sanitizeString(s.label, 60),
      JSON.stringify(s.measurements || {}),
      Math.max(0, Number(s.stock || 0)),
      s.price_override !== null && s.price_override !== '' && s.price_override !== undefined
        ? Number(s.price_override)
        : null,
      s.is_available === false ? 0 : 1
    );
    sizeIdByLabel.set(String(s.label || ''), Number(res.lastInsertRowid));
  }

  const insVar = db.prepare(
    `INSERT INTO product_variations (
      product_id, color_id, size_id, model_number, model_name, style, design, pattern, version, material, variant_name, image_url, sku, price, stock, is_available
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const v of variations) {
    const resolvedColorId = v.color_id || (v.color_name ? colorIdByName.get(v.color_name) ?? null : null);
    const resolvedSizeId = v.size_id || (v.size_label ? sizeIdByLabel.get(v.size_label) ?? null : null);
    insVar.run(
      productId,
      resolvedColorId,
      resolvedSizeId,
      sanitizeString(v.model_number, 60),
      sanitizeString(v.model_name, 80),
      sanitizeString(v.style, 60),
      sanitizeString(v.design, 60),
      sanitizeString(v.pattern, 60),
      sanitizeString(v.version, 60),
      sanitizeString(v.material, 80),
      sanitizeString(v.variant_name, 120),
      sanitizeString(v.image_url, 500),
      sanitizeString(v.sku, 60),
      Number(v.price || 0),
      Math.max(0, Number(v.stock || 0)),
      v.is_available === false ? 0 : 1
    );
  }

  recalculateProductMetrics(productId);
}

app.get('/api/admin/upload-diagnostics', requireAdmin, (_req, res) => {
  let dbConnected = false;
  let categoriesCount = 0;
  let productsCount = 0;
  let recentUploadErrors = 0;
  try {
    const integrity = db.pragma('quick_check') as Array<{ quick_check?: string }>;
    dbConnected = Boolean(integrity.length && integrity[0]?.quick_check === 'ok');
    categoriesCount = (db.prepare(`SELECT COUNT(*) AS cnt FROM categories`).get() as { cnt: number }).cnt;
    productsCount = (db.prepare(`SELECT COUNT(*) AS cnt FROM products`).get() as { cnt: number }).cnt;
    recentUploadErrors = (
      db.prepare(`SELECT COUNT(*) AS cnt FROM error_logs WHERE route LIKE '%product%' OR route LIKE '%upload%'`).get() as {
        cnt: number;
      }
    ).cnt;
  } catch {
    dbConnected = false;
  }

  let uploadsWritable = false;
  try {
    fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
    uploadsWritable = true;
  } catch {
    uploadsWritable = false;
  }

  res.json({
    ok: dbConnected && uploadsWritable && categoriesCount > 0,
    db_connected: dbConnected,
    uploads_writable: uploadsWritable,
    max_file_size_mb: 20,
    categories_count: categoriesCount,
    products_count: productsCount,
    recent_upload_errors: recentUploadErrors,
    supported_formats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
  });
});

app.get('/api/admin/products/:id/verify', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const verification = verifyProductUpload(id, UPLOADS_DIR);
  res.status(verification.passed ? 200 : 422).json(verification);
});

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  res.json(getAllProducts());
});

function validateProductInput(
  b: any,
  isUpdate: boolean,
  existingProduct?: ReturnType<typeof getProductById>
):
  | {
      ok: true;
      data: {
        name: string;
        productType: 'own' | 'affiliate';
        categoryId: number;
        status: 'active' | 'draft' | 'out_of_stock';
        currency: string;
        originalPrice: number;
        sellingPrice: number;
        salePrice: number;
        wholesalePrice: number;
        shippingCost: number;
        totalStock: number;
        images: string[];
        videoUrl: string;
        affiliateUrl: string;
        colors: any[];
        sizes: any[];
        variations: any[];
      };
    }
  | {
      ok: false;
      status: number;
      field: string;
      code: string;
      error: string;
      fixHint: string;
    } {
  const name = sanitizeString(b.name ?? existingProduct?.name, 200);
  if (!name) {
    return {
      ok: false,
      status: 400,
      field: 'name',
      code: 'NAME_REQUIRED',
      error: 'পণ্যের নাম দেওয়া আবশ্যক।',
      fixHint: 'অনুগ্রহ করে "পণ্যের নাম" ঘরে পণ্যের স্পষ্ট নাম লিখুন।',
    };
  }

  const productType = (b.product_type ?? existingProduct?.product_type) === 'affiliate' ? 'affiliate' : 'own';
  const rawStatus = sanitizeString(b.status ?? existingProduct?.status ?? 'active', 20);
  const status: 'active' | 'draft' | 'out_of_stock' =
    rawStatus === 'draft' || rawStatus === 'out_of_stock' ? rawStatus : 'active';

  const categoryId = parseSafeNumber(b.category_id ?? existingProduct?.category_id, 0);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return {
      ok: false,
      status: 400,
      field: 'category_id',
      code: 'CATEGORY_INVALID',
      error: 'সঠিক ক্যাটাগরি নির্বাচন করা হয়নি।',
      fixHint: 'তালিকা থেকে একটি বৈধ ক্যাটাগরি নির্বাচন করুন।',
    };
  }
  const catRow = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(categoryId);
  if (!catRow) {
    return {
      ok: false,
      status: 400,
      field: 'category_id',
      code: 'CATEGORY_NOT_FOUND',
      error: 'নির্বাচিত ক্যাটাগরিটি ডাটাবেজে পাওয়া যায়নি।',
      fixHint: 'অনুগ্রহ করে পেজটি রিলোড করে বিদ্যমান ক্যাটাগরি থেকে একটি বাছাই করুন।',
    };
  }

  const currency = sanitizeString(b.currency ?? existingProduct?.currency ?? 'BDT', 10).toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    return {
      ok: false,
      status: 400,
      field: 'currency',
      code: 'INVALID_CURRENCY',
      error: `অসমর্থিত কারেন্সি (${currency})।`,
      fixHint: 'কারেন্সি হিসেবে BDT (৳) অথবা USD ($) নির্বাচন করুন।',
    };
  }

  const rawSelling = parseSafeNumber(
    b.selling_price !== undefined ? b.selling_price : existingProduct?.selling_price ?? 0,
    0
  );
  const rawOriginal = parseSafeNumber(
    b.original_price !== undefined ? b.original_price : existingProduct?.original_price ?? rawSelling,
    rawSelling
  );
  const rawSale = parseSafeNumber(
    b.sale_price !== undefined && b.sale_price !== '' ? b.sale_price : rawSelling,
    rawSelling
  );
  const rawWholesale = parseSafeNumber(
    b.wholesale_price !== undefined ? b.wholesale_price : existingProduct?.wholesale_price ?? 0,
    0
  );
  const rawShipping = parseSafeNumber(
    b.shipping_cost !== undefined ? b.shipping_cost : existingProduct?.shipping_cost ?? 0,
    0
  );

  if (
    Number.isNaN(rawSelling) ||
    Number.isNaN(rawOriginal) ||
    Number.isNaN(rawSale) ||
    Number.isNaN(rawWholesale) ||
    Number.isNaN(rawShipping)
  ) {
    return {
      ok: false,
      status: 400,
      field: 'selling_price',
      code: 'PRICE_NAN',
      error: 'দামের ঘরে সঠিক সংখ্যা দেওয়া হয়নি।',
      fixHint: 'দামের ঘরে শুধু সংখ্যা লিখুন (যেমন: 1081 বা ১০৮১), কোনো অক্ষর লিখবেন না।',
    };
  }

  if (rawSelling < 0 || rawOriginal < 0 || rawSale < 0 || rawWholesale < 0 || rawShipping < 0) {
    return {
      ok: false,
      status: 400,
      field: 'selling_price',
      code: 'PRICE_NEGATIVE',
      error: 'পণ্যের দাম ঋণাত্মক হতে পারবে না।',
      fixHint: '০ বা তার বেশি বৈধ মূল্য লিখুন।',
    };
  }

  if (status === 'active' && rawSelling <= 0 && rawSale <= 0) {
    return {
      ok: false,
      status: 400,
      field: 'selling_price',
      code: 'ACTIVE_PRICE_REQUIRED',
      error: 'পণ্য মূল পেজে প্রকাশ করতে হলে বিক্রয় মূল্য ০-এর বেশি হতে হবে।',
      fixHint: 'বিক্রয় মূল্য / সেল প্রাইজ দিন অথবা পণ্যটি খসড়া (Draft) হিসেবে সেভ করুন।',
    };
  }

  const sellingPrice = rawSelling > 0 ? rawSelling : rawSale > 0 ? rawSale : rawOriginal;
  const salePrice = rawSale > 0 ? rawSale : sellingPrice;
  const originalPrice = rawOriginal >= salePrice ? rawOriginal : sellingPrice;

  const affiliateUrl = sanitizeString(b.affiliate_url ?? existingProduct?.affiliate_url ?? '', 1000);
  if (productType === 'affiliate') {
    if (!affiliateUrl || !isValidSafeUrl(affiliateUrl) || !/^https?:\/\//i.test(affiliateUrl)) {
      return {
        ok: false,
        status: 400,
        field: 'affiliate_url',
        code: 'INVALID_AFFILIATE_URL',
        error: 'অ্যাফিলিয়েট পণ্যের জন্য সঠিক AliExpress / পার্টনার লিংক (http:// বা https://) প্রয়োজন।',
        fixHint: 'সম্পূর্ণ সঠিক লিংক দিন, যেমন: https://s.click.aliexpress.com/...',
      };
    }
  } else if (affiliateUrl && !isValidSafeUrl(affiliateUrl)) {
    return {
      ok: false,
      status: 400,
      field: 'affiliate_url',
      code: 'INVALID_URL',
      error: 'প্রদত্ত অ্যাফিলিয়েট লিংকটি সঠিক নয়।',
      fixHint: 'সঠিক http:// বা https:// লিংক দিন।',
    };
  }

  const imagesRaw = Array.isArray(b.images) ? b.images : existingProduct?.images ?? [];
  const images: string[] = [];
  for (const img of imagesRaw) {
    const clean = sanitizeString(img, 500);
    if (!clean) continue;
    if (!isValidSafeUrl(clean)) {
      return {
        ok: false,
        status: 400,
        field: 'images',
        code: 'INVALID_IMAGE_URL',
        error: `ছবির লিংকটি বৈধ নয়: ${clean.slice(0, 60)}`,
        fixHint: 'ছবিটি ডিভাইস থেকে আপলোড করুন অথবা সঠিক https:// বা /uploads/ লিংক ব্যবহার করুন।',
      };
    }
    images.push(clean);
  }

  const videoUrl = sanitizeString(b.video_url ?? existingProduct?.video_url ?? '', 500);
  if (videoUrl && !isValidSafeUrl(videoUrl)) {
    return {
      ok: false,
      status: 400,
      field: 'video_url',
      code: 'INVALID_VIDEO_URL',
      error: 'ভিডিওর লিংকটি বৈধ নয়।',
      fixHint: 'সঠিক MP4/WebM ভিডিও আপলোড করুন বা বৈধ https:// লিংক দিন।',
    };
  }

  const totalStock = parseSafeNumber(
    b.total_stock !== undefined ? b.total_stock : existingProduct?.total_stock ?? 20,
    20
  );
  if (Number.isNaN(totalStock) || totalStock < 0) {
    return {
      ok: false,
      status: 400,
      field: 'total_stock',
      code: 'INVALID_STOCK',
      error: 'স্টকের পরিমাণ ০ বা তার বেশি হতে হবে।',
      fixHint: 'সঠিক স্টক সংখ্যা লিখুন (যেমন: 20 বা ২০)।',
    };
  }

  const rawColors = Array.isArray(b.colors) ? b.colors : existingProduct?.colors ?? [];
  const colors = rawColors
    .filter((c: any) => sanitizeString(c?.name, 60))
    .map((c: any) => ({
      ...c,
      name: sanitizeString(c.name, 60),
      hex_code: /^#[0-9a-fA-F]{3,8}$/.test(String(c.hex_code || '')) ? String(c.hex_code) : '#09090B',
      images: Array.isArray(c.images) ? c.images.filter((u: any) => isValidSafeUrl(String(u))) : [],
      stock: Math.max(0, Math.round(parseSafeNumber(c.stock, 10) || 0)),
      price_override:
        c.price_override !== null && c.price_override !== '' && c.price_override !== undefined
          ? parseSafeNumber(c.price_override, 0)
          : null,
      is_available: c.is_available !== false,
    }));

  const rawSizes = Array.isArray(b.sizes) ? b.sizes : existingProduct?.sizes ?? [];
  const sizes = rawSizes
    .filter((s: any) => sanitizeString(s?.label, 60))
    .map((s: any) => ({
      ...s,
      category_type: sanitizeString(s.category_type || 'general', 30),
      size_system: sanitizeString(s.size_system || 'Standard', 30),
      label: sanitizeString(s.label, 60),
      stock: Math.max(0, Math.round(parseSafeNumber(s.stock, 10) || 0)),
      price_override:
        s.price_override !== null && s.price_override !== '' && s.price_override !== undefined
          ? parseSafeNumber(s.price_override, 0)
          : null,
      is_available: s.is_available !== false,
    }));

  const rawVars = Array.isArray(b.variations) ? b.variations : existingProduct?.variations ?? [];
  const variations = rawVars.map((v: any) => ({
    ...v,
    price: Math.max(0, parseSafeNumber(v.price, salePrice) || salePrice),
    stock: Math.max(0, Math.round(parseSafeNumber(v.stock, 10) || 0)),
    is_available: v.is_available !== false,
  }));

  if (!isUpdate && rawColors.some((c: any) => !sanitizeString(c?.name, 60))) {
    return {
      ok: false,
      status: 400,
      field: 'colors',
      code: 'COLOR_NAME_REQUIRED',
      error: 'যোগ করা প্রতিটি রঙের নাম দিতে হবে।',
      fixHint: 'খালি রঙের ঘরের নাম লিখুন অথবা অপ্রয়োজনীয় রঙটি মুছে দিন।',
    };
  }
  if (!isUpdate && rawSizes.some((s: any) => !sanitizeString(s?.label, 60))) {
    return {
      ok: false,
      status: 400,
      field: 'sizes',
      code: 'SIZE_LABEL_REQUIRED',
      error: 'যোগ করা প্রতিটি সাইজের নাম/নম্বর দিতে হবে।',
      fixHint: 'খালি সাইজের ঘর পূরণ করুন অথবা মুছে দিন।',
    };
  }

  return {
    ok: true,
    data: {
      name,
      productType,
      categoryId,
      status,
      currency,
      originalPrice,
      sellingPrice,
      salePrice,
      wholesalePrice: rawWholesale,
      shippingCost: rawShipping,
      totalStock: Math.round(totalStock),
      images,
      videoUrl,
      affiliateUrl,
      colors,
      sizes,
      variations,
    },
  };
}

app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const b = req.body || {};
    const requestId = sanitizeString(b.request_id, 80);

    if (requestId) {
      const existingByReq = db.prepare(`SELECT id FROM products WHERE request_id = ?`).get(requestId) as
        | { id: number }
        | undefined;
      if (existingByReq) {
        const existingProd = getProductById(existingByReq.id);
        if (existingProd) {
          const verification = verifyProductUpload(existingProd.id, UPLOADS_DIR);
          res.status(200).json({ ...existingProd, idempotent: true, verification });
          return;
        }
      }
    }

    const validated = validateProductInput(b, false);
    if (validated.ok === false) {
      productError(
        res,
        validated.status,
        validated.field,
        validated.code,
        validated.error,
        validated.fixHint
      );
      return;
    }

    const v = validated.data;
    const discountAmount = Math.max(0, Number((v.originalPrice - v.salePrice).toFixed(2)));
    const discountPercentage = v.originalPrice > 0 ? Math.round((discountAmount / v.originalPrice) * 100) : 0;

    const productCode = sanitizeString(b.product_code, 60) || `SNX-${Date.now().toString().slice(-6)}`;
    const sku = sanitizeString(b.sku, 60) || `SKU-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const duplicateCode = db.prepare(`SELECT id FROM products WHERE product_code = ?`).get(productCode);
    if (duplicateCode) {
      productError(
        res,
        409,
        'product_code',
        'DUPLICATE_PRODUCT_CODE',
        `প্রোডাক্ট কোড "${productCode}" আগে থেকেই ব্যবহৃত হয়েছে।`,
        'প্রোডাক্ট কোড ঘরটি খালি রাখুন (অটো তৈরি হবে) অথবা নতুন একটি কোড দিন।'
      );
      return;
    }

    const normalizedChildren = {
      ...b,
      colors: v.colors,
      sizes: v.sizes,
      variations: v.variations,
    };

    const pid = db.transaction(() => {
      const ins = db
        .prepare(
          `INSERT INTO products (
            product_code, sku, name, brand, manufacturer, product_type, category_id, subcategory,
            short_description, full_description, highlights_json, country_of_origin, images_json, video_url,
            status, is_featured, is_new_arrival, is_trending, is_best_seller, is_special_offer, is_recommended, collection_tag,
            original_price, selling_price, discount_amount, discount_percentage, sale_price, currency, wholesale_price, shipping_cost, tax_rate, tax_info,
            package_contents, number_of_pieces, package_quantity, package_length, package_width, package_height, package_weight, shipping_weight, included_accessories,
            specs_json, size_chart_json, total_stock, low_stock_threshold, affiliate_url, estimated_delivery, shipping_info, return_policy, request_id
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?
          )`
        )
        .run(
          productCode,
          sku,
          v.name,
          sanitizeString(b.brand, 100),
          sanitizeString(b.manufacturer, 100),
          v.productType,
          v.categoryId,
          sanitizeString(b.subcategory, 100),
          sanitizeString(b.short_description, 400),
          sanitizeString(b.full_description, 5000),
          JSON.stringify(Array.isArray(b.highlights) ? b.highlights : []),
          sanitizeString(b.country_of_origin, 80),
          JSON.stringify(v.images),
          v.videoUrl,
          v.status,
          b.is_featured === undefined ? 1 : b.is_featured ? 1 : 0,
          b.is_new_arrival === undefined ? 1 : b.is_new_arrival ? 1 : 0,
          b.is_trending ? 1 : 0,
          b.is_best_seller ? 1 : 0,
          b.is_special_offer ? 1 : 0,
          b.is_recommended === undefined ? 1 : b.is_recommended ? 1 : 0,
          sanitizeString(b.collection_tag, 80),
          v.originalPrice,
          v.sellingPrice,
          discountAmount,
          discountPercentage,
          v.salePrice,
          v.currency,
          v.wholesalePrice,
          v.shippingCost,
          Math.max(0, parseSafeNumber(b.tax_rate, 0) || 0),
          sanitizeString(b.tax_info, 160),
          sanitizeString(b.package_contents, 500),
          Math.max(1, Math.round(parseSafeNumber(b.number_of_pieces, 1) || 1)),
          Math.max(1, Math.round(parseSafeNumber(b.package_quantity, 1) || 1)),
          sanitizeString(b.package_length, 40),
          sanitizeString(b.package_width, 40),
          sanitizeString(b.package_height, 40),
          sanitizeString(b.package_weight, 40),
          sanitizeString(b.shipping_weight, 40),
          sanitizeString(b.included_accessories, 300),
          JSON.stringify(b.specs || {}),
          JSON.stringify(Array.isArray(b.size_chart) ? b.size_chart : []),
          v.totalStock,
          Math.max(0, Math.round(parseSafeNumber(b.low_stock_threshold, 5) || 5)),
          v.affiliateUrl,
          sanitizeString(b.estimated_delivery, 160),
          sanitizeString(b.shipping_info, 400),
          sanitizeString(b.return_policy, 400),
          requestId || null
        );
      const newPid = Number(ins.lastInsertRowid);
      upsertProductChildren(newPid, normalizedChildren);
      return newPid;
    })();

    const created = getProductById(pid);
    if (!created) {
      productError(
        res,
        500,
        'server',
        'READBACK_FAILED',
        'পণ্যটি সেভ হওয়ার পর ডাটাবেজ থেকে নিশ্চিত করা যায়নি।',
        'অ্যাডমিন তালিকা রিলোড করে দেখুন এবং প্রয়োজনে আবার চেষ্টা করুন।'
      );
      return;
    }

    const verification = verifyProductUpload(pid, UPLOADS_DIR, {
      expectedImages: v.images,
      expectedCountry: sanitizeString(b.country_of_origin, 80),
      expectedCurrency: v.currency,
      expectedColorCount: v.colors.length,
      expectedSizeCount: v.sizes.length,
      expectedVariationCount: v.variations.length,
      expectedStatus: v.status,
    });

    res.status(201).json({ ...created, verification });
  } catch (err: any) {
    logServerError('/api/admin/products POST', err);
    const rawMsg = err instanceof Error ? err.message : '';
    if (rawMsg.includes('UNIQUE constraint failed: products.product_code')) {
      productError(
        res,
        409,
        'product_code',
        'DUPLICATE_PRODUCT_CODE',
        'এই প্রোডাক্ট কোডটি আগে থেকেই বিদ্যমান।',
        'প্রোডাক্ট কোড খালি রাখুন অথবা নতুন একটি কোড লিখুন।'
      );
      return;
    }
    productError(
      res,
      400,
      'server',
      'SAVE_FAILED',
      'ডাটাবেজে পণ্য সংরক্ষণ করা যায়নি।',
      'সব বাধ্যতামূলক তথ্য (নাম, দাম, ক্যাটাগরি) সঠিকভাবে পূরণ করে আবার চেষ্টা করুন।'
    );
  }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getProductById(id);
    if (!existing) {
      productError(
        res,
        404,
        'product',
        'PRODUCT_NOT_FOUND',
        'সংশোধন করার জন্য পণ্যটি পাওয়া যায়নি।',
        'পেজটি রিলোড করে আবার চেষ্টা করুন।'
      );
      return;
    }

    const b = req.body || {};
    const validated = validateProductInput(b, true, existing);
    if (validated.ok === false) {
      productError(
        res,
        validated.status,
        validated.field,
        validated.code,
        validated.error,
        validated.fixHint
      );
      return;
    }

    const v = validated.data;
    const discountAmount = Math.max(0, Number((v.originalPrice - v.salePrice).toFixed(2)));
    const discountPercentage = v.originalPrice > 0 ? Math.round((discountAmount / v.originalPrice) * 100) : 0;
    const normalizedChildren = {
      ...b,
      colors: v.colors,
      sizes: v.sizes,
      variations: v.variations,
    };

    db.transaction(() => {
      db.prepare(
        `UPDATE products SET
          sku = ?, name = ?, brand = ?, manufacturer = ?, product_type = ?, category_id = ?, subcategory = ?,
          short_description = ?, full_description = ?, highlights_json = ?, country_of_origin = ?, images_json = ?, video_url = ?,
          status = ?, is_featured = ?, is_new_arrival = ?, is_trending = ?, is_best_seller = ?, is_special_offer = ?, is_recommended = ?, collection_tag = ?,
          original_price = ?, selling_price = ?, discount_amount = ?, discount_percentage = ?, sale_price = ?, currency = ?, wholesale_price = ?, shipping_cost = ?, tax_rate = ?, tax_info = ?,
          package_contents = ?, number_of_pieces = ?, package_quantity = ?, package_length = ?, package_width = ?, package_height = ?, package_weight = ?, shipping_weight = ?, included_accessories = ?,
          specs_json = ?, size_chart_json = ?, total_stock = ?, low_stock_threshold = ?, affiliate_url = ?, estimated_delivery = ?, shipping_info = ?, return_policy = ?, updated_at = datetime('now')
        WHERE id = ?`
      ).run(
        sanitizeString(b.sku ?? existing.sku, 60),
        v.name,
        sanitizeString(b.brand ?? existing.brand, 100),
        sanitizeString(b.manufacturer ?? existing.manufacturer, 100),
        v.productType,
        v.categoryId,
        sanitizeString(b.subcategory ?? existing.subcategory, 100),
        sanitizeString(b.short_description ?? existing.short_description, 400),
        sanitizeString(b.full_description ?? existing.full_description, 5000),
        JSON.stringify(Array.isArray(b.highlights) ? b.highlights : existing.highlights),
        sanitizeString(b.country_of_origin ?? existing.country_of_origin, 80),
        JSON.stringify(v.images),
        v.videoUrl,
        v.status,
        b.is_featured !== undefined ? (b.is_featured ? 1 : 0) : existing.is_featured ? 1 : 0,
        b.is_new_arrival !== undefined ? (b.is_new_arrival ? 1 : 0) : existing.is_new_arrival ? 1 : 0,
        b.is_trending !== undefined ? (b.is_trending ? 1 : 0) : existing.is_trending ? 1 : 0,
        b.is_best_seller !== undefined ? (b.is_best_seller ? 1 : 0) : existing.is_best_seller ? 1 : 0,
        b.is_special_offer !== undefined ? (b.is_special_offer ? 1 : 0) : existing.is_special_offer ? 1 : 0,
        b.is_recommended !== undefined ? (b.is_recommended ? 1 : 0) : existing.is_recommended ? 1 : 0,
        sanitizeString(b.collection_tag ?? existing.collection_tag, 80),
        v.originalPrice,
        v.sellingPrice,
        discountAmount,
        discountPercentage,
        v.salePrice,
        v.currency,
        v.wholesalePrice,
        v.shippingCost,
        Math.max(0, parseSafeNumber(b.tax_rate ?? existing.tax_rate, 0) || 0),
        sanitizeString(b.tax_info ?? existing.tax_info, 160),
        sanitizeString(b.package_contents ?? existing.package_contents, 500),
        Math.max(1, Math.round(parseSafeNumber(b.number_of_pieces ?? existing.number_of_pieces, 1) || 1)),
        Math.max(1, Math.round(parseSafeNumber(b.package_quantity ?? existing.package_quantity, 1) || 1)),
        sanitizeString(b.package_length ?? existing.package_length, 40),
        sanitizeString(b.package_width ?? existing.package_width, 40),
        sanitizeString(b.package_height ?? existing.package_height, 40),
        sanitizeString(b.package_weight ?? existing.package_weight, 40),
        sanitizeString(b.shipping_weight ?? existing.shipping_weight, 40),
        sanitizeString(b.included_accessories ?? existing.included_accessories, 300),
        JSON.stringify(b.specs ?? existing.specs),
        JSON.stringify(Array.isArray(b.size_chart) ? b.size_chart : existing.size_chart),
        v.totalStock,
        Math.max(0, Math.round(parseSafeNumber(b.low_stock_threshold ?? existing.low_stock_threshold, 5) || 5)),
        v.affiliateUrl,
        sanitizeString(b.estimated_delivery ?? existing.estimated_delivery, 160),
        sanitizeString(b.shipping_info ?? existing.shipping_info, 400),
        sanitizeString(b.return_policy ?? existing.return_policy, 400),
        id
      );
      upsertProductChildren(id, normalizedChildren);
    })();

    const updated = getProductById(id);
    if (!updated) {
      productError(
        res,
        500,
        'server',
        'UPDATE_READBACK_FAILED',
        'আপডেট করার পর পণ্যটি পাওয়া যায়নি।',
        'আবার চেষ্টা করুন।'
      );
      return;
    }

    const verification = verifyProductUpload(id, UPLOADS_DIR, {
      expectedImages: v.images,
      expectedCountry: sanitizeString(b.country_of_origin ?? existing.country_of_origin, 80),
      expectedCurrency: v.currency,
      expectedColorCount: v.colors.length,
      expectedSizeCount: v.sizes.length,
      expectedVariationCount: v.variations.length,
      expectedStatus: v.status,
    });

    res.json({ ...updated, verification });
  } catch (err: any) {
    logServerError('/api/admin/products PUT', err);
    productError(
      res,
      400,
      'server',
      'UPDATE_FAILED',
      'পণ্যটি আপডেট করা যায়নি।',
      'সব তথ্য যাচাই করে আবার সংরক্ষণ করার চেষ্টা করুন।'
    );
  }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getProductById(id);
    if (!existing) {
      productError(
        res,
        404,
        'product',
        'PRODUCT_NOT_FOUND',
        'মুছে ফেলার জন্য পণ্যটি পাওয়া যায়নি।',
        'তালিকা রিফ্রেশ করে আবার দেখুন।'
      );
      return;
    }
    db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
    res.json({ success: true, deletedId: id });
  } catch (err) {
    logServerError('/api/admin/products DELETE', err);
    productError(
      res,
      400,
      'product',
      'DELETE_REFERENCED',
      'এই পণ্যটি ইতিমধ্যে ক্রেতার অর্ডারে যুক্ত থাকায় স্থায়ীভাবে মুছে ফেলা যাবে না।',
      'পণ্যটি মুছে ফেলার বদলে এডিট করে স্ট্যাটাস "খসড়া (Draft)" করে দিন — তাহলে ওয়েবসাইট থেকে লুকানো থাকবে।'
    );
  }
});

// Admin Order Management
app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all() as any[];
  res.json(rows.map(hydrateOrder));
});

app.put('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const b = req.body || {};
  const nextStatus = sanitizeString(b.order_status || existing.order_status, 40) as OrderStatus;
  const nextPayStatus = sanitizeString(b.payment_status || existing.payment_status, 30) as PaymentStatus;
  const trackingNumber = sanitizeString(b.tracking_number ?? existing.tracking_number, 100);
  const courierId = b.courier_id !== undefined ? (b.courier_id ? Number(b.courier_id) : null) : existing.courier_id;

  db.prepare(
    `UPDATE orders
     SET order_status = ?, payment_status = ?, tracking_number = ?, courier_id = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextStatus, nextPayStatus, trackingNumber, courierId, sanitizeString(b.notes ?? existing.notes, 400), id);

  if (nextPayStatus !== existing.payment_status) {
    db.prepare(
      `UPDATE payment_records SET status = ?, verified_by = 'Administrator', verified_at = datetime('now') WHERE order_id = ?`
    ).run(nextPayStatus, id);
  }

  if (existing.user_id && nextStatus !== existing.order_status) {
    createNotification(
      existing.user_id,
      'order_status',
      `Order ${existing.order_number} Updated`,
      `Status changed to ${nextStatus}${trackingNumber ? ` · Tracking: ${trackingNumber}` : ''}.`
    );
  }

  void sendTelegramAlert(
    'order_status',
    `Order ${existing.order_number} -> ${nextStatus} (Payment: ${nextPayStatus})${trackingNumber ? ` | Tracking: ${trackingNumber}` : ''}`
  );

  res.json(hydrateOrder(db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id)));
});

// Admin Customers
app.get('/api/admin/customers', requireAdmin, (_req, res) => {
  const users = db
    .prepare(`SELECT id, name, email, phone, role, avatar_url, status, created_at FROM users WHERE role = 'customer' ORDER BY id DESC`)
    .all() as any[];
  const enriched = users.map((u) => {
    const orders = db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`).all(u.id) as any[];
    const addresses = db.prepare(`SELECT * FROM addresses WHERE user_id = ?`).all(u.id) as any[];
    return {
      ...u,
      order_count: orders.length,
      total_spent: orders.reduce((s, o) => s + Number(o.final_total || 0), 0),
      addresses,
      orders: orders.map(hydrateOrder),
    };
  });
  res.json(enriched);
});

app.put('/api/admin/customers/:id/status', requireAdmin, (req, res) => {
  const status = req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare(`UPDATE users SET status = ? WHERE id = ? AND role = 'customer'`).run(status, Number(req.params.id));
  res.json({ success: true, status });
});

// Admin Affiliate Click Reports
app.get('/api/admin/affiliate-reports', requireAdmin, (_req, res) => {
  const clicks = db
    .prepare(
      `SELECT ac.*, p.name AS product_name, p.product_code, p.affiliate_url
       FROM affiliate_clicks ac
       LEFT JOIN products p ON p.id = ac.product_id
       ORDER BY ac.id DESC
       LIMIT 200`
    )
    .all();
  const byProduct = db
    .prepare(
      `SELECT p.id, p.name, p.product_code, p.affiliate_url, COUNT(ac.id) AS click_count
       FROM products p
       LEFT JOIN affiliate_clicks ac ON ac.product_id = p.id
       WHERE p.product_type = 'affiliate'
       GROUP BY p.id
       ORDER BY click_count DESC`
    )
    .all();
  res.json({ clicks, byProduct });
});

// Admin Coupons
app.get('/api/admin/coupons', requireAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM coupons ORDER BY id DESC`).all() as any[];
  res.json(rows.map((r) => ({ ...r, is_active: r.is_active === 1 })));
});

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  const b = req.body || {};
  const code = sanitizeString(b.code, 40).toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Coupon code is required.' });
    return;
  }
  const result = db
    .prepare(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_uses, expires_at, is_active, campaign_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      code,
      b.discount_type === 'fixed' ? 'fixed' : 'percentage',
      Number(b.discount_value || 10),
      Number(b.min_order_value || 0),
      Math.max(1, Number(b.max_uses || 100)),
      sanitizeString(b.expires_at, 40),
      b.is_active === false ? 0 : 1,
      sanitizeString(b.campaign_name, 100)
    );
  const created = db.prepare(`SELECT * FROM coupons WHERE id = ?`).get(result.lastInsertRowid) as any;
  res.status(201).json({ ...created, is_active: created.is_active === 1 });
});

app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM coupons WHERE id = ?`).run(Number(req.params.id));
  res.json({ success: true });
});

// Admin Reviews Moderation
app.get('/api/admin/reviews', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, p.name AS product_name
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ORDER BY r.id DESC`
    )
    .all() as any[];
  res.json(
    rows.map((r) => ({
      ...r,
      images: JSON.parse(r.images_json || '[]'),
      is_verified_purchase: r.is_verified_purchase === 1,
    }))
  );
});

app.put('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT product_id, status, answer FROM reviews WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  const status = ['pending', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : existing.status;
  const answer = sanitizeString(req.body.answer ?? existing.answer, 1000);
  db.prepare(`UPDATE reviews SET status = ?, answer = ? WHERE id = ?`).run(status, answer, id);
  recalculateProductRating(existing.product_id);
  res.json({ success: true });
});

// Admin Shipping Zones & Couriers
app.get('/api/admin/shipping', requireAdmin, (_req, res) => {
  const zones = (db.prepare(`SELECT * FROM shipping_zones ORDER BY id ASC`).all() as any[]).map((z) => ({
    ...z,
    is_active: z.is_active === 1,
  }));
  const couriers = (db.prepare(`SELECT * FROM couriers ORDER BY id ASC`).all() as any[]).map((c) => ({
    ...c,
    is_active: c.is_active === 1,
  }));
  res.json({ zones, couriers });
});

app.post('/api/admin/shipping-zones', requireAdmin, (req, res) => {
  const b = req.body || {};
  const resIns = db
    .prepare(
      `INSERT INTO shipping_zones (name, country, district, area, base_fee, per_kg_fee, free_shipping_threshold, estimated_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      sanitizeString(b.name, 100),
      sanitizeString(b.country, 80),
      sanitizeString(b.district, 80),
      sanitizeString(b.area, 100),
      Number(b.base_fee || 0),
      Number(b.per_kg_fee || 0),
      Number(b.free_shipping_threshold || 0),
      sanitizeString(b.estimated_days, 80)
    );
  res.status(201).json(db.prepare(`SELECT * FROM shipping_zones WHERE id = ?`).get(resIns.lastInsertRowid));
});

app.delete('/api/admin/shipping-zones/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM shipping_zones WHERE id = ?`).run(Number(req.params.id));
  res.json({ success: true });
});

app.post('/api/admin/couriers', requireAdmin, (req, res) => {
  const b = req.body || {};
  const resIns = db
    .prepare(
      `INSERT INTO couriers (name, contact_phone, tracking_url_template, supported_regions, base_rate, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(
      sanitizeString(b.name, 100),
      sanitizeString(b.contact_phone, 40),
      sanitizeString(b.tracking_url_template, 300),
      sanitizeString(b.supported_regions, 120),
      Number(b.base_rate || 0)
    );
  res.status(201).json(db.prepare(`SELECT * FROM couriers WHERE id = ?`).get(resIns.lastInsertRowid));
});

app.put('/api/admin/couriers/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE couriers SET name = ?, contact_phone = ?, tracking_url_template = ?, supported_regions = ?, base_rate = ?, is_active = ? WHERE id = ?`
  ).run(
    sanitizeString(b.name, 100),
    sanitizeString(b.contact_phone, 40),
    sanitizeString(b.tracking_url_template, 300),
    sanitizeString(b.supported_regions, 120),
    Number(b.base_rate || 0),
    b.is_active === false ? 0 : 1,
    Number(req.params.id)
  );
  res.json({ success: true });
});

// Admin Payment Settings & Records
app.get('/api/admin/payments', requireAdmin, (_req, res) => {
  const settings = (db.prepare(`SELECT * FROM payment_settings ORDER BY id ASC`).all() as any[]).map((p) => ({
    ...p,
    is_enabled: p.is_enabled === 1,
    sandbox_mode: p.sandbox_mode === 1,
    env_configured: isGatewayEnvConfigured(p.gateway),
  }));
  const records = db
    .prepare(
      `SELECT pr.*, o.order_number, o.customer_name
       FROM payment_records pr
       LEFT JOIN orders o ON o.id = pr.order_id
       ORDER BY pr.id DESC
       LIMIT 150`
    )
    .all();
  res.json({ settings, records });
});

app.put('/api/admin/payments/:gateway', requireAdmin, (req, res) => {
  const gateway = sanitizeString(req.params.gateway, 40);
  const b = req.body || {};
  db.prepare(
    `UPDATE payment_settings
     SET is_enabled = ?, display_name = ?, instructions = ?, merchant_number = ?, sandbox_mode = ?, updated_at = datetime('now')
     WHERE gateway = ?`
  ).run(
    b.is_enabled ? 1 : 0,
    sanitizeString(b.display_name, 100),
    sanitizeString(b.instructions, 500),
    sanitizeString(b.merchant_number, 60),
    b.sandbox_mode ? 1 : 0,
    gateway
  );
  res.json({ success: true });
});

// Admin Website Settings & Backup
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  const urlFields = [
    'facebook_url',
    'youtube_url',
    'telegram_channel_url',
    'instagram_url',
    'telegram_support_url',
    'hero_image',
    'logo_url',
    'android_apk_url',
  ];
  for (const f of urlFields) {
    if (b[f] && !isValidSafeUrl(b[f])) {
      res.status(400).json({ error: `Invalid URL provided for ${f}` });
      return;
    }
  }
  const saved = saveSiteSettings(b);
  res.json({ ...saved, telegram_configured: isTelegramConfigured() });
});

app.post('/api/admin/telegram/test', requireAdmin, async (_req, res) => {
  if (!isTelegramConfigured()) {
    res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in server environment Secrets.' });
    return;
  }
  const sent = await sendTelegramAlert('support', 'Test notification from SHOPNEXA ROBI HUB Admin Dashboard.');
  res.json({ sent });
});

const downloadTickets = new Map<string, { type: 'zip' | 'backup' | 'github-zip'; expiresAt: number }>();

function authorizeAdminOrDownloadTicket(
  req: AuthenticatedRequest,
  res: express.Response,
  expectedType: 'zip' | 'backup' | 'github-zip'
): boolean {
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket.trim() : '';
  if (ticket) {
    const entry = downloadTickets.get(ticket);
    downloadTickets.delete(ticket);
    if (entry && entry.type === expectedType && entry.expiresAt > Date.now()) {
      return true;
    }
    res.status(403).json({ error: 'Invalid or expired download ticket. Please retry from Dashboard.' });
    return false;
  }
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' });
    return false;
  }
  return true;
}

app.post('/api/admin/download-ticket', requireAdmin, (req, res) => {
  const now = Date.now();
  for (const [k, v] of downloadTickets.entries()) {
    if (v.expiresAt <= now) downloadTickets.delete(k);
  }
  const rawType = req.body?.type;
  const type: 'zip' | 'backup' | 'github-zip' =
    rawType === 'backup' ? 'backup' : rawType === 'github-zip' ? 'github-zip' : 'zip';
  const ticket = crypto.randomBytes(24).toString('hex');
  downloadTickets.set(ticket, { type, expiresAt: now + 60_000 });
  res.json({ ticket });
});

app.get('/api/admin/backup', (req, res) => {
  if (!authorizeAdminOrDownloadTicket(req as AuthenticatedRequest, res, 'backup')) return;
  if (!fs.existsSync(DB_PATH)) {
    res.status(404).json({ error: 'Database file not found' });
    return;
  }
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // proceed even if WAL checkpoint is unsupported
  }
  res.setHeader('Cache-Control', 'no-store');
  res.download(DB_PATH, `shopnexa-backup-${new Date().toISOString().slice(0, 10)}.db`);
});

app.post('/api/admin/restore-backup', requireAdmin, (req, res) => {
  backupUpload.single('database')(req, res, (uploadErr: unknown) => {
    if (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : 'Invalid backup file upload';
      res.status(400).json({ error: msg });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Please select a .db backup file to restore' });
      return;
    }
    const uploadedPath = path.resolve(req.file.path);
    try {
      if (!uploadedPath.startsWith(TMP_RESTORE_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid upload file path' });
        return;
      }
      const result = restoreDatabaseFromFile(uploadedPath);
      res.json({
        success: true,
        restoredTables: result.restoredTables,
        counts: result.counts,
      });
    } catch (err) {
      logServerError('/api/admin/restore-backup', err);
      const message = err instanceof Error ? err.message : 'Database restore failed';
      res.status(400).json({ error: message });
    } finally {
      try {
        if (fs.existsSync(uploadedPath)) {
          fs.unlinkSync(uploadedPath);
        }
      } catch {
        // ignore temp cleanup failure
      }
    }
  });
});

app.get('/api/admin/export-zip', (req, res) => {
  if (!authorizeAdminOrDownloadTicket(req as AuthenticatedRequest, res, 'zip')) return;
  const dateStamp = new Date().toISOString().slice(0, 10);
  const zipFilename = `shopnexa-complete-a-to-z-backup-${dateStamp}.zip`;

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // proceed even if WAL checkpoint is unsupported
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on('error', (err: ArchiverError) => {
    logServerError('/api/admin/export-zip', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to build A-to-Z website ZIP archive' });
    } else {
      res.end();
    }
  });

  res.on('close', () => {
    if (!res.writableFinished) {
      archive.abort();
    }
  });

  archive.pipe(res);

  const rootDir = process.cwd();
  const topDirs = ['src', 'server', 'public', 'uploads'];
  for (const dirName of topDirs) {
    const absDir = path.join(rootDir, dirName);
    if (fs.existsSync(absDir)) {
      archive.directory(absDir, dirName);
    }
  }

  const rootFiles = [
    'server.ts',
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'render.yaml',
    'metadata.json',
    '.env.example',
  ];
  for (const fileName of rootFiles) {
    const absFile = path.join(rootDir, fileName);
    if (fs.existsSync(absFile)) {
      archive.file(absFile, { name: fileName });
    }
  }

  if (fs.existsSync(DB_PATH)) {
    archive.file(DB_PATH, { name: 'data/shopnexa.db' });
  }

  const fullExportSnapshot = {
    exportedAt: new Date().toISOString(),
    siteSettings: getSiteSettings(),
    categories: db.prepare(`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`).all(),
    products: getAllProducts(),
    orders: (db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all() as any[]).map(hydrateOrder),
    customers: db
      .prepare(`SELECT id, name, email, phone, role, avatar_url, status, created_at FROM users ORDER BY id DESC`)
      .all(),
    coupons: db.prepare(`SELECT * FROM coupons ORDER BY id DESC`).all(),
    reviews: db.prepare(`SELECT * FROM reviews ORDER BY id DESC`).all(),
    shippingZones: db.prepare(`SELECT * FROM shipping_zones ORDER BY id ASC`).all(),
    couriers: db.prepare(`SELECT * FROM couriers ORDER BY id ASC`).all(),
    paymentSettings: db.prepare(`SELECT * FROM payment_settings ORDER BY id ASC`).all(),
    paymentRecords: db.prepare(`SELECT * FROM payment_records ORDER BY id DESC`).all(),
    newsletterSubscribers: db.prepare(`SELECT * FROM newsletter_subscribers ORDER BY id DESC`).all(),
    affiliateClicks: db.prepare(`SELECT * FROM affiliate_clicks ORDER BY id DESC`).all(),
  };

  archive.append(JSON.stringify(fullExportSnapshot, null, 2), {
    name: 'database-a-to-z-export.json',
  });

  void archive.finalize();
});

function appendCleanDirectoryToZip(archive: ZipArchive, absDir: string, zipPrefix: string): void {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(absDir, entry.name);
    const relName = `${zipPrefix}/${entry.name}`;
    if (relName === 'public/assets/aistudio' || relName.startsWith('public/assets/aistudio/')) {
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dev-dist' || entry.name === '.git') {
        continue;
      }
      appendCleanDirectoryToZip(archive, fullPath, relName);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.db') || entry.name.endsWith('.db-wal') || entry.name.endsWith('.db-shm') || entry.name === '.DS_Store') {
        continue;
      }
      archive.file(fullPath, { name: relName });
    }
  }
}

app.get('/api/admin/export-github-zip', (req, res) => {
  if (!authorizeAdminOrDownloadTicket(req as AuthenticatedRequest, res, 'github-zip')) return;
  const dateStamp = new Date().toISOString().slice(0, 10);
  const zipFilename = `shopnexa-github-deploy-ready-${dateStamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on('error', (err: ArchiverError) => {
    logServerError('/api/admin/export-github-zip', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to build clean GitHub deploy ZIP archive' });
    } else {
      res.end();
    }
  });

  res.on('close', () => {
    if (!res.writableFinished) {
      archive.abort();
    }
  });

  archive.pipe(res);

  const rootDir = process.cwd();
  for (const dirName of ['src', 'server', 'public']) {
    appendCleanDirectoryToZip(archive, path.join(rootDir, dirName), dirName);
  }

  const cleanRootFiles = [
    'server.ts',
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'render.yaml',
    'metadata.json',
    '.env.example',
    '.gitignore',
  ];
  for (const fileName of cleanRootFiles) {
    const absFile = path.join(rootDir, fileName);
    if (fs.existsSync(absFile)) {
      archive.file(absFile, { name: fileName });
    }
  }

  void archive.finalize();
});

app.get('/api/admin/error-logs', requireAdmin, (_req, res) => {
  res.json(db.prepare(`SELECT * FROM error_logs ORDER BY id DESC LIMIT 100`).all());
});

app.get('/api/admin/blocked-gmails', requireAdmin, (_req, res) => {
  res.json(db.prepare(`SELECT * FROM blocked_gmails ORDER BY id DESC LIMIT 100`).all());
});

app.delete('/api/admin/blocked-gmails/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT email FROM blocked_gmails WHERE id = ?`).get(id) as
    | { email: string }
    | undefined;
  if (existing) {
    db.prepare(`DELETE FROM blocked_gmails WHERE id = ?`).run(id);
    db.prepare(`UPDATE users SET status = 'active' WHERE email = ? AND status = 'blocked'`).run(existing.email);
  }
  res.json({ deleted: true });
});

app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'SHOPNEXA ROBI HUB' });
});

function resolvePublicBaseUrl(req: express.Request): string {
  const rawProto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const proto = rawProto.split(',')[0].trim() === 'http' ? 'http' : 'https';
  const host = (req.get('x-forwarded-host') || req.get('host') || 'shopnexa-2.onrender.com').split(',')[0].trim();
  if (host.includes('onrender.com')) {
    return 'https://shopnexa-2.onrender.com';
  }
  return `${proto}://${host}`;
}

app.get(/^\/+robots\.txt$/i, (req, res) => {
  const baseUrl = resolvePublicBaseUrl(req);
  const rules = [
    'Allow: /',
    'Allow: /api/store/',
    'Allow: /api/exchange-rates',
    'Disallow: /api/admin/',
    'Disallow: /api/auth/',
    'Disallow: /api/orders/',
    'Disallow: /api/cart/',
    'Disallow: /api/wishlist/',
    'Disallow: /api/notifications',
    'Disallow: /api/addresses',
    'Disallow: /api/upload',
    'Disallow: /admin',
  ].join('\n');
  res
    .status(200)
    .set('Cache-Control', 'no-cache, no-store, must-revalidate')
    .type('text/plain; charset=utf-8')
    .send(
      `User-agent: Googlebot\n${rules}\n\n` +
        `User-agent: Google-InspectionTool\n${rules}\n\n` +
        `User-agent: *\n${rules}\n\n` +
        `Sitemap: ${baseUrl}/sitemap.xml\n`
    );
});

app.get(/^\/+sitemap\.xml$/i, (req, res) => {
  const baseUrl = resolvePublicBaseUrl(req);
  const today = new Date().toISOString().slice(0, 10);
  res
    .status(200)
    .set('Cache-Control', 'no-cache, no-store, must-revalidate')
    .type('application/xml; charset=utf-8')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url>\n` +
        `    <loc>${baseUrl}/</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>daily</changefreq>\n` +
        `    <priority>1.0</priority>\n` +
        `  </url>\n` +
        `</urlset>\n`
    );
});

// ---------- SERVER STARTUP (Vite dev middleware or static dist) ----------
async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHOPNEXA ROBI HUB server listening on port ${PORT}`);
  });
}

void startServer();
