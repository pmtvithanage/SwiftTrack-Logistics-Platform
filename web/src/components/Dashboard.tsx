import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';

interface Product {
  _id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  stock?: number;
}

interface Offer {
  _id: string;
  title: string;
  discountPercent: number;
  description?: string;
  image?: string;
  status: string;
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeOfferIdx, setActiveOfferIdx] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCategory) params.set('category', selectedCategory);

      const [prodRes, offerRes, catRes] = await Promise.all([
        fetch(`/api/products/showProducts?${params}`),
        fetch('/api/products/offers'),
        fetch('/api/products/categories'),
      ]);

      const [prodData, offerData, catData] = await Promise.all([
        prodRes.json(),
        offerRes.json(),
        catRes.json(),
      ]);

      setProducts(Array.isArray(prodData) ? prodData : prodData.products || []);
      setOffers(Array.isArray(offerData) ? offerData.filter((o: Offer) => o.status === 'active') : []);
      setCategories(Array.isArray(catData) ? catData : catData.categories || []);
    } catch {
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-advance offer banner
  useEffect(() => {
    if (offers.length <= 1) return;
    const t = setInterval(() => setActiveOfferIdx(i => (i + 1) % offers.length), 4000);
    return () => clearInterval(t);
  }, [offers.length]);

  const activeOffer = offers[activeOfferIdx];

  return (
    <div className="space-y-8">
      {/* Hero / Offer Banner */}
      {activeOffer && (
        <div className="relative rounded-2xl overflow-hidden text-white" style={{ minHeight: '11rem' }}>
          {/* Background: image or gradient */}
          {activeOffer.image ? (
            <img
              src={activeOffer.image}
              alt={activeOffer.title}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-teal-700" />
          )}
          {/* Overlay */}
          <div className={`absolute inset-0 ${activeOffer.image ? 'bg-gradient-to-r from-black/70 via-black/40 to-black/10' : 'bg-black/10'}`} />

          <div className="relative p-8 flex items-center justify-between">
            <div className="flex-1">
              <div className="inline-block bg-white/20 text-sm font-semibold px-3 py-1 rounded-full mb-3">
                Special Offer · {activeOffer.discountPercent}% OFF
              </div>
              <h2 className="text-2xl font-bold mb-2">{activeOffer.title}</h2>
              <p className="text-white/80 mb-4 max-w-md">{activeOffer.description}</p>
              <Link to="/promotions" className="inline-block bg-white text-teal-700 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-teal-50 transition-colors">
                View all offers
              </Link>
            </div>
            {/* Right side image thumbnail or icon */}
            <div className="hidden lg:block ml-8 flex-shrink-0">
              {activeOffer.image ? (
                <img
                  src={activeOffer.image}
                  alt={activeOffer.title}
                  className="w-36 h-36 object-cover rounded-2xl shadow-lg ring-2 ring-white/30"
                />
              ) : (
                <div className="flex items-center justify-center w-32 h-32 bg-white/20 rounded-2xl">
                  <span className="material-icons-round" style={{ fontSize: 64 }}>shopping_bag</span>
                </div>
              )}
            </div>
          </div>

          {/* Dots */}
          {offers.length > 1 && (
            <div className="absolute bottom-4 left-8 flex gap-2">
              {offers.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveOfferIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === activeOfferIdx ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products…"
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-48"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">
            {selectedCategory || 'All Products'}
            {!loading && <span className="ml-2 text-sm text-slate-400 font-normal">({products.length})</span>}
          </h2>
          {selectedCategory && (
            <button onClick={() => setSelectedCategory('')} className="text-sm text-teal-600 hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="w-full h-44 bg-slate-200 rounded-xl mb-4" />
                <div className="h-4 bg-slate-200 rounded-full mb-2 w-3/4" />
                <div className="h-3 bg-slate-100 rounded-full mb-4 w-1/2" />
                <div className="h-8 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <div className="mb-3"><span className="material-icons-round" style={{ fontSize: 48, color: "#f59e0b" }}>warning</span></div>
            <p className="text-slate-600 mb-4">{error}</p>
            <button onClick={fetchData} className="btn-primary">Try again</button>
          </div>
        ) : products.length === 0 ? (
          <div className="card text-center py-12">
            <div className="mb-3"><span className="material-icons-round" style={{ fontSize: 48, color: "#cbd5e1" }}>search</span></div>
            <p className="text-slate-600">No products found. Try different filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map(p => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
