import React, { useState, useEffect } from 'react';
import { ShieldCheck, Printer, CheckCircle2, Tag, MapPin, Lock, Copy, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import type { CustomerAddress, PaymentMethod } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  BD_DIVISIONS,
  BD_DISTRICTS,
  DELIVERY_COUNTRIES,
  tr,
  translateOrderStatus,
  translatePaymentStatus,
  formatDetailedAddress,
} from '../i18n.ts';

const EMPTY_ADDRESS: CustomerAddress = {
  label: 'Home',
  is_default: true,
  full_name: '',
  mobile: '',
  alt_phone: '',
  email: '',
  country: 'Bangladesh',
  division: 'Rangpur',
  district: 'Rangpur',
  upazila: '',
  thana: '',
  post_office: '',
  union_name: '',
  municipality: '',
  city: '',
  village: '',
  area: '',
  road_number: '',
  house_number: '',
  apartment_number: '',
  floor_number: '',
  state_province: '',
  street_address: '',
  postal_code: '',
  landmark: '',
  instructions: '',
};

export function CheckoutView() {
  const {
    language,
    cart,
    user,
    authToken,
    paymentSettings,
    formatPrice,
    toBaseUsd,
    clearCart,
    refreshStore,
    navigate,
    lastCompletedOrder,
    setLastCompletedOrder,
    showToast,
  } = useStore();

  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [address, setAddress] = useState<CustomerAddress>({
    ...EMPTY_ADDRESS,
    full_name: user?.name || '',
    mobile: user?.phone || '',
    email: user?.email || '',
  });
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [transactionId, setTransactionId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [shippingQuote, setShippingQuote] = useState<{
    shipping_charge: number;
    estimated_days: string;
    zone_name: string;
  }>({ shipping_charge: 0, estimated_days: '2–5 Business Days', zone_name: 'Standard' });
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => {
    if (authToken) {
      fetch('/api/addresses', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: CustomerAddress[]) => {
          setSavedAddresses(list);
          const def = list.find((a) => a.is_default) || list[0];
          if (def) setAddress({ ...EMPTY_ADDRESS, ...def });
        })
        .catch(() => {});
    }
  }, [authToken]);

  const subtotal = cart.reduce((sum, item) => {
    const unit =
      item.selected_variation?.price ??
      item.selected_size?.price_override ??
      item.selected_color?.price_override ??
      (item.product.sale_price > 0 ? item.product.sale_price : item.product.selling_price);
    return sum + toBaseUsd(unit * item.quantity, item.product.currency || 'USD');
  }, 0);

  useEffect(() => {
    fetch('/api/shipping/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: address.country,
        district: address.district,
        subtotal,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setShippingQuote(data);
      })
      .catch(() => {});
  }, [address.country, address.district, subtotal]);

  const isBangladesh = address.country.toLowerCase() === 'bangladesh';

  const availableGateways = paymentSettings.filter((g) => {
    if (!g.is_enabled) return false;
    if (isBangladesh) return ['bkash', 'nagad', 'cod'].includes(g.gateway);
    return g.gateway === 'international_card';
  });

  useEffect(() => {
    if (availableGateways.length > 0 && !availableGateways.some((g) => g.gateway === paymentMethod)) {
      setPaymentMethod(availableGateways[0].gateway);
    }
  }, [isBangladesh, availableGateways, paymentMethod]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode.trim(), subtotal }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || tr(language, 'Invalid coupon', 'সঠিক কুপন কোড নয়'), 'error');
      setAppliedDiscount(null);
      return;
    }
    setAppliedDiscount({ code: data.code, amount: data.discount_amount });
    showToast(
      tr(language, `Coupon ${data.code} applied`, `কুপন ${data.code} সফলভাবে প্রয়োগ হয়েছে`),
      'success'
    );
  };

  const discountAmount = appliedDiscount ? Math.min(subtotal, appliedDiscount.amount) : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingQuote.shipping_charge);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmitting(true);
    try {
      if (authToken && saveAddressToAccount && !address.id) {
        await fetch('/api/addresses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(address),
        });
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          address,
          payment_method: paymentMethod,
          transaction_id: transactionId.trim(),
          coupon_code: appliedDiscount?.code || '',
          notes: orderNotes,
          items: cart.map((i) => ({
            product_id: i.product_id,
            color_id: i.color_id,
            size_id: i.size_id,
            variation_id: i.variation_id,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || tr(language, 'Checkout failed', 'অর্ডার সম্পন্ন করা যায়নি'), 'error');
        return;
      }

      setLastCompletedOrder(data.order);
      clearCart();
      await refreshStore();
      showToast(
        tr(
          language,
          `Order ${data.order.order_number} placed successfully`,
          `অর্ডার ${data.order.order_number} সফলভাবে সম্পন্ন হয়েছে!`
        ),
        'success'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (lastCompletedOrder && cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8 text-zinc-100">
        <div className="border border-[#C9A227] bg-zinc-950 text-white p-8 space-y-4">
          <div className="flex items-center gap-3 text-[#E4C76B]">
            <CheckCircle2 className="w-7 h-7" />
            <div>
              <p className="text-xs font-semibold tracking-[0.2em]">
                {tr(language, 'ORDER CONFIRMATION', 'অর্ডার নিশ্চিতকরণ')}
              </p>
              <h1 className="font-display text-3xl font-semibold text-white">
                {tr(language, 'Order', 'অর্ডার')} {lastCompletedOrder.order_number}
              </h1>
            </div>
          </div>
          <p className="text-sm text-zinc-300">
            {tr(language, 'Status:', 'অবস্থা:')}{' '}
            <span className="font-semibold text-white">
              {translateOrderStatus(lastCompletedOrder.order_status, language)}
            </span>{' '}
            · {tr(language, 'Payment:', 'পেমেন্ট:')}{' '}
            <span className="font-semibold text-[#E4C76B] uppercase">{lastCompletedOrder.payment_method}</span> (
            {translatePaymentStatus(lastCompletedOrder.payment_status, language)})
          </p>
        </div>

        <div className="border border-zinc-800 p-6 sm:p-8 space-y-6 bg-zinc-900 text-zinc-100">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-white">
                {tr(language, 'Order Invoice', 'অর্ডার ইনভয়েস / রসিদ')}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">{lastCompletedOrder.created_at}</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 border border-zinc-600 text-white text-xs font-semibold flex items-center gap-2 hover:border-[#C9A227] hover:bg-[#C9A227] hover:text-black transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{tr(language, 'Print Invoice', 'ইনভয়েস প্রিন্ট করুন')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-[#E4C76B]">{tr(language, 'Customer', 'ক্রেতার তথ্য')}</p>
              <p className="text-white">{lastCompletedOrder.customer_name}</p>
              <p className="text-zinc-300">{lastCompletedOrder.customer_phone}</p>
              <p className="text-zinc-300">{lastCompletedOrder.customer_email}</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#E4C76B]">{tr(language, 'Delivery Address', 'ডেলিভারির ঠিকানা')}</p>
              <p className="text-zinc-200 leading-relaxed">
                {formatDetailedAddress(lastCompletedOrder.address, language)}
              </p>
              {lastCompletedOrder.address?.landmark && (
                <p className="text-zinc-400">
                  {tr(language, 'Landmark:', 'পরিচিত স্থান:')} {lastCompletedOrder.address.landmark}
                </p>
              )}
              <p className="text-zinc-400">
                {tr(language, 'Estimated Delivery:', 'সম্ভাব্য ডেলিভারি:')} {lastCompletedOrder.estimated_delivery}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-3">
            {lastCompletedOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs py-2 border-b border-zinc-800">
                <div>
                  <p className="font-semibold text-white">{item.product_name}</p>
                  <p className="text-zinc-400">
                    {tr(language, 'Qty', 'পরিমাণ')} {item.quantity} ·{' '}
                    {[item.color_name, item.size_label, item.model_name].filter(Boolean).join(' / ')}
                  </p>
                </div>
                <span className="font-mono tabular-nums font-semibold text-white">{formatPrice(item.line_total)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs pt-2">
            <div className="flex justify-between text-zinc-300">
              <span>{tr(language, 'Subtotal', 'উপমোট')}</span>
              <span className="font-mono tabular-nums">{formatPrice(lastCompletedOrder.subtotal)}</span>
            </div>
            {lastCompletedOrder.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>
                  {tr(language, 'Discount', 'ছাড়')} ({lastCompletedOrder.coupon_code})
                </span>
                <span className="font-mono tabular-nums">-{formatPrice(lastCompletedOrder.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-300">
              <span>{tr(language, 'Shipping', 'ডেলিভারি চার্জ')}</span>
              <span className="font-mono tabular-nums">{formatPrice(lastCompletedOrder.shipping_charge)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-white pt-2 border-t border-zinc-800">
              <span>{tr(language, 'Final Total', 'সর্বমোট মূল্য')}</span>
              <span className="font-mono tabular-nums text-[#E4C76B]">{formatPrice(lastCompletedOrder.final_total)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 text-white border border-[#C9A227]/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#E4C76B]">
                {tr(language, 'BUYER EXCLUSIVE ACCESS', 'ক্রেতা অ্যাপ')}
              </p>
              <p className="text-xs text-zinc-200">
                {tr(
                  language,
                  'Download the SHOPNEXA ROBI HUB Buyer App to browse products and track your order in one tap.',
                  'সহজেই পণ্য দেখতে ও অর্ডার ট্র্যাক করতে SHOPNEXA ROBI HUB অ্যাপটি ডাউনলোড করুন।'
                )}
              </p>
            </div>
            <PWAInstallButton variant="banner" label={tr(language, 'Download SHOPNEXA ROBI HUB App', 'অ্যাপ ডাউনলোড করুন')} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setLastCompletedOrder(null);
                navigate({ page: 'shop', filter: 'own' });
              }}
              className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold transition-colors"
            >
              {tr(language, 'Continue Shopping', 'আরও কেনাকাটা করুন')}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'track', orderNumber: lastCompletedOrder.order_number })}
              className="px-5 py-2.5 border border-zinc-700 hover:border-[#C9A227] text-white text-xs font-semibold transition-colors"
            >
              {tr(language, 'Track Order', 'অর্ডার ট্র্যাক করুন')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4 text-zinc-100">
        <h1 className="font-display text-3xl font-semibold text-white">
          {tr(language, 'Direct Checkout', 'সরাসরি চেকআউট')}
        </h1>
        <p className="text-sm text-zinc-300">
          {tr(language, 'Your cart has no direct-selling items to check out.', 'চেকআউট করার জন্য আপনার কার্টে কোনো পণ্য নেই।')}
        </p>
        <button
          type="button"
          onClick={() => navigate({ page: 'shop', filter: 'own' })}
          className="px-6 py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold transition-colors"
        >
          {tr(language, 'Browse Own Products', 'সকল পণ্য দেখুন')}
        </button>
      </div>
    );
  }

  const selectedGatewayMeta = availableGateways.find((g) => g.gateway === paymentMethod);
  const inputCls =
    'w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-[#C9A227] focus:outline-none';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-zinc-100">
      <div className="border-b border-zinc-800 pb-6 mb-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
          {tr(language, 'DIRECT CHECKOUT', 'সরাসরি অর্ডার ও চেকআউট')}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
          {tr(language, 'Delivery Address & Payment', 'বিস্তারিত ডেলিভারি ঠিকানা ও পেমেন্ট')}
        </h1>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left 7 cols: Personal Info, Dynamic Address, Payment */}
        <div className="lg:col-span-7 space-y-8">
          {savedAddresses.length > 0 && (
            <div className="border border-zinc-800 bg-zinc-900 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <MapPin className="w-4 h-4 text-[#E4C76B]" />
                <span>{tr(language, 'Choose Saved Address', 'সংরক্ষিত ঠিকানা বেছে নিন')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedAddresses.map((sa) => (
                  <button
                    key={sa.id}
                    type="button"
                    onClick={() => setAddress({ ...EMPTY_ADDRESS, ...sa })}
                    className={`p-3 border text-left text-xs transition-colors ${
                      address.id === sa.id
                        ? 'border-[#C9A227] bg-zinc-950 text-white'
                        : 'border-zinc-700 bg-zinc-950/60 text-zinc-200 hover:border-[#C9A227]'
                    }`}
                  >
                    <p className="font-semibold text-white">
                      {sa.label} — {sa.full_name}
                    </p>
                    <p className="text-zinc-400 mt-0.5 line-clamp-2">
                      {formatDetailedAddress(sa, language)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#E4C76B] uppercase tracking-wider">
              {tr(language, '1. Personal Information', '১. ব্যক্তিগত তথ্য')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-200 mb-1">
                  {tr(language, 'Full Name *', 'সম্পূর্ণ নাম *')}
                </label>
                <input
                  type="text"
                  required
                  value={address.full_name}
                  onChange={(e) => setAddress({ ...address, id: undefined, full_name: e.target.value })}
                  placeholder={tr(language, 'Enter your full name', 'আপনার পুরো নাম লিখুন')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-200 mb-1">
                  {isBangladesh
                    ? tr(language, 'Mobile Number *', 'মোবাইল নম্বর *')
                    : tr(language, 'Phone Number with Country Code *', 'দেশের কোডসহ ফোন নম্বর *')}
                </label>
                <input
                  type="tel"
                  required
                  value={address.mobile}
                  onChange={(e) => setAddress({ ...address, id: undefined, mobile: e.target.value })}
                  placeholder={isBangladesh ? '01XXXXXXXXX' : '+1 555-0199'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-200 mb-1">
                  {tr(language, 'Alternative Phone Number', 'বিকল্প মোবাইল নম্বর')}
                </label>
                <input
                  type="tel"
                  value={address.alt_phone}
                  onChange={(e) => setAddress({ ...address, id: undefined, alt_phone: e.target.value })}
                  placeholder={tr(language, 'Optional backup phone', 'বিকল্প নম্বর (যদি থাকে)')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-200 mb-1">
                  {tr(language, 'Email Address *', 'ইমেইল ঠিকানা *')}
                </label>
                <input
                  type="email"
                  required
                  value={address.email}
                  onChange={(e) => setAddress({ ...address, id: undefined, email: e.target.value })}
                  placeholder="name@example.com"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Dynamic Delivery Address */}
          <div className="border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#E4C76B] uppercase tracking-wider">
                {isBangladesh
                  ? tr(language, '2. Bangladesh Detailed Delivery Address', '২. বাংলাদেশের বিস্তারিত ডেলিভারি ঠিকানা')
                  : tr(language, '2. International Delivery Address', '২. আন্তর্জাতিক ডেলিভারি ঠিকানা')}
              </h2>
              <select
                value={address.country}
                onChange={(e) => setAddress({ ...address, id: undefined, country: e.target.value })}
                className="border border-[#C9A227]/60 px-3 py-1.5 text-xs font-semibold bg-zinc-950 text-white focus:outline-none"
              >
                {DELIVERY_COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-zinc-950 text-white">
                    {language === 'bn' ? `${c.bn} (${c.en})` : c.en}
                  </option>
                ))}
              </select>
            </div>

            {isBangladesh ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Division *', 'বিভাগ *')}
                  </label>
                  <select
                    value={address.division}
                    onChange={(e) => setAddress({ ...address, id: undefined, division: e.target.value })}
                    className={inputCls}
                  >
                    {BD_DIVISIONS.map((d) => (
                      <option key={d.value} value={d.value} className="bg-zinc-950 text-white">
                        {language === 'bn' ? d.bn : d.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'District *', 'জেলা *')}
                  </label>
                  <input
                    type="text"
                    required
                    list="bd-checkout-districts"
                    value={address.district}
                    onChange={(e) => setAddress({ ...address, id: undefined, district: e.target.value })}
                    placeholder={tr(language, 'e.g. Dhaka, Rangpur, Chattogram', 'যেমন: ঢাকা, রংপুর, চট্টগ্রাম')}
                    className={inputCls}
                  />
                  <datalist id="bd-checkout-districts">
                    {BD_DISTRICTS.map((d) => (
                      <option key={d.en} value={d.en}>
                        {language === 'bn' ? `${d.bn} (${d.en})` : d.en}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Upazila', 'উপজেলা')}
                  </label>
                  <input
                    type="text"
                    value={address.upazila}
                    onChange={(e) => setAddress({ ...address, id: undefined, upazila: e.target.value })}
                    placeholder={tr(language, 'e.g. Sadar, Pirgachha', 'যেমন: সদর, পীরগাছা')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Thana / Police Station', 'থানা')}
                  </label>
                  <input
                    type="text"
                    value={address.thana}
                    onChange={(e) => setAddress({ ...address, id: undefined, thana: e.target.value })}
                    placeholder={tr(language, 'e.g. Kotwali, Mirpur', 'যেমন: কোতোয়ালী, মিরপুর')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Post Office *', 'ডাকঘর (Post Office) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.post_office || ''}
                    onChange={(e) => setAddress({ ...address, id: undefined, post_office: e.target.value })}
                    placeholder={tr(language, 'Post Office name', 'ডাকঘরের নাম লিখুন')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Postal Code *', 'পোস্টাল কোড *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.postal_code}
                    onChange={(e) => setAddress({ ...address, id: undefined, postal_code: e.target.value })}
                    placeholder={tr(language, 'e.g. 5400', 'যেমন: ৫৪০০')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Union', 'ইউনিয়ন')}
                  </label>
                  <input
                    type="text"
                    value={address.union_name}
                    onChange={(e) => setAddress({ ...address, id: undefined, union_name: e.target.value })}
                    placeholder={tr(language, 'Union name', 'ইউনিয়নের নাম')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Municipality / Pourashava', 'পৌরসভা / সিটি কর্পোরেশন')}
                  </label>
                  <input
                    type="text"
                    value={address.municipality}
                    onChange={(e) => setAddress({ ...address, id: undefined, municipality: e.target.value })}
                    placeholder={tr(language, 'Municipality / Ward', 'পৌরসভা / ওয়ার্ড নং')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'City / Town', 'শহর / নগরী')}
                  </label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, id: undefined, city: e.target.value })}
                    placeholder={tr(language, 'City or town name', 'শহরের নাম')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Village / Mohalla', 'গ্রাম / মহল্লা / পাড়া')}
                  </label>
                  <input
                    type="text"
                    value={address.village}
                    onChange={(e) => setAddress({ ...address, id: undefined, village: e.target.value })}
                    placeholder={tr(language, 'Village or para name', 'গ্রাম বা পাড়ার নাম')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Area / Sector / Bazar *', 'এলাকা / সেক্টর / বাজার *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.area}
                    onChange={(e) => setAddress({ ...address, id: undefined, area: e.target.value })}
                    placeholder={tr(language, 'e.g. Jahaj Company More, Gulshan-2', 'যেমন: জাহাজ কোম্পানি মোড়, গুলশান-২')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Road Number / Name', 'রোড / সড়ক নং')}
                  </label>
                  <input
                    type="text"
                    value={address.road_number}
                    onChange={(e) => setAddress({ ...address, id: undefined, road_number: e.target.value })}
                    placeholder={tr(language, 'e.g. Road 04', 'যেমন: রোড ০৪')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'House Number / Name', 'বাড়ি নং / নাম')}
                  </label>
                  <input
                    type="text"
                    value={address.house_number}
                    onChange={(e) => setAddress({ ...address, id: undefined, house_number: e.target.value })}
                    placeholder={tr(language, 'e.g. House 12', 'যেমন: বাড়ি ১২')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Apartment / Flat No.', 'ফ্ল্যাট / বাসা নং')}
                  </label>
                  <input
                    type="text"
                    value={address.apartment_number}
                    onChange={(e) => setAddress({ ...address, id: undefined, apartment_number: e.target.value })}
                    placeholder={tr(language, 'e.g. Flat 3B', 'যেমন: ফ্ল্যাট ৩বি')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Floor Number', 'তলা / ফ্লোর নং')}
                  </label>
                  <input
                    type="text"
                    value={address.floor_number}
                    onChange={(e) => setAddress({ ...address, id: undefined, floor_number: e.target.value })}
                    placeholder={tr(language, 'e.g. 3rd Floor', 'যেমন: ৩য় তলা')}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Full Street / Additional Details', 'সম্পূর্ণ ঠিকানা (বিস্তারিত)')}
                  </label>
                  <input
                    type="text"
                    value={address.street_address}
                    onChange={(e) => setAddress({ ...address, id: undefined, street_address: e.target.value })}
                    placeholder={tr(language, 'Full house/village/lane details', 'বাড়ি, পাড়া ও রাস্তার বিস্তারিত বিবরণ')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Nearby Landmark', 'নিকটস্থ পরিচিত স্থান')}
                  </label>
                  <input
                    type="text"
                    value={address.landmark}
                    onChange={(e) => setAddress({ ...address, id: undefined, landmark: e.target.value })}
                    placeholder={tr(language, 'e.g. Beside Central Mosque / School', 'যেমন: স্কুল বা মসজিদের পাশে')}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Additional Delivery Instructions', 'ডেলিভারির জন্য বিশেষ নির্দেশনা')}
                  </label>
                  <textarea
                    rows={2}
                    value={address.instructions}
                    onChange={(e) => setAddress({ ...address, id: undefined, instructions: e.target.value })}
                    placeholder={tr(language, 'e.g. Call before arrival, deliver after 4 PM', 'যেমন: পৌঁছানোর আগে কল দিবেন')}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'State / Province / Region *', 'স্টেট / প্রদেশ *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.state_province}
                    onChange={(e) => setAddress({ ...address, id: undefined, state_province: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'City *', 'শহর *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, id: undefined, city: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'District (if applicable)', 'জেলা (যদি থাকে)')}
                  </label>
                  <input
                    type="text"
                    value={address.district}
                    onChange={(e) => setAddress({ ...address, id: undefined, district: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Postal / ZIP Code *', 'পোস্টাল / জিপ কোড *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.postal_code}
                    onChange={(e) => setAddress({ ...address, id: undefined, postal_code: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Street Address *', 'বিস্তারিত সড়ক ঠিকানা *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={address.street_address}
                    onChange={(e) => setAddress({ ...address, id: undefined, street_address: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'House / Apartment Number', 'বাড়ি / অ্যাপার্টমেন্ট নং')}
                  </label>
                  <input
                    type="text"
                    value={address.apartment_number}
                    onChange={(e) => setAddress({ ...address, id: undefined, apartment_number: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Delivery Instructions', 'ডেলিভারি নির্দেশনা')}
                  </label>
                  <input
                    type="text"
                    value={address.instructions}
                    onChange={(e) => setAddress({ ...address, id: undefined, instructions: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {authToken && !address.id && (
              <label className="flex items-center gap-2 text-xs text-zinc-300 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddressToAccount}
                  onChange={(e) => setSaveAddressToAccount(e.target.checked)}
                />
                <span>
                  {tr(language, 'Save this delivery address to my SHOPNEXA ROBI HUB account', 'ভবিষ্যতের জন্য এই ঠিকানাটি অ্যাকাউন্টে সংরক্ষণ করুন')}
                </span>
              </label>
            )}
          </div>

          {/* Payment Method Selection */}
          <div className="border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E4C76B] uppercase tracking-wider">
                {tr(language, '3. Payment Method', '৩. পেমেন্ট মাধ্যম')}
              </h2>
              <span className="text-xs text-zinc-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#E4C76B]" />
                <span>{tr(language, 'No PIN or OTP collected', 'কোনো PIN বা OTP নেওয়া হয় না')}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableGateways.map((gw) => (
                <button
                  key={gw.gateway}
                  type="button"
                  onClick={() => setPaymentMethod(gw.gateway)}
                  className={`p-3.5 border text-left text-xs transition-colors ${
                    paymentMethod === gw.gateway
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-zinc-700 bg-zinc-950 text-white hover:border-[#C9A227]'
                  }`}
                >
                  <p className="font-semibold">{gw.display_name}</p>
                  <p className={`text-[11px] mt-1 ${paymentMethod === gw.gateway ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    {gw.gateway === 'cod'
                      ? tr(language, 'Pay on delivery', 'পণ্য হাতে পেয়ে টাকা দিন')
                      : gw.env_configured
                      ? tr(language, 'Authorized Gateway API', 'অনুমোদিত গেটওয়ে API')
                      : tr(language, 'Merchant TrxID Verification', 'মার্চেন্ট TrxID যাচাই')}
                  </p>
                </button>
              ))}
            </div>

            {selectedGatewayMeta && (
              <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3 text-xs">
                <p className="text-zinc-200 leading-relaxed">{selectedGatewayMeta.instructions}</p>
                {selectedGatewayMeta.merchant_number && (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-black text-white border border-[#C9A227]/60 px-4 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#E4C76B] font-semibold">
                        {selectedGatewayMeta.display_name} {tr(language, 'Number', 'নম্বর')}
                      </p>
                      <p className="font-mono text-base font-semibold tracking-wider mt-0.5">
                        {selectedGatewayMeta.merchant_number}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedGatewayMeta.merchant_number);
                        setCopiedWallet(true);
                        showToast(tr(language, 'Payment number copied', 'পেমেন্ট নম্বর কপি হয়েছে'), 'success');
                        setTimeout(() => setCopiedWallet(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      {copiedWallet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWallet ? tr(language, 'Copied', 'কপি হয়েছে') : tr(language, 'Copy Number', 'নম্বর কপি করুন')}</span>
                    </button>
                  </div>
                )}
                {(paymentMethod === 'bkash' || paymentMethod === 'nagad' || paymentMethod === 'international_card') && (
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      {tr(language, 'Transaction ID / Payment Reference *', 'ট্রানজেকশন আইডি (TrxID) *')}
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder={
                        paymentMethod === 'bkash'
                          ? tr(language, 'Enter bKash TrxID (never enter PIN/OTP)', 'বিকাশ TrxID লিখুন (কখনো PIN/OTP দিবেন না)')
                          : paymentMethod === 'nagad'
                          ? tr(language, 'Enter Nagad Transaction ID (never enter PIN/OTP)', 'নগদ TrxID লিখুন (কখনো PIN/OTP দিবেন না)')
                          : tr(language, 'Enter Gateway Reference ID', 'পেমেন্ট রেফারেন্স আইডি লিখুন')
                      }
                      className="w-full border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-400 px-3 py-2.5 font-mono text-xs focus:border-[#C9A227] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="text-xs">
              <label className="block font-medium text-zinc-200 mb-1">
                {tr(language, 'Order Notes (Optional)', 'অর্ডার নোট (ঐচ্ছিক)')}
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={tr(language, 'Any special request for fulfillment', 'প্যাকিং বা ডেলিভারি নিয়ে কোনো বিশেষ অনুরোধ')}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Right 5 cols: Complete Order Summary */}
        <div className="lg:col-span-5">
          <div className="border border-zinc-800 bg-zinc-900 p-6 space-y-5 sticky top-24">
            <h2 className="font-display text-2xl font-semibold text-white">
              {tr(language, 'Order Summary', 'অর্ডার সারাংশ')}
            </h2>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {cart.map((item) => {
                const unitPrice =
                  item.selected_variation?.price ??
                  item.selected_size?.price_override ??
                  item.selected_color?.price_override ??
                  (item.product.sale_price > 0 ? item.product.sale_price : item.product.selling_price);
                return (
                  <div key={item.id} className="flex gap-3 pb-3 border-b border-zinc-800 text-xs">
                    <div className="w-14 h-14 bg-white border border-zinc-700 shrink-0 overflow-hidden">
                      <SmartImage
                        src={item.selected_color?.images?.[0] || item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white line-clamp-1">{item.product.name}</p>
                      <p className="text-zinc-400 mt-0.5">
                        {[item.selected_color?.name, item.selected_size?.label, item.selected_variation?.model_name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="font-mono text-zinc-300 mt-0.5">
                        {item.quantity} × {formatPrice(unitPrice, item.product.currency || 'USD')}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-[#E4C76B]">
                      {formatPrice(unitPrice * item.quantity, item.product.currency || 'USD')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Coupon */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder={tr(language, 'Coupon code', 'কুপন কোড লিখুন')}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white placeholder:text-zinc-400 pl-8 pr-3 py-2 text-xs focus:border-[#C9A227] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={(e) => void handleApplyCoupon(e)}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 hover:border-[#C9A227] text-white text-xs font-semibold transition-colors"
              >
                {tr(language, 'Apply', 'প্রয়োগ করুন')}
              </button>
            </div>

            <div className="space-y-2 text-xs border-t border-zinc-800 pt-4">
              <div className="flex justify-between text-zinc-300">
                <span>{tr(language, 'Subtotal', 'উপমোট')}</span>
                <span className="font-mono tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>
                    {tr(language, 'Discount', 'ছাড়')} ({appliedDiscount?.code})
                  </span>
                  <span className="font-mono tabular-nums">-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-300">
                <span>
                  {tr(language, 'Shipping', 'ডেলিভারি চার্জ')} ({shippingQuote.zone_name})
                </span>
                <span className="font-mono tabular-nums">
                  {shippingQuote.shipping_charge === 0
                    ? tr(language, 'Free', 'ফ্রি')
                    : formatPrice(shippingQuote.shipping_charge)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>{tr(language, 'Tax', 'ট্যাক্স / ভ্যাট')}</span>
                <span className="font-mono tabular-nums">{formatPrice(0)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-white pt-3 border-t border-zinc-800">
                <span>{tr(language, 'Final Total', 'সর্বমোট মূল্য')}</span>
                <span className="font-mono tabular-nums text-[#E4C76B]">{formatPrice(finalTotal)}</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {tr(language, 'Estimated Delivery:', 'সম্ভাব্য ডেলিভারি সময়:')} {shippingQuote.estimated_days}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {submitting
                  ? tr(language, 'Confirming Order...', 'অর্ডার নিশ্চিত হচ্ছে...')
                  : tr(language, 'Confirm & Place Direct Order', 'অর্ডার নিশ্চিত করুন')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

