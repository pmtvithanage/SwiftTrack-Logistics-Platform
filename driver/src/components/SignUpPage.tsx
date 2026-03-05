import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../api';

export default function SignUpPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(ENDPOINTS.signup, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'driver' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Signup failed');
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
      <div style={{
        background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
        padding: '36px 24px 32px', color: '#fff', textAlign: 'center',
      }}>
        <span className="material-icons-round" style={{ fontSize: 44, marginBottom: 6, display: 'block', color: '#fff' }}>local_shipping</span>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>SwiftTrack</h1>
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Join as a driver</p>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '28px 20px', background: '#f8fafc' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(15,23,42,.06)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Create driver account</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>Fill in your details to get started</p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              {([
                { key: 'name', label: 'Full name', type: 'text', placeholder: 'John Silva' },
                { key: 'email', label: 'Email address', type: 'email', placeholder: 'driver@example.com' },
                { key: 'phone', label: 'Phone number', type: 'tel', placeholder: '+94 77 123 4567' },
                { key: 'password', label: 'Password', type: 'password', placeholder: 'Minimum 6 characters' },
              ] as const).map((f, i) => (
                <div key={f.key} style={{ marginTop: i > 0 ? 14 : 0 }}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={set(f.key)}
                    placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}

              <button type="submit" disabled={loading} style={{
                ...btnStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: '#64748b' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
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
