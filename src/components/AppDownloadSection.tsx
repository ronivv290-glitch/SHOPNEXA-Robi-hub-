import React, { useState } from 'react';
import { Download, Smartphone, ArrowRight, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { tr, translateSiteDefault } from '../i18n.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

export function AppDownloadSection() {
  const { settings, navigate, language } = useStore();
  const { isInstallable, isInstalled, platform, install } = usePWAInstall();
  const [apkGuideOpen, setApkGuideOpen] = useState(false);

  const brandName = settings?.brand_name || 'SHOPNEXA ROBI HUB';
  const apkUrl = settings?.android_apk_url?.trim() || '';

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

  const handleAndroidAction = async () => {
    if (isInstallable && !isInstalled) {
      const ok = await install();
      if (ok) return;
    }
    setApkGuideOpen(true);
  };

  return (
    <section
      id="app-download-section"
      aria-labelledby="app-download-heading"
      className="relative bg-zinc-950 text-white border-y border-[#C9A227]/30 overflow-hidden"
    >
      {/* Subtle Architectural Radial Contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,162,39,0.12),transparent_55%)]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Copy, Highlights & Download Actions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#E4C76B]">
              {tr(language, 'MOBILE & DESKTOP APPLICATION', 'মোবাইল ও ডেস্কটপ অ্যাপ্লিকেশন')}
            </p>
            <h2
              id="app-download-heading"
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.08] text-balance text-white max-w-2xl"
            >
              {tr(language, `Shop Faster With the ${brandName} App`, `${brandName} অ্যাপে আরও দ্রুত কেনাকাটা করুন`)}
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
              {tr(
                language,
                `Save ${brandName} directly to your mobile home screen or desktop for instant one-tap access, smooth product customization, live order tracking, and offline-ready speed.`,
                `এক ট্যাপেই ওপেন করতে, দ্রুত অর্ডার দিতে এবং লাইভ ডেলিভারি ট্র্যাকিং দেখতে আপনার মোবাইলের হোম স্ক্রিন বা ডেস্কটপে ${brandName} অ্যাপ ইনস্টল করুন।`
              )}
            </p>
          </div>

          {/* Clean Unboxed Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-zinc-800/90">
            <div className="pt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E4C76B]">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>{tr(language, '01. One-Tap Launch', '০১. এক-ট্যাপে চালু')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {tr(language, 'Opens full-screen right from your phone home screen.', 'সরাসরি ফোনের হোম স্ক্রিন থেকে ফুল-স্ক্রিনে ওপেন হয়।')}
              </p>
            </div>
            <div className="pt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E4C76B]">
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>{tr(language, '02. Android APK & PWA', '০২. অ্যান্ড্রয়েড APK ও PWA')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {tr(language, 'Supports Android WebAPK/APK, Safari iOS & desktop install.', 'Android APK, iPhone Safari ও ডেস্কটপ ব্রাউজারে সাপোর্ট করে।')}
              </p>
            </div>
            <div className="pt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E4C76B]">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{tr(language, '03. Live Order Access', '০৩. লাইভ অর্ডার ট্র্যাকিং')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {tr(language, 'Instant wishlist sync, checkout & courier tracking.', 'উইশলিস্ট, দ্রুত চেকআউট ও কুরিয়ার ট্র্যাকিং সুবিধা।')}
              </p>
            </div>
          </div>

          {/* Primary Attractive CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <PWAInstallButton
              variant="hero-cta"
              label={
                platform === 'ios'
                  ? tr(language, 'Save to Home Screen', 'হোম স্ক্রিনে সেভ করুন')
                  : tr(language, 'Download App', 'অ্যাপ ডাউনলোড করুন')
              }
              alwaysVisible
            />

            {apkUrl ? (
              <a
                href={apkUrl}
                download="SHOPNEXA-ROBI-HUB.apk"
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 border border-[#C9A227]/70 hover:bg-[#C9A227] text-[#E4C76B] hover:text-black text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{tr(language, 'Download Android APK', 'অ্যান্ড্রয়েড APK ডাউনলোড')}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void handleAndroidAction()}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 border border-zinc-700 hover:border-[#C9A227] text-white hover:text-[#E4C76B] text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0"
              >
                <Smartphone className="w-4 h-4 shrink-0 text-[#E4C76B]" />
                <span>{tr(language, 'Save to Home Screen Guide', 'হোম স্ক্রিন ইনস্টল গাইড')}</span>
              </button>
            )}
          </div>

          {/* Subtle Quick Navigation & Platform Compatibility */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-900 text-xs text-zinc-400">
            <p className="font-medium text-zinc-400">
              {tr(language, 'Android Chrome (PWA / APK)', 'Android Chrome (PWA / APK)')}{' '}
              <span aria-hidden="true" className="mx-1.5 text-zinc-600">·</span>{' '}
              {tr(language, 'iPhone Safari', 'iPhone Safari')}{' '}
              <span aria-hidden="true" className="mx-1.5 text-zinc-600">·</span>{' '}
              {tr(language, 'Desktop', 'ডেস্কটপ')}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate({ page: 'shop', filter: 'discount' })}
                className="text-zinc-300 hover:text-[#E4C76B] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <span>{tr(language, 'View Special Offers', 'বিশেষ অফার দেখুন')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'track' })}
                className="text-zinc-300 hover:text-[#E4C76B] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <span>{tr(language, 'Track Existing Order', 'অর্ডার ট্র্যাক করুন')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Stylish Phone Showcase & App Icon Preview */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-[330px] bg-zinc-900/90 border border-[#C9A227]/45 p-3 shadow-2xl">
            <div className="bg-[#09090B] border border-zinc-800 p-6 flex flex-col items-center text-center space-y-5">
              {/* Top Phone Bezel Accent */}
              <div className="w-16 h-1 bg-zinc-800 rounded-full" aria-hidden="true" />

              {/* Stylish App Icon Emblem */}
              <div className="relative pt-1">
                <img
                  src="/pwa-512x512.png"
                  alt={`${brandName} Mobile App Icon`}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-2xl border border-[#C9A227]/80 shadow-[0_12px_36px_rgba(201,162,39,0.22)] object-cover"
                />
              </div>

              <div className="space-y-1">
                <p className="font-display text-2xl font-semibold tracking-[0.08em] text-white">
                  {brandName}
                </p>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#E4C76B]">
                  {sloganText}
                </p>
                <p className="text-xs text-zinc-400 pt-1">
                  {taglineText}
                </p>
              </div>

              {/* Clean Preview Metrics */}
              <div className="w-full grid grid-cols-3 border-y border-zinc-800/90 py-3 text-[11px] text-zinc-300">
                <div className="px-1">
                  <p className="font-semibold text-white">{tr(language, 'Direct', 'সরাসরি')}</p>
                  <p className="text-zinc-500">{tr(language, 'Catalog', 'ক্যাটালগ')}</p>
                </div>
                <div className="px-1 border-x border-zinc-800">
                  <p className="font-semibold text-white">{tr(language, 'Instant', 'দ্রুত')}</p>
                  <p className="text-zinc-500">{tr(language, 'Checkout', 'চেকআউট')}</p>
                </div>
                <div className="px-1">
                  <p className="font-semibold text-white">{tr(language, 'Offline', 'অফলাইন')}</p>
                  <p className="text-zinc-500">{tr(language, 'Ready', 'প্রস্তুত')}</p>
                </div>
              </div>

              <div className="w-full">
                {apkUrl ? (
                  <a
                    href={apkUrl}
                    download="SHOPNEXA-ROBI-HUB.apk"
                    className="w-full min-h-[42px] px-4 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{tr(language, 'Get App (APK / PWA)', 'অ্যাপ নিন (APK / PWA)')}</span>
                  </a>
                ) : (
                  <PWAInstallButton
                    variant="banner"
                    label={
                      isInstalled
                        ? tr(language, 'App Installed', 'অ্যাপ ইনস্টলড')
                        : tr(language, 'Install on Home Screen', 'হোম স্ক্রিনে ইনস্টল করুন')
                    }
                    alwaysVisible
                    className="w-full"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Android / Mobile Home Screen Quick Guide Modal when secondary button is clicked */}
      {apkGuideOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="android-guide-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setApkGuideOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-zinc-950 text-white border border-[#C9A227]/50 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <img
                src="/pwa-192x192.png"
                alt={`${brandName} Icon`}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl border border-[#C9A227]/80 object-cover shrink-0"
              />
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[#E4C76B]">
                  {tr(language, 'HOME SCREEN & MOBILE INSTALL', 'মোবাইল ও হোম স্ক্রিন ইনস্টল')}
                </p>
                <h3 id="android-guide-title" className="font-display text-xl font-semibold text-white">
                  {tr(language, `Install ${brandName}`, `${brandName} ইনস্টল করুন`)}
                </h3>
              </div>
            </div>

            {isInstalled ? (
              <p className="text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {tr(language, 'The app is already saved and running on your device.', 'অ্যাপটি ইতিমধ্যেই আপনার ডিভাইসে ইনস্টল করা আছে।')}
                </span>
              </p>
            ) : (
              <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
                <p>
                  <strong className="text-white">{tr(language, 'Android (Chrome / Edge):', 'অ্যান্ড্রয়েড (Chrome / Edge):')}</strong>{' '}
                  {tr(language, 'Tap the browser menu', 'ব্রাউজার মেনুতে ট্যাপ করুন')} <strong className="text-[#E4C76B]">⋮</strong> →{' '}
                  <strong className="text-white">{tr(language, 'Add to Home screen', 'হোম স্ক্রিনে যোগ করুন (Add to Home screen)')}</strong> →{' '}
                  <strong className="text-[#E4C76B]">{tr(language, 'Install', 'ইনস্টল (Install)')}</strong>
                </p>
                <p>
                  <strong className="text-white">{tr(language, 'iPhone / iPad (Safari):', 'আইফোন / আইপ্যাড (Safari):')}</strong>{' '}
                  <strong className="text-white">{tr(language, 'Share', 'শেয়ার (Share)')}</strong> →{' '}
                  <strong className="text-white">{tr(language, 'Add to Home Screen', 'Add to Home Screen')}</strong> →{' '}
                  <strong className="text-[#E4C76B]">{tr(language, 'Add', 'Add')}</strong>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setApkGuideOpen(false);
                  }}
                  className="px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold"
                >
                  {tr(language, 'Install Now', 'এখনই ইনস্টল করুন')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setApkGuideOpen(false)}
                className="px-4 py-2 border border-zinc-700 hover:border-white text-xs font-semibold text-zinc-200"
              >
                {tr(language, 'Close', 'বন্ধ করুন')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
