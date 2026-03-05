import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(ENDPOINTS.login, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Login failed');
      if (data.user?.role !== 'driver') throw new Error('This portal is for drivers only.');
      login(data.token, {
        id: data.user.id, email: data.user.email, name: data.user.name,
        role: data.user.role, driver_id: data.user.driver_id, phone: data.user.phone,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero half */}
      <div style={{
        background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
        padding: '48px 24px 40px', color: '#fff', textAlign: 'center',
      }}>
        <span className="material-icons-round" style={{ fontSize: 52, marginBottom: 8, display: 'block', color: '#fff' }}>local_shipping</span>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>SwiftTrack</h1>
        <p style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>Driver Portal</p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 20px', background: '#f8fafc' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 28,
            boxShadow: '0 4px 24px rgba(15,23,42,.06)',
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Welcome back</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>Sign in to your driver account</p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <label style={labelStyle}>Email address</label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="driver@example.com" style={inputStyle} autoComplete="email" />

              <label style={{ ...labelStyle, marginTop: 16 }}>Password</label>
              <input type="password" value={form.password} onChange={set('password')}
                placeholder="••••••••" style={inputStyle} />

              <button type="submit" disabled={loading} style={{
                ...btnStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#64748b' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 14,
  padding: '13px 16px', fontSize: 15, color: '#0f172a', background: '#f8fafc',
  outline: 'none', boxSizing: 'border-box',
};
const btnStyle: React.CSSProperties = {
  width: '100%', background: '#0d9488', color: '#fff', border: 'none',
  borderRadius: 14, padding: '15px 0', fontSize: 16, fontWeight: 700,
  marginTop: 20, boxShadow: '0 4px 12px rgba(13,148,136,.3)',
};
