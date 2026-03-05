import React, { useEffect, useState } from 'react';

interface Offer {
  _id: string;
  title: string;
  description?: string;
  discountPercent: number;
  status: string;
  startDate?: string;
  endDate?: string;
  image?: string;
}

const GRADIENT_PAIRS = [
  'from-teal-500 to-teal-700',
  'from-purple-500 to-pink-600',
  'from-green-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-cyan-500 to-teal-600',
  'from-rose-500 to-pink-600',
];

export default function PromotionsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/products/offers');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load promotions');
        setOffers(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = offers.filter(o => o.status === 'active');
  const inactive = offers.filter(o => o.status !== 'active');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Promotions & Offers</h1>
        <p className="text-slate-500">Exclusive deals and discounts just for you</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-48 bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <div className="mb-3"><span className="material-icons-round" style={{ fontSize: 48, color: "#f59e0b" }}>warning</span></div>
          <p className="text-slate-600">{error}</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="card text-center py-16">
          <div className="mb-4"><span className="material-icons-round" style={{ fontSize: 56, color: "#cbd5e1" }}>card_giftcard</span></div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No promotions right now</h2>
          <p className="text-slate-500">Check back soon for exclusive deals!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <h2 className="font-semibold text-slate-900">Active Offers</h2>
                <span className="badge bg-green-100 text-green-700">{active.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {active.map((offer, i) => (
                  <div
                    key={offer._id}
                    className="relative rounded-2xl text-white overflow-hidden"
                    style={{ minHeight: '13rem' }}
                  >
                    {/* Background image or gradient */}
                    {offer.image ? (
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT_PAIRS[i % GRADIENT_PAIRS.length]}`} />
                    )}
                    {/* Dark overlay for readability */}
                    <div className={`absolute inset-0 ${offer.image ? 'bg-gradient-to-t from-black/75 via-black/35 to-transparent' : ''}`} />
                    {/* Decorative circles (no-image only) */}
                    {!offer.image && (
                      <>
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
                        <div className="absolute -right-2 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />
                      </>
                    )}
                    <div className="relative p-6 flex flex-col justify-end" style={{ minHeight: '13rem' }}>
                      <div className="text-4xl font-black mb-1">{offer.discountPercent}% OFF</div>
                      <h3 className="text-lg font-bold mb-1">{offer.title}</h3>
                      {offer.description && (
                        <p className="text-white/80 text-sm line-clamp-2">{offer.description}</p>
                      )}
                      {offer.endDate && (
                        <div className="mt-3 flex items-center gap-1.5 text-white/70 text-xs">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Ends {new Date(offer.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section>
              <h2 className="font-semibold text-slate-500 mb-4 text-sm uppercase tracking-wider">Past Offers</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {inactive.map(offer => (
                  <div key={offer._id} className="card opacity-60 overflow-hidden !p-0">
                    {offer.image && (
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-32 object-cover grayscale"
                      />
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-3xl font-black text-slate-400">{offer.discountPercent}% OFF</span>
                        <span className="badge bg-slate-100 text-slate-500">Expired</span>
                      </div>
                      <h3 className="font-semibold text-slate-700">{offer.title}</h3>
                      {offer.description && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{offer.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
