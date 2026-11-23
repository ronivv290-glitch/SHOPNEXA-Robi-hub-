import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  Link2,
  ShoppingCart,
  Users,
  Truck,
  CreditCard,
  Tag,
  MessageSquare,
  Settings,
  Download,
  Upload,
  LogOut,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Send,
  Shield,
  ExternalLink,
  KeyRound,
  Eye,
  Globe,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import type {
  Product,
  Order,
  Coupon,
  Review,
  ShippingZone,
  CourierService,
  PaymentSetting,
  SiteSettings,
} from '../types.ts';
import {
  tr,
  translateCategory,
  translateOrderStatus,
  translatePaymentStatus,
  formatDetailedAddress,
} from '../i18n.ts';
import { AdminProductEditor } from './AdminProductEditor.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';

type AdminTab =
  | 'overview'
  | 'products'
  | 'categories'
  | 'affiliates'
  | 'orders'
  | 'customers'
  | 'shipping'
  | 'payments'
  | 'coupons'
  | 'reviews'
  | 'social'
  | 'settings';

export function AdminDashboard() {
  const {
    adminToken,
    setAdminSession,
    logoutAdmin,
    categories,
    settings,
    formatPrice,
    refreshStore,
    showToast,
    language,
    setLanguage,
    navigate,
  } = useStore();

  const [authStatus, setAuthStatus] = useState<{
    envConfigured: boolean;
    needsInitialSetup: boolean;
    requiresUsername?: boolean;
    requiresGmailVerification?: boolean;
  } | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [gmailInput, setGmailInput] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [loginStep, setLoginStep] = useState<'credentials' | 'gmail'>('credentials');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [zipBusy, setZipBusy] = useState(false);
  const [githubZipBusy, setGithubZipBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [credForm, setCredForm] = useState({ currentPasscode: '', newUsername: '', newPasscode: '', newGmail: '' });
  const [credBusy, setCredBusy] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [daysFilter, setDaysFilter] = useState(30);
  const [analytics, setAnalytics] = useState<any>(null);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [affiliateReports, setAffiliateReports] = useState<{ clicks: any[]; byProduct: any[] }>({
    clicks: [],
    byProduct: [],
  });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [shippingData, setShippingData] = useState<{ zones: ShippingZone[]; couriers: CourierService[] }>({
    zones: [],
    couriers: [],
  });
  const [paymentData, setPaymentData] = useState<{ settings: PaymentSetting[]; records: any[] }>({
    settings: [],
    records: [],
  });
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [blockedGmails, setBlockedGmails] = useState<any[]>([]);
  const [blockedNotice, setBlockedNotice] = useState('');

  const [editingProduct, setEditingProduct] = useState<{ open: boolean; product: Product | null; defaultType: 'own' | 'affiliate' }>({
    open: false,
    product: null,
    defaultType: 'own',
  });

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_value: 0,
    max_uses: 100,
    expires_at: '',
    campaign_name: '',
  });
  const [newZone, setNewZone] = useState({
    name: '',
    country: 'Bangladesh',
    district: '',
    area: '',
    base_fee: 2,
    free_shipping_threshold: 100,
    estimated_days: '2–4 Business Days',
  });
  const [newCourier, setNewCourier] = useState({
    name: '',
    contact_phone: '',
    tracking_url_template: '',
    supported_regions: 'Bangladesh',
    base_rate: 2,
  });
  const [siteForm, setSiteForm] = useState<SiteSettings | null>(settings);

  useEffect(() => {
    setSiteForm(settings);
  }, [settings]);

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then(setAuthStatus)
      .catch(() => {});
  }, []);

  const loadAllAdminData = useCallback(async () => {
    if (!adminToken) return;
    const headers = { Authorization: `Bearer ${adminToken}` };
    const [an, pr, or, cu, af, cp, rv, sh, py, lg, bg, me] = await Promise.all([
      fetch(`/api/admin/analytics?days=${daysFilter}`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/products', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/orders', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/customers', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/affiliate-reports', { headers }).then((r) => (r.ok ? r.json() : { clicks: [], byProduct: [] })),
      fetch('/api/admin/coupons', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/reviews', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/shipping', { headers }).then((r) => (r.ok ? r.json() : { zones: [], couriers: [] })),
      fetch('/api/admin/payments', { headers }).then((r) => (r.ok ? r.json() : { settings: [], records: [] })),
      fetch('/api/admin/error-logs', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/blocked-gmails', { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/auth/me', { headers }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (an) setAnalytics(an);
    if (me?.username) setAdminDisplayName(me.username);
    setAdminProducts(pr);
    setOrders(or);
    setCustomers(cu);
    setAffiliateReports(af);
    setCoupons(cp);
    setReviews(rv);
    setShippingData(sh);
    setPaymentData(py);
    setErrorLogs(lg);
    setBlockedGmails(bg);
  }, [adminToken, daysFilter]);

  useEffect(() => {
    void loadAllAdminData();
  }, [loadAllAdminData]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      if (authStatus?.needsInitialSetup) {
        const res = await fetch('/api/admin/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: adminUsername.trim(), passcode, gmail: gmailInput.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || tr(language, 'Authentication failed', 'অথেনটিকেশন ব্যর্থ হয়েছে'), 'error');
          return;
        }
        setAdminSession(data.token);
        setPasscode('');
        setGmailInput('');
        showToast(tr(language, 'Admin session authenticated', 'অ্যাডমিন সেশন সফলভাবে চালু হয়েছে'), 'success');
        return;
      }

      if (loginStep === 'credentials') {
        setBlockedNotice('');
        const res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: adminUsername.trim(), passcode }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || tr(language, 'Authentication failed', 'অথেনটিকেশন ব্যর্থ হয়েছে'), 'error');
          return;
        }
        if (data.requiresGmailVerification && data.challengeToken) {
          setChallengeToken(data.challengeToken);
          setPasscode('');
          setGmailInput('');
          setLoginStep('gmail');
          showToast(
            tr(
              language,
              'Credentials verified. Complete Gmail verification.',
              'অ্যাডমিন তথ্য যাচাই হয়েছে। এবার অনুমোদিত জিমেইল যাচাই করুন।'
            ),
            'info'
          );
          return;
        }
        if (data.token) {
          setAdminSession(data.token);
          setPasscode('');
          showToast(tr(language, 'Admin session authenticated', 'অ্যাডমিন সেশন সফলভাবে চালু হয়েছে'), 'success');
        }
        return;
      }

      const res = await fetch('/api/admin/auth/verify-gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, gmail: gmailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || tr(language, 'Gmail verification failed', 'জিমেইল যাচাই ব্যর্থ হয়েছে');
        showToast(msg, 'error');
        if (data.blocked || res.status === 403 || res.status === 401) {
          setBlockedNotice(msg);
          setChallengeToken('');
          setGmailInput('');
          setLoginStep('credentials');
        }
        return;
      }
      setBlockedNotice('');
      setAdminSession(data.token);
      if (data.username) setAdminDisplayName(data.username);
      setGmailInput('');
      setChallengeToken('');
      setLoginStep('credentials');
      showToast(tr(language, 'Admin session authenticated', 'অ্যাডমিন সেশন সফলভাবে চালু হয়েছে'), 'success');
    } finally {
      setAuthBusy(false);
    }
  };

  if (!adminToken) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="border border-[#C9A227]/40 bg-zinc-950 text-white p-8 space-y-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 text-[#E4C76B]">
              {loginStep === 'gmail' ? <KeyRound className="w-6 h-6 shrink-0" /> : <Shield className="w-6 h-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold tracking-[0.2em]">
                  {tr(language, 'SHOPNEXA ROBI HUB CONSOLE', 'SHOPNEXA ROBI HUB কন্ট্রোল প্যানেল')}
                </p>
                <h1 className="font-display text-3xl font-semibold text-white">
                  {authStatus?.needsInitialSetup
                    ? tr(language, 'Claim Administrator Access', 'অ্যাডমিন অ্যাক্সেস সেটআপ করুন')
                    : loginStep === 'gmail'
                    ? tr(language, 'Gmail Verification', 'জিমেইল যাচাইকরণ')
                    : tr(language, 'Administrator Sign In', 'অ্যাডমিন সাইন ইন')}
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="px-2.5 py-1 border border-zinc-700 hover:border-[#C9A227] text-xs font-semibold text-[#E4C76B] flex items-center gap-1 shrink-0"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            {authStatus?.needsInitialSetup
              ? tr(
                  language,
                  'First-run security setup: configure your Administrator username and password (min 6 characters).',
                  'প্রথমবারের নিরাপত্তা সেটআপ: আপনার অ্যাডমিন নাম এবং পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) সেট করুন।'
                )
              : loginStep === 'gmail'
              ? tr(
                  language,
                  'Step 2 of 2: Enter your authorized administrator Gmail address to unlock the dashboard. Any unauthorized Gmail will be blocked immediately.',
                  'ধাপ ২/২: ড্যাশবোর্ড আনলক করতে আপনার অনুমোদিত অ্যাডমিন জিমেইল লিখুন। অননুমোদিত যেকোনো জিমেইল সাথে সাথে ব্লক করা হবে।'
                )
              : tr(
                  language,
                  'Step 1 of 2: Enter your Administrator name and password to proceed to Gmail verification.',
                  'ধাপ ১/২: জিমেইল যাচাইকরণে যেতে আপনার অ্যাডমিন নাম ও পাসওয়ার্ড লিখুন।'
                )}
          </p>

          {blockedNotice && (
            <div className="border border-red-700/70 bg-red-950/40 px-4 py-3 text-xs text-red-200 leading-relaxed">
              {blockedNotice}
            </div>
          )}

          <form onSubmit={handleAdminAuth} className="space-y-4 text-xs" autoComplete="off">
            {loginStep === 'credentials' || authStatus?.needsInitialSetup ? (
              <>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr(language, 'Admin Name', 'অ্যাডমিন নাম')}
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder={tr(language, 'Enter admin name', 'অ্যাডমিন নাম লিখুন')}
                    className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr(language, 'Admin Password', 'অ্যাডমিন পাসওয়ার্ড')}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder={
                      authStatus?.needsInitialSetup
                        ? tr(language, 'Create admin password', 'অ্যাডমিন পাসওয়ার্ড তৈরি করুন')
                        : tr(language, 'Enter admin password', 'অ্যাডমিন পাসওয়ার্ড লিখুন')
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                {authStatus?.needsInitialSetup && (
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      {tr(language, 'Authorized Gmail', 'অনুমোদিত জিমেইল')}
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete="off"
                      spellCheck={false}
                      value={gmailInput}
                      onChange={(e) => setGmailInput(e.target.value)}
                      placeholder={tr(language, 'Enter authorized admin Gmail', 'অনুমোদিত অ্যাডমিন জিমেইল লিখুন')}
                      className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-white focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr(language, 'Authorized Gmail', 'অনুমোদিত জিমেইল')}
                </label>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={gmailInput}
                  onChange={(e) => setGmailInput(e.target.value)}
                  placeholder={tr(language, 'Enter authorized admin Gmail', 'অনুমোদিত অ্যাডমিন জিমেইল লিখুন')}
                  className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-white focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
            >
              {authBusy
                ? tr(language, 'Verifying...', 'যাচাই করা হচ্ছে...')
                : authStatus?.needsInitialSetup
                ? tr(language, 'Save & Enter Dashboard', 'সংরক্ষণ করুন ও ড্যাশবোর্ডে প্রবেশ করুন')
                : loginStep === 'gmail'
                ? tr(language, 'Verify Gmail & Enter Dashboard', 'জিমেইল যাচাই করে ড্যাশবোর্ডে প্রবেশ করুন')
                : tr(language, 'Continue to Gmail Verification', 'জিমেইল যাচাইকরণে এগিয়ে যান')}
            </button>

            {loginStep === 'gmail' && !authStatus?.needsInitialSetup && (
              <button
                type="button"
                onClick={() => {
                  setLoginStep('credentials');
                  setChallengeToken('');
                  setGmailInput('');
                }}
                className="w-full py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-medium transition-colors"
              >
                {tr(language, 'Back to Admin Name & Password', 'অ্যাডমিন নাম ও পাসওয়ার্ডে ফিরে যান')}
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== 'All' && o.order_status !== orderStatusFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      return `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.customer_email}`.toLowerCase().includes(q);
    }
    return true;
  });

  const triggerNativeUrlDownload = (downloadUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
    }, 5000);
  };

  const exportOrdersCsv = () => {
    const header = ['OrderID', 'Customer', 'Phone', 'Country', 'Payment', 'PayStatus', 'Status', 'Total', 'Date'];
    const rows = filteredOrders.map((o) => [
      o.order_number,
      `"${o.customer_name}"`,
      `"${o.customer_phone}"`,
      o.country,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.final_total,
      o.created_at,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopnexa-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 15000);
  };

  const handleDownloadBackup = async () => {
    try {
      const ticketRes = await fetch('/api/admin/download-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ type: 'backup' }),
      });
      if (ticketRes.status === 401 || ticketRes.status === 403) {
        logoutAdmin();
        showToast(tr(language, 'Admin session expired. Please sign in again.', 'অ্যাডমিন সেশন শেষ হয়েছে। অনুগ্রহ করে আবার সাইন ইন করুন।'), 'error');
        return;
      }
      if (ticketRes.ok) {
        const { ticket } = (await ticketRes.json()) as { ticket?: string };
        if (ticket) {
          triggerNativeUrlDownload(
            `/api/admin/backup?ticket=${encodeURIComponent(ticket)}`,
            `shopnexa-backup-${new Date().toISOString().slice(0, 10)}.db`
          );
          showToast(tr(language, 'Database backup download started', 'ডাটাবেজ ব্যাকআপ ডাউনলোড শুরু হয়েছে'), 'success');
          return;
        }
      }
      showToast(tr(language, 'Backup download failed', 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে'), 'error');
    } catch {
      showToast(tr(language, 'Backup download failed', 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে'), 'error');
    }
  };

  const handleDownloadFullZip = async () => {
    setZipBusy(true);
    try {
      const ticketRes = await fetch('/api/admin/download-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ type: 'zip' }),
      });
      if (ticketRes.status === 401 || ticketRes.status === 403) {
        logoutAdmin();
        showToast(tr(language, 'Admin session expired. Please sign in again.', 'অ্যাডমিন সেশন শেষ হয়েছে। অনুগ্রহ করে আবার সাইন ইন করুন।'), 'error');
        return;
      }
      if (ticketRes.ok) {
        const { ticket } = (await ticketRes.json()) as { ticket?: string };
        if (ticket) {
          triggerNativeUrlDownload(
            `/api/admin/export-zip?ticket=${encodeURIComponent(ticket)}`,
            `shopnexa-complete-a-to-z-backup-${new Date().toISOString().slice(0, 10)}.zip`
          );
          showToast(tr(language, 'Complete A-to-Z Website ZIP download started', 'সম্পূর্ণ ওয়েবসাইট ZIP (A–Z) ডাউনলোড শুরু হয়েছে'), 'success');
          return;
        }
      }
      showToast(tr(language, 'Full website ZIP export failed', 'সম্পূর্ণ ওয়েবসাইট ZIP ডাউনলোড ব্যর্থ হয়েছে'), 'error');
    } catch {
      showToast(tr(language, 'Full website ZIP export failed', 'সম্পূর্ণ ওয়েবসাইট ZIP ডাউনলোড ব্যর্থ হয়েছে'), 'error');
    } finally {
      setZipBusy(false);
    }
  };

  const handleDownloadGithubZip = async () => {
    setGithubZipBusy(true);
    try {
      const ticketRes = await fetch('/api/admin/download-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ type: 'github-zip' }),
      });
      if (ticketRes.status === 401 || ticketRes.status === 403) {
        logoutAdmin();
        showToast(tr(language, 'Admin session expired. Please sign in again.', 'অ্যাডমিন সেশন শেষ হয়েছে। অনুগ্রহ করে আবার সাইন ইন করুন।'), 'error');
        return;
      }
      if (ticketRes.ok) {
        const { ticket } = (await ticketRes.json()) as { ticket?: string };
        if (ticket) {
          triggerNativeUrlDownload(
            `/api/admin/export-github-zip?ticket=${encodeURIComponent(ticket)}`,
            `shopnexa-github-deploy-ready-${new Date().toISOString().slice(0, 10)}.zip`
          );
          showToast(
            tr(
              language,
              'Clean GitHub & Render Deploy ZIP download started',
              'গিটহাব ও রেন্ডার ডিপ্লয়-রেডি ক্লিন ZIP ডাউনলোড শুরু হয়েছে'
            ),
            'success'
          );
          return;
        }
      }
      showToast(tr(language, 'Clean GitHub ZIP export failed', 'গিটহাব ক্লিন ZIP ডাউনলোড ব্যর্থ হয়েছে'), 'error');
    } catch {
      showToast(tr(language, 'Clean GitHub ZIP export failed', 'গিটহাব ক্লিন ZIP ডাউনলোড ব্যর্থ হয়েছে'), 'error');
    } finally {
      setGithubZipBusy(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;
    setRestoreFile(file);
  };

  const handleConfirmRestoreBackup = async () => {
    if (!restoreFile) return;
    setRestoreBusy(true);
    try {
      const formData = new FormData();
      formData.append('database', restoreFile);
      const res = await fetch('/api/admin/restore-backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });
      if (res.status === 401 || res.status === 403) {
        logoutAdmin();
        showToast(tr(language, 'Admin session expired. Please sign in again.', 'অ্যাডমিন সেশন শেষ হয়েছে। অনুগ্রহ করে আবার সাইন ইন করুন।'), 'error');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || tr(language, 'Failed to restore database backup', 'ডাটাবেজ ব্যাকআপ রিস্টোর করা যায়নি'), 'error');
        return;
      }
      setRestoreFile(null);
      await Promise.all([loadAllAdminData(), refreshStore()]);
      const counts = data?.counts;
      showToast(
        counts
          ? tr(
              language,
              `Backup restored! Products: ${counts.products}, Orders: ${counts.orders}, Categories: ${counts.categories}`,
              `ব্যাকআপ রিস্টোর সম্পন্ন! পণ্য: ${counts.products}টি, অর্ডার: ${counts.orders}টি, ক্যাটাগরি: ${counts.categories}টি`
            )
          : tr(language, 'Database backup restored successfully!', 'ডাটাবেজ ব্যাকআপ সফলভাবে রিস্টোর হয়েছে!'),
        'success'
      );
    } catch {
      showToast(tr(language, 'Failed to upload and restore database backup', 'ডাটাবেজ ব্যাকআপ আপলোড ও রিস্টোর করা যায়নি'), 'error');
    } finally {
      setRestoreBusy(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: any }> = [
    { id: 'overview', label: tr(language, 'Overview', 'ওভারভিউ'), icon: LayoutDashboard },
    { id: 'products', label: tr(language, 'Products (Own & Affiliate)', 'পণ্য (নিজস্ব ও অ্যাফিলিয়েট)'), icon: Package },
    { id: 'categories', label: tr(language, 'Categories', 'ক্যাটাগরি'), icon: Tag },
    { id: 'affiliates', label: tr(language, 'Affiliate Reports', 'অ্যাফিলিয়েট রিপোর্ট'), icon: Link2 },
    { id: 'orders', label: tr(language, 'Orders', 'অর্ডার'), icon: ShoppingCart },
    { id: 'customers', label: tr(language, 'Customers', 'ক্রেতাবৃন্দ'), icon: Users },
    { id: 'shipping', label: tr(language, 'Shipping & Couriers', 'ডেলিভারি জোন ও কুরিয়ার'), icon: Truck },
    { id: 'payments', label: tr(language, 'Payments', 'পেমেন্ট ও লেনদেন'), icon: CreditCard },
    { id: 'coupons', label: tr(language, 'Coupons', 'কুপন কোড'), icon: Tag },
    { id: 'reviews', label: tr(language, 'Reviews & Q&A', 'রিভিউ ও প্রশ্নোত্তর'), icon: MessageSquare },
    { id: 'social', label: tr(language, 'Social Media & Telegram', 'সোশ্যাল মিডিয়া ও টেলিগ্রাম'), icon: Send },
    { id: 'settings', label: tr(language, 'Website, Credentials & Backup', 'ওয়েবসাইট, পাসওয়ার্ড ও ব্যাকআপ'), icon: Settings },
  ];

  const maxChartRev = Math.max(1, ...(analytics?.salesSeries || []).map((s: any) => s.revenue));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="bg-black text-white border-b border-[#C9A227]/35 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#E4C76B]">
            {tr(language, 'SHOPNEXA ROBI HUB CONTROL CENTER', 'SHOPNEXA ROBI HUB কন্ট্রোল সেন্টার')}
          </p>
          <h1 className="font-display text-2xl font-semibold text-white">
            {tr(language, 'Administrator Dashboard', 'অ্যাডমিনিস্ট্রেটর ড্যাশবোর্ড')}
          </h1>
          {adminDisplayName && (
            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
              {tr(language, 'Private Admin Session:', 'প্রাইভেট অ্যাডমিন সেশন:')}{' '}
              <span className="text-[#E4C76B] font-semibold">{adminDisplayName}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            className="px-3 py-2 border border-zinc-700 hover:border-[#C9A227] text-xs font-semibold text-[#E4C76B] flex items-center gap-1.5 transition-colors"
            title={tr(language, 'Switch to Bengali', 'ইংরেজিতে পরিবর্তন করুন')}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'home', section: 'all' })}
            className="px-3 py-2 border border-zinc-700 hover:border-[#C9A227] text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#E4C76B]" />
            <span>{tr(language, 'View Main Store', 'মেইন পেজ দেখুন')}</span>
          </button>
          <PWAInstallButton variant="header" label={tr(language, 'Download App', 'অ্যাপ ডাউনলোড')} />
          <button
            type="button"
            disabled={zipBusy}
            onClick={() => void handleDownloadFullZip()}
            className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>
              {zipBusy
                ? tr(language, 'Preparing ZIP...', 'ZIP প্রস্তুত হচ্ছে...')
                : tr(language, 'Download Full Website ZIP (A–Z)', 'সম্পূর্ণ ওয়েবসাইট ZIP (A–Z)')}
            </span>
          </button>
          <button
            type="button"
            onClick={logoutAdmin}
            className="px-4 py-2 border border-zinc-700 hover:border-[#C9A227] text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{tr(language, 'Sign Out Admin', 'সাইন আউট')}</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center gap-2.5 border transition-colors ${
                  active
                    ? 'bg-[#C9A227] text-black border-[#C9A227]'
                    : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-[#C9A227]/60 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-black' : 'text-[#E4C76B]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="lg:col-span-9 space-y-6">
          {/* 1. OVERVIEW */}
          {tab === 'overview' && analytics && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-2xl font-semibold text-white">
                  {tr(language, 'Marketplace Overview', 'মার্কেটপ্লেস ওভারভিউ')}
                </h2>
                <select
                  value={daysFilter}
                  onChange={(e) => setDaysFilter(Number(e.target.value))}
                  className="border border-zinc-700 bg-zinc-900 text-white px-3 py-1.5 text-xs font-semibold focus:border-[#C9A227] focus:outline-none"
                >
                  <option value={7} className="bg-zinc-950 text-white">{tr(language, 'Last 7 Days', 'গত ৭ দিন')}</option>
                  <option value={30} className="bg-zinc-950 text-white">{tr(language, 'Last 30 Days', 'গত ৩০ দিন')}</option>
                  <option value={90} className="bg-zinc-950 text-white">{tr(language, 'Last 90 Days', 'গত ৯০ দিন')}</option>
                  <option value={365} className="bg-zinc-950 text-white">{tr(language, 'Last 365 Days', 'গত ৩৬৫ দিন')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                {[
                  { label: tr(language, 'Total Revenue', 'মোট আয়'), val: formatPrice(analytics.metrics.totalRevenue) },
                  { label: tr(language, 'Total Sales', 'মোট বিক্রয় সংখ্যা'), val: analytics.metrics.totalSales },
                  { label: tr(language, 'Total Orders', 'মোট অর্ডার'), val: analytics.metrics.totalOrders },
                  { label: tr(language, 'Pending Orders', 'অপেক্ষমাণ অর্ডার'), val: analytics.metrics.pendingOrders },
                  { label: tr(language, 'Confirmed Orders', 'নিশ্চিত অর্ডার'), val: analytics.metrics.confirmedOrders },
                  { label: tr(language, 'Delivered Orders', 'ডেলিভারি সম্পন্ন'), val: analytics.metrics.deliveredOrders },
                  { label: tr(language, 'Cancelled Orders', 'বাতিল অর্ডার'), val: analytics.metrics.cancelledOrders },
                  { label: tr(language, 'Total Customers', 'মোট ক্রেতা'), val: analytics.metrics.totalCustomers },
                  { label: tr(language, 'Total Products', 'মোট পণ্য'), val: analytics.metrics.totalProducts },
                  { label: tr(language, 'Own Products', 'নিজস্ব পণ্য'), val: analytics.metrics.ownProductCount },
                  { label: tr(language, 'Affiliate Products', 'অ্যাফিলিয়েট পণ্য'), val: analytics.metrics.affiliateProductCount },
                  { label: tr(language, 'Total Direct Stock', 'মোট নিজস্ব স্টক'), val: analytics.metrics.totalStock },
                  { label: tr(language, 'Low Stock Alerts', 'কম স্টক সতর্কতা'), val: analytics.metrics.lowStockCount },
                  { label: tr(language, 'Affiliate Clicks', 'অ্যাফিলিয়েট ক্লিক'), val: analytics.metrics.affiliateClicks },
                ].map((m) => (
                  <div key={m.label} className="bg-zinc-900 border border-zinc-800 p-4">
                    <p className="text-zinc-400">{m.label}</p>
                    <p className="text-lg font-mono tabular-nums font-semibold text-white mt-1">{m.val}</p>
                  </div>
                ))}
              </div>

              {/* SVG Sales & Clicks Chart */}
              <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">
                  {tr(language, 'Sales Revenue & Activity Timeline', 'বিক্রয় আয় ও কার্যক্রমের সময়রেখা')}
                </h3>
                {analytics.salesSeries.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-8 text-center">
                    {tr(
                      language,
                      'No order or affiliate click activity recorded in this period yet.',
                      'এই সময়কালে এখনো কোনো অর্ডার বা অ্যাফিলিয়েট ক্লিক রেকর্ড হয়নি।'
                    )}
                  </p>
                ) : (
                  <div className="h-44 flex items-end gap-2 border-b border-l border-zinc-700 p-3 overflow-x-auto">
                    {analytics.salesSeries.map((pt: any) => {
                      const heightPct = Math.max(8, Math.round((pt.revenue / maxChartRev) * 100));
                      return (
                        <div key={pt.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-1">
                          <span className="text-[10px] font-mono text-zinc-300">{pt.orders}o/{pt.clicks}c</span>
                          <div
                            title={`${pt.date}: $${pt.revenue}`}
                            className="w-full max-w-[32px] bg-[#C9A227] hover:bg-[#E4C76B] transition-colors"
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[10px] font-mono text-zinc-400">{pt.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-semibold text-white">
                    {tr(language, 'Low Stock Direct Products', 'কম স্টকের নিজস্ব পণ্যসমূহ')}
                  </h3>
                  {analytics.lowStockProducts.length === 0 ? (
                    <p className="text-zinc-400">
                      {tr(language, 'All direct products are adequately stocked.', 'সব নিজস্ব পণ্যে পর্যাপ্ত স্টক রয়েছে।')}
                    </p>
                  ) : (
                    analytics.lowStockProducts.map((p: Product) => (
                      <div key={p.id} className="flex justify-between py-2 border-b border-zinc-800">
                        <span className="font-medium text-zinc-200">{p.name}</span>
                        <span className="font-mono text-red-400 font-semibold">
                          {p.total_stock} {tr(language, 'left', 'টি বাকি')}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-semibold text-white">
                    {tr(language, 'Recent Orders', 'সাম্প্রতিক অর্ডারসমূহ')}
                  </h3>
                  {analytics.recentOrders.length === 0 ? (
                    <p className="text-zinc-400">
                      {tr(language, 'No direct orders placed yet.', 'এখনো কোনো সরাসরি অর্ডার আসেনি।')}
                    </p>
                  ) : (
                    analytics.recentOrders.map((o: Order) => (
                      <div key={o.id} className="flex justify-between py-2 border-b border-zinc-800">
                        <div>
                          <span className="font-mono font-semibold text-white">{o.order_number}</span>
                          <span className="text-zinc-400 ml-2">{o.customer_name}</span>
                        </div>
                        <span className="font-mono font-semibold text-[#E4C76B]">{formatPrice(o.final_total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. PRODUCTS */}
          {tab === 'products' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-white">
                    {tr(language, 'Products Management', 'পণ্য ব্যবস্থাপনা')}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tr(
                      language,
                      'Upload, edit, and run 10-point auto-verification for all own & affiliate products. Active own products appear immediately on the main page.',
                      'সকল নিজস্ব ও অ্যাফিলিয়েট পণ্য আপলোড, এডিট এবং ১০-পয়েন্ট অটো-ভেরিফিকেশন — সক্রিয় নিজস্ব পণ্য সাথে সাথেই মেইন পেজে চলে আসে।'
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch('/api/admin/upload-diagnostics', {
                        headers: { Authorization: `Bearer ${adminToken}` },
                      });
                      const d = await res.json();
                      if (res.ok && d.ok) {
                        showToast(
                          tr(
                            language,
                            `Upload System Ready: DB & Storage OK · ${d.categories_count} categories, ${d.products_count} products`,
                            `সিস্টেম সচল: ডাটাবেজ ও স্টোরেজ (Uploads) ঠিক আছে · ${d.categories_count}টি ক্যাটাগরি, ${d.products_count}টি পণ্য`
                          ),
                          'success'
                        );
                      } else {
                        showToast(
                          tr(
                            language,
                            `Diagnostic Warning: DB=${d.db_connected ? 'OK' : 'Error'}, Uploads=${d.uploads_writable ? 'OK' : 'Error'}`,
                            `সমস্যা পাওয়া গেছে: DB=${d.db_connected ? 'OK' : 'Error'}, Uploads=${d.uploads_writable ? 'OK' : 'Error'}`
                          ),
                          'error'
                        );
                      }
                    }}
                    className="px-3.5 py-2 bg-zinc-950 border border-emerald-700/70 hover:border-emerald-400 text-emerald-300 text-xs font-semibold transition-colors"
                  >
                    {tr(language, 'Check Upload System', 'আপলোড সিস্টেম পরীক্ষা')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct({ open: true, product: null, defaultType: 'own' })}
                    className="px-4 py-2 bg-zinc-950 border border-zinc-700 hover:border-[#C9A227] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{tr(language, 'Upload Own Product', 'নতুন নিজস্ব পণ্য আপলোড')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct({ open: true, product: null, defaultType: 'affiliate' })}
                    className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{tr(language, 'Add Affiliate Product', 'অ্যাফিলিয়েট পণ্য যোগ')}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-[#E4C76B] border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2.5">{tr(language, 'Code / SKU', 'কোড / SKU')}</th>
                      <th className="px-3 py-2.5">{tr(language, 'Product Name', 'পণ্যের নাম')}</th>
                      <th className="px-3 py-2.5">{tr(language, 'Type & Status', 'ধরন ও স্ট্যাটাস')}</th>
                      <th className="px-3 py-2.5">{tr(language, 'Price (Saved Currency)', 'দাম (আসল কারেন্সি)')}</th>
                      <th className="px-3 py-2.5">{tr(language, 'Colors / Sizes / Var', 'রঙ / সাইজ / ভ্যারিয়েন্ট')}</th>
                      <th className="px-3 py-2.5">{tr(language, 'Stock', 'স্টক')}</th>
                      <th className="px-3 py-2.5 text-right">{tr(language, 'Actions', 'অ্যাকশন')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {adminProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-950/60">
                        <td className="px-3 py-2.5 font-mono text-zinc-300">{p.product_code}</td>
                        <td className="px-3 py-2.5 font-semibold text-white">{p.name}</td>
                        <td className="px-3 py-2.5 text-zinc-300 space-y-0.5">
                          <div className="uppercase font-semibold">
                            {p.product_type === 'affiliate'
                              ? tr(language, 'Affiliate', 'অ্যাফিলিয়েট')
                              : tr(language, 'Own Product', 'নিজস্ব পণ্য')}
                          </div>
                          <div className={`text-[10px] font-semibold ${p.status === 'active' ? 'text-emerald-400' : p.status === 'draft' ? 'text-amber-300' : 'text-red-400'}`}>
                            {p.status === 'active'
                              ? tr(language, 'Active (On Main Page)', 'সক্রিয় (মেইন পেজে)')
                              : p.status === 'draft'
                              ? tr(language, 'Draft', 'খসড়া (ড্রাফট)')
                              : tr(language, 'Out of Stock', 'স্টক শেষ')}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-white">
                          <div>{formatPrice(p.sale_price || p.selling_price, p.currency || 'USD')}</div>
                          <div className="text-[10px] text-zinc-400">
                            {tr(language, 'Saved:', 'সংরক্ষিত:')} {(p.sale_price || p.selling_price).toLocaleString()} {p.currency || 'USD'}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-zinc-300">
                          {p.total_colors} {tr(language, 'col', 'রঙ')} / {p.total_sizes} {tr(language, 'sz', 'সাইজ')} / {p.total_variations} {tr(language, 'var', 'ভ্যার')}
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-white">{p.total_stock}</td>
                        <td className="px-3 py-2.5 text-right space-x-2 whitespace-nowrap">
                          {p.product_type === 'own' && p.status !== 'draft' && (
                            <button
                              type="button"
                              onClick={() => navigate({ page: 'product', productId: p.id })}
                              className="text-[#E4C76B] hover:text-white inline-flex items-center gap-1"
                              title={tr(language, 'Open on Website', 'ওয়েবসাইটে দেখুন')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{tr(language, 'View', 'দেখুন')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/admin/products/${p.id}/verify`, {
                                headers: { Authorization: `Bearer ${adminToken}` },
                              });
                              const v = await res.json();
                              const passedCount = (v.checks || []).filter((c: any) => c.passed).length;
                              showToast(
                                v.passed
                                  ? tr(
                                      language,
                                      `10-point check passed (${passedCount}/10) — Product #${p.id} ready!`,
                                      `১০-পয়েন্ট যাচাই সফল (${passedCount}/১০) — পণ্য #${p.id} সব ঠিক আছে!`
                                    )
                                  : tr(
                                      language,
                                      `Check warning (${passedCount}/10): ${(v.checks || []).filter((c: any) => !c.passed).map((c: any) => c.label).join(', ')}`,
                                      `যাচাই সতর্কতা (${passedCount}/১০): ${(v.checks || []).filter((c: any) => !c.passed).map((c: any) => c.label).join(', ')}`
                                    ),
                                v.passed ? 'success' : 'error'
                              );
                            }}
                            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                          >
                            <span>{tr(language, 'Verify', 'যাচাই')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProduct({ open: true, product: p, defaultType: p.product_type })}
                            className="text-zinc-200 hover:text-[#E4C76B] inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{tr(language, 'Edit', 'এডিট')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/admin/products/${p.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${adminToken}` },
                              });
                              if (res.ok) {
                                showToast(tr(language, 'Product deleted successfully', 'পণ্যটি সফলভাবে মুছে ফেলা হয়েছে'), 'success');
                                await loadAllAdminData();
                                await refreshStore();
                              } else {
                                const d = await res.json();
                                showToast(d.error || tr(language, 'Cannot delete product', 'পণ্য মুছে ফেলা যায়নি'), 'error');
                              }
                            }}
                            className="text-red-400 hover:text-red-300 inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. CATEGORIES */}
          {tab === 'categories' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-6 text-xs">
              <h2 className="font-display text-2xl font-semibold text-white">
                {tr(language, 'Categories Management', 'ক্যাটাগরি ব্যবস্থাপনা')} ({categories.length})
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ name: newCategoryName, is_featured: true }),
                  });
                  if (res.ok) {
                    setNewCategoryName('');
                    await refreshStore();
                    showToast(tr(language, 'Category added', 'নতুন ক্যাটাগরি যোগ হয়েছে'), 'success');
                  }
                }}
                className="flex gap-2 max-w-md"
              >
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={tr(language, 'New category name', 'নতুন ক্যাটাগরির নাম')}
                  className="flex-1 border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <button type="submit" className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold">
                  {tr(language, 'Add Category', 'ক্যাটাগরি যোগ করুন')}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="border border-zinc-800 bg-zinc-950 p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{translateCategory(cat.name, language)}</p>
                      <p className="text-zinc-400 font-mono">
                        {cat.product_count ?? 0} {tr(language, 'products', 'টি পণ্য')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch(`/api/admin/categories/${cat.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${adminToken}` },
                        });
                        if (res.ok) await refreshStore();
                        else showToast(tr(language, 'Remove products in this category first', 'প্রথমে এই ক্যাটাগরির পণ্যগুলো সরান'), 'error');
                      }}
                      className="text-zinc-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. PRIVATE AFFILIATE CATALOG & REPORTS (Admin Only) */}
          {tab === 'affiliates' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-6 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-white">
                    {tr(language, 'Private Affiliate Products & Reports', 'প্রাইভেট অ্যাফিলিয়েট পণ্য ও রিপোর্ট')}
                  </h2>
                  <p className="text-zinc-300 mt-0.5">
                    {tr(
                      language,
                      'Private Admin Vault: affiliate products added here are visible only inside your Admin Dashboard and never shown to public visitors.',
                      'প্রাইভেট অ্যাডমিন ভল্ট: এখানে যোগ করা অ্যাফিলিয়েট পণ্য শুধু আপনার অ্যাডমিন ড্যাশবোর্ডেই দেখা যাবে, সাধারণ ক্রেতাদের পেজে নয়।'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProduct({ open: true, product: null, defaultType: 'affiliate' })}
                  className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold"
                >
                  {tr(language, '+ Add Affiliate Product', '+ অ্যাফিলিয়েট পণ্য যোগ')}
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-white">
                  {tr(language, 'Your Affiliate Products', 'আপনার অ্যাফিলিয়েট পণ্যসমূহ')} ({adminProducts.filter((p) => p.product_type === 'affiliate').length})
                </h3>
                <div className="overflow-x-auto border border-zinc-800">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-950 text-[#E4C76B] border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2">{tr(language, 'Code', 'কোড')}</th>
                        <th className="px-3 py-2">{tr(language, 'Product', 'পণ্য')}</th>
                        <th className="px-3 py-2">{tr(language, 'Price', 'দাম')}</th>
                        <th className="px-3 py-2">{tr(language, 'Affiliate Link', 'অ্যাফিলিয়েট লিংক')}</th>
                        <th className="px-3 py-2 text-right">{tr(language, 'Actions', 'অ্যাকশন')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {adminProducts.filter((p) => p.product_type === 'affiliate').length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-zinc-400">
                            {tr(language, 'No affiliate products added yet.', 'এখনো কোনো অ্যাফিলিয়েট পণ্য যোগ করা হয়নি।')}
                          </td>
                        </tr>
                      ) : (
                        adminProducts
                          .filter((p) => p.product_type === 'affiliate')
                          .map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-950/60">
                              <td className="px-3 py-2.5 font-mono text-zinc-300">{p.product_code}</td>
                              <td className="px-3 py-2.5 font-semibold text-white">{p.name}</td>
                              <td className="px-3 py-2.5 font-mono tabular-nums text-white">
                                {formatPrice(p.sale_price || p.selling_price, p.currency || 'USD')}
                              </td>
                              <td className="px-3 py-2.5 max-w-xs truncate">
                                {p.affiliate_url ? (
                                  <a
                                    href={p.affiliate_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#E4C76B] hover:underline inline-flex items-center gap-1 font-mono"
                                  >
                                    <span>{tr(language, 'Open Affiliate Link', 'অ্যাফিলিয়েট লিংক খুলুন')}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-zinc-500">{tr(language, 'No URL', 'কোনো লিংক নেই')}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingProduct({ open: true, product: p, defaultType: 'affiliate' })}
                                  className="text-zinc-200 hover:text-[#E4C76B] inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>{tr(language, 'Edit', 'এডিট')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await fetch(`/api/admin/products/${p.id}`, {
                                      method: 'DELETE',
                                      headers: { Authorization: `Bearer ${adminToken}` },
                                    });
                                    if (res.ok) {
                                      await loadAllAdminData();
                                      await refreshStore();
                                    } else {
                                      const d = await res.json();
                                      showToast(d.error || tr(language, 'Cannot delete', 'মুছে ফেলা যায়নি'), 'error');
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-300 inline-flex items-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-800">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 text-[#E4C76B] border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">{tr(language, 'Code', 'কোড')}</th>
                      <th className="px-3 py-2">{tr(language, 'Product', 'পণ্য')}</th>
                      <th className="px-3 py-2">{tr(language, 'Affiliate URL', 'অ্যাফিলিয়েট লিংক')}</th>
                      <th className="px-3 py-2 text-right">{tr(language, 'Tracked Clicks', 'মোট ক্লিক')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {affiliateReports.byProduct.map((row: any) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-mono text-zinc-300">{row.product_code}</td>
                        <td className="px-3 py-2 font-semibold text-white">{row.name}</td>
                        <td className="px-3 py-2 font-mono truncate max-w-xs">
                          {row.affiliate_url ? (
                            <a
                              href={row.affiliate_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#E4C76B] hover:underline"
                            >
                              {row.affiliate_url}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold text-white">{row.click_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-2">
                  {tr(language, 'Recent Affiliate Click Log', 'সাম্প্রতিক অ্যাফিলিয়েট ক্লিক তালিকা')} ({affiliateReports.clicks.length})
                </h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {affiliateReports.clicks.map((c: any) => (
                    <div key={c.id} className="border border-zinc-800 bg-zinc-950 p-2.5 flex justify-between">
                      <span className="text-zinc-200">{c.product_name} ({[c.selected_color, c.selected_size].filter(Boolean).join(', ') || tr(language, 'Default', 'ডিফল্ট')})</span>
                      <span className="font-mono text-zinc-400">{c.clicked_at}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. ORDERS */}
          {tab === 'orders' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold text-white">
                  {tr(language, 'Orders Management', 'অর্ডার ব্যবস্থাপনা')} ({filteredOrders.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder={tr(language, 'Search Order ID, customer...', 'অর্ডার আইডি, ক্রেতা খুঁজুন...')}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="border border-zinc-700 px-3 py-1.5 bg-zinc-950 text-white focus:border-[#C9A227] focus:outline-none"
                  >
                    <option value="All" className="bg-zinc-950 text-white">{tr(language, 'All Statuses', 'সকল অবস্থা')}</option>
                    {['Pending', 'Confirmed', 'Processing', 'Ready to Ship', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'].map((s) => (
                      <option key={s} value={s} className="bg-zinc-950 text-white">{translateOrderStatus(s, language)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={exportOrdersCsv}
                    className="px-3 py-1.5 border border-zinc-700 hover:border-[#C9A227] text-zinc-200 hover:text-white font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{tr(language, 'Export CSV', 'CSV ডাউনলোড')}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-800">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 text-[#E4C76B] border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">{tr(language, 'Order ID', 'অর্ডার আইডি')}</th>
                      <th className="px-3 py-2">{tr(language, 'Customer', 'ক্রেতা')}</th>
                      <th className="px-3 py-2">{tr(language, 'Payment', 'পেমেন্ট')}</th>
                      <th className="px-3 py-2">{tr(language, 'Total', 'মোট')}</th>
                      <th className="px-3 py-2">{tr(language, 'Order Status', 'অর্ডারের অবস্থা')}</th>
                      <th className="px-3 py-2 text-right">{tr(language, 'Manage', 'ব্যবস্থাপনা')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-950/60">
                        <td className="px-3 py-2.5 font-mono font-semibold text-white">{o.order_number}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-white">{o.customer_name}</p>
                          <p className="text-zinc-400">{o.customer_phone} · {o.country}</p>
                        </td>
                        <td className="px-3 py-2.5 uppercase text-zinc-300">
                          {o.payment_method} ({translatePaymentStatus(o.payment_status, language)})
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums font-semibold text-white">{formatPrice(o.final_total)}</td>
                        <td className="px-3 py-2.5 font-semibold text-[#E4C76B]">{translateOrderStatus(o.order_status, language)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            className="px-3 py-1 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
                          >
                            {tr(language, 'Inspect / Update', 'বিস্তারিত / আপডেট')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedOrder && (
                <div className="border-2 border-[#C9A227]/60 p-5 space-y-4 bg-zinc-950 text-zinc-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold font-mono text-white">
                      {tr(language, 'Manage Order', 'অর্ডার ব্যবস্থাপনা')} {selectedOrder.order_number}
                    </h3>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => window.print()} className="px-3 py-1 border border-zinc-700 hover:border-[#C9A227] text-zinc-200 flex items-center gap-1">
                        <Printer className="w-3.5 h-3.5" />
                        <span>{tr(language, 'Print Invoice', 'ইনভয়েস প্রিন্ট')}</span>
                      </button>
                      <button type="button" onClick={() => setSelectedOrder(null)} className="px-2 py-1 border border-zinc-700 hover:border-zinc-500 text-zinc-200">
                        {tr(language, 'Close', 'বন্ধ')}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-white">{tr(language, 'Detailed Delivery Address', 'বিস্তারিত ডেলিভারি ঠিকানা')}</p>
                      <p className="text-zinc-200 leading-relaxed">
                        {formatDetailedAddress(selectedOrder.address, language)}
                      </p>
                      {selectedOrder.address.landmark && (
                        <p className="text-zinc-400">
                          {tr(language, 'Landmark:', 'পরিচিত স্থান:')} {selectedOrder.address.landmark}
                        </p>
                      )}
                      {selectedOrder.address.instructions && (
                        <p className="text-zinc-400">
                          {tr(language, 'Delivery Note:', 'ডেলিভারি নির্দেশনা:')} {selectedOrder.address.instructions}
                        </p>
                      )}
                      {selectedOrder.transaction_id && (
                        <p className="font-mono text-[#E4C76B] mt-1">
                          {tr(language, 'Transaction ID:', 'ট্রানজেকশন আইডি:')} {selectedOrder.transaction_id}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Order Status', 'অর্ডারের অবস্থা')}</label>
                        <select
                          value={selectedOrder.order_status}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, order_status: e.target.value as any })}
                          className="w-full border border-zinc-700 bg-zinc-900 text-white px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                        >
                          {['Pending', 'Confirmed', 'Processing', 'Ready to Ship', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'].map((s) => (
                            <option key={s} value={s} className="bg-zinc-950 text-white">{translateOrderStatus(s, language)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Payment Status', 'পেমেন্টের অবস্থা')}</label>
                        <select
                          value={selectedOrder.payment_status}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, payment_status: e.target.value as any })}
                          className="w-full border border-zinc-700 bg-zinc-900 text-white px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                        >
                          {['pending', 'verified', 'paid', 'failed', 'refunded'].map((s) => (
                            <option key={s} value={s} className="bg-zinc-950 text-white">{translatePaymentStatus(s, language)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Courier Service', 'কুরিয়ার সার্ভিস')}</label>
                        <select
                          value={selectedOrder.courier_id ?? ''}
                          onChange={(e) =>
                            setSelectedOrder({ ...selectedOrder, courier_id: e.target.value ? Number(e.target.value) : null })
                          }
                          className="w-full border border-zinc-700 bg-zinc-900 text-white px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                        >
                          <option value="" className="bg-zinc-950 text-white">{tr(language, 'Select Courier', 'কুরিয়ার নির্বাচন করুন')}</option>
                          {shippingData.couriers.map((c) => (
                            <option key={c.id} value={c.id} className="bg-zinc-950 text-white">{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Tracking Number', 'ট্র্যাকিং নম্বর')}</label>
                        <input
                          type="text"
                          value={selectedOrder.tracking_number}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })}
                          className="w-full border border-zinc-700 bg-zinc-900 text-white px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                        body: JSON.stringify(selectedOrder),
                      });
                      if (res.ok) {
                        showToast(tr(language, 'Order updated', 'অর্ডার তথ্য আপডেট হয়েছে'), 'success');
                        await loadAllAdminData();
                      }
                    }}
                    className="px-5 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
                  >
                    {tr(language, 'Save Order Update', 'অর্ডার আপডেট সংরক্ষণ করুন')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6. CUSTOMERS */}
          {tab === 'customers' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4 text-xs">
              <h2 className="font-display text-2xl font-semibold text-white">
                {tr(language, 'Customers', 'ক্রেতাবৃন্দ')} ({customers.length})
              </h2>
              <div className="overflow-x-auto border border-zinc-800">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 text-[#E4C76B] border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">{tr(language, 'Customer', 'ক্রেতা')}</th>
                      <th className="px-3 py-2">{tr(language, 'Contact', 'যোগাযোগ')}</th>
                      <th className="px-3 py-2">{tr(language, 'Orders / Spent', 'অর্ডার / মোট খরচ')}</th>
                      <th className="px-3 py-2">{tr(language, 'Status', 'অবস্থা')}</th>
                      <th className="px-3 py-2 text-right">{tr(language, 'Action', 'অ্যাকশন')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-950/60">
                        <td className="px-3 py-2.5 font-semibold text-white">{c.name}</td>
                        <td className="px-3 py-2.5 text-zinc-300">{c.email} · {c.phone}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-200">
                          {c.order_count} {tr(language, 'orders', 'টি অর্ডার')} · {formatPrice(c.total_spent)}
                        </td>
                        <td className="px-3 py-2.5 uppercase font-semibold text-[#E4C76B]">
                          {c.status === 'active' ? tr(language, 'Active', 'সক্রিয়') : tr(language, 'Suspended', 'স্থগিত')}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              const next = c.status === 'active' ? 'suspended' : 'active';
                              await fetch(`/api/admin/customers/${c.id}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                                body: JSON.stringify({ status: next }),
                              });
                              await loadAllAdminData();
                            }}
                            className="px-3 py-1 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white transition-colors"
                          >
                            {c.status === 'active' ? tr(language, 'Suspend', 'স্থগিত করুন') : tr(language, 'Activate', 'সক্রিয় করুন')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. SHIPPING & COURIERS */}
          {tab === 'shipping' && (
            <div className="space-y-6 text-xs">
              <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
                <h2 className="font-display text-2xl font-semibold text-white">
                  {tr(language, 'Shipping Zones', 'ডেলিভারি জোনসমূহ')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {shippingData.zones.map((z) => (
                    <div key={z.id} className="border border-zinc-800 bg-zinc-950 p-3 space-y-1">
                      <div className="flex justify-between font-semibold text-white">
                        <span>{z.name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/shipping-zones/${z.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${adminToken}` },
                            });
                            await loadAllAdminData();
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-zinc-300">{z.country} · {z.district} · {z.area}</p>
                      <p className="font-mono text-[#E4C76B]">
                        {tr(language, 'Fee:', 'চার্জ:')} {formatPrice(z.base_fee)} · {tr(language, 'Free >', 'ফ্রি >')} {formatPrice(z.free_shipping_threshold)}
                      </p>
                      <p className="text-zinc-400">{z.estimated_days}</p>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch('/api/admin/shipping-zones', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                      body: JSON.stringify(newZone),
                    });
                    await loadAllAdminData();
                    showToast(tr(language, 'Shipping zone added', 'নতুন ডেলিভারি জোন যোগ হয়েছে'), 'success');
                  }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-zinc-800"
                >
                  <input type="text" required placeholder={tr(language, 'Zone Name', 'জোনের নাম')} value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <input type="text" required placeholder={tr(language, 'Country', 'দেশ')} value={newZone.country} onChange={(e) => setNewZone({ ...newZone, country: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <input type="text" placeholder={tr(language, 'District', 'জেলা')} value={newZone.district} onChange={(e) => setNewZone({ ...newZone, district: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <input type="number" step="0.01" placeholder={tr(language, 'Fee USD', 'চার্জ USD')} value={newZone.base_fee} onChange={(e) => setNewZone({ ...newZone, base_fee: Number(e.target.value) })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <input type="text" placeholder={tr(language, 'Estimated Days', 'সম্ভাব্য সময় (দিন)')} value={newZone.estimated_days} onChange={(e) => setNewZone({ ...newZone, estimated_days: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <button type="submit" className="px-4 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold">
                    {tr(language, 'Add Zone', 'জোন যোগ করুন')}
                  </button>
                </form>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
                <h2 className="font-display text-2xl font-semibold text-white">
                  {tr(language, 'Courier Services', 'কুরিয়ার সার্ভিসসমূহ')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {shippingData.couriers.map((c) => (
                    <div key={c.id} className="border border-zinc-800 bg-zinc-950 p-3 space-y-1">
                      <p className="font-semibold text-white">{c.name}</p>
                      <p className="text-zinc-300">{c.supported_regions} · {tr(language, 'Base', 'বেস')} {formatPrice(c.base_rate)}</p>
                      <p className="font-mono text-[11px] text-zinc-400 truncate">{c.tracking_url_template}</p>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch('/api/admin/couriers', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                      body: JSON.stringify(newCourier),
                    });
                    await loadAllAdminData();
                    showToast(tr(language, 'Courier added', 'নতুন কুরিয়ার সার্ভিস যোগ হয়েছে'), 'success');
                  }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-zinc-800"
                >
                  <input type="text" required placeholder={tr(language, 'Courier Name', 'কুরিয়ারের নাম')} value={newCourier.name} onChange={(e) => setNewCourier({ ...newCourier, name: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <input type="text" placeholder={tr(language, 'Regions', 'অঞ্চল/দেশ')} value={newCourier.supported_regions} onChange={(e) => setNewCourier({ ...newCourier, supported_regions: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <input type="text" placeholder={tr(language, 'Tracking URL Template', 'ট্র্যাকিং লিংক টেমপ্লেট')} value={newCourier.tracking_url_template} onChange={(e) => setNewCourier({ ...newCourier, tracking_url_template: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none" />
                  <button type="submit" className="px-4 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold">
                    {tr(language, 'Add Courier', 'কুরিয়ার যোগ করুন')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 8. PAYMENTS */}
          {tab === 'payments' && (
            <div className="space-y-6 text-xs">
              <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
                <h2 className="font-display text-2xl font-semibold text-white">
                  {tr(language, 'Payment Gateways (bKash, Nagad, COD, International)', 'পেমেন্ট গেটওয়ে (বিকাশ, নগদ, ক্যাশ অন ডেলিভারি, কার্ড)')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentData.settings.map((gw) => (
                    <div key={gw.gateway} className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-white">{gw.display_name}</span>
                        <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                          {gw.env_configured
                            ? tr(language, 'Server API Active', 'সার্ভার API সক্রিয়')
                            : gw.merchant_number
                            ? tr(language, `Send Money Active (${gw.merchant_number})`, `সেন্ড মানি সক্রিয় (${gw.merchant_number})`)
                            : tr(language, 'TrxID Verification Active', 'TrxID যাচাই সক্রিয়')}
                        </span>
                      </div>
                      <div className="flex gap-4 text-zinc-200">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={gw.is_enabled}
                            onChange={(e) =>
                              setPaymentData((prev) => ({
                                ...prev,
                                settings: prev.settings.map((s) =>
                                  s.gateway === gw.gateway ? { ...s, is_enabled: e.target.checked } : s
                                ),
                              }))
                            }
                            className="accent-[#C9A227]"
                          />
                          <span>{tr(language, 'Enabled', 'চালু')}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={gw.sandbox_mode}
                            onChange={(e) =>
                              setPaymentData((prev) => ({
                                ...prev,
                                settings: prev.settings.map((s) =>
                                  s.gateway === gw.gateway ? { ...s, sandbox_mode: e.target.checked } : s
                                ),
                              }))
                            }
                            className="accent-[#C9A227]"
                          />
                          <span>{tr(language, 'Sandbox Mode', 'টেস্ট / স্যান্ডবক্স মোড')}</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder={tr(language, 'Merchant Wallet Number (optional)', 'মার্চেন্ট ওয়ালেট নম্বর (ঐচ্ছিক)')}
                        value={gw.merchant_number}
                        onChange={(e) =>
                          setPaymentData((prev) => ({
                            ...prev,
                            settings: prev.settings.map((s) =>
                              s.gateway === gw.gateway ? { ...s, merchant_number: e.target.value } : s
                            ),
                          }))
                        }
                        className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                      />
                      <textarea
                        rows={2}
                        value={gw.instructions}
                        onChange={(e) =>
                          setPaymentData((prev) => ({
                            ...prev,
                            settings: prev.settings.map((s) =>
                              s.gateway === gw.gateway ? { ...s, instructions: e.target.value } : s
                            ),
                          }))
                        }
                        className="w-full border border-zinc-700 bg-zinc-900 text-white px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/payments/${gw.gateway}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                            body: JSON.stringify(gw),
                          });
                          await refreshStore();
                          showToast(`${gw.display_name} ${tr(language, 'saved', 'সংরক্ষিত হয়েছে')}`, 'success');
                        }}
                        className="px-4 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
                      >
                        {tr(language, 'Save Gateway Settings', 'গেটওয়ে সেটিং সংরক্ষণ করুন')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  {tr(language, 'Payment & Verification Records', 'পেমেন্ট ও যাচাইকরণ তালিকা')}
                </h3>
                <div className="overflow-x-auto border border-zinc-800">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-950 text-[#E4C76B] border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2">{tr(language, 'Order', 'অর্ডার')}</th>
                        <th className="px-3 py-2">{tr(language, 'Gateway', 'মাধ্যম')}</th>
                        <th className="px-3 py-2">{tr(language, 'Transaction ID', 'ট্রানজেকশন আইডি')}</th>
                        <th className="px-3 py-2">{tr(language, 'Amount', 'পরিমাণ')}</th>
                        <th className="px-3 py-2">{tr(language, 'Status', 'অবস্থা')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {paymentData.records.map((r: any) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-white">{r.order_number}</td>
                          <td className="px-3 py-2 uppercase text-zinc-300">{r.gateway}</td>
                          <td className="px-3 py-2 font-mono text-zinc-300">{r.transaction_id || 'COD'}</td>
                          <td className="px-3 py-2 font-mono text-white">{formatPrice(r.amount)}</td>
                          <td className="px-3 py-2 uppercase font-semibold text-[#E4C76B]">{translatePaymentStatus(r.status, language)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 9. COUPONS */}
          {tab === 'coupons' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-6 text-xs">
              <h2 className="font-display text-2xl font-semibold text-white">
                {tr(language, 'Coupons & Promotional Campaigns', 'কুপন কোড ও প্রোমোশনাল ক্যাম্পেইন')}
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/coupons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(newCoupon),
                  });
                  if (res.ok) {
                    setNewCoupon({ code: '', discount_type: 'percentage', discount_value: 10, min_order_value: 0, max_uses: 100, expires_at: '', campaign_name: '' });
                    await loadAllAdminData();
                    showToast(tr(language, 'Coupon created', 'নতুন কুপন তৈরি হয়েছে'), 'success');
                  }
                }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                <input type="text" required placeholder={tr(language, 'Code (e.g. NEXA10)', 'কুপন কোড (যেমন NEXA10)')} value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 font-mono uppercase focus:border-[#C9A227] focus:outline-none" />
                <select value={newCoupon.discount_type} onChange={(e) => setNewCoupon({ ...newCoupon, discount_type: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none">
                  <option value="percentage" className="bg-zinc-950 text-white">{tr(language, 'Percentage (%)', 'শতাংশ (%)')}</option>
                  <option value="fixed" className="bg-zinc-950 text-white">{tr(language, 'Fixed Amount ($)', 'নির্দিষ্ট পরিমাণ ($)')}</option>
                </select>
                <input type="number" required placeholder={tr(language, 'Value', 'ছাড়ের মান')} value={newCoupon.discount_value} onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: Number(e.target.value) })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none" />
                <input type="number" placeholder={tr(language, 'Min Order ($)', 'সর্বনিম্ন অর্ডার ($)')} value={newCoupon.min_order_value} onChange={(e) => setNewCoupon({ ...newCoupon, min_order_value: Number(e.target.value) })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none" />
                <input type="number" placeholder={tr(language, 'Max Uses', 'সর্বোচ্চ ব্যবহার')} value={newCoupon.max_uses} onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: Number(e.target.value) })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none" />
                <input type="date" value={newCoupon.expires_at} onChange={(e) => setNewCoupon({ ...newCoupon, expires_at: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                <input type="text" placeholder={tr(language, 'Campaign Name', 'ক্যাম্পেইনের নাম')} value={newCoupon.campaign_name} onChange={(e) => setNewCoupon({ ...newCoupon, campaign_name: e.target.value })} className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                <button type="submit" className="bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold px-4 py-2 transition-colors">
                  {tr(language, 'Create Coupon', 'কুপন তৈরি করুন')}
                </button>
              </form>

              <div className="space-y-2">
                {coupons.map((cp) => (
                  <div key={cp.id} className="border border-zinc-800 bg-zinc-950 p-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold text-sm text-[#E4C76B]">{cp.code}</span>
                      <span className="ml-3 text-zinc-300">
                        {cp.discount_type === 'percentage'
                          ? `${cp.discount_value}% ${tr(language, 'off', 'ছাড়')}`
                          : `$${cp.discount_value} ${tr(language, 'off', 'ছাড়')}`}{' '}
                        · {tr(language, 'Min', 'ন্যূনতম')} ${cp.min_order_value} · {tr(language, 'Used', 'ব্যবহৃত')} {cp.used_count}/{cp.max_uses}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/coupons/${cp.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${adminToken}` },
                        });
                        await loadAllAdminData();
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. REVIEWS */}
          {tab === 'reviews' && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4 text-xs">
              <h2 className="font-display text-2xl font-semibold text-white">
                {tr(language, 'Reviews & Customer Questions', 'রিভিউ ও ক্রেতাদের প্রশ্ন')} ({reviews.length})
              </h2>
              {reviews.length === 0 ? (
                <p className="text-zinc-400">
                  {tr(language, 'No customer reviews or questions submitted yet.', 'এখনো কোনো ক্রেতার রিভিউ বা প্রশ্ন জমা পড়েনি।')}
                </p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-white">{r.author_name} — {r.product_name}</span>
                      <span className="uppercase font-mono text-[#E4C76B]">
                        {r.status === 'approved'
                          ? tr(language, 'Approved', 'অনুমোদিত')
                          : r.status === 'rejected'
                          ? tr(language, 'Rejected', 'বাতিল')
                          : tr(language, 'Pending', 'অপেক্ষমাণ')}
                      </span>
                    </div>
                    <p className="text-zinc-200">{r.comment || r.question}</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/reviews/${r.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                            body: JSON.stringify({ status: 'approved' }),
                          });
                          await loadAllAdminData();
                        }}
                        className="px-3 py-1 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold"
                      >
                        {tr(language, 'Approve', 'অনুমোদন করুন')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/reviews/${r.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                            body: JSON.stringify({ status: 'rejected' }),
                          });
                          await loadAllAdminData();
                        }}
                        className="px-3 py-1 border border-zinc-700 text-zinc-200 hover:border-red-400 hover:text-red-300"
                      >
                        {tr(language, 'Reject', 'বাতিল করুন')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 11. OFFICIAL SOCIAL MEDIA & TELEGRAM LINKS */}
          {tab === 'social' && siteForm && (
            <div className="space-y-6 text-xs">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(siteForm),
                  });
                  if (res.ok) {
                    await refreshStore();
                    showToast(tr(language, 'Official social media & Telegram links saved', 'সোশ্যাল মিডিয়া ও টেলিগ্রাম লিংক সংরক্ষিত হয়েছে'), 'success');
                  } else {
                    showToast(tr(language, 'Failed to save social links', 'সোশ্যাল মিডিয়া লিংক সংরক্ষণ করা যায়নি'), 'error');
                  }
                }}
                className="bg-zinc-900 border border-zinc-800 p-6 space-y-6"
              >
                <div>
                  <h2 className="font-display text-2xl font-semibold text-white">
                    {tr(language, 'Official Social Media & Telegram Links', 'অফিশিয়াল সোশ্যাল মিডিয়া ও টেলিগ্রাম লিংক')}
                  </h2>
                  <p className="text-zinc-300 mt-1">
                    {tr(
                      language,
                      'Update all five official SHOPNEXA ROBI HUB social and customer support URLs shown in the website footer, homepage, and floating support widget.',
                      'ওয়েবসাইটের ফুটার, হোমপেজ ও ফ্লোটিং সাপোর্ট বাটনে প্রদর্শিত SHOPNEXA ROBI HUB-এর ৫টি অফিশিয়াল সোশ্যাল ও টেলিগ্রাম লিংক এখান থেকে আপডেট করুন।'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-zinc-200 mb-1">
                      {tr(language, '1. Facebook Page URL', '১. ফেসবুক পেজ লিংক')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={siteForm.facebook_url}
                        onChange={(e) => setSiteForm({ ...siteForm, facebook_url: e.target.value })}
                        className="flex-1 border border-zinc-700 bg-zinc-950 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                      />
                      <a
                        href={siteForm.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white font-semibold"
                      >
                        {tr(language, 'Test', 'পরীক্ষা')}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-200 mb-1">
                      {tr(language, '2. YouTube Channel URL', '২. ইউটিউব চ্যানেল লিংক')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={siteForm.youtube_url}
                        onChange={(e) => setSiteForm({ ...siteForm, youtube_url: e.target.value })}
                        className="flex-1 border border-zinc-700 bg-zinc-950 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                      />
                      <a
                        href={siteForm.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white font-semibold"
                      >
                        {tr(language, 'Test', 'পরীক্ষা')}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-200 mb-1">
                      {tr(language, '3. Telegram Channel URL', '৩. টেলিগ্রাম চ্যানেল লিংক')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={siteForm.telegram_channel_url}
                        onChange={(e) => setSiteForm({ ...siteForm, telegram_channel_url: e.target.value })}
                        className="flex-1 border border-zinc-700 bg-zinc-950 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                      />
                      <a
                        href={siteForm.telegram_channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white font-semibold"
                      >
                        {tr(language, 'Test', 'পরীক্ষা')}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-200 mb-1">
                      {tr(language, '4. Instagram Profile URL', '৪. ইনস্টাগ্রাম প্রোফাইল লিংক')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={siteForm.instagram_url}
                        onChange={(e) => setSiteForm({ ...siteForm, instagram_url: e.target.value })}
                        className="flex-1 border border-zinc-700 bg-zinc-950 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                      />
                      <a
                        href={siteForm.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white font-semibold"
                      >
                        {tr(language, 'Test', 'পরীক্ষা')}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-200 mb-1">
                      {tr(language, '5. Telegram Customer Support URL', '৫. টেলিগ্রাম কাস্টমার সাপোর্ট লিংক')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={siteForm.telegram_support_url}
                        onChange={(e) => setSiteForm({ ...siteForm, telegram_support_url: e.target.value })}
                        className="flex-1 border border-zinc-700 bg-zinc-950 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                      />
                      <a
                        href={siteForm.telegram_support_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white font-semibold"
                      >
                        {tr(language, 'Test', 'পরীক্ষা')}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-200 mb-1">
                      {tr(language, 'Telegram Support Handle', 'টেলিগ্রাম সাপোর্ট হ্যান্ডেল')}
                    </label>
                    <input
                      type="text"
                      value={siteForm.telegram_support_username}
                      onChange={(e) => setSiteForm({ ...siteForm, telegram_support_username: e.target.value })}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-200 mb-1">
                    {tr(language, 'Floating Telegram Support Instructions', 'ফ্লোটিং টেলিগ্রাম সাপোর্ট নির্দেশনা')}
                  </label>
                  <textarea
                    rows={2}
                    value={siteForm.telegram_support_instructions}
                    onChange={(e) => setSiteForm({ ...siteForm, telegram_support_instructions: e.target.value })}
                    className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      {tr(language, 'Telegram Bot Server Alerts', 'টেলিগ্রাম বট সার্ভার সতর্কতা')}
                    </h3>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {settings?.telegram_configured
                        ? tr(language, 'Bot Alerts Active', 'বট সতর্কতা সক্রিয়')
                        : tr(language, 'Telegram Channel & Support Active', 'টেলিগ্রাম চ্যানেল ও সাপোর্ট সক্রিয়')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-zinc-200">
                    {(
                      [
                        ['new_order', tr(language, 'New Order Alerts', 'নতুন অর্ডার সতর্কতা')],
                        ['new_customer', tr(language, 'New Customer Alerts', 'নতুন ক্রেতা সতর্কতা')],
                        ['payment', tr(language, 'Payment Notifications', 'পেমেন্ট বিজ্ঞপ্তি')],
                        ['low_stock', tr(language, 'Low Stock Alerts', 'কম স্টক সতর্কতা')],
                        ['order_status', tr(language, 'Order Status Updates', 'অর্ডার অবস্থা আপডেট')],
                        ['support', tr(language, 'Support Alerts', 'সাপোর্ট সতর্কতা')],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={siteForm.telegram_alerts[k]}
                          onChange={(e) =>
                            setSiteForm({
                              ...siteForm,
                              telegram_alerts: { ...siteForm.telegram_alerts, [k]: e.target.checked },
                            })
                          }
                          className="accent-[#C9A227]"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch('/api/admin/telegram/test', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${adminToken}` },
                      });
                      const d = await res.json();
                      showToast(
                        res.ok && d.sent
                          ? tr(language, 'Test alert sent to Telegram', 'টেলিগ্রামে টেস্ট সতর্কতা পাঠানো হয়েছে')
                          : d.error || tr(language, 'Telegram not configured', 'টেলিগ্রাম বট সেট করা নেই'),
                        res.ok ? 'success' : 'error'
                      );
                    }}
                    className="px-3 py-1.5 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{tr(language, 'Send Test Telegram Alert', 'টেস্ট টেলিগ্রাম সতর্কতা পাঠান')}</span>
                  </button>
                </div>

                <button type="submit" className="px-6 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold">
                  {tr(language, 'Save Social & Telegram Links', 'সোশ্যাল ও টেলিগ্রাম লিংক সংরক্ষণ করুন')}
                </button>
              </form>
            </div>
          )}

          {/* 12. WEBSITE, CREDENTIALS & BACKUP SETTINGS */}
          {tab === 'settings' && siteForm && (
            <div className="space-y-6 text-xs">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(siteForm),
                  });
                  if (res.ok) {
                    await refreshStore();
                    showToast(tr(language, 'Website & location settings saved', 'ওয়েবসাইট ও ঠিকানার তথ্য সংরক্ষিত হয়েছে'), 'success');
                  }
                }}
                className="bg-zinc-900 border border-zinc-800 p-6 space-y-6"
              >
                <h2 className="font-display text-2xl font-semibold text-white">
                  {tr(language, 'Website & Business Location Settings', 'ওয়েবসাইট ও ব্যবসার ঠিকানা সেটিংস')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Brand Name', 'ব্র্যান্ডের নাম')}</label>
                    <input type="text" value={siteForm.brand_name} onChange={(e) => setSiteForm({ ...siteForm, brand_name: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Main Headline / Tagline', 'মূল শিরোনাম / ট্যাগলাইন')}</label>
                    <input type="text" value={siteForm.tagline} onChange={(e) => setSiteForm({ ...siteForm, tagline: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Logo Slogan', 'লোগো স্লোগান')}</label>
                    <input type="text" value={siteForm.logo_slogan || 'SHOP • DISCOVER • ENJOY'} onChange={(e) => setSiteForm({ ...siteForm, logo_slogan: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Hero Title', 'হিরো ব্যানার শিরোনাম')}</label>
                    <input type="text" value={siteForm.hero_title} onChange={(e) => setSiteForm({ ...siteForm, hero_title: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Promo Banner Text', 'প্রোমো ব্যানার লেখা')}</label>
                    <input type="text" value={siteForm.promo_banner_text} onChange={(e) => setSiteForm({ ...siteForm, promo_banner_text: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Contact Email', 'যোগাযোগের ইমেইল')}</label>
                    <input type="email" value={siteForm.contact_email} onChange={(e) => setSiteForm({ ...siteForm, contact_email: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">{tr(language, 'Business Location / Address', 'ব্যবসার ঠিকানা')}</label>
                    <input type="text" value={siteForm.business_address} onChange={(e) => setSiteForm({ ...siteForm, business_address: e.target.value })} className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      {tr(language, 'Customer App Download Visibility', 'ক্রেতাদের জন্য অ্যাপ ডাউনলোড প্রদর্শন')}
                    </label>
                    <select
                      value={siteForm.customer_download_buyers_only === false ? 'public' : 'buyers_only'}
                      onChange={(e) =>
                        setSiteForm({
                          ...siteForm,
                          customer_download_buyers_only: e.target.value !== 'public',
                        })
                      }
                      className="w-full border border-zinc-700 px-3 py-2 bg-zinc-950 text-white focus:border-[#C9A227] focus:outline-none"
                    >
                      <option value="buyers_only" className="bg-zinc-950 text-white">
                        {tr(language, 'Buyers Only (Visible only after product purchase)', 'শুধু ক্রেতাদের জন্য (পণ্য কেনার পর দেখা যাবে)')}
                      </option>
                      <option value="public" className="bg-zinc-950 text-white">
                        {tr(language, 'Public (Visible to all storefront visitors)', 'সবার জন্য উন্মুক্ত (সকল ভিজিটর দেখতে পারবে)')}
                      </option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-zinc-300 mb-1">
                      {tr(language, 'Android APK Download URL (Optional)', 'অ্যান্ড্রয়েড APK ডাউনলোড লিংক (ঐচ্ছিক)')}
                    </label>
                    <input
                      type="text"
                      value={siteForm.android_apk_url || ''}
                      onChange={(e) => setSiteForm({ ...siteForm, android_apk_url: e.target.value })}
                      placeholder={tr(
                        language,
                        'https://... or /shopnexa-robi-hub.apk (leave blank to use Chrome PWA / WebAPK install)',
                        'https://... অথবা /shopnexa-robi-hub.apk (খালি রাখলে Chrome PWA / WebAPK ইনস্টল ব্যবহার হবে)'
                      )}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                </div>

                <button type="submit" className="px-6 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors">
                  {tr(language, 'Save Website Settings', 'ওয়েবসাইট সেটিংস সংরক্ষণ করুন')}
                </button>
              </form>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCredBusy(true);
                  try {
                    const res = await fetch('/api/admin/auth/credentials', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                      body: JSON.stringify(credForm),
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      showToast(d.error || tr(language, 'Failed to update admin credentials', 'অ্যাডমিন তথ্য আপডেট করা যায়নি'), 'error');
                    } else {
                      setCredForm({ currentPasscode: '', newUsername: '', newPasscode: '', newGmail: '' });
                      showToast(tr(language, 'Administrator credentials updated', 'অ্যাডমিন তথ্য সফলভাবে আপডেট হয়েছে'), 'success');
                    }
                  } finally {
                    setCredBusy(false);
                  }
                }}
                className="bg-zinc-900 border border-zinc-800 p-6 space-y-4"
              >
                <h3 className="text-sm font-semibold text-white">
                  {tr(language, 'Administrator Credentials & Hidden Verification Gmail', 'অ্যাডমিন লগইন তথ্য ও গোপন যাচাইকরণ জিমেইল')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      {tr(language, 'Current Password *', 'বর্তমান পাসওয়ার্ড *')}
                    </label>
                    <input
                      type="password"
                      required
                      value={credForm.currentPasscode}
                      onChange={(e) => setCredForm({ ...credForm, currentPasscode: e.target.value })}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      {tr(language, 'New Admin Name (Optional)', 'নতুন অ্যাডমিন নাম (ঐচ্ছিক)')}
                    </label>
                    <input
                      type="text"
                      value={credForm.newUsername}
                      onChange={(e) => setCredForm({ ...credForm, newUsername: e.target.value })}
                      placeholder={tr(language, 'Leave blank to keep current', 'অপরিবর্তিত রাখতে খালি রাখুন')}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      {tr(language, 'New Password (Optional, min 6)', 'নতুন পাসওয়ার্ড (ঐচ্ছিক, কমপক্ষে ৬ অক্ষর)')}
                    </label>
                    <input
                      type="password"
                      minLength={6}
                      value={credForm.newPasscode}
                      onChange={(e) => setCredForm({ ...credForm, newPasscode: e.target.value })}
                      placeholder={tr(language, 'Leave blank to keep current', 'অপরিবর্তিত রাখতে খালি রাখুন')}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      {tr(language, 'New Verification Gmail (Hidden)', 'নতুন যাচাইকরণ জিমেইল (গোপন)')}
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={credForm.newGmail}
                      onChange={(e) => setCredForm({ ...credForm, newGmail: e.target.value })}
                      placeholder={tr(language, 'Leave blank to keep hidden Gmail', 'বর্তমান গোপন জিমেইল রাখতে খালি রাখুন')}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                </div>
                <button type="submit" disabled={credBusy} className="px-5 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors">
                  {credBusy ? tr(language, 'Updating...', 'আপডেট হচ্ছে...') : tr(language, 'Update Admin Credentials', 'অ্যাডমিন তথ্য আপডেট করুন')}
                </button>
              </form>

              <div className="bg-black text-white border border-[#C9A227]/50 p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src="/pwa-192x192.png"
                    alt="SHOPNEXA ROBI HUB App Icon"
                    className="w-14 h-14 rounded-2xl border border-[#C9A227]/80 shadow-lg shrink-0 object-cover"
                  />
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-[#E4C76B]">
                      {tr(language, 'INSTALLABLE MOBILE & DESKTOP APP', 'ইনস্টলযোগ্য মোবাইল ও ডেস্কটপ অ্যাপ')}
                    </p>
                    <h3 className="font-display text-xl font-semibold text-white mt-0.5">
                      {tr(language, 'SHOPNEXA ROBI HUB App', 'SHOPNEXA ROBI HUB অ্যাপ')}
                    </h3>
                    <p className="text-zinc-300 mt-0.5">
                      {tr(
                        language,
                        'Install SHOPNEXA ROBI HUB with its custom metallic gold app icon directly on your phone or desktop.',
                        'কাস্টম সোনালি অ্যাপ আইকনসহ SHOPNEXA ROBI HUB সরাসরি আপনার ফোন বা কম্পিউটারে ইনস্টল করুন।'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <PWAInstallButton variant="banner" label={tr(language, 'Download SHOPNEXA ROBI HUB App', 'SHOPNEXA ROBI HUB অ্যাপ ডাউনলোড করুন')} />
                </div>
              </div>

              <div className="bg-zinc-900 border border-[#C9A227]/40 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#E4C76B]">
                      {tr(language, 'GitHub & Render One-Step Deploy Hub', 'গিটহাব ও রেন্ডার সহজ ডিপ্লয় অপশন')}
                    </h3>
                    <p className="text-zinc-300 mt-1 leading-relaxed">
                      {tr(
                        language,
                        'Download a clean source-only ZIP (without .db, uploads, or node_modules), sign in/sign up on GitHub to upload to ronivv290-glitch/Shopnexa, then click Deploy latest commit on Render.',
                        'কোনো ভেজাল ফাইল (.db, uploads বা node_modules) ছাড়াই ক্লিন কোড ZIP ডাউনলোড করুন, নিচের বাটন থেকে গিটহাবে সাইন ইন/সাইন আপ করে ronivv290-glitch/Shopnexa-তে আপলোড দিন এবং Render-এ Deploy latest commit চাপুন।'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={githubZipBusy}
                    onClick={() => void handleDownloadGithubZip()}
                    className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {githubZipBusy
                        ? tr(language, 'Preparing Clean ZIP...', 'ক্লিন ZIP প্রস্তুত হচ্ছে...')
                        : tr(language, 'Download Clean GitHub ZIP (Deploy-Ready)', 'গিটহাব ক্লিন ZIP ডাউনলোড (ভেজাল ছাড়া)')}
                    </span>
                  </button>
                  <a
                    href="https://github.com/login?return_to=%2Fronivv290-glitch%2FShopnexa%2Fupload%2Fmain"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-zinc-950 border border-[#C9A227]/70 hover:border-[#E4C76B] text-[#E4C76B] hover:text-white font-semibold flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{tr(language, 'Sign In & Upload to GitHub', 'গিটহাব সাইন ইন ও আপলোড')}</span>
                  </a>
                  <a
                    href="https://github.com/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-zinc-700 hover:border-white text-zinc-200 hover:text-white font-semibold flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{tr(language, 'Sign Up GitHub', 'গিটহাব সাইন আপ')}</span>
                  </a>
                  <a
                    href="https://dashboard.render.com/web/srv-dc14ff0u01pc738o791g"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-600 hover:text-black font-semibold flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{tr(language, 'Open Render Deploy (srv-dc14ff0u01pc738o791g)', 'Render ডিপ্লয় খুলুন')}</span>
                  </a>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {tr(language, 'Complete Website A-to-Z Archive & Database Backup / Restore', 'সম্পূর্ণ ওয়েবসাইট (A–Z) ZIP ও ডাটাবেজ ব্যাকআপ / রিস্টোর')}
                    </h3>
                    <p className="text-zinc-300 mt-0.5">
                      {tr(
                        language,
                        'Download the complete SHOPNEXA ROBI HUB website package, export your standalone SQLite database (.db), or restore a previously saved .db backup so all your settings, products & orders stay intact after redeploying.',
                        'সম্পূর্ণ SHOPNEXA ROBI HUB ওয়েবসাইট প্যাকেজ ডাউনলোড করুন, SQLite ডাটাবেজ (.db) সংরক্ষণ করুন, অথবা রি-ডিপ্লয় করার পর পূর্বের সংরক্ষিত .db ব্যাকআপ রিস্টোর করে সব পণ্য, সেটিংস ও অর্ডার অক্ষুণ্ণ রাখুন।'
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={zipBusy}
                      onClick={() => void handleDownloadFullZip()}
                      className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {zipBusy
                          ? tr(language, 'Preparing A–Z ZIP...', 'A–Z ZIP প্রস্তুত হচ্ছে...')
                          : tr(language, 'Download Full Website ZIP (A–Z)', 'সম্পূর্ণ ওয়েবসাইট ZIP (A–Z)')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadBackup()}
                      className="px-4 py-2 border border-zinc-700 text-zinc-100 hover:border-[#C9A227] hover:text-[#E4C76B] font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>{tr(language, 'Download Database (.db)', 'ডাটাবেজ ডাউনলোড (.db)')}</span>
                    </button>
                    <button
                      type="button"
                      disabled={restoreBusy}
                      onClick={() => restoreInputRef.current?.click()}
                      className="px-4 py-2 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-600 hover:text-black font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{tr(language, 'Restore Database (.db)', 'ডাটাবেজ রিস্টোর (.db)')}</span>
                    </button>
                    <input
                      ref={restoreInputRef}
                      type="file"
                      accept=".db,.sqlite,.sqlite3,application/octet-stream"
                      onChange={handleSelectRestoreFile}
                      className="hidden"
                    />
                  </div>
                </div>

                {restoreFile && (
                  <div className="border border-[#C9A227]/60 bg-black/80 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-[#E4C76B]">
                        {tr(language, 'Ready to restore:', 'রিস্টোরের জন্য প্রস্তুত:')}{' '}
                        <span className="text-white font-mono">{restoreFile.name}</span> ({(restoreFile.size / 1024).toFixed(1)} KB)
                      </p>
                      <p className="text-zinc-400">
                        {tr(
                          language,
                          'All website settings, products, categories, coupons, orders & customer records will be restored from this backup file.',
                          'এই ব্যাকআপ ফাইল থেকে ওয়েবসাইটের সকল সেটিংস, পণ্য, ক্যাটাগরি, কুপন, অর্ডার ও ক্রেতাদের তথ্য রিস্টোর করা হবে।'
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={restoreBusy}
                        onClick={() => void handleConfirmRestoreBackup()}
                        className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold transition-colors"
                      >
                        {restoreBusy ? tr(language, 'Restoring...', 'রিস্টোর হচ্ছে...') : tr(language, 'Confirm & Restore Now', 'নিশ্চিত করুন ও রিস্টোর করুন')}
                      </button>
                      <button
                        type="button"
                        disabled={restoreBusy}
                        onClick={() => setRestoreFile(null)}
                        className="px-3 py-2 border border-zinc-700 hover:border-white text-zinc-300 text-xs font-semibold transition-colors"
                      >
                        {tr(language, 'Cancel', 'বাতিল')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {blockedGmails.length > 0 && (
                <div className="bg-zinc-900 border border-red-900/60 p-6 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-red-300">
                      {tr(language, 'Blocked Unauthorized Gmails (Admin Security Trap)', 'ব্লক করা অননুমোদিত জিমেইল (নিরাপত্তা ফাঁদ)')}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tr(
                        language,
                        'Anyone who entered a wrong Gmail during Step 2 admin verification was automatically blocked here.',
                        'ধাপ ২ অ্যাডমিন যাচাইকরণে কেউ ভুল জিমেইল দিলে তা স্বয়ংক্রিয়ভাবে এখানে ব্লক হয়ে যায়।'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {blockedGmails.map((b: any) => (
                      <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2 text-xs">
                        <div>
                          <p className="font-mono text-red-300 font-semibold">{b.email}</p>
                          <p className="text-[11px] text-zinc-400">
                            {tr(language, 'Blocked at:', 'ব্লকের সময়:')} {b.blocked_at} {b.ip_address ? `• IP: ${b.ip_address}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/blocked-gmails/${b.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${adminToken}` },
                            });
                            showToast(`${tr(language, 'Unblocked', 'আনব্লক হয়েছে:')} ${b.email}`, 'success');
                            await loadAllAdminData();
                          }}
                          className="px-3 py-1.5 border border-zinc-700 hover:border-[#C9A227] text-zinc-200 hover:text-[#E4C76B] text-[11px] font-semibold transition-colors"
                        >
                          {tr(language, 'Unblock', 'আনব্লক')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errorLogs.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 p-6 space-y-2">
                  <h3 className="text-sm font-semibold text-white">
                    {tr(language, 'Recent Server Error Logs', 'সাম্প্রতিক সার্ভার ত্রুটি লগ')}
                  </h3>
                  {errorLogs.slice(0, 10).map((l: any) => (
                    <div key={l.id} className="font-mono text-[11px] text-red-400 border-b border-zinc-800 pb-1">
                      [{l.created_at}] {l.route}: {l.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {editingProduct.open && (
        <AdminProductEditor
          initialProduct={editingProduct.product}
          defaultType={editingProduct.defaultType}
          categories={categories}
          onClose={() => setEditingProduct({ open: false, product: null, defaultType: 'own' })}
          onSaved={async () => {
            await loadAllAdminData();
            await refreshStore();
          }}
        />
      )}
    </div>
  );
}
