import type { CustomerAddress } from './types.ts';

export type LanguageCode = 'en' | 'bn' | 'ar' | 'es';

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'BDT', symbol: '৳', label: 'BDT (৳)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AED', symbol: 'د.إ', label: 'AED' },
  { code: 'SGD', symbol: 'S$', label: 'SGD' },
  { code: 'CAD', symbol: 'C$', label: 'CAD' },
  { code: 'AUD', symbol: 'A$', label: 'AUD' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
] as const;

const BENGALI_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function normalizeNumericInput(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/[০-৯٠-٩]/g, (d) => BENGALI_DIGIT_MAP[d] ?? d)
    .replace(/,/g, '')
    .trim();
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();
  if (from === to) return safeAmount;
  const fromRate = rates[from] && rates[from] > 0 ? rates[from] : 1;
  const toRate = rates[to] && rates[to] > 0 ? rates[to] : 1;
  return (safeAmount / fromRate) * toRate;
}

export function formatCurrency(
  amount: number,
  currency: string,
  rates: Record<string, number>,
  sourceCurrency = 'USD'
): string {
  const converted = convertCurrency(amount, sourceCurrency, currency, rates);
  const meta = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  const decimals = currency === 'BDT' || currency === 'INR' ? 0 : 2;
  return `${meta.symbol}${converted.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function tr(lang: LanguageCode, enText: string, bnText: string): string {
  return lang === 'bn' ? bnText : enText;
}

export const BD_DIVISIONS: Array<{ value: string; en: string; bn: string }> = [
  { value: 'Dhaka', en: 'Dhaka Division', bn: 'ঢাকা বিভাগ' },
  { value: 'Chattogram', en: 'Chattogram Division', bn: 'চট্টগ্রাম বিভাগ' },
  { value: 'Rajshahi', en: 'Rajshahi Division', bn: 'রাজশাহী বিভাগ' },
  { value: 'Khulna', en: 'Khulna Division', bn: 'খুলনা বিভাগ' },
  { value: 'Barishal', en: 'Barishal Division', bn: 'বরিশাল বিভাগ' },
  { value: 'Sylhet', en: 'Sylhet Division', bn: 'সিলেট বিভাগ' },
  { value: 'Rangpur', en: 'Rangpur Division', bn: 'রংপুর বিভাগ' },
  { value: 'Mymensingh', en: 'Mymensingh Division', bn: 'ময়মনসিংহ বিভাগ' },
];

export const BD_DISTRICTS: Array<{ en: string; bn: string }> = [
  { en: 'Dhaka', bn: 'ঢাকা' },
  { en: 'Faridpur', bn: 'ফরিদপুর' },
  { en: 'Gazipur', bn: 'গাজীপুর' },
  { en: 'Gopalganj', bn: 'গোপালগঞ্জ' },
  { en: 'Kishoreganj', bn: 'কিশোরগঞ্জ' },
  { en: 'Madaripur', bn: 'মাদারীপুর' },
  { en: 'Manikganj', bn: 'মানিকগঞ্জ' },
  { en: 'Munshiganj', bn: 'মুন্সিগঞ্জ' },
  { en: 'Narayanganj', bn: 'নারায়ণগঞ্জ' },
  { en: 'Narsingdi', bn: 'নরসিংদী' },
  { en: 'Rajbari', bn: 'রাজবাড়ী' },
  { en: 'Shariatpur', bn: 'শরীয়তপুর' },
  { en: 'Tangail', bn: 'টাঙ্গাইল' },
  { en: 'Chattogram', bn: 'চট্টগ্রাম' },
  { en: 'Bandarban', bn: 'বান্দরবান' },
  { en: 'Brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া' },
  { en: 'Chandpur', bn: 'চাঁদপুর' },
  { en: 'Comilla', bn: 'কুমিল্লা' },
  { en: "Cox's Bazar", bn: 'কক্সবাজার' },
  { en: 'Feni', bn: 'ফেনী' },
  { en: 'Khagrachhari', bn: 'খাগড়াছড়ি' },
  { en: 'Lakshmipur', bn: 'লক্ষ্মীপুর' },
  { en: 'Noakhali', bn: 'নোয়াখালী' },
  { en: 'Rangamati', bn: 'রাঙ্গামাটি' },
  { en: 'Rajshahi', bn: 'রাজশাহী' },
  { en: 'Bogura', bn: 'বগুড়া' },
  { en: 'Chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ' },
  { en: 'Joypurhat', bn: 'জয়পুরহাট' },
  { en: 'Naogaon', bn: 'নওগাঁ' },
  { en: 'Natore', bn: 'নাটোর' },
  { en: 'Pabna', bn: 'পাবনা' },
  { en: 'Sirajganj', bn: 'সিরাজগঞ্জ' },
  { en: 'Khulna', bn: 'খুলনা' },
  { en: 'Bagerhat', bn: 'বাগেরহাট' },
  { en: 'Chuadanga', bn: 'চুয়াডাঙ্গা' },
  { en: 'Jashore', bn: 'যশোর' },
  { en: 'Jhenaidah', bn: 'ঝিনাইদহ' },
  { en: 'Kushtia', bn: 'কুষ্টিয়া' },
  { en: 'Magura', bn: 'মাগুরা' },
  { en: 'Meherpur', bn: 'মেহেরপুর' },
  { en: 'Narail', bn: 'নড়াইল' },
  { en: 'Satkhira', bn: 'সাতক্ষীরা' },
  { en: 'Barishal', bn: 'বরিশাল' },
  { en: 'Barguna', bn: 'বরগুনা' },
  { en: 'Bhola', bn: 'ভোলা' },
  { en: 'Jhalokati', bn: 'ঝালকাঠি' },
  { en: 'Patuakhali', bn: 'পটুয়াখালী' },
  { en: 'Pirojpur', bn: 'পিরোজপুর' },
  { en: 'Sylhet', bn: 'সিলেট' },
  { en: 'Habiganj', bn: 'হবিগঞ্জ' },
  { en: 'Moulvibazar', bn: 'মৌলভীবাজার' },
  { en: 'Sunamganj', bn: 'সুনামগঞ্জ' },
  { en: 'Rangpur', bn: 'রংপুর' },
  { en: 'Dinajpur', bn: 'দিনাজপুর' },
  { en: 'Gaibandha', bn: 'গাইবান্ধা' },
  { en: 'Kurigram', bn: 'কুড়িগ্রাম' },
  { en: 'Lalmonirhat', bn: 'লালমনিরহাট' },
  { en: 'Nilphamari', bn: 'নীলফামারী' },
  { en: 'Panchagarh', bn: 'পঞ্চগড়' },
  { en: 'Thakurgaon', bn: 'ঠাকুরগাঁও' },
  { en: 'Mymensingh', bn: 'ময়মনসিংহ' },
  { en: 'Jamalpur', bn: 'জামালপুর' },
  { en: 'Netrokona', bn: 'নেত্রকোণা' },
  { en: 'Sherpur', bn: 'শেরপুর' },
];

export const DELIVERY_COUNTRIES: Array<{ value: string; en: string; bn: string }> = [
  { value: 'Bangladesh', en: 'Bangladesh', bn: 'বাংলাদেশ' },
  { value: 'United States', en: 'United States', bn: 'যুক্তরাষ্ট্র' },
  { value: 'United Kingdom', en: 'United Kingdom', bn: 'যুক্তরাজ্য' },
  { value: 'United Arab Emirates', en: 'United Arab Emirates', bn: 'সংযুক্ত আরব আমিরাত' },
  { value: 'Saudi Arabia', en: 'Saudi Arabia', bn: 'সৌদি আরব' },
  { value: 'Malaysia', en: 'Malaysia', bn: 'মালয়েশিয়া' },
  { value: 'Singapore', en: 'Singapore', bn: 'সিঙ্গাপুর' },
  { value: 'India', en: 'India', bn: 'ভারত' },
  { value: 'Canada', en: 'Canada', bn: 'কানাডা' },
  { value: 'Australia', en: 'Australia', bn: 'অস্ট্রেলিয়া' },
  { value: 'Germany', en: 'Germany', bn: 'জার্মানি' },
  { value: 'France', en: 'France', bn: 'ফ্রান্স' },
];

const CATEGORY_TRANSLATIONS_BN: Record<string, string> = {
  Accessories: 'এক্সেসরিজ',
  Bags: 'ব্যাগ ও লাগেজ',
  'Beauty & Personal Care': 'সৌন্দর্য ও ব্যক্তিগত যত্ন',
  Computers: 'কম্পিউটার ও ল্যাপটপ',
  Electronics: 'ইলেকট্রনিক্স',
  'Home & Living': 'হোম ও লিভিং',
  'Kitchen Products': 'কিচেন পণ্য',
  Lifestyle: 'লাইফস্টাইল',
  "Men's Fashion": 'ছেলেদের ফ্যাশন',
  'Mobile Accessories': 'মোবাইল এক্সেসরিজ',
  'Other Categories': 'অন্যান্য ক্যাটাগরি',
  Shoes: 'জুতা',
  'Sports & Outdoors': 'খেলাধুলা ও আউটডোর',
  Toys: 'খেলনা',
  Watches: 'ঘড়ি',
  "Women's Fashion": 'মেয়েদের ফ্যাশন',
};

export function translateCategory(name: string | undefined, lang: LanguageCode): string {
  if (!name) return '';
  if (lang === 'bn') {
    return CATEGORY_TRANSLATIONS_BN[name] || name;
  }
  return name;
}

const ORDER_STATUS_BN: Record<string, string> = {
  Pending: 'অপেক্ষমাণ (Pending)',
  Confirmed: 'নিশ্চিত হয়েছে',
  Processing: 'প্যাকিং / প্রস্তুত হচ্ছে',
  'Ready to Ship': 'পাঠানোর জন্য প্রস্তুত',
  Shipped: 'কুরিয়ারে পাঠানো হয়েছে',
  'Out for Delivery': 'ডেলিভারির পথে',
  Delivered: 'ডেলিভারি সম্পন্ন',
  Cancelled: 'বাতিল হয়েছে',
  Returned: 'ফেরত পাঠানো হয়েছে',
  Refunded: 'টাকা ফেরত (Refunded)',
};

export function translateOrderStatus(status: string, lang: LanguageCode): string {
  if (lang === 'bn') return ORDER_STATUS_BN[status] || status;
  return status;
}

const PAYMENT_STATUS_BN: Record<string, string> = {
  pending: 'অপেক্ষমাণ',
  verified: 'যাচাইকৃত',
  paid: 'পরিশোধিত',
  failed: 'ব্যর্থ',
  refunded: 'রিফান্ডকৃত',
};

export function translatePaymentStatus(status: string, lang: LanguageCode): string {
  if (lang === 'bn') return PAYMENT_STATUS_BN[status.toLowerCase()] || status;
  return status;
}

export function translateCountry(country: string | undefined, lang: LanguageCode): string {
  if (!country) return '';
  const match = DELIVERY_COUNTRIES.find((c) => c.value.toLowerCase() === country.toLowerCase());
  if (!match) return country;
  return lang === 'bn' ? match.bn : match.en;
}

export function translateDivision(division: string | undefined, lang: LanguageCode): string {
  if (!division) return '';
  const match = BD_DIVISIONS.find((d) => d.value.toLowerCase() === division.toLowerCase());
  if (!match) return division;
  return lang === 'bn' ? match.bn : match.en;
}

export function translateSiteDefault(
  value: string | undefined,
  enDefault: string,
  bnDefault: string,
  lang: LanguageCode
): string {
  const clean = (value || '').trim();
  if (lang !== 'bn') return clean || enDefault;
  if (!clean) return bnDefault;
  const knownEnglishDefaults = new Set([
    enDefault.trim(),
    'THE FUTURE OF SHOPPING 🛍️',
    'THE FUTURE OF SHOPPING',
    'SHOP • DISCOVER • ENJOY',
    'Curated Luxury, Direct & Global Discovery',
    'A global shopping destination uniting direct-from-vault SHOPNEXA ROBI HUB editions with verified international partner collections.',
    'Explore Collection',
    'Rangpur, Bangladesh · Global Fulfillment',
    'Message @ShoponexaMarketplaseSuport on Telegram with your Order ID or product question for priority assistance.',
  ]);
  return knownEnglishDefaults.has(clean) ? bnDefault : clean;
}

export function formatDetailedAddress(addr: Partial<CustomerAddress> | null | undefined, lang: LanguageCode): string {
  if (!addr) return '';
  const parts = [
    addr.house_number ? (lang === 'bn' ? `বাড়ি: ${addr.house_number}` : `House ${addr.house_number}`) : '',
    addr.floor_number ? (lang === 'bn' ? `তলা: ${addr.floor_number}` : `Floor ${addr.floor_number}`) : '',
    addr.apartment_number ? (lang === 'bn' ? `ফ্ল্যাট: ${addr.apartment_number}` : `Apt ${addr.apartment_number}`) : '',
    addr.road_number ? (lang === 'bn' ? `রোড: ${addr.road_number}` : `Road ${addr.road_number}`) : '',
    addr.street_address || '',
    addr.area || '',
    addr.village ? (lang === 'bn' ? `গ্রাম/মহল্লা: ${addr.village}` : `Village: ${addr.village}`) : '',
    addr.post_office ? (lang === 'bn' ? `ডাকঘর: ${addr.post_office}` : `Post Office: ${addr.post_office}`) : '',
    addr.union_name ? (lang === 'bn' ? `ইউনিয়ন: ${addr.union_name}` : `Union: ${addr.union_name}`) : '',
    addr.municipality ? (lang === 'bn' ? `পৌরসভা: ${addr.municipality}` : addr.municipality) : '',
    addr.thana ? (lang === 'bn' ? `থানা: ${addr.thana}` : `Thana: ${addr.thana}`) : '',
    addr.upazila ? (lang === 'bn' ? `উপজেলা: ${addr.upazila}` : `Upazila: ${addr.upazila}`) : '',
    addr.district ? (lang === 'bn' ? `জেলা: ${addr.district}` : addr.district) : '',
    addr.division ? translateDivision(addr.division, lang) : '',
    addr.city && addr.city !== addr.district ? addr.city : '',
    addr.state_province || '',
    addr.postal_code ? (lang === 'bn' ? `পোস্ট কোড: ${addr.postal_code}` : addr.postal_code) : '',
    addr.country ? translateCountry(addr.country, lang) : '',
  ].filter(Boolean);
  return parts.join(', ');
}

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    tagline: 'THE FUTURE OF SHOPPING',
    globalMessage: 'A Global Shopping Destination — Direct Vault Editions & Verified Partner Finds',
    menuHome: 'HOME',
    menuShop: 'SHOP',
    menuCategories: 'CATEGORIES',
    searchPlaceholder: 'Search products, brands, SKUs...',
    account: 'Account',
    wishlist: 'Wishlist',
    cart: 'Cart',
    trackOrder: 'Track Order',
    admin: 'Admin',
    viewDetails: 'View Details',
    addToCart: 'Add to Cart',
    buyNowDirect: 'Buy Now — Direct Checkout',
    buyOnAliExpress: 'BUY NOW on AliExpress',
    ownProductLabel: 'SHOPNEXA ROBI HUB Direct',
    affiliateProductLabel: 'Affiliate Partner',
    featuredProducts: 'Featured Products',
    newArrivals: 'New Arrivals',
    trendingProducts: 'Trending Products',
    bestSellers: 'Best Sellers',
    specialOffers: 'Special Offers',
    allProducts: 'All Products',
    latestUploads: 'Latest Uploads',
    ownProducts: 'Own Products',
    affiliateProducts: 'Affiliate Products',
    discountProducts: 'Discount Products',
    newCollections: 'New Collections',
    featuredCollections: 'Featured Collections',
    recommendedProducts: 'Recommended For You',
    customerReviews: 'Verified Customer Reviews',
    shoppingBenefits: 'Why Shop With SHOPNEXA ROBI HUB',
    newsletterTitle: 'Join the SHOPNEXA ROBI HUB Private List',
    newsletterSubtitle: 'Receive curated collection launches, direct vault releases, and seasonal offers.',
    subscribe: 'Subscribe',
    telegramSupport: 'Telegram Support',
  },
  bn: {
    tagline: 'কেনাকাটার ভবিষ্যৎ',
    globalMessage: 'বিশ্বব্যাপী শপিং গন্তব্য — সরাসরি কালেকশন এবং বিশ্বস্ত পার্টনার পণ্য',
    menuHome: 'হোম',
    menuShop: 'শপ',
    menuCategories: 'ক্যাটাগরি',
    searchPlaceholder: 'পণ্য, ব্র্যান্ড বা SKU খুঁজুন...',
    account: 'অ্যাকাউন্ট',
    wishlist: 'উইশলিস্ট',
    cart: 'কার্ট',
    trackOrder: 'অর্ডার ট্র্যাক',
    admin: 'অ্যাডমিন',
    viewDetails: 'বিস্তারিত দেখুন',
    addToCart: 'কার্টে যোগ করুন',
    buyNowDirect: 'এখনই কিনুন — সরাসরি চেকআউট',
    buyOnAliExpress: 'AliExpress-এ কিনুন',
    ownProductLabel: 'SHOPNEXA সরাসরি পণ্য',
    affiliateProductLabel: 'অ্যাফিলিয়েট পার্টনার',
    featuredProducts: 'ফিচার্ড পণ্য',
    newArrivals: 'নতুন আগমন',
    trendingProducts: 'ট্রেন্ডিং পণ্য',
    bestSellers: 'সেরা বিক্রিত',
    specialOffers: 'বিশেষ অফার',
    allProducts: 'সকল পণ্য',
    latestUploads: 'সর্বশেষ আপলোড',
    ownProducts: 'নিজস্ব পণ্য',
    affiliateProducts: 'অ্যাফিলিয়েট পণ্য',
    discountProducts: 'ডিসকাউন্ট পণ্য',
    newCollections: 'নতুন সংগ্রহ',
    featuredCollections: 'বিশেষ সংগ্রহ',
    recommendedProducts: 'আপনার জন্য প্রস্তাবিত',
    customerReviews: 'ক্রেতাদের যাচাইকৃত রিভিউ',
    shoppingBenefits: 'কেন SHOPNEXA ROBI HUB থেকে কিনবেন',
    newsletterTitle: 'SHOPNEXA ROBI HUB নিউজলেটারে যুক্ত হন',
    newsletterSubtitle: 'নতুন কালেকশন, সরাসরি রিলিজ এবং মৌসুমি অফার সবার আগে জানতে ইমেইল যুক্ত করুন।',
    subscribe: 'সাবস্ক্রাইব',
    telegramSupport: 'টেলিগ্রাম সাপোর্ট',
  },
  ar: {
    tagline: 'مستقبل التسوق',
    globalMessage: 'وجهة تسوق عالمية — إصدارات مباشرة وشركاء موثوقون',
    menuHome: 'الرئيسية',
    menuShop: 'المتجر',
    menuCategories: 'الفئات',
    searchPlaceholder: 'ابحث عن المنتجات أو العلامات التجارية...',
    account: 'الحساب',
    wishlist: 'المفضلة',
    cart: 'السلة',
    trackOrder: 'تتبع الطلب',
    admin: 'الإدارة',
    viewDetails: 'عرض التفاصيل',
    addToCart: 'أضف إلى السلة',
    buyNowDirect: 'اشترِ الآن — الدفع المباشر',
    buyOnAliExpress: 'اشترِ الآن عبر AliExpress',
    ownProductLabel: 'SHOPNEXA ROBI HUB مباشر',
    affiliateProductLabel: 'شريك تسويق',
    featuredProducts: 'منتجات مميزة',
    newArrivals: 'وصل حديثاً',
    trendingProducts: 'الأكثر رواجاً',
    bestSellers: 'الأكثر مبيعاً',
    specialOffers: 'عروض خاصة',
    allProducts: 'جميع المنتجات',
    latestUploads: 'أحدث المنتجات',
    ownProducts: 'منتجاتنا المباشرة',
    affiliateProducts: 'منتجات الشركاء',
    discountProducts: 'منتجات مخفضة',
    newCollections: 'تشكيلات جديدة',
    featuredCollections: 'تشكيلات مختارة',
    recommendedProducts: 'مقترحة لك',
    customerReviews: 'تقييمات العملاء',
    shoppingBenefits: 'مزايا التسوق في SHOPNEXA ROBI HUB',
    newsletterTitle: 'انضم إلى قائمة SHOPNEXA ROBI HUB',
    newsletterSubtitle: 'احصل على أحدث الإصدارات والعروض الحصرية.',
    subscribe: 'اشتراك',
    telegramSupport: 'دعم تيليجرام',
  },
  es: {
    tagline: 'EL FUTURO DE LAS COMPRAS',
    globalMessage: 'Un Destino Global de Compras — Ediciones Directas y Aliados Verificados',
    menuHome: 'INICIO',
    menuShop: 'TIENDA',
    menuCategories: 'CATEGORÍAS',
    searchPlaceholder: 'Buscar productos, marcas, SKUs...',
    account: 'Cuenta',
    wishlist: 'Favoritos',
    cart: 'Carrito',
    trackOrder: 'Rastrear',
    admin: 'Admin',
    viewDetails: 'Ver Detalles',
    addToCart: 'Añadir al Carrito',
    buyNowDirect: 'Comprar Ahora — Pago Directo',
    buyOnAliExpress: 'COMPRAR EN AliExpress',
    ownProductLabel: 'SHOPNEXA ROBI HUB Directo',
    affiliateProductLabel: 'Aliado Afiliado',
    featuredProducts: 'Productos Destacados',
    newArrivals: 'Novedades',
    trendingProducts: 'Tendencias',
    bestSellers: 'Más Vendidos',
    specialOffers: 'Ofertas Especiales',
    allProducts: 'Todos los Productos',
    latestUploads: 'Últimos Productos',
    ownProducts: 'Productos Propios',
    affiliateProducts: 'Productos Afiliados',
    discountProducts: 'Productos con Descuento',
    newCollections: 'Nuevas Colecciones',
    featuredCollections: 'Colecciones Destacadas',
    recommendedProducts: 'Recomendado para Ti',
    customerReviews: 'Reseñas de Clientes',
    shoppingBenefits: 'Por Qué Comprar en SHOPNEXA ROBI HUB',
    newsletterTitle: 'Únete a SHOPNEXA ROBI HUB',
    newsletterSubtitle: 'Recibe lanzamientos exclusivos y ofertas de temporada.',
    subscribe: 'Suscribirse',
    telegramSupport: 'Soporte Telegram',
  },
};

export function t(lang: LanguageCode, key: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}
