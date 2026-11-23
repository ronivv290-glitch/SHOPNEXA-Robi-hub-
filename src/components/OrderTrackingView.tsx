import React, { useState, useEffect } from 'react';
import { Search, Truck, ExternalLink, MapPin, AlertTriangle, Package } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { SmartImage } from './SmartImage.tsx';
import {
  tr,
  translateOrderStatus,
  translatePaymentStatus,
  formatDetailedAddress,
} from '../i18n.ts';

export function OrderTrackingView({ initialOrderNumber = '' }: { initialOrderNumber?: string }) {
  const { language, formatPrice, markBuyerVerified, lastCompletedOrder } = useStore();
  const [query, setQuery] = useState(initialOrderNumber);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookupOrder = async (num: string) => {
    if (!num.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(num.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(
          res.status === 404
            ? tr(language, 'No order found matching that Order ID.', 'এই অর্ডার আইডি দিয়ে কোনো অর্ডার খুঁজে পাওয়া যায়নি।')
            : data.error || tr(language, 'Unable to fetch order status.', 'অর্ডারের তথ্য লোড করা যায়নি।')
        );
        return;
      }
      setResult(data);
      markBuyerVerified();
    } catch {
      setResult(null);
      setError(tr(language, 'Network error while looking up order.', 'ইন্টারনেট সমস্যার কারণে অর্ডার খোঁজা যায়নি।'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber) {
      setQuery(initialOrderNumber);
      void lookupOrder(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  const STATUS_STEPS = ['Pending', 'Confirmed', 'Processing', 'Ready to Ship', 'Shipped', 'Out for Delivery', 'Delivered'];
  const isTerminalIssue = result && ['Cancelled', 'Returned', 'Refunded'].includes(result.order_status);
  const destinationText = result?.delivery_destination
    ? formatDetailedAddress(result.delivery_destination, language)
    : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-14 space-y-8 text-zinc-100">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#E4C76B]">
          {tr(language, 'LOGISTICS & FULFILLMENT', 'ডেলিভারি ও অর্ডার ট্র্যাকিং')}
        </p>
        <h1 className="font-display text-4xl font-semibold text-white">
          {tr(language, 'Track Your SHOPNEXA ROBI HUB Order', 'আপনার অর্ডার লাইভ ট্র্যাক করুন')}
        </h1>
        <p className="text-xs text-zinc-300">
          {tr(
            language,
            'Enter your unique Order ID (e.g., SNX-...) to view live fulfillment, delivery destination, and courier status.',
            'আপনার অর্ডার আইডি (যেমন: SNX-...) লিখে ডেলিভারি ও কুরিয়ারের সর্বশেষ অবস্থান দেখুন।'
          )}
        </p>
      </div>

      {lastCompletedOrder && result?.order_number !== lastCompletedOrder.order_number && (
        <div className="border border-[#C9A227]/40 bg-zinc-900/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#E4C76B]" />
            <span className="text-zinc-200">
              {tr(language, 'Your recent order:', 'আপনার সাম্প্রতিক অর্ডার:')}{' '}
              <strong className="font-mono text-white">{lastCompletedOrder.order_number}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery(lastCompletedOrder.order_number);
              void lookupOrder(lastCompletedOrder.order_number);
            }}
            className="px-3 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
          >
            {tr(language, 'Track Now', 'এখনই ট্র্যাক করুন')}
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookupOrder(query);
        }}
        className="flex border border-zinc-700 bg-zinc-900 focus-within:border-[#C9A227]"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr(language, 'Enter Order ID (SNX-...)', 'অর্ডার আইডি লিখুন (যেমন: SNX-...)')}
          className="flex-1 bg-transparent px-4 py-3 text-sm font-mono text-white placeholder:text-zinc-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>{loading ? tr(language, 'Searching...', 'খোঁজা হচ্ছে...') : tr(language, 'Track Order', 'অর্ডার ট্র্যাক করুন')}</span>
        </button>
      </form>

      {error && <div className="border border-red-800 bg-red-950/60 text-red-200 p-4 text-xs">{error}</div>}

      {result && (
        <div className="border border-zinc-800 p-6 space-y-6 bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <p className="text-xs text-zinc-400">{tr(language, 'Order ID', 'অর্ডার আইডি')}</p>
              <p className="font-mono text-lg font-semibold text-white">{result.order_number}</p>
              {result.created_at && (
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  {tr(language, 'Placed:', 'তারিখ:')} {String(result.created_at).slice(0, 16)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">{tr(language, 'Current Status', 'বর্তমান অবস্থা')}</p>
              <p className={`text-sm font-semibold ${isTerminalIssue ? 'text-red-400' : 'text-[#E4C76B]'}`}>
                {translateOrderStatus(result.order_status, language)}
              </p>
              {result.estimated_delivery && !isTerminalIssue && (
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {tr(language, 'Est. Delivery:', 'সম্ভাব্য ডেলিভারি:')} {result.estimated_delivery}
                </p>
              )}
            </div>
          </div>

          {isTerminalIssue ? (
            <div className="border border-red-800/70 bg-red-950/40 p-4 flex items-center gap-3 text-xs text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">
                  {translateOrderStatus(result.order_status, language)}
                </p>
                <p className="text-red-200/90 mt-0.5">
                  {tr(
                    language,
                    'If you have questions about this order, please contact support via Telegram.',
                    'এই অর্ডার সম্পর্কে কোনো প্রশ্ন থাকলে আমাদের টেলিগ্রাম সাপোর্টে যোগাযোগ করুন।'
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-[11px]">
              {STATUS_STEPS.map((st, idx) => {
                const currentIdx = STATUS_STEPS.indexOf(result.order_status);
                const active = currentIdx >= idx;
                return (
                  <div
                    key={st}
                    className={`p-2 border text-center font-medium ${
                      active ? 'border-[#C9A227] bg-zinc-950 text-[#E4C76B]' : 'border-zinc-800 bg-zinc-950/50 text-zinc-500'
                    }`}
                  >
                    {translateOrderStatus(st, language)}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-zinc-950 p-4 border border-zinc-800">
            <div>
              <p className="text-zinc-400">{tr(language, 'Courier Service', 'কুরিয়ার সার্ভিস')}</p>
              <p className="font-semibold text-white flex items-center gap-1 mt-0.5">
                <Truck className="w-3.5 h-3.5 text-[#E4C76B]" />
                <span>{result.courier_name || tr(language, 'Awaiting Dispatch', 'পাঠানোর অপেক্ষায়')}</span>
              </p>
            </div>
            <div>
              <p className="text-zinc-400">{tr(language, 'Tracking Number', 'ট্র্যাকিং নম্বর')}</p>
              <p className="font-mono font-semibold text-white mt-0.5">
                {result.tracking_number || tr(language, 'Not assigned yet', 'এখনো যুক্ত হয়নি')}
              </p>
              {result.courier_tracking_url && (
                <a
                  href={result.courier_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E4C76B] hover:underline mt-1"
                >
                  <span>{tr(language, 'Open Courier Live Tracking', 'কুরিয়ার লাইভ ট্র্যাকিং দেখুন')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div>
              <p className="text-zinc-400">{tr(language, 'Payment', 'পেমেন্ট')}</p>
              <p className="font-semibold text-white uppercase mt-0.5">
                {result.payment_method} ({translatePaymentStatus(result.payment_status, language)})
              </p>
            </div>
          </div>

          {destinationText && (
            <div className="bg-zinc-950 border border-zinc-800 p-4 text-xs space-y-1">
              <p className="text-zinc-400 flex items-center gap-1.5 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#E4C76B]" />
                <span>{tr(language, 'Delivery Destination', 'ডেলিভারির ঠিকানা')}</span>
              </p>
              <p className="text-zinc-200 leading-relaxed">{destinationText}</p>
            </div>
          )}

          <div className="space-y-2 text-xs">
            <p className="font-semibold text-white">{tr(language, 'Order Items', 'অর্ডারের পণ্যসমূহ')}</p>
            {result.items?.map((it: any) => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-800 text-zinc-200">
                <div className="flex items-center gap-3 min-w-0">
                  {it.product_image && (
                    <div className="w-10 h-10 bg-white border border-zinc-700 shrink-0 overflow-hidden">
                      <SmartImage src={it.product_image} alt={it.product_name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {it.quantity} × {it.product_name}
                    </p>
                    {(it.color_name || it.size_label || it.model_name) && (
                      <p className="text-[11px] text-zinc-400">
                        {[it.color_name, it.size_label, it.model_name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <span className="font-mono tabular-nums text-white shrink-0">{formatPrice(it.line_total)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-sm pt-2 text-white">
              <span>{tr(language, 'Total', 'সর্বমোট')}</span>
              <span className="font-mono tabular-nums text-[#E4C76B]">{formatPrice(result.final_total)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 text-white border border-[#C9A227]/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-semibold text-[#E4C76B] tracking-wider">
                {tr(language, 'BUYER APP DOWNLOAD', 'অ্যাপ ডাউনলোড করুন')}
              </p>
              <p className="text-zinc-300 mt-0.5">
                {tr(
                  language,
                  'Install the SHOPNEXA ROBI HUB Buyer App for products and live tracking.',
                  'পণ্য ব্রাউজ ও লাইভ অর্ডার ট্র্যাক করতে SHOPNEXA ROBI HUB অ্যাপ ইনস্টল করুন।'
                )}
              </p>
            </div>
            <PWAInstallButton variant="banner" label={tr(language, 'Download App', 'অ্যাপ ডাউনলোড')} />
          </div>
        </div>
      )}
    </div>
  );
}

