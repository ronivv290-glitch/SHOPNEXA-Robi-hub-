import React, { useState, useEffect } from 'react';
import { Download, X, Share, MoreVertical, Smartphone, Monitor, CheckCircle2, PlusSquare, Copy } from 'lucide-react';
import { usePWAInstall, type InstallPlatform } from '../hooks/usePWAInstall.ts';
import { useStore } from '../context/StoreContext.tsx';
import { tr } from '../i18n.ts';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'footer' | 'hero-cta';
  label?: string;
  shortMobileLabel?: string;
  defaultTab?: InstallPlatform;
  alwaysVisible?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  label,
  shortMobileLabel,
  defaultTab,
  alwaysVisible = false,
  className = '',
}) => {
  const { settings, showToast, language } = useStore();
  const resolvedLabel = label || tr(language, 'Download App', 'অ্যাপ ডাউনলোড');
  const { isInstallable, isInstalled, platform, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<InstallPlatform>(defaultTab || platform);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab || platform);
  }, [defaultTab, platform]);

  if (isInstalled && !alwaysVisible) {
    return null;
  }

  const apkUrl = settings?.android_apk_url?.trim() || '';

  const handleClick = async () => {
    if (isInstalled) {
      setShowGuide(true);
      return;
    }
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setActiveTab(defaultTab || platform);
    setShowGuide(true);
  };

  const buttonClass =
    variant === 'header'
      ? 'flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border border-[#C9A227]/75 hover:bg-[#C9A227] text-[#E4C76B] hover:text-black text-xs font-semibold transition-colors whitespace-nowrap shrink-0'
      : variant === 'hero-cta'
      ? 'inline-flex items-center justify-center gap-2.5 min-h-[46px] px-7 py-3 bg-[#C9A227] hover:bg-[#E4C76B] active:scale-[0.99] text-black text-xs sm:text-sm font-semibold tracking-wide transition-all duration-200 whitespace-nowrap shrink-0 shadow-[0_8px_28px_rgba(201,162,39,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C76B]'
      : variant === 'banner'
      ? 'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold transition-colors whitespace-nowrap shrink-0'
      : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 border border-[#C9A227] hover:bg-[#C9A227] text-[#E4C76B] hover:text-black text-xs font-semibold transition-colors whitespace-nowrap shrink-0';

  return (
    <>
      <button type="button" onClick={() => void handleClick()} className={`${buttonClass} ${className}`.trim()} aria-label={resolvedLabel}>
        {isInstalled ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
        {isInstalled ? (
          <span>{tr(language, 'App Installed', 'অ্যাপ ইনস্টলড')}</span>
        ) : shortMobileLabel ? (
          <>
            <span className="sm:hidden">{shortMobileLabel}</span>
            <span className="hidden sm:inline">{resolvedLabel}</span>
          </>
        ) : (
          <span>{resolvedLabel}</span>
        )}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="w-full max-w-lg bg-zinc-950 text-white border border-[#C9A227]/50 p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <img
                  src="/pwa-192x192.png"
                  alt="SHOPNEXA ROBI HUB App Icon"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-2xl border border-[#C9A227]/80 shadow-lg shrink-0 object-cover"
                />
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[#E4C76B]">
                    SHOPNEXA ROBI HUB APP
                  </p>
                  <h3 id="pwa-install-title" className="font-display text-2xl font-semibold text-white leading-tight">
                    {tr(language, 'Save to Home Screen', 'হোম স্ক্রিনে অ্যাপ সেভ করুন')}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tr(language, 'Fast mobile shopping, offline support & instant launch', 'দ্রুত মোবাইল শপিং, অফলাইন সাপোর্ট এবং ইনস্ট্যান্ট লঞ্চ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label={tr(language, 'Close install instructions', 'নির্দেশনা বন্ধ করুন')}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInstalled && (
              <div className="border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{tr(language, 'SHOPNEXA ROBI HUB is already installed on this device.', 'SHOPNEXA ROBI HUB ইতিমধ্যেই এই ডিভাইসে ইনস্টল করা আছে।')}</span>
              </div>
            )}

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 border border-zinc-800">
              {(
                [
                  { id: 'android', label: tr(language, 'Android', 'অ্যান্ড্রয়েড'), icon: Smartphone },
                  { id: 'ios', label: tr(language, 'iPhone / iPad', 'আইফোন / আইপ্যাড'), icon: Share },
                  { id: 'desktop', label: tr(language, 'Desktop', 'ডেস্কটপ'), icon: Monitor },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active ? 'bg-[#C9A227] text-black' : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'android' && (
              <div className="space-y-4">
                <ol className="space-y-2.5 text-xs text-zinc-300 leading-relaxed list-decimal pl-4">
                  <li>
                    {tr(language, 'Open this page in', 'এই পেজটি খুলুন')} <strong className="text-white">Google Chrome</strong> {tr(language, 'or', 'অথবা')} <strong className="text-white">Microsoft Edge</strong>-এ।
                  </li>
                  <li>
                    {tr(language, 'Tap the browser menu', 'উপরে ডানের ব্রাউজার মেনুতে ট্যাপ করুন')} (<MoreVertical className="w-3.5 h-3.5 inline text-[#E4C76B]" />).
                  </li>
                  <li>
                    {tr(language, 'Select Add to Home screen or Install app, then confirm Install.', 'Add to Home screen বা Install app বেছে নিয়ে Install চাপুন।')}
                  </li>
                </ol>

                {apkUrl ? (
                  <div className="border border-[#C9A227]/40 bg-zinc-900/70 p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs">
                      <p className="font-semibold text-[#E4C76B]">{tr(language, 'Android APK Package Available', 'অ্যান্ড্রয়েড APK ফাইল পাওয়া যাচ্ছে')}</p>
                      <p className="text-zinc-400 mt-0.5">{tr(language, 'Download the standalone Android installer directly.', 'সরাসরি Android ইনস্টলার ডাউনলোড করুন।')}</p>
                    </div>
                    <a
                      href={apkUrl}
                      download="SHOPNEXA-ROBI-HUB.apk"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{tr(language, 'Download APK', 'APK ডাউনলোড')}</span>
                    </a>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 border-t border-zinc-800 pt-3">
                    {tr(
                      language,
                      'Chrome automatically packages SHOPNEXA ROBI HUB as a lightweight WebAPK right on your Android app drawer & home screen.',
                      'Chrome স্বয়ংক্রিয়ভাবে SHOPNEXA ROBI HUB-কে আপনার ফোনের অ্যাপ ড্রয়ার ও হোম স্ক্রিনে হালকা WebAPK অ্যাপ হিসেবে সেভ করে।'
                    )}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'ios' && (
              <ol className="space-y-2.5 text-xs text-zinc-300 leading-relaxed list-decimal pl-4">
                <li>
                  {tr(language, 'Open SHOPNEXA ROBI HUB in Safari on your iPhone or iPad.', 'আইফোন বা আইপ্যাডের Safari ব্রাউজারে SHOPNEXA ROBI HUB খুলুন।')}
                </li>
                <li>
                  {tr(language, 'Tap the Share button on the Safari toolbar:', 'Safari টুলবারের Share বাটনে ট্যাপ করুন:')}{' '}
                  <strong className="text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-[#E4C76B]" /> Share</strong>
                </li>
                <li>
                  {tr(language, 'Scroll down and tap Add to Home Screen:', 'নিচে স্ক্রল করে Add to Home Screen ট্যাপ করুন:')}{' '}
                  <strong className="text-white inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 text-[#E4C76B]" /> Add to Home Screen</strong>
                </li>
                <li>
                  {tr(language, 'Tap Add in the top-right corner to save the app icon.', 'উপরে ডানের Add বাটনে ট্যাপ করলে অ্যাপ আইকন সেভ হবে।')}
                </li>
              </ol>
            )}

            {activeTab === 'desktop' && (
              <ol className="space-y-2.5 text-xs text-zinc-300 leading-relaxed list-decimal pl-4">
                <li>
                  {tr(language, 'Look for the Install icon on the right side of your Chrome or Edge address bar.', 'Chrome বা Edge অ্যাড্রেস বারের ডান পাশে Install আইকন দেখুন।')}
                </li>
                <li>
                  {tr(language, 'Or open the browser menu → Cast, save, and share → Install SHOPNEXA ROBI HUB.', 'অথবা ব্রাউজার মেনু → Install SHOPNEXA ROBI HUB-এ ক্লিক করুন।')}
                </li>
                <li>
                  {tr(language, 'The app launches in its own dedicated window with quick desktop shortcut access.', 'অ্যাপটি আলাদা ডেস্কটপ উইন্ডোতে ওপেন হবে।')}
                </li>
              </ol>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-800">
              {!isInstallable && !isInstalled ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.origin);
                      setCopiedUrl(true);
                      showToast(
                        tr(language, 'Link copied! Open in Chrome to install the app.', 'লিংক কপি হয়েছে! অ্যাপ ইনস্টল করতে Chrome-এ ওপেন করুন।'),
                        'success'
                      );
                      setTimeout(() => setCopiedUrl(false), 3000);
                    } catch {
                      showToast(
                        tr(language, 'Open this website directly in Google Chrome to install.', 'ইনস্টল করতে ওয়েবসাইটটি Google Chrome-এ খুলুন।'),
                        'info'
                      );
                    }
                  }}
                  className="px-4 py-2.5 border border-[#C9A227]/60 text-[#E4C76B] hover:bg-[#C9A227] hover:text-black text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedUrl ? tr(language, 'Link Copied!', 'লিংক কপি হয়েছে!') : tr(language, 'Copy Link (Open in Chrome)', 'লিংক কপি করুন (Chrome-এ খুলুন)')}</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                {isInstallable && !isInstalled && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setShowGuide(false);
                    }}
                    className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{tr(language, 'Install Now (One-Tap)', 'এখনই ইনস্টল করুন')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="px-4 py-2.5 border border-zinc-700 hover:border-white text-xs font-semibold text-zinc-200 transition-colors"
                >
                  {tr(language, 'Close', 'বন্ধ করুন')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
