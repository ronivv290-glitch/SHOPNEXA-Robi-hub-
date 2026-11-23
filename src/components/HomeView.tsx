import React, { useState, useEffect } from 'react';
import {
  Search,
  ArrowRight,
  Globe,
  ShieldCheck,
  Truck,
  Headphones,
  Star,
  Send,
  Youtube,
  Instagram,
  Facebook,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { t, tr, translateCategory, translateSiteDefault } from '../i18n.ts';
import { ProductCard } from './ProductCard.tsx';
import { SmartImage } from './SmartImage.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { AppDownloadSection } from './AppDownloadSection.tsx';

export function HomeView({ initialSection }: { initialSection?: string }) {
  const { settings, categories, products, reviews, navigate, language, showToast, canShowCustomerDownload } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'featured' | 'new-arrivals' | 'trending' | 'best-sellers' | 'special-offers'>('all');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNews, setSubmittingNews] = useState(false);

  useEffect(() => {
    if (
      initialSection === 'all' ||
      initialSection === 'featured' ||
      initialSection === 'new-arrivals' ||
      initialSection === 'trending' ||
      initialSection === 'best-sellers' ||
      initialSection === 'special-offers'
    ) {
      setActiveTab(initialSection);
      const el = document.getElementById('showcase-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [initialSection]);

  const featuredCats = categories.filter((c) => c.is_featured === 1).slice(0, 8);
  const ownProducts = products.filter((p) => p.product_type === 'own').slice(0, 12);
  const recommendedProducts = products.filter((p) => p.is_recommended).slice(0, 6);

  const tabProducts = products.filter((p) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'featured') return p.is_featured;
    if (activeTab === 'new-arrivals') return p.is_new_arrival;
    if (activeTab === 'trending') return p.is_trending;
    if (activeTab === 'best-sellers') return p.is_best_seller;
    if (activeTab === 'special-offers') return p.is_special_offer || p.discount_percentage > 0;
    return true;
  });

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ page: 'shop', search: searchQuery.trim(), filter: 'all' });
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubmittingNews(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail.trim(), language }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          tr(language, data.message || 'Subscribed successfully', 'সফলভাবে সাবস্ক্রাইব সম্পন্ন হয়েছে'),
          'success'
        );
        setNewsletterEmail('');
      } else {
        showToast(data.error || tr(language, 'Subscription failed', 'সাবস্ক্রিপশন ব্যর্থ হয়েছে'), 'error');
      }
    } finally {
      setSubmittingNews(false);
    }
  };

  const taglineText = translateSiteDefault(
    settings?.tagline,
    'THE FUTURE OF SHOPPING 🛍️',
    'কেনাকাটার ভবিষ্যৎ 🛍️',
    language
  );
  const sloganText = translateSiteDefault(
    settings?.logo_slogan,
    'SHOP • DISCOVER • ENJOY',
    'কিনুন • জানুন • উপভোগ করুন',
    language
  );
  const heroTitleText = translateSiteDefault(
    settings?.hero_title,
    'Curated Luxury, Direct & Global Discovery',
    'বাছাইকৃত প্রিমিয়াম, সরাসরি ও গ্লোবাল শপিং কালেকশন',
    language
  );
  const heroSubtitleText = translateSiteDefault(
    settings?.hero_subtitle,
    'A global shopping destination uniting direct-from-vault SHOPNEXA ROBI HUB editions with verified international partner collections.',
    t(language, 'globalMessage'),
    language
  );
  const heroCtaText = translateSiteDefault(
    settings?.hero_cta_text,
    'Explore Collection',
    'কালেকশন দেখুন',
    language
  );

  return (
    <div className="bg-zinc-950 text-zinc-100">
      {/* 1. HERO SECTION — Obsidian, Champagne Gold & Crisp White */}
      <section className="bg-zinc-950 text-white border-b border-[#C9A227]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.22em] text-[#E4C76B]">
                {settings?.brand_name || 'SHOPNEXA ROBI HUB'} – {taglineText}
              </p>
              <p className="text-[11px] font-medium tracking-[0.26em] text-zinc-300">
                {sloganText}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.06] text-balance text-white">
                {heroTitleText}
              </h1>
              <p className="text-sm sm:text-base text-zinc-200 leading-relaxed max-w-xl">
                {heroSubtitleText}
              </p>
            </div>

            {/* Hero Product Search */}
            <form onSubmit={handleHeroSearch} className="flex max-w-lg bg-zinc-900 border border-zinc-700 focus-within:border-[#C9A227]">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(language, 'searchPlaceholder')}
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>{tr(language, 'Search', 'খুঁজুন')}</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => navigate({ page: 'shop', filter: 'all' })}
                className="px-6 py-3 bg-white hover:bg-[#E4C76B] text-black text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors"
              >
                <span>{heroCtaText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'shop', filter: 'own' })}
                className="px-6 py-3 border border-zinc-600 hover:border-[#C9A227] text-white text-xs font-semibold tracking-wide transition-colors"
              >
                {t(language, 'ownProducts')}
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'track' })}
                className="px-5 py-3 border border-[#C9A227]/60 hover:bg-[#C9A227] text-[#E4C76B] hover:text-black text-xs font-semibold tracking-wide transition-colors flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>{t(language, 'trackOrder')}</span>
              </button>
              {canShowCustomerDownload && (
                <PWAInstallButton variant="footer" label={tr(language, 'Download App', 'অ্যাপ ডাউনলোড')} />
              )}
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[380px] overflow-hidden border border-[#C9A227]/30">
            <SmartImage
              src={settings?.hero_image || '/src/assets/images/hero_shopnexa_luxury_1795308770793.jpg'}
              alt="SHOPNEXA ROBI HUB Flagship Collection"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-xs">
              <div>
                <p className="text-[#E4C76B] font-semibold tracking-wider">
                  {tr(language, 'WORLDWIDE DESTINATION', 'দেশ ও বিদেশে ডেলিভারি')}
                </p>
                <p className="text-zinc-100 mt-0.5">
                  {tr(language, 'Direct Bangladesh & Global Fulfillment', 'বাংলাদেশের প্রতিটি জেলা-উপজেলা, থানা ও ডাকঘরসহ বিশ্বব্যাপী ডেলিভারি')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURED CATEGORIES — Dark Frame with Crisp White Product Tiles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-zinc-800">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
              {tr(language, 'CURATED DEPARTMENTS', 'জনপ্রিয় বিভাগসমূহ')}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
              {tr(language, 'Featured Categories', 'ফিচার্ড ক্যাটাগরি')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'shop', filter: 'all' })}
            className="text-xs font-semibold text-zinc-200 hover:text-[#E4C76B] flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <span>
              {tr(language, `View All ${categories.length} Categories`, `সকল ${categories.length}টি ক্যাটাগরি দেখুন`)}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {featuredCats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate({ page: 'shop', categoryId: cat.id })}
              className="group text-left border border-zinc-800 hover:border-[#C9A227] bg-zinc-900 transition-colors flex flex-col"
            >
              <div className="aspect-[4/3] bg-white overflow-hidden">
                <SmartImage
                  src={cat.image_url}
                  alt={translateCategory(cat.name, language)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-white truncate">{translateCategory(cat.name, language)}</p>
                <p className="text-[11px] font-mono tabular-nums text-zinc-400 mt-0.5">
                  {cat.product_count ?? 0} {tr(language, 'items', 'টি পণ্য')}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. CURATED SHOWCASE — Defaults to Latest Uploads so any newly uploaded product appears #1 right away */}
      <section id="showcase-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
              {tr(language, 'LIVE STOREFRONT SHOWCASE', 'লাইভ স্টোর শোকেস')}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
              {tr(language, 'Curated Marketplace Highlights', 'সর্বশেষ আপলোড ও জনপ্রিয় কালেকশন')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-zinc-900 border border-zinc-800 p-1">
            {(
              [
                { id: 'all', label: t(language, 'latestUploads') },
                { id: 'featured', label: t(language, 'featuredProducts') },
                { id: 'new-arrivals', label: t(language, 'newArrivals') },
                { id: 'trending', label: t(language, 'trendingProducts') },
                { id: 'best-sellers', label: t(language, 'bestSellers') },
                { id: 'special-offers', label: t(language, 'specialOffers') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-[#C9A227] text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(tabProducts.length > 0 ? tabProducts : products).slice(0, 12).map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </section>

      {/* 4. OWN PRODUCTS SECTION (White Product Cards on Deep Black Canvas) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
              {tr(language, 'DIRECT FULFILLMENT', 'সরাসরি নিজস্ব ডেলিভারি')}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
              {t(language, 'ownProducts')}
            </h2>
            <p className="text-sm text-zinc-300 mt-1">
              {tr(
                language,
                'Checkout directly on SHOPNEXA ROBI HUB with bKash, Nagad, or Cash on Delivery in Bangladesh, or worldwide express shipping.',
                'বাংলাদেশে বিকাশ, নগদ বা ক্যাশ অন ডেলিভারি অথবা বিশ্বব্যাপী এক্সপ্রেস শিপিংয়ের মাধ্যমে সরাসরি SHOPNEXA ROBI HUB থেকে অর্ডার করুন।'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'shop', filter: 'own' })}
            className="px-4 py-2 border border-[#C9A227] text-[#E4C76B] text-xs font-semibold hover:bg-[#C9A227] hover:text-black transition-colors whitespace-nowrap shrink-0"
          >
            {tr(language, 'Shop All Direct', 'সকল নিজস্ব পণ্য দেখুন')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ownProducts.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </section>

      {/* 5. PROMOTIONAL & APP DOWNLOAD SECTION */}
      <AppDownloadSection />

      {/* 6. RECOMMENDED PRODUCTS & SHOPPING BENEFITS (White Product Cards on Deep Black Canvas) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-zinc-800">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
            {tr(language, 'HANDPICKED', 'আপনার জন্য বিশেষ বাছাই')}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
            {t(language, 'recommendedProducts')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {recommendedProducts.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-zinc-800">
          <div className="space-y-2">
            <Globe className="w-5 h-5 text-[#E4C76B]" />
            <h3 className="text-sm font-semibold text-white">
              {tr(language, 'Worldwide & Bangladesh Delivery', 'সারা বাংলাদেশ ও বিশ্বে ডেলিভারি')}
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {tr(
                language,
                'Dynamic division, district, upazila, thana, post office & village support across Bangladesh plus global express shipping.',
                'বাংলাদেশের প্রতিটি বিভাগ, জেলা, উপজেলা, থানা, ডাকঘর ও গ্রাম পর্যায়ে ডেলিভারি এবং আন্তর্জাতিক এক্সপ্রেস শিপিং সুবিধা।'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#E4C76B]" />
            <h3 className="text-sm font-semibold text-white">
              {tr(language, 'Verified Payment Options', 'নিরাপদ ও যাচাইকৃত পেমেন্ট')}
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {tr(
                language,
                'Authorized bKash, Nagad, and Cash on Delivery for Bangladesh orders. Zero PIN or OTP collection.',
                'বিকাশ, নগদ এবং ক্যাশ অন ডেলিভারির সুবিধা। কখনোই পিন বা OTP চাওয়া হয় না।'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Truck className="w-5 h-5 text-[#E4C76B]" />
            <h3 className="text-sm font-semibold text-white">
              {tr(language, 'Real-Time Stock & Tracking', 'রিয়েল-টাইম স্টক ও অর্ডার ট্র্যাকিং')}
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {tr(
                language,
                'Exact color, size, and model stock validation with instant order tracking and printable invoices.',
                'সঠিক রঙ ও সাইজের স্টক যাচাই, তাৎক্ষণিক অর্ডার ট্র্যাকিং এবং প্রিন্টযোগ্য ইনভয়েস।'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Headphones className="w-5 h-5 text-[#E4C76B]" />
            <h3 className="text-sm font-semibold text-white">
              {tr(language, 'Direct Telegram Support', 'সরাসরি টেলিগ্রাম সাপোর্ট')}
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {tr(
                language,
                `Connect directly with ${settings?.telegram_support_username || '@ShoponexaMarketplaseSuport'} anytime.`,
                `যেকোনো সময় সরাসরি ${settings?.telegram_support_username || '@ShoponexaMarketplaseSuport'}-এ যোগাযোগ করুন।`
              )}
            </p>
          </div>
        </div>
      </section>

      {/* 8. REAL CUSTOMER REVIEWS (Obsidian Cards with High-Contrast White Typography) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
              {tr(language, 'AUTHENTIC FEEDBACK', 'ক্রেতাদের প্রকৃত মতামত')}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
              {t(language, 'customerReviews')}
            </h2>
          </div>
        </div>

        {reviews.filter((r) => r.rating > 0).length === 0 ? (
          <div className="border border-zinc-800 bg-zinc-900 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {tr(language, 'No customer reviews submitted yet', 'এখনো কোনো ক্রেতার রিভিউ জমা পড়েনি')}
              </p>
              <p className="text-xs text-zinc-300">
                {tr(
                  language,
                  'SHOPNEXA ROBI HUB displays only authentic reviews submitted by customers. Open any product page to leave the first rating or ask a question.',
                  'SHOPNEXA ROBI HUB শুধুমাত্র ক্রেতাদের দেওয়া আসল রিভিউ প্রকাশ করে। প্রথম রিভিউ দিতে বা প্রশ্ন করতে যেকোনো পণ্যের পেজ খুলুন।'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'shop', filter: 'all' })}
              className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold whitespace-nowrap transition-colors"
            >
              {tr(language, 'Explore Products', 'পণ্যগুলো দেখুন')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews
              .filter((r) => r.rating > 0)
              .slice(0, 6)
              .map((rev) => (
                <div key={rev.id} className="border border-zinc-800 p-5 space-y-3 bg-zinc-900 text-zinc-100">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating ? 'fill-[#C9A227] text-[#C9A227]' : 'text-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                    {rev.is_verified_purchase && (
                      <span className="text-[11px] font-medium text-[#E4C76B]">
                        {tr(language, 'Verified Purchase', 'যাচাইকৃত ক্রেতা')}
                      </span>
                    )}
                  </div>
                  {rev.title && <h3 className="text-sm font-semibold text-white">{rev.title}</h3>}
                  <p className="text-xs text-zinc-300 leading-relaxed">{rev.comment}</p>
                  <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400 flex justify-between">
                    <span className="font-medium text-white">{rev.author_name}</span>
                    {rev.product_name && <span className="truncate max-w-[140px]">{rev.product_name}</span>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* 9. SOCIAL MEDIA & NEWSLETTER */}
      <section className="bg-black border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Official Social Media Buttons */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
              {tr(language, 'CONNECT WITH SHOPNEXA ROBI HUB', 'SHOPNEXA ROBI HUB-এর সাথে যুক্ত থাকুন')}
            </p>
            <h2 className="font-display text-3xl font-semibold text-white">
              {tr(language, 'Follow Our Official Global Channels', 'আমাদের অফিসিয়াল চ্যানেলগুলো ফলো করুন')}
            </h2>
            <p className="text-sm text-zinc-300">
              {tr(
                language,
                'Stay updated on new vault drops, product reviews, and direct customer support.',
                'নতুন কালেকশন, পণ্যের রিভিউ এবং সরাসরি কাস্টমার সাপোর্টের আপডেট পেতে যুক্ত হন।'
              )}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={settings?.facebook_url || 'https://www.facebook.com/share/1WFDAntMgp/'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-[#C9A227] hover:bg-[#C9A227] text-white hover:text-black text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Facebook className="w-4 h-4" />
                <span>{tr(language, 'Facebook Page', 'ফেসবুক পেজ')}</span>
              </a>
              <a
                href={settings?.youtube_url || 'https://www.youtube.com/@shopnexamarketplase'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-[#C9A227] hover:bg-[#C9A227] text-white hover:text-black text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Youtube className="w-4 h-4" />
                <span>{tr(language, 'YouTube Channel', 'ইউটিউব চ্যানেল')}</span>
              </a>
              <a
                href={settings?.instagram_url || 'https://www.instagram.com/shopnexa978?knvt=NTd5OHhtMDN6bGc3'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-[#C9A227] hover:bg-[#C9A227] text-white hover:text-black text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Instagram className="w-4 h-4" />
                <span>{tr(language, 'Instagram', 'ইনস্টাগ্রাম')}</span>
              </a>
              <a
                href={settings?.telegram_channel_url || 'https://t.me/shopnexamarketplase'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>{tr(language, 'Join Telegram Channel', 'টেলিগ্রাম চ্যানেলে যুক্ত হন')}</span>
              </a>
              <a
                href={settings?.telegram_support_url || 'https://t.me/ShoponexaMarketplaseSuport'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 border border-[#C9A227]/60 bg-zinc-950 hover:bg-[#C9A227] text-white hover:text-black text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Headphones className="w-4 h-4" />
                <span>{tr(language, 'Telegram Support', 'টেলিগ্রাম সাপোর্ট')}</span>
              </a>
            </div>
          </div>

          {/* Newsletter Subscription */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 sm:p-8 space-y-4">
            <h3 className="font-display text-2xl font-semibold text-white">
              {t(language, 'newsletterTitle')}
            </h3>
            <p className="text-xs text-zinc-300">{t(language, 'newsletterSubtitle')}</p>
            <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder={tr(language, 'Enter your email address', 'আপনার ইমেইল ঠিকানা লিখুন')}
                className="flex-1 bg-zinc-950 border border-zinc-700 px-4 py-2.5 text-sm text-white placeholder:text-zinc-400 focus:border-[#C9A227] focus:outline-none"
              />
              <button
                type="submit"
                disabled={submittingNews}
                className="px-6 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold whitespace-nowrap transition-colors"
              >
                {submittingNews ? tr(language, 'Subscribing...', 'সাবস্ক্রাইব হচ্ছে...') : t(language, 'subscribe')}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
