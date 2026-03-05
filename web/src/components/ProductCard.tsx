import React from 'react';
import { useCart } from '../context/CartContext';

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
  discountPercent: number;
  // ties by category or product name matching
}

interface Props {
  product: Product;
  offer?: Offer | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  electronics: 'bg-purple-100 text-purple-700',
  food: 'bg-green-100 text-green-700',
  clothing: 'bg-pink-100 text-pink-700',
  books: 'bg-yellow-100 text-yellow-700',
  home: 'bg-orange-100 text-orange-700',
  default: 'bg-slate-100 text-slate-600',
};

export default function ProductCard({ product, offer }: Props) {
  const { addToCart } = useCart();
  const discountedPrice = offer ? product.price * (1 - offer.discountPercent / 100) : null;
  const catClass = CATEGORY_COLORS[product.category?.toLowerCase()] ?? CATEGORY_COLORS.default;
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  return (
    <div className="card hover:shadow-md transition-shadow flex flex-col group">
      {/* Image */}
      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100 mb-4">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300"><span className="material-icons-round text-5xl">inventory_2</span></div>
        )}
        {offer && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{offer.discountPercent}%
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-slate-500 font-semibold text-sm">Out of stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col">
        <span className={`badge ${catClass} self-start mb-2`}>{product.category}</span>
        <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 line-clamp-2">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-slate-400 mb-3 line-clamp-2">{product.description}</p>
        )}

        {/* Price */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-lg font-bold text-slate-900">
              Rs. {(discountedPrice ?? product.price).toFixed(2)}
            </span>
            {discountedPrice && (
              <span className="text-sm text-slate-400 line-through">Rs. {product.price.toFixed(2)}</span>
            )}
          </div>

          <button
            disabled={isOutOfStock}
            onClick={() => addToCart(product)}
            className={`btn-primary w-full text-sm py-2 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isOutOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
