import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { tr } from '../i18n.ts';
import { SmartImage } from './SmartImage.tsx';

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    updateCartQuantity,
    removeFromCart,
    formatPrice,
    toBaseUsd,
    navigate,
    language,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);

  if (!cartOpen) return null;

  const subtotal = cart.reduce((sum, item) => {
    const unit =
      item.selected_variation?.price ??
      item.selected_size?.price_override ??
      item.selected_color?.price_override ??
      (item.product.sale_price > 0 ? item.product.sale_price : item.product.selling_price);
    return sum + toBaseUsd(unit * item.quantity, item.product.currency || 'USD');
  }, 0);

  const discountAmount = appliedDiscount ? Math.min(subtotal, appliedDiscount.amount) : 0;
  const estimatedTotal = Math.max(0, subtotal - discountAmount);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponInput.trim()) return;
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponInput.trim(), subtotal }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCouponError(data.error || tr(language, 'Invalid coupon', 'কুপন কোডটি সঠিক নয়'));
      setAppliedDiscount(null);
      return;
    }
    setAppliedDiscount({ code: data.code, amount: data.discount_amount });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-zinc-950 text-zinc-100 h-full flex flex-col shadow-2xl border-l border-[#C9A227]/35">
        <div className="px-6 py-4 bg-black text-white flex items-center justify-between border-b border-[#C9A227]/30">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#E4C76B]" />
            <h2 className="font-display text-xl font-semibold tracking-wide text-white">
              {tr(language, 'Shopping Bag', 'শপিং ব্যাগ')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label={tr(language, 'Close Cart', 'কার্ট বন্ধ করুন')}
            className="p-1.5 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {cart.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <ShoppingBag className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm text-zinc-300">
                {tr(language, 'Your SHOPNEXA ROBI HUB bag is currently empty.', 'আপনার SHOPNEXA ROBI HUB শপিং ব্যাগটি বর্তমানে খালি।')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate({ page: 'shop', filter: 'own' });
                }}
                className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold transition-colors"
              >
                {tr(language, 'Browse Direct Products', 'সরাসরি পণ্য দেখুন')}
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const unitPrice =
                item.selected_variation?.price ??
                item.selected_size?.price_override ??
                item.selected_color?.price_override ??
                (item.product.sale_price > 0 ? item.product.sale_price : item.product.selling_price);
              const img =
                item.selected_variation?.image_url ||
                item.selected_color?.images?.[0] ||
                item.product.images[0];

              return (
                <div key={item.id} className="flex gap-4 pb-5 border-b border-zinc-800">
                  <div className="w-20 h-20 bg-white border border-zinc-700 shrink-0 overflow-hidden">
                    <SmartImage src={img} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white line-clamp-2">{item.product.name}</h3>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={tr(language, 'Remove item', 'আইটেম সরান')}
                        className="text-zinc-400 hover:text-red-400 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-1 text-xs text-zinc-400 space-x-2">
                      {item.selected_color && (
                        <span>{tr(language, 'Color', 'রঙ')}: {item.selected_color.name}</span>
                      )}
                      {item.selected_size && (
                        <span>· {tr(language, 'Size', 'সাইজ')}: {item.selected_size.label}</span>
                      )}
                      {item.selected_variation && <span>· {item.selected_variation.variant_name}</span>}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center border border-zinc-700 bg-zinc-900 text-white">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          aria-label={tr(language, 'Decrease quantity', 'পরিমাণ কমান')}
                          className="p-1.5 hover:bg-zinc-800"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-xs font-mono tabular-nums font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          aria-label={tr(language, 'Increase quantity', 'পরিমাণ বাড়ান')}
                          className="p-1.5 hover:bg-zinc-800"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold font-mono tabular-nums text-[#E4C76B]">
                        {formatPrice(unitPrice * item.quantity, item.product.currency || 'USD')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 bg-zinc-900 border-t border-zinc-800 space-y-4">
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={tr(language, 'Promo / Coupon code', 'প্রোমো / কুপন কোড')}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white placeholder:text-zinc-400 pl-8 pr-3 py-2 text-xs focus:border-[#C9A227] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 hover:border-[#C9A227] text-white text-xs font-semibold transition-colors"
              >
                {tr(language, 'Apply', 'প্রয়োগ করুন')}
              </button>
            </form>
            {couponError && <p className="text-xs text-red-400">{couponError}</p>}
            {appliedDiscount && (
              <p className="text-xs text-emerald-400 font-medium">
                {tr(language, 'Coupon', 'কুপন')} {appliedDiscount.code} {tr(language, 'applied', 'প্রয়োগ হয়েছে')} (-{formatPrice(appliedDiscount.amount)})
              </p>
            )}

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>{tr(language, 'Subtotal', 'উপ-মোট')}</span>
                <span className="font-mono tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>{tr(language, 'Discount', 'ছাড়')}</span>
                  <span className="font-mono tabular-nums">-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-white pt-2 border-t border-zinc-800">
                <span>{tr(language, 'Estimated Total', 'আনুমানিক মোট')}</span>
                <span className="font-mono tabular-nums text-[#E4C76B]">{formatPrice(estimatedTotal)}</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {tr(language, 'Shipping calculated by country & district at checkout.', 'চেকআউটে দেশ ও জেলা অনুযায়ী ডেলিভারি চার্জ যুক্ত হবে।')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setCartOpen(false);
                navigate({ page: 'checkout' });
              }}
              className="w-full py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-colors"
            >
              <span>{tr(language, 'Proceed to Checkout', 'চেকআউট করুন')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
