import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function SignUpPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', address: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          address: form.address,
          role: 'customer',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Signup failed');
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
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-teal-600 via-teal-600 to-teal-700 text-white flex-col justify-center px-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><span className="material-icons-round" style={{ fontSize: 22 }}>local_shipping</span></div>
          <span className="text-2xl font-bold">SwiftTrack</span>
        </div>
        <h1 className="text-4xl font-bold leading-tight mb-4">
          Join thousands of<br />happy customers
        </h1>
        <p className="text-teal-100 text-lg mb-8">
          Create your free account and start ordering with fast, reliable delivery right to your doorstep.
        </p>
        <div className="space-y-3">
          {['Free account creation', 'Real-time order tracking', 'Exclusive member offers', 'Priority customer support'].map(b => (
            <div key={b} className="flex items-center gap-3 text-teal-100">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center"><span className="material-icons-round" style={{ fontSize: 12 }}>check</span></div>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md py-6">
          <div className="lg:hidden flex items-center gap-2 mb-6 justify-center">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center text-white"><span className="material-icons-round" style={{ fontSize: 20 }}>local_shipping</span></div>
            <span className="text-xl font-bold text-slate-900">SwiftTrack</span>
          </div>

          <div className="card">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Create account</h2>
            <p className="text-slate-500 mb-6">Fill in your details to get started</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Full name</label>
                <input name="name" required className="input" placeholder="John Silva" value={form.name} onChange={handleChange} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email address</label>
                <input type="email" name="email" required className="input" placeholder="you@example.com" value={form.email} onChange={handleChange} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone number</label>
                <input type="tel" name="phone" className="input" placeholder="+94 77 123 4567" value={form.phone} onChange={handleChange} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Delivery address</label>
                <input name="address" className="input" placeholder="No. 12, Main Street, Colombo 03" value={form.address} onChange={handleChange} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
                <input type="password" name="password" required className="input" placeholder="••••••••" value={form.password} onChange={handleChange} />
                <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Confirm password</label>
                <input type="password" name="confirmPassword" required className="input" placeholder="••••••••" value={form.confirmPassword} onChange={handleChange} />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : 'Create account'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-teal-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
