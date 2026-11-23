import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { tr } from '../i18n.ts';

export const OfflineIndicator: React.FC = () => {
  const { language } = useStore();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 bg-zinc-950 border border-[#C9A227] px-3.5 py-2 text-xs font-semibold text-[#E4C76B] shadow-xl">
      <WifiOff className="w-3.5 h-3.5" />
      <span>{tr(language, 'Offline Mode — Cached storefront ready', 'অফলাইন মোড — ক্যাশ করা স্টোর প্রস্তুত')}</span>
    </div>
  );
};
