import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Home,
} from 'lucide-react';
import type {
  Category,
  Product,
  ProductColor,
  ProductSize,
  ProductVariation,
  ProductUploadVerification,
} from '../types.ts';
import { useStore } from '../context/StoreContext.tsx';
import {
  CURRENCIES,
  convertCurrency,
  normalizeNumericInput,
  tr,
  translateCategory,
  type LanguageCode,
} from '../i18n.ts';

interface AdminProductEditorProps {
  initialProduct?: Product | null;
  defaultType?: 'own' | 'affiliate';
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface UploadErrorReport {
  field: string;
  fieldLabel: string;
  code?: string;
  error: string;
  fixHint: string;
}

const CLOTHING_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const WEIGHT_VOLUME_PRESETS = ['250g', '500g', '1kg', '2kg', '500ml', '1L'];
const GENERAL_PRESETS = ['Small', 'Medium', 'Large', 'Extra Large', 'Free Size'];

const COUNTRY_QUICK_OPTIONS: Array<{ value: string; en: string; bn: string }> = [
  { value: 'Bangladesh', en: 'Bangladesh', bn: 'বাংলাদেশ' },
  { value: 'China', en: 'China', bn: 'চীন' },
  { value: 'India', en: 'India', bn: 'ভারত' },
  { value: 'Turkey', en: 'Turkey', bn: 'তুরস্ক' },
  { value: 'Vietnam', en: 'Vietnam', bn: 'ভিয়েতনাম' },
  { value: 'United States', en: 'United States', bn: 'যুক্তরাষ্ট্র' },
  { value: 'United Kingdom', en: 'United Kingdom', bn: 'যুক্তরাজ্য' },
  { value: 'United Arab Emirates', en: 'UAE', bn: 'সংযুক্ত আরব আমিরাত' },
  { value: 'International', en: 'International', bn: 'আন্তর্জাতিক' },
];

const COLOR_PRESETS: Array<{ en: string; bn: string; hex: string }> = [
  { en: 'Black', bn: 'কালো', hex: '#09090B' },
  { en: 'White', bn: 'সাদা', hex: '#FFFFFF' },
  { en: 'Red', bn: 'লাল', hex: '#DC2626' },
  { en: 'Blue', bn: 'নীল', hex: '#2563EB' },
  { en: 'Green', bn: 'সবুজ', hex: '#16A34A' },
  { en: 'Gold', bn: 'সোনালি', hex: '#C9A227' },
  { en: 'Brown', bn: 'বাদামী', hex: '#78350F' },
  { en: 'Gray', bn: 'ধূসর', hex: '#6B7280' },
  { en: 'Maroon', bn: 'মেরুন', hex: '#881337' },
  { en: 'Navy Blue', bn: 'নেভি ব্লু', hex: '#1E3A8A' },
  { en: 'Yellow', bn: 'হলুদ', hex: '#EAB308' },
  { en: 'Pink', bn: 'গোলাপি', hex: '#EC4899' },
];

function getFieldLabel(field: string, lang: LanguageCode): string {
  const map: Record<string, { en: string; bn: string }> = {
    name: { en: 'Product Name', bn: 'পণ্যের নাম' },
    category_id: { en: 'Category', bn: 'ক্যাটাগরি' },
    selling_price: { en: 'Selling Price', bn: 'বিক্রয় মূল্য / দাম' },
    sale_price: { en: 'Offer / Sale Price', bn: 'সেল / অফার প্রাইজ' },
    original_price: { en: 'Original Price', bn: 'পূর্বের / আসল দাম' },
    currency: { en: 'Currency', bn: 'কারেন্সি (টাকা / ডলার)' },
    total_stock: { en: 'Total Stock', bn: 'স্টকের পরিমাণ' },
    images: { en: 'Product Images', bn: 'পণ্যের ছবি' },
    video_url: { en: 'Product Video', bn: 'পণ্যের ভিডিও' },
    affiliate_url: { en: 'Affiliate Link', bn: 'অ্যাফিলিয়েট লিংক' },
    product_code: { en: 'Product Code', bn: 'প্রোডাক্ট কোড' },
    colors: { en: 'Colors', bn: 'রঙ (Colors)' },
    sizes: { en: 'Sizes', bn: 'সাইজ (Sizes)' },
    country_of_origin: { en: 'Country of Origin', bn: 'উৎপাদনকারী দেশ' },
    server: { en: 'Server / Database Connection', bn: 'সার্ভার / ডাটাবেজ সংযোগ' },
    network: { en: 'Network Connection', bn: 'ইন্টারনেট / নেটওয়ার্ক সংযোগ' },
    auth: { en: 'Admin Login Session', bn: 'অ্যাডমিন লগইন সেশন' },
  };
  const entry = map[field];
  if (!entry) return field;
  return lang === 'bn' ? entry.bn : entry.en;
}

const SPEC_TEMPLATES: Record<'clothing' | 'electronics' | 'shoes', Array<{ en: string; bn: string }>> = {
  clothing: [
    { en: 'Fabric Type', bn: 'কাপড়ের ধরন (Fabric)' },
    { en: 'Material', bn: 'উপাদান (Material)' },
    { en: 'Fit Type', bn: 'ফিট (Fit Type)' },
    { en: 'Sleeve', bn: 'হাতা (Sleeve)' },
    { en: 'Gender', bn: 'জেন্ডার (Gender)' },
    { en: 'Care Instructions', bn: 'যত্ন নির্দেশনা (Care)' },
  ],
  electronics: [
    { en: 'Brand', bn: 'ব্র্যান্ড (Brand)' },
    { en: 'Model', bn: 'মডেল (Model)' },
    { en: 'Battery', bn: 'ব্যাটারি (Battery)' },
    { en: 'Display', bn: 'ডিসপ্লে (Display)' },
    { en: 'Connectivity', bn: 'কানেক্টিভিটি (Connectivity)' },
    { en: 'Warranty', bn: 'ওয়ারেন্টি (Warranty)' },
  ],
  shoes: [
    { en: 'Upper Material', bn: 'উপরের উপাদান (Upper)' },
    { en: 'Sole Type', bn: 'সোলের ধরন (Sole)' },
    { en: 'Inner Lining', bn: 'ভিতরের লাইনিং (Inner)' },
    { en: 'Closure', bn: 'ক্লোজার (Closure)' },
    { en: 'Heel Height', bn: 'হিলের উচ্চতা (Heel)' },
    { en: 'Weight', bn: 'ওজন (Weight)' },
  ],
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm']);

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseNum(val: string | number, fallback = 0): number {
  const norm = normalizeNumericInput(val);
  if (!norm) return fallback;
  const n = Number(norm);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function AdminProductEditor({
  initialProduct,
  defaultType = 'own',
  categories,
  onClose,
  onSaved,
}: AdminProductEditorProps) {
  const { language, adminToken, showToast, exchangeRates, navigate } = useStore();
  const scrollContainerRef = useRef<HTMLFormElement | null>(null);
  const requestIdRef = useRef<string>(createRequestId());

  const [productType, setProductType] = useState<'own' | 'affiliate'>(
    initialProduct?.product_type || defaultType
  );
  const [name, setName] = useState(initialProduct?.name || '');
  const [productCode, setProductCode] = useState(initialProduct?.product_code || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [brand, setBrand] = useState(initialProduct?.brand || '');
  const [manufacturer, setManufacturer] = useState(initialProduct?.manufacturer || '');
  const [categoryId, setCategoryId] = useState<number>(initialProduct?.category_id || categories[0]?.id || 1);
  const [subcategory, setSubcategory] = useState(initialProduct?.subcategory || '');
  const [countryOfOrigin, setCountryOfOrigin] = useState(
    initialProduct?.country_of_origin || (language === 'bn' ? 'বাংলাদেশ' : 'Bangladesh')
  );
  const [status, setStatus] = useState<'active' | 'draft' | 'out_of_stock'>(initialProduct?.status || 'active');
  const [shortDescription, setShortDescription] = useState(initialProduct?.short_description || '');
  const [fullDescription, setFullDescription] = useState(initialProduct?.full_description || '');
  const [highlightsText, setHighlightsText] = useState((initialProduct?.highlights || []).join('\n'));
  const [images, setImages] = useState<string[]>(initialProduct?.images || []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [videoUrl, setVideoUrl] = useState(initialProduct?.video_url || '');

  // Default ON for new products so newly uploaded products appear immediately everywhere
  const [isFeatured, setIsFeatured] = useState(initialProduct ? initialProduct.is_featured : true);
  const [isNewArrival, setIsNewArrival] = useState(initialProduct ? initialProduct.is_new_arrival : true);
  const [isTrending, setIsTrending] = useState(initialProduct?.is_trending ?? false);
  const [isBestSeller, setIsBestSeller] = useState(initialProduct?.is_best_seller ?? false);
  const [isSpecialOffer, setIsSpecialOffer] = useState(initialProduct?.is_special_offer ?? false);
  const [isRecommended, setIsRecommended] = useState(initialProduct ? initialProduct.is_recommended : true);
  const [collectionTag, setCollectionTag] = useState(initialProduct?.collection_tag || '');

  // Base currency defaults to BDT (৳) for new uploads so entering 1081 shows ৳1,081 with zero inflation
  const [productCurrency, setProductCurrency] = useState<string>(initialProduct?.currency || 'BDT');
  const [originalPrice, setOriginalPrice] = useState(
    initialProduct ? String(initialProduct.original_price) : ''
  );
  const [sellingPrice, setSellingPrice] = useState(
    initialProduct ? String(initialProduct.selling_price) : ''
  );
  const [salePrice, setSalePrice] = useState(
    initialProduct ? String(initialProduct.sale_price) : ''
  );
  const [wholesalePrice, setWholesalePrice] = useState(String(initialProduct?.wholesale_price ?? 0));
  const [shippingCost, setShippingCost] = useState(String(initialProduct?.shipping_cost ?? 0));
  const [taxInfo, setTaxInfo] = useState(initialProduct?.tax_info || '');
  const [totalStock, setTotalStock] = useState(String(initialProduct?.total_stock ?? 20));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(initialProduct?.low_stock_threshold ?? 5));

  const [packageContents, setPackageContents] = useState(initialProduct?.package_contents || '');
  const [numberOfPieces, setNumberOfPieces] = useState(String(initialProduct?.number_of_pieces ?? 1));
  const [packageQuantity, setPackageQuantity] = useState(String(initialProduct?.package_quantity ?? 1));
  const [packageLength, setPackageLength] = useState(initialProduct?.package_length || '');
  const [packageWidth, setPackageWidth] = useState(initialProduct?.package_width || '');
  const [packageHeight, setPackageHeight] = useState(initialProduct?.package_height || '');
  const [packageWeight, setPackageWeight] = useState(initialProduct?.package_weight || '');
  const [shippingWeight, setShippingWeight] = useState(initialProduct?.shipping_weight || '');
  const [includedAccessories, setIncludedAccessories] = useState(initialProduct?.included_accessories || '');

  const [affiliateUrl, setAffiliateUrl] = useState(initialProduct?.affiliate_url || '');
  const [estimatedDelivery, setEstimatedDelivery] = useState(initialProduct?.estimated_delivery || '');
  const [shippingInfo, setShippingInfo] = useState(initialProduct?.shipping_info || '');
  const [returnPolicy, setReturnPolicy] = useState(initialProduct?.return_policy || '');

  const [colors, setColors] = useState<ProductColor[]>(initialProduct?.colors || []);
  const [sizes, setSizes] = useState<ProductSize[]>(initialProduct?.sizes || []);
  const [variations, setVariations] = useState<ProductVariation[]>(initialProduct?.variations || []);
  const [specsList, setSpecsList] = useState<Array<{ key: string; value: string }>>(
    Object.entries(initialProduct?.specs || {}).map(([key, value]) => ({ key, value }))
  );

  // Shoe range builder states
  const [shoeRangeStart, setShoeRangeStart] = useState('39');
  const [shoeRangeEnd, setShoeRangeEnd] = useState('44');
  const [shoeRangeSystem, setShoeRangeSystem] = useState<'EU' | 'Standard' | 'US' | 'UK' | 'Custom'>('EU');
  const [shoeRangeStock, setShoeRangeStock] = useState('10');

  // Upload & Submission states
  const [mediaUploading, setMediaUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorReport, setErrorReport] = useState<UploadErrorReport | null>(null);
  const [verificationResult, setVerificationResult] = useState<ProductUploadVerification | null>(null);
  const [savedProductId, setSavedProductId] = useState<number | null>(initialProduct?.id ?? null);

  const variationStats = useMemo(() => {
    const availColors = colors.filter((c) => c.is_available && c.stock > 0).length;
    const availSizes = sizes.filter((s) => s.is_available && s.stock > 0).length;
    const validVars =
      variations.length > 0
        ? variations.filter((v) => v.is_available && v.stock > 0).length
        : availColors > 0 && availSizes > 0
        ? availColors * availSizes
        : Math.max(availColors, availSizes, 1);
    return { availColors, availSizes, validVars };
  }, [colors, sizes, variations]);

  // Live currency conversion preview
  const pricePreview = useMemo(() => {
    const rawSale = parseNum(salePrice, Number.NaN);
    const rawSelling = parseNum(sellingPrice, Number.NaN);
    const active =
      Number.isFinite(rawSale) && rawSale > 0
        ? rawSale
        : Number.isFinite(rawSelling) && rawSelling > 0
        ? rawSelling
        : 0;
    const inBdt = convertCurrency(active, productCurrency, 'BDT', exchangeRates);
    const inUsd = convertCurrency(active, productCurrency, 'USD', exchangeRates);
    return {
      active,
      bdtText: `৳${Math.round(inBdt).toLocaleString()}`,
      usdText: `$${inUsd.toFixed(2)}`,
    };
  }, [salePrice, sellingPrice, productCurrency, exchangeRates]);

  const reportError = (field: string, error: string, fixHint: string, code?: string) => {
    setErrorReport({
      field,
      fieldLabel: getFieldLabel(field, language),
      code,
      error,
      fixHint,
    });
    showToast(error, 'error');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Upload a single file with XHR progress & explicit validation
  const uploadSingleFile = (file: File, expectedKind: 'image' | 'video'): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!adminToken) {
        reject({
          field: 'auth',
          error: tr(language, 'Admin session not found.', 'অ্যাডমিন সেশন পাওয়া যায়নি।'),
          fixHint: tr(language, 'Please sign in as admin again.', 'পুনরায় অ্যাডমিন হিসেবে লগইন করুন।'),
        });
        return;
      }
      if (file.size === 0) {
        reject({
          field: expectedKind === 'video' ? 'video_url' : 'images',
          error: tr(language, `"${file.name}" is empty (0 bytes).`, `"${file.name}" ফাইলটি খালি (0 বাইট)।`),
          fixHint: tr(language, 'Choose a valid non-empty file.', 'সঠিক ও কার্যকরী একটি ফাইল নির্বাচন করুন।'),
        });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        reject({
          field: expectedKind === 'video' ? 'video_url' : 'images',
          error: tr(
            language,
            `"${file.name}" exceeds 20 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
            `"${file.name}" ফাইলের সাইজ ২০ MB-এর বেশি (${(file.size / 1024 / 1024).toFixed(1)} MB)।`
          ),
          fixHint: tr(language, 'Select a file smaller than 20 MB.', '২০ MB-এর কম সাইজের ছবি/ভিডিও নির্বাচন করুন।'),
        });
        return;
      }
      const allowedSet = expectedKind === 'video' ? ALLOWED_VIDEO_MIME : ALLOWED_IMAGE_MIME;
      if (file.type && !allowedSet.has(file.type.toLowerCase())) {
        reject({
          field: expectedKind === 'video' ? 'video_url' : 'images',
          error: tr(
            language,
            `"${file.name}" format (${file.type}) is not supported.`,
            `"${file.name}" ফাইলের ফরম্যাট (${file.type}) সমর্থিত নয়।`
          ),
          fixHint:
            expectedKind === 'video'
              ? tr(language, 'Only MP4 or WebM video files are supported.', 'শুধু MP4 বা WebM ভিডিও আপলোড করুন।')
              : tr(language, 'Only JPG, PNG, WEBP, or GIF images are supported.', 'শুধু JPG, PNG, WEBP বা GIF ছবি আপলোড করুন।'),
        });
        return;
      }

      const fd = new FormData();
      fd.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.timeout = 60000;
      xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data?.url) {
            resolve(data.url as string);
          } else {
            reject({
              field: data.field || (expectedKind === 'video' ? 'video_url' : 'images'),
              code: data.code,
              error: data.error || tr(language, `File upload failed (status ${xhr.status}).`, `ফাইল আপলোড ব্যর্থ হয়েছে (কোড: ${xhr.status})।`),
              fixHint:
                data.fix_hint ||
                tr(language, 'Check file size and format and try again.', 'ফাইলের সাইজ ও ফরম্যাট যাচাই করে আবার চেষ্টা করুন।'),
            });
          }
        } catch {
          reject({
            field: expectedKind === 'video' ? 'video_url' : 'images',
            error: tr(
              language,
              `Unexpected server response (status ${xhr.status}).`,
              `সার্ভার থেকে অপ্রত্যাশিত উত্তর পাওয়া গেছে (স্ট্যাটাস ${xhr.status})।`
            ),
            fixHint: tr(language, 'Try again or run Upload System Diagnostics.', 'কিছুক্ষণ পর আবার চেষ্টা করুন বা আপলোড ডায়াগনস্টিকস পরীক্ষা করুন।'),
          });
        }
      };

      xhr.onerror = () => {
        reject({
          field: 'network',
          error: tr(language, 'Network disconnected during upload.', 'নেটওয়ার্ক বিচ্ছিন্ন হওয়ায় ফাইল আপলোড সম্পন্ন হয়নি।'),
          fixHint: tr(language, 'Check your internet connection and retry.', 'আপনার ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় ছবি আপলোড করুন।'),
        });
      };

      xhr.ontimeout = () => {
        reject({
          field: 'network',
          error: tr(language, 'Upload timed out after 60 seconds.', 'ফাইল আপলোড করতে ৬০ সেকেন্ডের বেশি সময় লেগেছে (সার্ভার টাইমআউট)।'),
          fixHint: tr(language, 'Use a smaller file or check connection speed.', 'ছোট সাইজের ছবি ব্যবহার করুন অথবা ইন্টারনেট গতি পরীক্ষা করুন।'),
        });
      };

      xhr.send(fd);
    });
  };

  const handleUploadMedia = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'image' | 'video' | { colorIdx: number }
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';

    setErrorReport(null);
    setMediaUploading(true);
    setUploadProgress(0);

    try {
      let uploadedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadLabel(
          tr(
            language,
            `Uploading (${i + 1}/${files.length}): ${file.name}`,
            `আপলোড হচ্ছে (${i + 1}/${files.length}): ${file.name}`
          )
        );
        setUploadProgress(5);
        const url = await uploadSingleFile(file, target === 'video' ? 'video' : 'image');

        if (target === 'image') {
          setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
        } else if (target === 'video') {
          setVideoUrl(url);
        } else {
          setColors((prev) =>
            prev.map((c, idx) => (idx === target.colorIdx ? { ...c, images: [...c.images, url] } : c))
          );
        }
        uploadedCount += 1;
      }
      showToast(
        tr(
          language,
          `${uploadedCount} media file(s) uploaded and saved`,
          `${uploadedCount}টি মিডিয়া সফলভাবে আপলোড ও সংরক্ষিত হয়েছে`
        ),
        'success'
      );
    } catch (err: any) {
      reportError(
        err?.field || 'images',
        err?.error || tr(language, 'Media upload failed.', 'মিডিয়া আপলোড ব্যর্থ হয়েছে।'),
        err?.fixHint || tr(language, 'Select a valid JPG/PNG/WEBP image.', 'দয়া করে JPG/PNG/WEBP ফরম্যাটের বৈধ ফাইল নির্বাচন করুন।'),
        err?.code
      );
    } finally {
      setMediaUploading(false);
      setUploadProgress(0);
      setUploadLabel('');
    }
  };

  const handleAddImageUrl = () => {
    const raw = newImageUrl.trim();
    if (!raw) {
      reportError(
        'images',
        tr(language, 'Image URL field is empty.', 'ছবির লিংক খালি রয়েছে।'),
        tr(language, 'Enter a valid https:// or /uploads/ image URL.', 'একটি সঠিক https:// অথবা /uploads/ ছবির লিংক লিখুন।')
      );
      return;
    }
    const isValid = /^https?:\/\/.+/i.test(raw) || raw.startsWith('/uploads/') || raw.startsWith('/assets/');
    if (!isValid) {
      reportError(
        'images',
        tr(
          language,
          'Invalid image URL. Must start with http://, https:// or /uploads/.',
          'ছবির লিংকটি বৈধ নয়। লিংক অবশ্যই http://, https:// অথবা /uploads/ দিয়ে শুরু হতে হবে।'
        ),
        tr(
          language,
          'Paste a valid image URL or use "Upload Images from Device".',
          'সঠিক ছবির URL পেস্ট করুন অথবা "ডিভাইস থেকে ছবি আপলোড" বোতামে চাপ দিন।'
        )
      );
      return;
    }
    setErrorReport(null);
    setImages((prev) => (prev.includes(raw) ? prev : [...prev, raw]));
    setNewImageUrl('');
  };

  const handleAddShoeRangeExpanded = () => {
    const start = Math.round(parseNum(shoeRangeStart, Number.NaN));
    const end = Math.round(parseNum(shoeRangeEnd, Number.NaN));
    const stock = Math.max(0, Math.round(parseNum(shoeRangeStock, 10) || 10));

    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
      reportError(
        'sizes',
        tr(language, 'Enter valid numbers for shoe size range.', 'জুতার সাইজ রেঞ্জে সঠিক সংখ্যা দিন।'),
        tr(language, 'For example: start 39 and end 44.', 'যেমন: শুরু সাইজ 39 এবং শেষ সাইজ 44 লিখুন।')
      );
      return;
    }
    if (start > end) {
      reportError(
        'sizes',
        tr(language, 'Start size cannot exceed end size.', 'শুরু সাইজ শেষ সাইজের চেয়ে বড় হতে পারবে না।'),
        tr(language, 'Use a smaller start size and larger end size (e.g. 39 to 44).', 'শুরু সাইজ ছোট ও শেষ সাইজ বড় দিন (যেমন: 39 থেকে 44)।')
      );
      return;
    }
    if (end - start > 30) {
      reportError(
        'sizes',
        tr(language, 'Cannot generate more than 30 sizes at once.', 'একসাথে ৩০টির বেশি সাইজ রেঞ্জ তৈরি করা যাবে না।'),
        tr(language, 'Choose a smaller range (e.g. 38 to 45).', 'একটি যুক্তিসঙ্গত রেঞ্জ দিন (যেমন: 38 থেকে 45)।')
      );
      return;
    }

    const prefix = shoeRangeSystem === 'Standard' || shoeRangeSystem === 'Custom' ? '' : `${shoeRangeSystem} `;
    const additions: ProductSize[] = [];
    for (let s = start; s <= end; s++) {
      additions.push({
        category_type: 'shoes',
        size_system: shoeRangeSystem,
        label: `${prefix}${s}`.trim(),
        measurements: { length: '' },
        stock,
        price_override: null,
        is_available: true,
      });
    }

    setSizes((prev) => {
      const existingLabels = new Set(prev.map((x) => x.label.toLowerCase()));
      const uniqueNew = additions.filter((a) => !existingLabels.has(a.label.toLowerCase()));
      return [...prev, ...uniqueNew];
    });
    setErrorReport(null);
    showToast(
      tr(language, `Added shoe sizes ${start} to ${end}`, `${start} থেকে ${end} পর্যন্ত জুতার সাইজ যোগ করা হয়েছে`),
      'success'
    );
  };

  const handleAddShoeRangeSingleLine = () => {
    const start = Math.round(parseNum(shoeRangeStart, Number.NaN));
    const end = Math.round(parseNum(shoeRangeEnd, Number.NaN));
    const stock = Math.max(0, Math.round(parseNum(shoeRangeStock, 10) || 10));

    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || start > end) {
      reportError(
        'sizes',
        tr(language, 'Enter a valid start and end size number.', 'এক লাইনে সাইজ রেঞ্জ তৈরি করতে সঠিক শুরু ও শেষ সংখ্যা দিন।'),
        tr(language, 'For example: start 39 and end 44.', 'যেমন: শুরু 39 এবং শেষ 44।')
      );
      return;
    }

    const prefix = shoeRangeSystem === 'Standard' || shoeRangeSystem === 'Custom' ? '' : `${shoeRangeSystem} `;
    const label =
      language === 'bn' ? `${prefix}${start} থেকে ${end}`.trim() : `${prefix}${start} to ${end}`.trim();

    setSizes((prev) => {
      if (prev.some((x) => x.label.toLowerCase() === label.toLowerCase())) return prev;
      return [
        ...prev,
        {
          category_type: 'shoes',
          size_system: shoeRangeSystem,
          label,
          measurements: { length: '' },
          stock,
          price_override: null,
          is_available: true,
        },
      ];
    });
    setErrorReport(null);
    showToast(tr(language, `Added range "${label}"`, `"${label}" সাইজ রেঞ্জ যোগ করা হয়েছে`), 'success');
  };

  const handleQuickAddColor = (preset: { en: string; bn: string; hex: string }) => {
    const colorName = language === 'bn' ? preset.bn : preset.en;
    setColors((prev) => {
      if (
        prev.some(
          (c) =>
            c.name.trim().toLowerCase() === preset.en.toLowerCase() ||
            c.name.trim().toLowerCase() === preset.bn.toLowerCase()
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          name: colorName,
          hex_code: preset.hex,
          images: [],
          is_available: true,
          stock: 10,
          sku: '',
          price_override: null,
        },
      ];
    });
  };

  const applySpecTemplate = (template: 'clothing' | 'electronics' | 'shoes') => {
    const keys = SPEC_TEMPLATES[template].map((item) => (language === 'bn' ? item.bn : item.en));
    const existingKeys = new Set(specsList.map((s) => s.key));
    const additions = keys.filter((k) => !existingKeys.has(k)).map((key) => ({ key, value: '' }));
    setSpecsList((prev) => [...prev, ...additions]);
  };

  const submitProduct = async () => {
    if (saving) return;
    setErrorReport(null);

    if (!adminToken) {
      reportError(
        'auth',
        tr(language, 'Admin session missing or expired.', 'অ্যাডমিন সেশন পাওয়া যায়নি বা মেয়াদ শেষ হয়েছে।'),
        tr(language, 'Please sign in to the Admin Console again.', 'দয়া করে পুনরায় অ্যাডমিন প্যানেলে লগইন করুন।')
      );
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      reportError(
        'name',
        tr(language, 'Product name is required.', 'পণ্যের নাম লেখা হয়নি।'),
        tr(language, 'Enter the product title under Section 1 (Basic Information).', '"১. মৌলিক তথ্য" অংশে পণ্যের নাম লিখুন।')
      );
      return;
    }

    if (!categoryId || !categories.some((c) => c.id === categoryId)) {
      reportError(
        'category_id',
        tr(language, 'Please select a valid category.', 'সঠিক ক্যাটাগরি নির্বাচন করা হয়নি।'),
        tr(language, 'Choose a valid category from the dropdown.', 'তালিকা থেকে একটি বৈধ ক্যাটাগরি বেছে নিন।')
      );
      return;
    }

    const parsedSelling = parseNum(sellingPrice, Number.NaN);
    const parsedSale = salePrice.trim() ? parseNum(salePrice, Number.NaN) : parsedSelling;
    const parsedOriginal = originalPrice.trim() ? parseNum(originalPrice, Number.NaN) : parsedSelling;
    const parsedWholesale = wholesalePrice.trim() ? parseNum(wholesalePrice, 0) : 0;
    const parsedShipping = shippingCost.trim() ? parseNum(shippingCost, 0) : 0;
    const parsedStock = parseNum(totalStock, Number.NaN);

    if (
      (sellingPrice.trim() && Number.isNaN(parsedSelling)) ||
      (salePrice.trim() && Number.isNaN(parsedSale)) ||
      (originalPrice.trim() && Number.isNaN(parsedOriginal))
    ) {
      reportError(
        'selling_price',
        tr(language, 'Price fields must contain valid numbers.', 'দামের ঘরে সঠিক সংখ্যা দেওয়া হয়নি।'),
        tr(
          language,
          'Enter digits only (e.g. 1081 or 19.99) without currency symbols.',
          'দামের ঘরে শুধু সংখ্যা লিখুন (যেমন: 1081 বা ১০৮১), কোনো অক্ষর লিখবেন না।'
        )
      );
      return;
    }

    const effectiveSelling =
      Number.isFinite(parsedSelling) && parsedSelling > 0
        ? parsedSelling
        : Number.isFinite(parsedSale)
        ? parsedSale
        : 0;
    const effectiveSale = Number.isFinite(parsedSale) && parsedSale > 0 ? parsedSale : effectiveSelling;
    const effectiveOriginal =
      Number.isFinite(parsedOriginal) && parsedOriginal >= effectiveSale ? parsedOriginal : effectiveSelling;

    if (effectiveSelling < 0 || effectiveSale < 0 || effectiveOriginal < 0 || parsedWholesale < 0 || parsedShipping < 0) {
      reportError(
        'selling_price',
        tr(language, 'Product prices cannot be negative.', 'পণ্যের দাম ঋণাত্মক হতে পারবে না।'),
        tr(language, 'Enter 0 or a positive number.', '০ বা তার বেশি বৈধ মূল্য লিখুন।')
      );
      return;
    }

    if (status === 'active' && effectiveSelling <= 0 && effectiveSale <= 0) {
      reportError(
        'selling_price',
        tr(
          language,
          'Active products require a selling price greater than 0.',
          'মূল পেজে প্রকাশ (সক্রিয়) করতে হলে বিক্রয় মূল্য ০-এর বেশি হতে হবে।'
        ),
        tr(
          language,
          'Enter a selling price (e.g. 1081) or save as Draft.',
          'বিক্রয় মূল্য লিখুন (যেমন: 1081) অথবা স্ট্যাটাস "খসড়া (Draft)" করুন।'
        )
      );
      return;
    }

    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      reportError(
        'total_stock',
        tr(language, 'Invalid stock quantity.', 'মোট স্টকের পরিমাণ সঠিক নয়।'),
        tr(language, 'Enter a whole number 0 or higher.', 'স্টকের ঘরে ০ বা তার বেশি পূর্ণ সংখ্যা দিন।')
      );
      return;
    }

    if (productType === 'affiliate') {
      const cleanAff = affiliateUrl.trim();
      if (!cleanAff || !/^https?:\/\/.+/i.test(cleanAff)) {
        reportError(
          'affiliate_url',
          tr(language, 'Valid AliExpress / Affiliate URL is required.', 'অ্যাফিলিয়েট পণ্যের জন্য সঠিক AliExpress / পার্টনার লিংক প্রয়োজন।'),
          tr(language, 'Enter a full URL starting with https://.', 'https:// দিয়ে শুরু হওয়া সম্পূর্ণ বৈধ লিংক দিন।')
        );
        return;
      }
    }

    if (status === 'active' && images.length === 0) {
      reportError(
        'images',
        tr(
          language,
          'At least 1 product image is required before publishing to the main page.',
          'মূল পেজে প্রকাশের জন্য অন্তত ১টি পণ্যের ছবি আপলোড করা প্রয়োজন।'
        ),
        tr(
          language,
          'Upload an image or paste an image URL under Section 2, or save as Draft.',
          '"২. ছবি ও ভিডিও" অংশে ছবি আপলোড করুন অথবা ছবির URL যোগ করুন, অথবা স্ট্যাটাস "খসড়া (Draft)" হিসেবে সেভ করুন।'
        )
      );
      return;
    }

    const emptyColor = colors.find((c) => !c.name.trim());
    if (emptyColor) {
      reportError(
        'colors',
        tr(language, 'A color entry has an empty name.', 'একটি রঙের ঘরে নাম লেখা হয়নি।'),
        tr(language, 'Name every color or delete the blank row.', 'প্রতিটি রঙের নাম দিন অথবা খালি ঘরটি মুছে ফেলুন।')
      );
      return;
    }

    const emptySize = sizes.find((s) => !s.label.trim());
    if (emptySize) {
      reportError(
        'sizes',
        tr(language, 'A size entry has an empty label.', 'একটি সাইজের ঘরে মান লেখা হয়নি।'),
        tr(language, 'Enter a label (e.g. M or EU 40) or delete the blank row.', 'প্রতিটি সাইজের লেবেল (যেমন: M বা EU 40) দিন অথবা মুছে ফেলুন।')
      );
      return;
    }

    setSaving(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    try {
      const specsObj: Record<string, string> = {};
      for (const item of specsList) {
        if (item.key.trim() && item.value.trim()) {
          specsObj[item.key.trim()] = item.value.trim();
        }
      }

      const payload = {
        request_id: requestIdRef.current,
        product_type: productType,
        product_code: productCode.trim(),
        sku: sku.trim(),
        name: cleanName,
        brand: brand.trim(),
        manufacturer: manufacturer.trim(),
        category_id: categoryId,
        subcategory: subcategory.trim(),
        country_of_origin: countryOfOrigin.trim() || 'Bangladesh',
        status,
        short_description: shortDescription.trim(),
        full_description: fullDescription.trim(),
        highlights: highlightsText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        images,
        video_url: videoUrl.trim(),
        is_featured: isFeatured,
        is_new_arrival: isNewArrival,
        is_trending: isTrending,
        is_best_seller: isBestSeller,
        is_special_offer: isSpecialOffer,
        is_recommended: isRecommended,
        collection_tag: collectionTag.trim(),
        currency: productCurrency,
        original_price: effectiveOriginal,
        selling_price: effectiveSelling,
        sale_price: effectiveSale,
        wholesale_price: Number.isFinite(parsedWholesale) ? parsedWholesale : 0,
        shipping_cost: Number.isFinite(parsedShipping) ? parsedShipping : 0,
        tax_info: taxInfo.trim(),
        total_stock: Math.round(parsedStock),
        low_stock_threshold: Math.max(0, Math.round(parseNum(lowStockThreshold, 5) || 5)),
        package_contents: packageContents.trim(),
        number_of_pieces: Math.max(1, Math.round(parseNum(numberOfPieces, 1) || 1)),
        package_quantity: Math.max(1, Math.round(parseNum(packageQuantity, 1) || 1)),
        package_length: packageLength.trim(),
        package_width: packageWidth.trim(),
        package_height: packageHeight.trim(),
        package_weight: packageWeight.trim(),
        shipping_weight: shippingWeight.trim(),
        included_accessories: includedAccessories.trim(),
        affiliate_url: affiliateUrl.trim(),
        estimated_delivery: estimatedDelivery.trim(),
        shipping_info: shippingInfo.trim(),
        return_policy: returnPolicy.trim(),
        specs: specsObj,
        colors: colors.map((c) => ({
          ...c,
          name: c.name.trim(),
          stock: Math.max(0, Math.round(parseNum(c.stock, 10) || 0)),
          price_override:
            c.price_override !== null && c.price_override !== undefined && String(c.price_override) !== ''
              ? parseNum(c.price_override, 0)
              : null,
        })),
        sizes: sizes.map((s) => ({
          ...s,
          label: s.label.trim(),
          stock: Math.max(0, Math.round(parseNum(s.stock, 10) || 0)),
          price_override:
            s.price_override !== null && s.price_override !== undefined && String(s.price_override) !== ''
              ? parseNum(s.price_override, 0)
              : null,
        })),
        variations: variations.map((v) => ({
          ...v,
          price: Math.max(0, parseNum(v.price, effectiveSale) || effectiveSale),
          stock: Math.max(0, Math.round(parseNum(v.stock, 10) || 0)),
        })),
      };

      const url = initialProduct ? `/api/admin/products/${initialProduct.id}` : '/api/admin/products';
      const method = initialProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        reportError(
          'server',
          tr(
            language,
            `Server returned invalid JSON (status ${res.status}).`,
            `সার্ভার থেকে সঠিক JSON উত্তর পাওয়া যায়নি (কোড: ${res.status})।`
          ),
          tr(language, 'Verify the server is running and click Retry.', 'সার্ভার চালু আছে কিনা দেখুন এবং "আবার চেষ্টা করুন" বোতামে চাপ দিন।')
        );
        return;
      }

      if (!res.ok) {
        reportError(
          data?.field || 'server',
          data?.error || tr(language, `Product save failed (status ${res.status}).`, `পণ্য সংরক্ষণ ব্যর্থ হয়েছে (কোড: ${res.status})।`),
          data?.fix_hint || tr(language, 'Review the highlighted details and retry.', 'সব তথ্য যাচাই করে আবার চেষ্টা করুন।'),
          data?.code
        );
        return;
      }

      setSavedProductId(data.id ?? initialProduct?.id ?? null);
      if (data.verification) {
        setVerificationResult(data.verification as ProductUploadVerification);
      }

      await onSaved();
      showToast(
        initialProduct
          ? tr(language, 'Product updated successfully!', 'পণ্য সফলভাবে আপডেট হয়েছে!')
          : tr(language, 'New product published & verified on main page!', 'নতুন পণ্য সফলভাবে প্রকাশিত ও মূল পেজে যুক্ত হয়েছে!'),
        'success'
      );

      if (!data.verification) {
        onClose();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        reportError(
          'network',
          tr(language, 'Server timed out after 30 seconds.', 'সার্ভার থেকে উত্তর আসতে ৩০ সেকেন্ডের বেশি সময় লেগেছে (টাইমআউট)।'),
          tr(
            language,
            'Check your internet connection and click Retry. None of your form data was lost.',
            'ইন্টারনেট সংযোগ পরীক্ষা করে "আবার চেষ্টা করুন" চাপ দিন। আপনার লেখা সব তথ্য অক্ষত আছে।'
          )
        );
      } else {
        reportError(
          'network',
          tr(language, 'Network disconnected while saving product.', 'ইন্টারনেট বা সার্ভার সংযোগ বিচ্ছিন্ন হওয়ায় পণ্যটি সেভ করা যায়নি।'),
          tr(
            language,
            'Reconnect and click Retry. Your entered fields remain intact.',
            'সংযোগ পরীক্ষা করে "আবার চেষ্টা করুন" চাপ দিন। আপনার লেখা কোনো তথ্য হারায়নি।'
          )
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitProduct();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-zinc-950 text-zinc-100 w-full max-w-5xl max-h-[95dvh] flex flex-col border border-[#C9A227]/50 shadow-2xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-black text-white flex items-center justify-between border-b border-[#C9A227]/40 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-2xl font-semibold text-white truncate">
              {initialProduct
                ? `${tr(language, 'Edit Product:', 'পণ্য সম্পাদনা:')} ${initialProduct.name}`
                : tr(language, 'Upload New Product', 'নতুন পণ্য আপলোড করুন')}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#E4C76B] font-mono tabular-nums mt-0.5 truncate">
              {tr(language, 'Auto Calculation · Colors:', 'স্বয়ংক্রিয় হিসাব · রঙ:')} {variationStats.availColors} ·{' '}
              {tr(language, 'Sizes:', 'সাইজ:')} {variationStats.availSizes} ·{' '}
              {tr(language, 'Variations:', 'মোট ভ্যারিয়েশন:')} {variationStats.validVars}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(language, 'Close', 'বন্ধ করুন')}
            className="text-zinc-400 hover:text-white p-1 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-Upload 10-Point Verification Report Screen */}
        {verificationResult ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-xs">
            <div
              className={`border p-4 sm:p-5 flex items-start gap-3 ${
                verificationResult.passed
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-100'
                  : 'bg-amber-950/50 border-amber-500/60 text-amber-100'
              }`}
            >
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  {verificationResult.passed
                    ? tr(
                        language,
                        '10-Point Upload Verification Passed — Saved & Live!',
                        '১০-পয়েন্ট আপলোড যাচাই সম্পন্ন — সবকিছু সঠিকভাবে সেভ ও প্রকাশিত হয়েছে!'
                      )
                    : tr(
                        language,
                        'Product Saved with Verification Warnings',
                        'পণ্য সেভ হয়েছে, তবে কিছু তথ্য যাচাইয়ে সতর্কতা রয়েছে'
                      )}
                </h3>
                <p className="text-zinc-300 mt-1">
                  {tr(language, 'Product ID:', 'পণ্য আইডি:')} #{savedProductId} ·{' '}
                  {tr(language, 'Verified at:', 'যাচাইয়ের সময়:')}{' '}
                  {new Date(verificationResult.checked_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {verificationResult.checks.map((chk, idx) => (
                <div
                  key={chk.key}
                  className={`border p-3 flex items-start gap-2.5 ${
                    chk.passed ? 'border-emerald-800/60 bg-zinc-900' : 'border-amber-700/60 bg-amber-950/20'
                  }`}
                >
                  {chk.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {idx + 1}. {chk.label}
                    </p>
                    <p className="text-zinc-300 mt-0.5 break-words">{chk.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-zinc-800">
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate({ page: 'home', section: 'all' });
                  }}
                  className="px-4 py-2.5 border border-[#C9A227]/60 text-[#E4C76B] hover:bg-[#C9A227] hover:text-black font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>{tr(language, 'View on Main Page', 'মূল পেজে দেখুন')}</span>
                </button>
                {savedProductId && status !== 'draft' && productType === 'own' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate({ page: 'product', productId: savedProductId });
                    }}
                    className="px-4 py-2.5 border border-emerald-600/60 text-emerald-300 hover:bg-emerald-600 hover:text-black font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{tr(language, 'Open Product Page', 'পণ্য পেজে দেখুন')}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setVerificationResult(null)}
                  className="px-4 py-2.5 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] hover:text-white font-semibold"
                >
                  {tr(language, 'Continue Editing', 'আরও এডিট করুন')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold"
                >
                  {tr(language, 'Done & Close', 'ঠিক আছে ও বন্ধ করুন')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            ref={scrollContainerRef}
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7 text-xs text-zinc-200"
          >
            {/* Smart Error Detection & Troubleshooting Banner */}
            {errorReport && (
              <div className="bg-red-950/70 border border-red-500 p-4 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-red-200 text-sm">
                        {tr(language, 'Upload Issue Detected — Field:', 'আপলোড সমস্যা শনাক্ত হয়েছে — ক্ষেত্র:')}{' '}
                        {errorReport.fieldLabel}
                      </p>
                      <p className="text-white font-medium">{errorReport.error}</p>
                      <p className="text-amber-200">
                        <span className="font-semibold">{tr(language, 'Solution:', 'সমাধান:')} </span>
                        {errorReport.fixHint}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorReport(null)}
                    className="text-zinc-400 hover:text-white shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void submitProduct()}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                    <span>{tr(language, 'Retry Save', 'আবার চেষ্টা করুন')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1. Basic Information */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-[#E4C76B] border-b border-zinc-800 pb-2">
                {tr(language, '1. Basic Product Information', '১. পণ্যের মৌলিক তথ্য')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Selling Type *', 'বিক্রয়ের ধরন *')}
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'own' | 'affiliate')}
                    className="w-full border border-zinc-700 px-3 py-2 bg-zinc-900 text-white font-semibold focus:border-[#C9A227] focus:outline-none"
                  >
                    <option value="own" className="bg-zinc-950 text-white">
                      {tr(language, 'Own Product (Direct Storefront Checkout)', 'নিজস্ব পণ্য (SHOPNEXA সরাসরি চেকআউট)')}
                    </option>
                    <option value="affiliate" className="bg-zinc-950 text-white">
                      {tr(language, 'Affiliate Product (Partner Link)', 'অ্যাফিলিয়েট পণ্য (AliExpress লিংক)')}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Product Name *', 'পণ্যের নাম *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={tr(language, 'e.g. Premium Leather Running Shoes', 'যেমন: প্রিমিয়াম লেদার রানিং জুতা')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Category *', 'ক্যাটাগরি *')}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full border border-zinc-700 px-3 py-2 bg-zinc-900 text-white focus:border-[#C9A227] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-zinc-950 text-white">
                        {language === 'bn' ? `${translateCategory(c.name, 'bn')} (${c.name})` : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Brand Name', 'ব্র্যান্ডের নাম')}
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={tr(language, 'e.g. Apex, Lotto, Robi Hub', 'যেমন: Apex, Lotto, Robi Hub')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Manufacturer', 'প্রস্তুতকারক (Manufacturer)')}
                  </label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder={tr(language, 'e.g. Dhaka Footwear Ltd', 'যেমন: Dhaka Footwear Ltd')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Subcategory', 'সাব-ক্যাটাগরি')}
                  </label>
                  <input
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder={tr(language, 'e.g. Sports Sneakers', 'যেমন: স্পোর্টস জুতা / স্নিকার্স')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Product Code / ID', 'প্রোডাক্ট কোড / আইডি')}
                  </label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder={tr(language, 'Auto-generated if left blank', 'খালি রাখলে অটো তৈরি হবে')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'SKU', 'এসকেইউ (SKU)')}
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder={tr(language, 'Auto-generated if left blank', 'খালি রাখলে অটো তৈরি হবে')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Publish Status', 'প্রকাশনার অবস্থা (Status)')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'draft' | 'out_of_stock')}
                    className="w-full border border-zinc-700 px-3 py-2 bg-zinc-900 text-white font-semibold focus:border-[#C9A227] focus:outline-none"
                  >
                    <option value="active" className="bg-zinc-950 text-white">
                      {tr(language, 'Active — Live on Main Website', 'সক্রিয় — মূল ওয়েবসাইটে দেখাবে')}
                    </option>
                    <option value="draft" className="bg-zinc-950 text-white">
                      {tr(language, 'Draft — Admin Only', 'খসড়া (Draft) — শুধু অ্যাডমিনে থাকবে')}
                    </option>
                    <option value="out_of_stock" className="bg-zinc-950 text-white">
                      {tr(language, 'Out of Stock', 'স্টক শেষ (Out of Stock)')}
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Country of Origin', 'উৎপাদনকারী দেশ (Country of Origin)')}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={countryOfOrigin}
                      onChange={(e) => setCountryOfOrigin(e.target.value)}
                      placeholder={tr(language, 'Enter country (e.g. Bangladesh)', 'দেশের নাম লিখুন (যেমন: বাংলাদেশ)')}
                      className="flex-1 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COUNTRY_QUICK_OPTIONS.map((cOpt) => {
                      const label = language === 'bn' ? cOpt.bn : cOpt.en;
                      const selected = countryOfOrigin === label || countryOfOrigin === cOpt.value;
                      return (
                        <button
                          key={cOpt.value}
                          type="button"
                          onClick={() => setCountryOfOrigin(label)}
                          className={`px-2 py-1 border text-[11px] transition-colors ${
                            selected
                              ? 'bg-[#C9A227] text-black border-[#C9A227] font-semibold'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-[#C9A227]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Collection Tag (Optional)', 'কালেকশন ট্যাগ (ঐচ্ছিক)')}
                  </label>
                  <input
                    type="text"
                    value={collectionTag}
                    onChange={(e) => setCollectionTag(e.target.value)}
                    placeholder={tr(language, 'e.g. Eid Collection', 'যেমন: ঈদ কালেকশন')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-[#E4C76B]">
                  {tr(
                    language,
                    'Storefront Placement Sections (All active Own products automatically appear under Latest Uploads on the Main Page):',
                    'ওয়েবসাইটের কোন কোন অংশে দেখাবে (সকল সক্রিয় পণ্য মূল পেজের "সর্বশেষ আপলোড" অংশে সাথে সাথে দেখাবে):'
                  )}
                </p>
                <div className="flex flex-wrap gap-4 text-zinc-200">
                  {[
                    { label: tr(language, 'Featured (Main Page)', 'ফিচার্ড (মূল পেজ)'), val: isFeatured, set: setIsFeatured },
                    { label: tr(language, 'New Arrival', 'নতুন আগমন (New Arrival)'), val: isNewArrival, set: setIsNewArrival },
                    { label: tr(language, 'Trending', 'ট্রেন্ডিং'), val: isTrending, set: setIsTrending },
                    { label: tr(language, 'Best Seller', 'সেরা বিক্রিত'), val: isBestSeller, set: setIsBestSeller },
                    { label: tr(language, 'Special Offer', 'বিশেষ অফার'), val: isSpecialOffer, set: setIsSpecialOffer },
                    { label: tr(language, 'Recommended', 'প্রস্তাবিত (Recommended)'), val: isRecommended, set: setIsRecommended },
                  ].map((flag) => (
                    <label key={flag.label} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flag.val}
                        onChange={(e) => flag.set(e.target.checked)}
                        className="accent-[#C9A227]"
                      />
                      <span>{flag.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Short Description', 'সংক্ষিপ্ত বিবরণ')}
                  </label>
                  <textarea
                    rows={2}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder={tr(language, '1–2 line summary of the product', 'পণ্য সম্পর্কে ১-২ লাইনের সংক্ষিপ্ত বর্ণনা')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Key Highlights (One per line)', 'প্রধান বৈশিষ্ট্য (প্রতি লাইনে একটি)')}
                  </label>
                  <textarea
                    rows={2}
                    value={highlightsText}
                    onChange={(e) => setHighlightsText(e.target.value)}
                    placeholder={tr(
                      language,
                      '100% genuine material\nBreathable sole',
                      'যেমন:\n১০০% অরিজিনাল চামড়া\nআরামদায়ক সোল'
                    )}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Full Description', 'বিস্তারিত বিবরণ')}
                  </label>
                  <textarea
                    rows={3}
                    value={fullDescription}
                    onChange={(e) => setFullDescription(e.target.value)}
                    placeholder={tr(language, 'Complete product details, quality, and usage instructions', 'পণ্যের গুণমান, ব্যবহার ও সম্পূর্ণ বিবরণ লিখুন')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Affiliate Specific */}
            {productType === 'affiliate' && (
              <section className="bg-zinc-900 border border-[#C9A227]/50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  {tr(language, 'AliExpress / Affiliate Link Settings', 'AliExpress / অ্যাফিলিয়েট লিংক সেটিংস')}
                </h3>
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Official AliExpress Tracking URL *', 'অফিশিয়াল AliExpress ট্র্যাকিং লিংক *')}
                  </label>
                  <input
                    type="url"
                    required
                    value={affiliateUrl}
                    onChange={(e) => setAffiliateUrl(e.target.value)}
                    placeholder="https://s.click.aliexpress.com/e/..."
                    className="w-full border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
              </section>
            )}

            {/* 2. Media Gallery & Video */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-[#E4C76B]">
                  {tr(
                    language,
                    `2. Product Images & Video (${images.length} images · Max 20 MB · JPG/PNG/WEBP)`,
                    `২. পণ্যের ছবি ও ভিডিও (মোট ছবি: ${images.length}টি · সর্বোচ্চ ২০ MB · JPG/PNG/WEBP)`
                  )}
                </h3>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder={tr(language, 'Paste image URL here', 'ছবির লিংক (URL) এখানে পেস্ট করুন')}
                  className="flex-1 min-w-[200px] border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-semibold transition-colors"
                >
                  {tr(language, 'Add URL', 'লিংক যোগ করুন')}
                </button>
                <label className="px-3.5 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold cursor-pointer flex items-center gap-1.5 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{tr(language, 'Upload Images from Device (Multiple)', 'ডিভাইস থেকে ছবি আপলোড (একাধিক)')}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => void handleUploadMedia(e, 'image')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Upload progress bar */}
              {mediaUploading && (
                <div className="bg-zinc-900 border border-[#C9A227]/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#E4C76B] font-medium truncate">
                      {uploadLabel || tr(language, 'Uploading...', 'আপলোড হচ্ছে...')}
                    </span>
                    <span className="font-mono text-white">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-[#C9A227] transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Image Previews */}
              {images.length === 0 ? (
                <div className="border border-dashed border-zinc-700 bg-zinc-900/50 p-4 text-center text-zinc-400 flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#C9A227]" />
                  <span>
                    {tr(
                      language,
                      'No images added yet. Upload images or paste a URL above.',
                      'এখনো কোনো ছবি যোগ করা হয়নি। উপরে থেকে ছবি আপলোড করুন বা ছবির লিংক যোগ করুন।'
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <div key={`${img}-${i}`} className="relative w-28 border border-zinc-700 bg-zinc-900">
                      <div className="w-full h-22 bg-white flex items-center justify-center overflow-hidden">
                        {brokenImages[img] ? (
                          <span className="text-[10px] text-red-600 px-1 text-center font-semibold">
                            {tr(language, 'Image failed to load', 'ছবি লোড হয়নি')}
                          </span>
                        ) : (
                          <img
                            src={img}
                            alt={`${tr(language, 'Product image', 'পণ্য ছবি')} ${i + 1}`}
                            onError={() => setBrokenImages((prev) => ({ ...prev, [img]: true }))}
                            className="w-full h-20 object-cover"
                          />
                        )}
                      </div>
                      <div className="p-1 flex items-center justify-between text-[10px] bg-zinc-950 border-t border-zinc-800">
                        {i === 0 ? (
                          <span className="text-[#E4C76B] font-semibold">
                            {tr(language, 'Primary', 'প্রধান ছবি')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setImages((prev) => {
                                const target = prev[i];
                                return [target, ...prev.filter((_, idx) => idx !== i)];
                              })
                            }
                            className="text-zinc-300 hover:text-[#E4C76B]"
                          >
                            {tr(language, 'Set Primary', 'প্রধান করুন')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label={tr(language, 'Delete image', 'ছবি মুছুন')}
                          className="text-red-400 hover:text-red-300 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center pt-1">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={tr(language, 'Product video URL (MP4 / WebM)', 'পণ্যের ভিডিও লিংক (MP4 / WebM)')}
                  className="flex-1 min-w-[200px] border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <label className="px-3 py-2 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#C9A227] cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{tr(language, 'Upload Video', 'ভিডিও আপলোড')}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={(e) => void handleUploadMedia(e, 'video')}
                    className="hidden"
                  />
                </label>
              </div>
            </section>

            {/* 3. Pricing, Currency & Inventory */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-[#E4C76B]">
                  {tr(
                    language,
                    '3. Pricing, Currency & Inventory (Exact Entry — No Unexpected Multiplier)',
                    '৩. দাম, কারেন্সি ও স্টক (সঠিক হিসাব — কোনো বাড়তি গুণ হবে না)'
                  )}
                </h3>
                <div className="flex items-center gap-2 bg-zinc-900 border border-[#C9A227]/40 px-3 py-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#E4C76B]" />
                  <span className="text-[11px] text-zinc-200">
                    {tr(language, 'Storefront Preview:', 'মূল পেজে দেখাবে:')}{' '}
                    <strong className="text-[#E4C76B]">{pricePreview.bdtText}</strong> ·{' '}
                    <span className="font-mono text-zinc-300">{pricePreview.usdText}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Product Currency *', 'পণ্যের কারেন্সি *')}
                  </label>
                  <select
                    value={productCurrency}
                    onChange={(e) => setProductCurrency(e.target.value)}
                    className="w-full border border-[#C9A227]/60 px-3 py-2 bg-zinc-900 text-white font-semibold focus:border-[#C9A227] focus:outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-zinc-950 text-white">
                        {c.code === 'BDT'
                          ? tr(language, 'BDT (৳ Taka — Bangladesh)', 'BDT (৳ টাকা — বাংলাদেশের জন্য)')
                          : c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Original Price', 'পূর্বের / আসল দাম')} ({productCurrency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder={tr(language, 'e.g. 1250', 'যেমন: 1250 বা ১২৫০')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Selling Price *', 'বিক্রয় মূল্য *')} ({productCurrency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder={tr(language, 'e.g. 1081', 'যেমন: 1081 বা ১০৮১')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Offer / Sale Price', 'অফার / সেল প্রাইজ')} ({productCurrency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder={tr(language, 'Leave blank to match selling price', 'খালি রাখলে বিক্রয় মূল্য')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Total Stock Quantity', 'মোট স্টক সংখ্যা')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={totalStock}
                    onChange={(e) => setTotalStock(e.target.value)}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Low Stock Alert Threshold', 'লো-স্টক সতর্কতা সীমা')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Wholesale Price', 'পাইকারি মূল্য')} ({productCurrency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Shipping Fee Override', 'ডেলিভারি / শিপিং খরচ')} ({productCurrency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white px-3 py-2 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-300 mb-1">
                    {tr(language, 'Tax / VAT Info (Optional)', 'ট্যাক্স / ভ্যাট তথ্য (ঐচ্ছিক)')}
                  </label>
                  <input
                    type="text"
                    value={taxInfo}
                    onChange={(e) => setTaxInfo(e.target.value)}
                    placeholder={tr(language, 'e.g. VAT included', 'যেমন: ভ্যাট অন্তর্ভুক্ত')}
                    className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* 4. Colors Management */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-[#E4C76B]">
                  {tr(language, `4. Product Colors (${colors.length})`, `৪. পণ্যের রঙ নির্বাচন (${colors.length}টি)`)}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setColors((prev) => [
                      ...prev,
                      {
                        name: language === 'bn' ? 'কালো' : 'Black',
                        hex_code: '#09090B',
                        images: [],
                        is_available: true,
                        stock: 10,
                        sku: '',
                        price_override: null,
                      },
                    ])
                  }
                  className="px-3 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tr(language, 'Add Custom Color', 'কাস্টম রঙ যোগ করুন')}</span>
                </button>
              </div>

              {/* 1-Click Color Palette */}
              <div className="bg-zinc-900/70 border border-zinc-800 p-3 space-y-2">
                <p className="text-[11px] text-zinc-300 font-medium">
                  {tr(language, 'Quick-add popular colors:', 'এক ক্লিকেই পছন্দের রঙ যোগ করুন:')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((preset) => {
                    const label = language === 'bn' ? preset.bn : preset.en;
                    const added = colors.some(
                      (c) =>
                        c.name.trim().toLowerCase() === preset.en.toLowerCase() ||
                        c.name.trim().toLowerCase() === preset.bn.toLowerCase()
                    );
                    return (
                      <button
                        key={preset.en}
                        type="button"
                        onClick={() => handleQuickAddColor(preset)}
                        className={`px-2.5 py-1 border text-[11px] flex items-center gap-1.5 transition-colors ${
                          added
                            ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#E4C76B] font-semibold'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-[#C9A227]'
                        }`}
                      >
                        <span className="w-3 h-3 border border-zinc-400 inline-block" style={{ backgroundColor: preset.hex }} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {colors.map((c, idx) => (
                <div key={idx} className="border border-zinc-800 bg-zinc-900 p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                  <input
                    type="text"
                    placeholder={tr(language, 'Color name', 'রঙের নাম')}
                    value={c.name}
                    onChange={(e) => setColors((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={c.hex_code}
                      onChange={(e) => setColors((p) => p.map((x, i) => (i === idx ? { ...x, hex_code: e.target.value } : x)))}
                      className="w-8 h-8 border border-zinc-700 bg-zinc-950"
                    />
                    <input
                      type="text"
                      value={c.hex_code}
                      onChange={(e) => setColors((p) => p.map((x, i) => (i === idx ? { ...x, hex_code: e.target.value } : x)))}
                      className="w-20 border border-zinc-700 bg-zinc-950 text-white px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={tr(language, 'Stock', 'স্টক')}
                    value={c.stock}
                    onChange={(e) =>
                      setColors((p) =>
                        p.map((x, i) => (i === idx ? { ...x, stock: Math.max(0, Number(normalizeNumericInput(e.target.value) || 0)) } : x))
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder={tr(language, 'Color SKU', 'রঙের SKU')}
                    value={c.sku}
                    onChange={(e) => setColors((p) => p.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`${tr(language, 'Override Price', 'আলাদা দাম')} (${productCurrency})`}
                    value={c.price_override ?? ''}
                    onChange={(e) =>
                      setColors((p) =>
                        p.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                price_override:
                                  e.target.value === '' ? null : Number(normalizeNumericInput(e.target.value) || 0),
                              }
                            : x
                        )
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-200 hover:border-[#C9A227] cursor-pointer text-[11px]">
                      {tr(language, 'Img', 'ছবি')} ({c.images.length})
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => void handleUploadMedia(e, { colorIdx: idx })}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setColors((p) => p.filter((_, i) => i !== idx))}
                      aria-label={tr(language, 'Remove color', 'রঙ মুছুন')}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {/* 5. Sizes Management + Shoe Size Range Builder */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-[#E4C76B]">
                  {tr(language, `5. Sizes & Measurements (${sizes.length})`, `৫. সাইজ ও মাপ নির্বাচন (${sizes.length}টি)`)}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSizes((prev) => {
                        const existing = new Set(prev.map((x) => x.label));
                        const next = CLOTHING_PRESETS.filter((l) => !existing.has(l)).map((l) => ({
                          category_type: 'clothing' as const,
                          size_system: 'Standard' as const,
                          label: l,
                          measurements: { chest: '', waist: '', length: '' },
                          stock: 10,
                          price_override: null,
                          is_available: true,
                        }));
                        return [...prev, ...next];
                      })
                    }
                    className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#C9A227] hover:text-white"
                  >
                    {tr(language, '+ Clothing Sizes (XS–XXXL)', '+ পোশাকের সাইজ (XS–XXXL)')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSizes((prev) => {
                        const existing = new Set(prev.map((x) => x.label));
                        const next = WEIGHT_VOLUME_PRESETS.filter((l) => !existing.has(l)).map((l) => ({
                          category_type: 'general' as const,
                          size_system: 'Custom' as const,
                          label: l,
                          measurements: {},
                          stock: 10,
                          price_override: null,
                          is_available: true,
                        }));
                        return [...prev, ...next];
                      })
                    }
                    className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#C9A227] hover:text-white"
                  >
                    {tr(language, '+ Weight / Pack Sizes', '+ ওজন / প্যাক সাইজ')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSizes((prev) => [
                        ...prev,
                        {
                          category_type: 'general',
                          size_system: 'Standard',
                          label: GENERAL_PRESETS[0],
                          measurements: {},
                          stock: 10,
                          price_override: null,
                          is_available: true,
                        },
                      ])
                    }
                    className="px-3 py-1 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold"
                  >
                    {tr(language, '+ Add Custom Size', '+ কাস্টম সাইজ যোগ করুন')}
                  </button>
                </div>
              </div>

              {/* Dedicated Shoe Size Range Builder */}
              <div className="bg-zinc-900/90 border border-[#C9A227]/40 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">
                    {tr(
                      language,
                      'Shoe / Numeric Size Range Generator (From – To)',
                      'জুতা / পণ্যের সাইজ রেঞ্জ তৈরি করুন (এত থেকে এত সাইজ)'
                    )}
                  </p>
                  <span className="text-[11px] text-[#E4C76B]">
                    {tr(language, 'e.g. sizes 39 to 44', 'যেমন: ৩৯ থেকে ৪৪ পর্যন্ত সাইজ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      {tr(language, 'Start Size', 'শুরু সাইজ')}
                    </label>
                    <input
                      type="text"
                      value={shoeRangeStart}
                      onChange={(e) => setShoeRangeStart(e.target.value)}
                      placeholder="39"
                      className="w-full border border-zinc-700 bg-zinc-950 text-white px-2.5 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      {tr(language, 'End Size', 'শেষ সাইজ')}
                    </label>
                    <input
                      type="text"
                      value={shoeRangeEnd}
                      onChange={(e) => setShoeRangeEnd(e.target.value)}
                      placeholder="44"
                      className="w-full border border-zinc-700 bg-zinc-950 text-white px-2.5 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      {tr(language, 'Size System', 'সাইজ সিস্টেম')}
                    </label>
                    <select
                      value={shoeRangeSystem}
                      onChange={(e) => setShoeRangeSystem(e.target.value as any)}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white px-2.5 py-1.5 focus:border-[#C9A227] focus:outline-none"
                    >
                      <option value="EU">{tr(language, 'EU (e.g. EU 39–44)', 'EU (যেমন: EU 39–44)')}</option>
                      <option value="Standard">{tr(language, 'Standard (39–44)', 'বাংলাদেশ / সাধারণ (৩৯–৪৪)')}</option>
                      <option value="US">US</option>
                      <option value="UK">UK</option>
                      <option value="Custom">{tr(language, 'Custom Numbers', 'কাস্টম নম্বর')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      {tr(language, 'Stock per Size', 'প্রতি সাইজে স্টক')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={shoeRangeStock}
                      onChange={(e) => setShoeRangeStock(e.target.value)}
                      className="w-full border border-zinc-700 bg-zinc-950 text-white px-2.5 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAddShoeRangeExpanded}
                    className="px-3 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
                  >
                    {tr(language, '+ Generate Individual Sizes from Range', '+ রেঞ্জ থেকে সব সাইজ আলাদা যোগ করুন')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddShoeRangeSingleLine}
                    className="px-3 py-1.5 border border-[#C9A227] text-[#E4C76B] hover:bg-[#C9A227] hover:text-black font-semibold transition-colors"
                  >
                    {tr(language, '+ Add Range as One Label (e.g. 39 to 44)', '+ এক লাইনে রেঞ্জ যোগ করুন (যেমন: ৩৯ থেকে ৪৪)')}
                  </button>
                </div>
              </div>

              {sizes.map((s, idx) => (
                <div key={idx} className="border border-zinc-800 bg-zinc-900 p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                  <input
                    type="text"
                    placeholder={tr(language, 'Size (e.g. EU 40)', 'সাইজ (যেমন: EU 40)')}
                    value={s.label}
                    onChange={(e) => setSizes((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <select
                    value={s.size_system}
                    onChange={(e) => setSizes((p) => p.map((x, i) => (i === idx ? { ...x, size_system: e.target.value as any } : x)))}
                    className="border border-zinc-700 px-2 py-1.5 bg-zinc-950 text-white focus:border-[#C9A227] focus:outline-none"
                  >
                    <option value="Standard" className="bg-zinc-950 text-white">{tr(language, 'Standard', 'সাধারণ')}</option>
                    <option value="EU" className="bg-zinc-950 text-white">EU</option>
                    <option value="US" className="bg-zinc-950 text-white">US</option>
                    <option value="UK" className="bg-zinc-950 text-white">UK</option>
                    <option value="Custom" className="bg-zinc-950 text-white">{tr(language, 'Custom', 'কাস্টম')}</option>
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={tr(language, 'Stock', 'স্টক')}
                    value={s.stock}
                    onChange={(e) =>
                      setSizes((p) =>
                        p.map((x, i) => (i === idx ? { ...x, stock: Math.max(0, Number(normalizeNumericInput(e.target.value) || 0)) } : x))
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder={tr(language, 'Measurements (Chest/Len)', 'মাপ (বুক / দৈর্ঘ্য)')}
                    value={s.measurements?.chest || s.measurements?.length || ''}
                    onChange={(e) =>
                      setSizes((p) =>
                        p.map((x, i) =>
                          i === idx ? { ...x, measurements: { ...x.measurements, length: e.target.value } } : x
                        )
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`${tr(language, 'Override Price', 'আলাদা দাম')} (${productCurrency})`}
                    value={s.price_override ?? ''}
                    onChange={(e) =>
                      setSizes((p) =>
                        p.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                price_override:
                                  e.target.value === '' ? null : Number(normalizeNumericInput(e.target.value) || 0),
                              }
                            : x
                        )
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSizes((p) => p.filter((_, i) => i !== idx))}
                    aria-label={tr(language, 'Remove size', 'সাইজ মুছুন')}
                    className="text-red-400 hover:text-red-300 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>

            {/* 6. Models & Variations */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-[#E4C76B]">
                  {tr(language, `6. Models & Variations (${variations.length})`, `৬. মডেল ও ভ্যারিয়েশন (${variations.length}টি)`)}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setVariations((prev) => [
                      ...prev,
                      {
                        color_id: null,
                        size_id: null,
                        model_number: '',
                        model_name: '',
                        style: '',
                        design: '',
                        pattern: '',
                        version: '',
                        material: '',
                        variant_name: '',
                        image_url: images[0] || '',
                        sku: '',
                        price: pricePreview.active,
                        stock: 10,
                        is_available: true,
                      },
                    ])
                  }
                  className="px-3 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tr(language, 'Add Variation', 'ভ্যারিয়েশন যোগ করুন')}</span>
                </button>
              </div>
              {variations.map((v, idx) => (
                <div key={idx} className="border border-zinc-800 bg-zinc-900 p-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder={tr(language, 'Variation Name', 'ভ্যারিয়েশনের নাম')}
                    value={v.variant_name}
                    onChange={(e) => setVariations((p) => p.map((x, i) => (i === idx ? { ...x, variant_name: e.target.value } : x)))}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder={tr(language, 'Model Number / Name', 'মডেল নম্বর / নাম')}
                    value={v.model_name}
                    onChange={(e) => setVariations((p) => p.map((x, i) => (i === idx ? { ...x, model_name: e.target.value } : x)))}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder={tr(language, 'Style / Material', 'স্টাইল / উপাদান')}
                    value={v.material}
                    onChange={(e) => setVariations((p) => p.map((x, i) => (i === idx ? { ...x, material: e.target.value } : x)))}
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`${tr(language, 'Price', 'দাম')} (${productCurrency})`}
                    value={v.price}
                    onChange={(e) =>
                      setVariations((p) =>
                        p.map((x, i) => (i === idx ? { ...x, price: Number(normalizeNumericInput(e.target.value) || 0) } : x))
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={tr(language, 'Stock', 'স্টক')}
                      value={v.stock}
                      onChange={(e) =>
                        setVariations((p) =>
                          p.map((x, i) =>
                            i === idx ? { ...x, stock: Math.max(0, Number(normalizeNumericInput(e.target.value) || 0)) } : x
                          )
                        )
                      }
                      className="w-20 border border-zinc-700 bg-zinc-950 text-white placeholder:text-zinc-500 px-2 py-1.5 font-mono focus:border-[#C9A227] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setVariations((p) => p.filter((_, i) => i !== idx))}
                      aria-label={tr(language, 'Remove variation', 'ভ্যারিয়েশন মুছুন')}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {/* 7. Specifications */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-[#E4C76B]">
                  {tr(language, '7. Product Specifications', '৭. পণ্যের স্পেসিফিকেশন / গুণাবলী')}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applySpecTemplate('clothing')}
                    className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#C9A227] hover:text-white"
                  >
                    {tr(language, '+ Clothing Specs', '+ পোশাকের তথ্য')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applySpecTemplate('electronics')}
                    className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#C9A227] hover:text-white"
                  >
                    {tr(language, '+ Electronics Specs', '+ ইলেকট্রনিক্স তথ্য')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applySpecTemplate('shoes')}
                    className="px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#C9A227] hover:text-white"
                  >
                    {tr(language, '+ Footwear Specs', '+ জুতার তথ্য')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpecsList((p) => [...p, { key: '', value: '' }])}
                    className="px-3 py-1 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold"
                  >
                    {tr(language, '+ Custom Spec', '+ কাস্টম তথ্য')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {specsList.map((sp, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={tr(language, 'Attribute Name', 'বৈশিষ্ট্যের নাম')}
                      value={sp.key}
                      onChange={(e) => setSpecsList((p) => p.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))}
                      className="w-1/2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-2 py-1.5 font-medium focus:border-[#C9A227] focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder={tr(language, 'Value / Detail', 'মান / বিবরণ')}
                      value={sp.value}
                      onChange={(e) => setSpecsList((p) => p.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                      className="w-1/2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-2 py-1.5 focus:border-[#C9A227] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSpecsList((p) => p.filter((_, i) => i !== idx))}
                      aria-label={tr(language, 'Remove spec', 'তথ্য মুছুন')}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* 8. Packaging & Delivery */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-[#E4C76B] border-b border-zinc-800 pb-2">
                {tr(language, '8. Packaging, Dimensions & Delivery', '৮. প্যাকেজিং, মাপ ও ডেলিভারি তথ্য')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder={tr(language, 'Package Contents', 'প্যাকেজে যা যা থাকছে')}
                  value={packageContents}
                  onChange={(e) => setPackageContents(e.target.value)}
                  className="col-span-2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={tr(language, 'Number of Pieces', 'পিস সংখ্যা')}
                  value={numberOfPieces}
                  onChange={(e) => setNumberOfPieces(e.target.value)}
                  className="border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={tr(language, 'Package Quantity', 'প্যাকেজ পরিমাণ')}
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(e.target.value)}
                  className="border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Length (e.g. 20cm)', 'দৈর্ঘ্য (যেমন: 20cm)')}
                  value={packageLength}
                  onChange={(e) => setPackageLength(e.target.value)}
                  className="border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Width', 'প্রস্থ (Width)')}
                  value={packageWidth}
                  onChange={(e) => setPackageWidth(e.target.value)}
                  className="border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Height', 'উচ্চতা (Height)')}
                  value={packageHeight}
                  onChange={(e) => setPackageHeight(e.target.value)}
                  className="border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Weight', 'ওজন (Weight)')}
                  value={packageWeight}
                  onChange={(e) => {
                    setPackageWeight(e.target.value);
                    setShippingWeight(e.target.value);
                  }}
                  className="border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Included Accessories', 'সাথে থাকা আনুষঙ্গিক পণ্য')}
                  value={includedAccessories}
                  onChange={(e) => setIncludedAccessories(e.target.value)}
                  className="col-span-2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Estimated Delivery (e.g. 2–5 Days)', 'সম্ভাব্য ডেলিভারি সময় (যেমন: ২-৫ দিন)')}
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  className="col-span-2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Shipping Info', 'শিপিং সংক্রান্ত তথ্য')}
                  value={shippingInfo}
                  onChange={(e) => setShippingInfo(e.target.value)}
                  className="col-span-2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={tr(language, 'Return / Exchange Policy', 'রিটার্ন / পরিবর্তন নীতিমালা')}
                  value={returnPolicy}
                  onChange={(e) => setReturnPolicy(e.target.value)}
                  className="col-span-2 border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 px-3 py-2 focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            </section>

            {/* Sticky Bottom Bar */}
            <div className="sticky bottom-0 bg-zinc-950 border-t border-zinc-800 pt-4 pb-1 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400">
                {tr(
                  language,
                  'Fill required (*) fields & add at least 1 image, then click Publish Product.',
                  '* চিহ্নিত তথ্য ও অন্তত ১টি ছবি দিয়ে "পণ্য প্রকাশ করুন" চাপুন।'
                )}
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 sm:px-5 py-2.5 border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-white font-semibold transition-colors"
                >
                  {tr(language, 'Cancel', 'বাতিল করুন')}
                </button>
                <button
                  type="submit"
                  disabled={saving || mediaUploading}
                  className="px-5 sm:px-6 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] disabled:opacity-60 text-black font-semibold transition-colors"
                >
                  {saving
                    ? tr(language, 'Saving & Verifying...', 'সংরক্ষণ ও যাচাই হচ্ছে...')
                    : mediaUploading
                    ? tr(language, 'Waiting for media upload...', 'ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন...')
                    : initialProduct
                    ? tr(language, 'Save Changes', 'পরিবর্তন সংরক্ষণ করুন')
                    : tr(language, 'Publish Product', 'পণ্য প্রকাশ করুন')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

