import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  MapPin,
  Heart,
  Package,
  Bell,
  LogOut,
  Trash2,
  Check,
  Upload,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import type { CustomerAddress, Order } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  BD_DIVISIONS,
  BD_DISTRICTS,
  DELIVERY_COUNTRIES,
  tr,
  translateOrderStatus,
  formatDetailedAddress,
} from '../i18n.ts';

const EMPTY_SAVED_ADDR: Partial<CustomerAddress> = {
  label: 'Home',
  country: 'Bangladesh',
  division: 'Rangpur',
  district: 'Rangpur',
  upazila: '',
  thana: '',
  post_office: '',
  postal_code: '',
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
  landmark: '',
  alt_phone: '',
  instructions: '',
  full_name: '',
  mobile: '',
  email: '',
  is_default: true,
};

export function CustomerAccountView({ initialTab = 'profile' }: { initialTab?: string }) {
  const {
    language,
    user,
    authToken,
    setCustomerSession,
    logoutCustomer,
    products,
    wishlistIds,
    notifications,
    refreshNotifications,
    formatPrice,
    navigate,
    showToast,
    markBuyerVerified,
  } = useStore();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState(initialTab);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [newAddr, setNewAddr] = useState<Partial<CustomerAddress>>({ ...EMPTY_SAVED_ADDR });

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!authToken || !user) return;
    setProfileName(user.name);
    setProfilePhone(user.phone);
    setProfileAvatar(user.avatar_url);

    fetch('/api/orders/my', { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Order[]) => {
        setOrders(list);
        if (list.length > 0) {
          markBuyerVerified();
        }
      })
      .catch(() => {});

    fetch('/api/addresses', { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setAddresses)
      .catch(() => {});

    void refreshNotifications();
  }, [authToken, user, refreshNotifications, markBuyerVerified]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || tr(language, 'Login failed', 'লগইন ব্যর্থ হয়েছে'), 'error');
          return;
        }
        setCustomerSession(data.token, data.user);
        showToast(tr(language, `Welcome back, ${data.user.name}`, `স্বাগতম, ${data.user.name}`), 'success');
      } else if (authMode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || tr(language, 'Registration failed', 'নিবন্ধন ব্যর্থ হয়েছে'), 'error');
          return;
        }
        setCustomerSession(data.token, data.user);
        showToast(tr(language, 'Account created and signed in', 'অ্যাকাউন্ট তৈরি ও লগইন সফল হয়েছে'), 'success');
      } else if (authMode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        showToast(
          data.resetCodePreview
            ? tr(language, `Reset code generated: ${data.resetCodePreview}`, `রিসেট কোড: ${data.resetCodePreview}`)
            : data.message,
          'info'
        );
        setAuthMode('reset');
      } else if (authMode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, resetCode, newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || tr(language, 'Reset failed', 'রিসেট ব্যর্থ হয়েছে'), 'error');
          return;
        }
        showToast(data.message || tr(language, 'Password reset successful', 'পাসওয়ার্ড রিসেট হয়েছে'), 'success');
        setAuthMode('login');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authToken) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: fd,
    });
    if (res.ok) {
      const data = await res.json();
      setProfileAvatar(data.url);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: profileName, phone: profilePhone, avatar_url: profileAvatar }),
    });
    const data = await res.json();
    if (res.ok) {
      setCustomerSession(authToken, data.user);
      showToast(tr(language, 'Profile updated', 'প্রোফাইল আপডেট হয়েছে'), 'success');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(tr(language, 'Password updated', 'পাসওয়ার্ড পরিবর্তন হয়েছে'), 'success');
      setCurrentPassword('');
      setNewPassword('');
    } else {
      showToast(data.error || tr(language, 'Failed to update password', 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে'), 'error');
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    const res = await fetch('/api/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ...newAddr,
        email: newAddr.email || user?.email || '',
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setAddresses((prev) => [created, ...prev.map((a) => (created.is_default ? { ...a, is_default: false } : a))]);
      setNewAddr({ ...EMPTY_SAVED_ADDR, full_name: user?.name || '', mobile: user?.phone || '' });
      showToast(tr(language, 'Address saved', 'ঠিকানা সফলভাবে সংরক্ষিত হয়েছে'), 'success');
    } else {
      showToast(tr(language, 'Failed to save address', 'ঠিকানা সংরক্ষণ ব্যর্থ হয়েছে'), 'error');
    }
  };

  const handleSetDefaultAddress = async (addr: CustomerAddress) => {
    if (!authToken || !addr.id) return;
    const res = await fetch(`/api/addresses/${addr.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ...addr, is_default: true }),
    });
    if (res.ok) {
      setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === addr.id })));
      showToast(tr(language, 'Default address updated', 'ডিফল্ট ঠিকানা পরিবর্তন হয়েছে'), 'success');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!authToken) return;
    await fetch(`/api/addresses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    showToast(tr(language, 'Address removed', 'ঠিকানা মুছে ফেলা হয়েছে'), 'info');
  };

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));
  const isNewAddrBD = (newAddr.country || 'Bangladesh').toLowerCase() === 'bangladesh';
  const addrInputCls =
    'bg-zinc-950 border border-zinc-700 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-[#C9A227] focus:outline-none';

  if (!user || !authToken) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14 space-y-6 text-zinc-100">
        <div className="border border-zinc-800 p-8 bg-zinc-900 space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
              {tr(language, 'CUSTOMER PORTAL', 'ক্রেতা পোর্টাল')}
            </p>
            <h1 className="font-display text-3xl font-semibold text-white mt-1">
              {authMode === 'login' && tr(language, 'Sign In to SHOPNEXA ROBI HUB', 'অ্যাকাউন্টে লগইন করুন')}
              {authMode === 'register' && tr(language, 'Create Customer Account', 'নতুন ক্রেতা অ্যাকাউন্ট খুলুন')}
              {authMode === 'forgot' && tr(language, 'Forgot Password', 'পাসওয়ার্ড ভুলে গেছেন?')}
              {authMode === 'reset' && tr(language, 'Reset Password', 'পাসওয়ার্ড রিসেট করুন')}
            </h1>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Full Name', 'পূর্ণ নাম')}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Mobile Number', 'মোবাইল নম্বর')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block font-medium text-zinc-200 mb-1">
                {tr(language, 'Email Address', 'ইমেইল ঠিকানা')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-white focus:border-[#C9A227] focus:outline-none"
              />
            </div>

            {authMode === 'reset' && (
              <div>
                <label className="block font-medium text-zinc-200 mb-1">
                  {tr(language, 'Reset Code', 'রিসেট কোড')}
                </label>
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-white font-mono focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            )}

            {authMode !== 'forgot' && (
              <div>
                <label className="block font-medium text-zinc-200 mb-1">
                  {authMode === 'reset'
                    ? tr(language, 'New Password', 'নতুন পাসওয়ার্ড')
                    : tr(language, 'Password', 'পাসওয়ার্ড')}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-white focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors"
            >
              {authLoading
                ? tr(language, 'Processing...', 'অপেক্ষা করুন...')
                : authMode === 'login'
                ? tr(language, 'Sign In', 'লগইন করুন')
                : authMode === 'register'
                ? tr(language, 'Create Account', 'অ্যাকাউন্ট তৈরি করুন')
                : authMode === 'forgot'
                ? tr(language, 'Request Reset Code', 'রিসেট কোড পাঠান')
                : tr(language, 'Reset Password', 'পাসওয়ার্ড রিসেট করুন')}
            </button>
          </form>

          <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-zinc-800 text-xs">
            {authMode === 'login' ? (
              <>
                <button type="button" onClick={() => setAuthMode('register')} className="font-semibold text-white hover:text-[#E4C76B]">
                  {tr(language, 'Create an account', 'নতুন অ্যাকাউন্ট খুলুন')}
                </button>
                <button type="button" onClick={() => setAuthMode('forgot')} className="text-zinc-300 hover:text-[#E4C76B]">
                  {tr(language, 'Forgot password?', 'পাসওয়ার্ড ভুলে গেছেন?')}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setAuthMode('login')} className="font-semibold text-white hover:text-[#E4C76B]">
                {tr(language, 'Back to Sign In', 'লগইন পাতায় ফিরে যান')}
              </button>
            )}
          </div>
        </div>

        {wishlistProducts.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">
              {tr(language, 'Saved Wishlist', 'পছন্দের তালিকা')} ({wishlistProducts.length})
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {wishlistProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-zinc-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-zinc-900 text-[#E4C76B] flex items-center justify-center font-display text-2xl font-semibold overflow-hidden border border-[#C9A227]">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold text-white">{user.name}</h1>
            <p className="text-xs text-zinc-400">
              {user.email} · {user.phone || tr(language, 'No phone set', 'মোবাইল নম্বর দেওয়া নেই')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logoutCustomer}
          className="px-4 py-2 border border-zinc-700 hover:border-[#C9A227] text-white text-xs font-semibold flex items-center gap-2 self-start transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{tr(language, 'Logout', 'লগআউট')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3 space-y-1">
          {[
            { id: 'profile', label: tr(language, 'Profile & Security', 'প্রোফাইল ও নিরাপত্তা'), icon: UserIcon },
            { id: 'orders', label: `${tr(language, 'Order History', 'আমার অর্ডারসমূহ')} (${orders.length})`, icon: Package },
            { id: 'addresses', label: `${tr(language, 'Saved Addresses', 'সংরক্ষিত ঠিকানা')} (${addresses.length})`, icon: MapPin },
            { id: 'wishlist', label: `${tr(language, 'Wishlist', 'পছন্দের তালিকা')} (${wishlistProducts.length})`, icon: Heart },
            {
              id: 'notifications',
              label: `${tr(language, 'Notifications', 'নোটিফিকেশন')} (${notifications.filter((n) => !n.is_read).length})`,
              icon: Bell,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-2.5 border transition-colors ${
                  tab === item.id
                    ? 'bg-[#C9A227] text-black border-[#C9A227]'
                    : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-[#C9A227]'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab === item.id ? 'text-black' : 'text-[#E4C76B]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="lg:col-span-9">
          {tab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form onSubmit={handleSaveProfile} className="border border-zinc-800 bg-zinc-900 p-6 space-y-4 text-xs">
                <h2 className="text-sm font-semibold text-[#E4C76B] uppercase tracking-wider">
                  {tr(language, 'Update Profile', 'প্রোফাইল আপডেট করুন')}
                </h2>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Full Name', 'পূর্ণ নাম')}
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Phone', 'মোবাইল নম্বর')}
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Profile Picture', 'প্রোফাইল ছবি')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={profileAvatar}
                      onChange={(e) => setProfileAvatar(e.target.value)}
                      placeholder={tr(language, 'Image URL or upload', 'ছবির লিংক বা আপলোড করুন')}
                      className="flex-1 bg-zinc-950 border border-zinc-700 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-[#C9A227] focus:outline-none"
                    />
                    <label className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white cursor-pointer flex items-center gap-1 hover:border-[#C9A227]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{tr(language, 'Upload', 'আপলোড')}</span>
                      <input type="file" accept="image/*" onChange={(e) => void handleAvatarUpload(e)} className="hidden" />
                    </label>
                  </div>
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors">
                  {tr(language, 'Save Profile', 'প্রোফাইল সংরক্ষণ করুন')}
                </button>
              </form>

              <form onSubmit={handleChangePassword} className="border border-zinc-800 bg-zinc-900 p-6 space-y-4 text-xs">
                <h2 className="text-sm font-semibold text-[#E4C76B] uppercase tracking-wider">
                  {tr(language, 'Change Password', 'পাসওয়ার্ড পরিবর্তন')}
                </h2>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'Current Password', 'বর্তমান পাসওয়ার্ড')}
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-200 mb-1">
                    {tr(language, 'New Password', 'নতুন পাসওয়ার্ড')}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:border-[#C9A227] focus:outline-none"
                  />
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors">
                  {tr(language, 'Update Password', 'পাসওয়ার্ড আপডেট করুন')}
                </button>
              </form>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              {orders.length > 0 && (
                <div className="bg-zinc-900 text-white border border-[#C9A227]/40 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-[#E4C76B] tracking-wider">
                      {tr(language, 'BUYER APP DOWNLOAD', 'ক্রেতা অ্যাপ ডাউনলোড')}
                    </p>
                    <p className="text-zinc-300 mt-0.5">
                      {tr(
                        language,
                        'Available for verified buyers — browse products and track your orders directly.',
                        'যাচাইকৃত ক্রেতাদের জন্য — সহজে পণ্য ব্রাউজ ও অর্ডার ট্র্যাক করুন।'
                      )}
                    </p>
                  </div>
                  <PWAInstallButton variant="banner" label={tr(language, 'Download SHOPNEXA ROBI HUB App', 'অ্যাপ ডাউনলোড করুন')} />
                </div>
              )}
              {orders.length === 0 ? (
                <div className="border border-zinc-800 bg-zinc-900 p-8 text-xs text-zinc-300">
                  {tr(language, 'You have not placed any direct orders yet.', 'আপনি এখনো কোনো সরাসরি অর্ডার করেননি।')}
                </div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="border border-zinc-800 p-5 space-y-3 text-xs bg-zinc-900">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                      <div>
                        <span className="font-mono font-semibold text-sm text-white">{o.order_number}</span>
                        <span className="text-zinc-400 ml-3">{o.created_at.slice(0, 10)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#E4C76B]">{translateOrderStatus(o.order_status, language)}</span>
                        <span className="font-mono font-semibold text-white">{formatPrice(o.final_total)}</span>
                        <button
                          type="button"
                          onClick={() => navigate({ page: 'track', orderNumber: o.order_number })}
                          className="px-3 py-1 border border-zinc-700 hover:border-[#C9A227] text-white font-semibold"
                        >
                          {tr(language, 'Track', 'ট্র্যাক করুন')}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {o.items.map((it) => (
                        <p key={it.id} className="text-zinc-200">
                          {it.quantity} × {it.product_name} ({[it.color_name, it.size_label].filter(Boolean).join(', ')})
                        </p>
                      ))}
                    </div>
                    {o.address && (
                      <p className="text-zinc-400">
                        {tr(language, 'Delivery:', 'ঠিকানা:')} {formatDetailedAddress(o.address, language)}
                      </p>
                    )}
                    {o.tracking_number && (
                      <p className="text-zinc-400 font-mono">
                        {tr(language, 'Courier:', 'কুরিয়ার:')} {o.courier_name || tr(language, 'Assigned', 'নির্ধারিত')} ·{' '}
                        {tr(language, 'Tracking:', 'ট্র্যাকিং:')} {o.tracking_number}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'addresses' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div key={addr.id} className="border border-zinc-800 bg-zinc-900 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {addr.label} {addr.is_default && tr(language, '· Default', '· ডিফল্ট')}
                      </span>
                      <div className="flex items-center gap-2">
                        {!addr.is_default && (
                          <button
                            type="button"
                            onClick={() => void handleSetDefaultAddress(addr)}
                            className="text-[#E4C76B] hover:underline flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{tr(language, 'Set Default', 'ডিফল্ট করুন')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => addr.id && void handleDeleteAddress(addr.id)}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="font-medium text-zinc-100">
                      {addr.full_name} · {addr.mobile}
                    </p>
                    <p className="text-zinc-300 leading-relaxed">{formatDetailedAddress(addr, language)}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSaveAddress} className="border border-zinc-800 bg-zinc-900 p-6 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#E4C76B]">
                    {tr(language, 'Add New Detailed Address', 'নতুন বিস্তারিত ঠিকানা যোগ করুন')}
                  </h3>
                  <select
                    value={newAddr.country || 'Bangladesh'}
                    onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })}
                    className="border border-[#C9A227]/60 px-3 py-1.5 bg-zinc-950 text-white font-semibold focus:outline-none"
                  >
                    {DELIVERY_COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value} className="bg-zinc-950 text-white">
                        {language === 'bn' ? `${c.bn} (${c.en})` : c.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder={tr(language, 'Label (Home / Office)', 'ঠিকানার ধরন (বাসা / অফিস)')}
                    value={newAddr.label || ''}
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                    className={addrInputCls}
                  />
                  <input
                    type="text"
                    required
                    placeholder={tr(language, 'Recipient Full Name *', 'প্রাপকের পূর্ণ নাম *')}
                    value={newAddr.full_name || ''}
                    onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })}
                    className={addrInputCls}
                  />
                  <input
                    type="tel"
                    required
                    placeholder={tr(language, 'Mobile Number *', 'মোবাইল নম্বর *')}
                    value={newAddr.mobile || ''}
                    onChange={(e) => setNewAddr({ ...newAddr, mobile: e.target.value })}
                    className={addrInputCls}
                  />

                  {isNewAddrBD ? (
                    <>
                      <select
                        value={newAddr.division || 'Rangpur'}
                        onChange={(e) => setNewAddr({ ...newAddr, division: e.target.value })}
                        className={addrInputCls}
                      >
                        {BD_DIVISIONS.map((d) => (
                          <option key={d.value} value={d.value} className="bg-zinc-950 text-white">
                            {language === 'bn' ? d.bn : d.en}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        list="bd-account-districts"
                        placeholder={tr(language, 'District *', 'জেলা *')}
                        value={newAddr.district || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })}
                        className={addrInputCls}
                      />
                      <datalist id="bd-account-districts">
                        {BD_DISTRICTS.map((d) => (
                          <option key={d.en} value={d.en}>
                            {language === 'bn' ? `${d.bn} (${d.en})` : d.en}
                          </option>
                        ))}
                      </datalist>
                      <input
                        type="text"
                        placeholder={tr(language, 'Upazila', 'উপজেলা')}
                        value={newAddr.upazila || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, upazila: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Thana / Police Station', 'থানা')}
                        value={newAddr.thana || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, thana: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'Post Office *', 'ডাকঘর (Post Office) *')}
                        value={newAddr.post_office || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, post_office: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'Postal Code *', 'পোস্টাল কোড *')}
                        value={newAddr.postal_code || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Union', 'ইউনিয়ন')}
                        value={newAddr.union_name || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, union_name: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Municipality / Ward', 'পৌরসভা / ওয়ার্ড')}
                        value={newAddr.municipality || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, municipality: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Village / Mohalla', 'গ্রাম / মহল্লা')}
                        value={newAddr.village || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, village: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'Area / Sector *', 'এলাকা / বাজার *')}
                        value={newAddr.area || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, area: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Road Number', 'রোড নং')}
                        value={newAddr.road_number || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, road_number: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'House Number', 'বাড়ি নং')}
                        value={newAddr.house_number || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, house_number: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Apartment / Flat', 'ফ্ল্যাট নং')}
                        value={newAddr.apartment_number || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, apartment_number: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Floor Number', 'তলা / ফ্লোর')}
                        value={newAddr.floor_number || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, floor_number: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Nearby Landmark', 'নিকটস্থ পরিচিত স্থান')}
                        value={newAddr.landmark || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, landmark: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Full Street Details', 'বিস্তারিত ঠিকানা')}
                        value={newAddr.street_address || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })}
                        className={`sm:col-span-2 ${addrInputCls}`}
                      />
                      <input
                        type="tel"
                        placeholder={tr(language, 'Alternative Phone', 'বিকল্প মোবাইল নম্বর')}
                        value={newAddr.alt_phone || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, alt_phone: e.target.value })}
                        className={addrInputCls}
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'State / Province *', 'স্টেট / প্রদেশ *')}
                        value={newAddr.state_province || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, state_province: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'City *', 'শহর *')}
                        value={newAddr.city || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value, district: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'Postal / ZIP Code *', 'পোস্টাল / জিপ কোড *')}
                        value={newAddr.postal_code || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })}
                        className={addrInputCls}
                      />
                      <input
                        type="text"
                        required
                        placeholder={tr(language, 'Street Address *', 'বিস্তারিত ঠিকানা *')}
                        value={newAddr.street_address || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })}
                        className={`sm:col-span-2 ${addrInputCls}`}
                      />
                      <input
                        type="text"
                        placeholder={tr(language, 'Apartment / Suite', 'অ্যাপার্টমেন্ট নং')}
                        value={newAddr.apartment_number || ''}
                        onChange={(e) => setNewAddr({ ...newAddr, apartment_number: e.target.value })}
                        className={addrInputCls}
                      />
                    </>
                  )}
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#C9A227] hover:bg-[#E4C76B] text-black font-semibold transition-colors">
                  {tr(language, 'Save Address', 'ঠিকানা সংরক্ষণ করুন')}
                </button>
              </form>
            </div>
          )}

          {tab === 'wishlist' && (
            <div>
              {wishlistProducts.length === 0 ? (
                <div className="border border-zinc-800 bg-zinc-900 p-8 text-xs text-zinc-300">
                  {tr(language, 'Your wishlist is empty.', 'আপনার পছন্দের তালিকায় এখনো কোনো পণ্য নেই।')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlistProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/notifications/read-all', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${authToken}` },
                    });
                    await refreshNotifications();
                  }}
                  className="text-xs font-semibold text-[#E4C76B] hover:underline"
                >
                  {tr(language, 'Mark all as read', 'সব পঠিত হিসেবে চিহ্নিত করুন')}
                </button>
              </div>
              {notifications.length === 0 ? (
                <div className="border border-zinc-800 bg-zinc-900 p-8 text-xs text-zinc-300">
                  {tr(language, 'No notifications yet.', 'এখনো কোনো নোটিফিকেশন আসেনি।')}
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border p-4 text-xs ${
                      n.is_read ? 'border-zinc-800 bg-zinc-900' : 'border-[#C9A227] bg-zinc-950'
                    }`}
                  >
                    <div className="flex justify-between font-semibold text-white">
                      <span>{n.title}</span>
                      <span className="text-zinc-400 font-mono">{n.created_at.slice(0, 10)}</span>
                    </div>
                    <p className="text-zinc-300 mt-1">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

