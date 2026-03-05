import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { user, token } = useAuth();
  const { items, totalPrice, removeFromCart, updateQuantity, clearCart } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState(user?.address || '');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePlaceOrder = async () => {
    if (!address.trim()) { setError('Please enter a delivery address'); return; }
    if (!user?.customer_id) { setError('Customer ID missing. Please re-login.'); return; }
    setPlacing(true);
    setError('');
    try {
      // Generate unique order ID
      const order_id = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const res = await fetch('/cms/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order_id: order_id,
          customer_id: user.customer_id,
          delivery_address: address,
          items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
          totalAmount: totalPrice,
          priority: 'low',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to place order');
      setSuccess(`Order placed successfully! Order ID: ${data.order_id || order_id}`);
      clearCart();
      setTimeout(() => navigate('/orders'), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-16 card text-center py-12">
        <div className="mb-4"><span className="material-icons-round" style={{ fontSize: 64, color: "#0d9488" }}>check_circle</span></div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Order Placed!</h2>
        <p className="text-slate-500 text-sm">{success}</p>
        <p className="text-slate-400 text-xs mt-2">Redirecting to orders…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-16 card text-center py-12">
        <div className="mb-4"><span className="material-icons-round" style={{ fontSize: 64, color: "#cbd5e1" }}>shopping_cart</span></div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
        <p className="text-slate-500 mb-6">Add some products to your cart to get started.</p>
        <Link to="/dashboard" className="btn-primary">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your Cart</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => (
            <div key={item._id} className="card flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" /> : <span className="material-icons-round text-2xl text-slate-300">inventory_2</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{item.name}</p>
                <p className="text-sm text-slate-500">Rs. {item.price.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item._id, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-bold flex items-center justify-center text-sm"
                >−</button>
                <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item._id, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-bold flex items-center justify-center text-sm"
                >+</button>
              </div>
              <span className="font-semibold text-slate-900 text-sm w-20 text-right">
                Rs. {(item.price * item.quantity).toFixed(2)}
              </span>
              <button
                onClick={() => removeFromCart(item._id)}
                className="text-slate-300 hover:text-red-400 transition-colors ml-1"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm text-slate-600 mb-4">
              <div className="flex justify-between">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>Rs. {totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
                <span>Total</span>
                <span>Rs. {totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Delivery address</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Enter full delivery address"
                value={address}
                onChange={e => { setAddress(e.target.value); setError(''); }}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm mb-3">
                {error}
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="btn-primary w-full"
            >
              {placing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing order…
                </span>
              ) : 'Place Order'}
            </button>
          </div>

          <button onClick={clearCart} className="btn-secondary w-full text-sm">
            Clear cart
          </button>
        </div>
      </div>
    </div>
  );
}
