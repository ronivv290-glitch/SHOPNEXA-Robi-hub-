import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { t, tr, translateCategory } from '../i18n.ts';
import { ProductCard } from './ProductCard.tsx';

interface ShopCatalogViewProps {
  initialFilter?: string;
  initialCategoryId?: number;
  initialSearch?: string;
}

export function ShopCatalogView({
  initialFilter = 'all',
  initialCategoryId,
  initialSearch = '',
}: ShopCatalogViewProps) {
  const { products, categories, toBaseUsd, language } = useStore();
  const [filter, setFilter] = useState(initialFilter && initialFilter !== 'affiliate' ? initialFilter : 'all');
  const [categoryId, setCategoryId] = useState<number | 'all'>(initialCategoryId ?? 'all');
  const [search, setSearch] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'discount'>('newest');

  React.useEffect(() => {
    setFilter(initialFilter && initialFilter !== 'affiliate' ? initialFilter : 'all');
  }, [initialFilter]);

  React.useEffect(() => {
    setCategoryId(initialCategoryId ?? 'all');
  }, [initialCategoryId]);

  React.useEffect(() => {
    setSearch(initialSearch || '');
  }, [initialSearch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (p.product_type !== 'own') return false;
      if (filter === 'discount' && p.discount_percentage <= 0 && !p.is_special_offer) return false;
      if (filter === 'new' && !p.is_new_arrival) return false;
      if (filter === 'featured' && !p.is_featured) return false;
      if (categoryId !== 'all' && p.category_id !== categoryId) return false;
      if (q) {
        const hay = `${p.name} ${p.brand} ${p.sku} ${p.product_code} ${p.category_name || ''} ${p.short_description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const priceA = toBaseUsd(a.sale_price > 0 ? a.sale_price : a.selling_price, a.currency || 'USD');
      const priceB = toBaseUsd(b.sale_price > 0 ? b.sale_price : b.selling_price, b.currency || 'USD');
      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      if (sortBy === 'discount') return b.discount_percentage - a.discount_percentage;
      return b.id - a.id;
    });
  }, [products, filter, categoryId, search, sortBy, toBaseUsd]);

  const filterTabs = [
    { id: 'all', label: t(language, 'allProducts') },
    { id: 'own', label: tr(language, 'Direct Vault', 'সরাসরি নিজস্ব ভল্ট') },
    { id: 'discount', label: t(language, 'discountProducts') },
    { id: 'new', label: t(language, 'newCollections') },
    { id: 'featured', label: t(language, 'featuredCollections') },
  ];

  const activeCategoryName =
    categoryId !== 'all'
      ? translateCategory(categories.find((c) => c.id === categoryId)?.name, language) || tr(language, 'Category', 'ক্যাটাগরি')
      : filterTabs.find((f) => f.id === filter)?.label || t(language, 'allProducts');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-zinc-100">
      <div className="border-b border-zinc-800 pb-6 mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
            {tr(language, 'SHOPNEXA ROBI HUB CATALOG', 'SHOPNEXA ROBI HUB পণ্যের ক্যাটালগ')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
            {activeCategoryName}
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono tabular-nums">
            {tr(
              language,
              `Showing ${filtered.length} product${filtered.length === 1 ? '' : 's'}`,
              `মোট ${filtered.length}টি পণ্য দেখানো হচ্ছে`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr(language, 'Filter by keyword, brand, SKU...', 'নাম, ব্র্যান্ড বা SKU দিয়ে খুঁজুন...')}
              className="bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-400 pl-9 pr-3 py-2 text-xs w-60 focus:border-[#C9A227] focus:outline-none"
            />
          </div>

          <select
            value={categoryId === 'all' ? 'all' : String(categoryId)}
            onChange={(e) => setCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="border border-zinc-700 px-3 py-2 text-xs bg-zinc-900 text-white focus:border-[#C9A227] focus:outline-none"
          >
            <option value="all" className="bg-zinc-950 text-white">
              {tr(language, `All Categories (${categories.length})`, `সকল ক্যাটাগরি (${categories.length})`)}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-950 text-white">
                {translateCategory(c.name, language)}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 border border-zinc-700 px-3 py-2 bg-zinc-900">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#E4C76B]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-transparent text-white focus:outline-none"
            >
              <option value="newest" className="bg-zinc-950 text-white">
                {tr(language, 'Newest First', 'সর্বশেষ আপলোড আগে')}
              </option>
              <option value="price-asc" className="bg-zinc-950 text-white">
                {tr(language, 'Price: Low to High', 'দাম: কম থেকে বেশি')}
              </option>
              <option value="price-desc" className="bg-zinc-950 text-white">
                {tr(language, 'Price: High to Low', 'দাম: বেশি থেকে কম')}
              </option>
              <option value="discount" className="bg-zinc-950 text-white">
                {tr(language, 'Highest Discount', 'সর্বোচ্চ ছাড়')}
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-[#C9A227] text-black'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-[#C9A227] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {(categoryId !== 'all' || search) && (
          <button
            type="button"
            onClick={() => {
              setCategoryId('all');
              setSearch('');
              setFilter('all');
            }}
            className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-[#E4C76B] flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>{tr(language, 'Reset Filters', 'ফিল্টার রিসেট করুন')}</span>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-zinc-800 bg-zinc-900 p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-white">
            {tr(language, 'No matching products found', 'কোনো মিল থাকা পণ্য পাওয়া যায়নি')}
          </p>
          <p className="text-xs text-zinc-300">
            {tr(language, 'Try clearing your search query or switching to All Categories.', 'সার্চ বক্স খালি করুন বা সকল ক্যাটাগরি নির্বাচন করুন।')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      )}
    </div>
  );
}
