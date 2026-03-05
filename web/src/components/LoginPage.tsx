import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Login failed');
      if (data.user?.role !== 'customer') {
        throw new Error('This portal is for customers only. Please use the driver app.');
      }
      login(data.token, {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.name,
        role: data.user.role,
        customer_id: data.user.customer_id,
        phone: data.user.phone,
        address: data.user.address,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 text-white flex-col justify-center px-16">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><span className="material-icons-round" style={{ fontSize: 22 }}>local_shipping</span></div>
            <span className="text-2xl font-bold">SwiftTrack</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Fast & Reliable<br />Logistics Platform
          </h1>
          <p className="text-teal-200 text-lg">
            Order products, track deliveries in real-time, and manage your shipments all in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: 'inventory_2', label: 'Track Orders', desc: 'Real-time tracking' },
            { icon: 'bolt', label: 'Fast Delivery', desc: 'Optimized routes' },
            { icon: 'shopping_cart', label: 'Easy Shopping', desc: 'Wide product range' },
            { icon: 'notifications', label: 'Notifications', desc: 'Stay updated' },
          ].map(f => (
            <div key={f.label} className="bg-white/10 rounded-xl p-4">
              <span className="material-icons-round" style={{ fontSize: 24, marginBottom: 4, display: 'block' }}>{f.icon}</span>
              <div className="font-semibold">{f.label}</div>
              <div className="text-teal-200 text-sm">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center text-white"><span className="material-icons-round" style={{ fontSize: 20 }}>local_shipping</span></div>
            <span className="text-xl font-bold text-slate-900">SwiftTrack</span>
          </div>

          <div className="card">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-slate-500 mb-7">Sign in to your account</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email address</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="input"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  className="input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Don't have an account?{' '}
              <Link to="/signup" className="text-teal-600 font-medium hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
