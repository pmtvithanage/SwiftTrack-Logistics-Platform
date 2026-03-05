import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import Orders from './components/Orders';
import RoutePage from './components/RoutePage';
import Notifications from './components/Notifications';

/* ---------- Auth guard ---------- */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: React.ReactElement }) {
  const { token } = useAuth();
  return token ? <Navigate to="/" replace /> : children;
}

/* ---------- Bottom tab bar ---------- */
const TABS = [
  { path: '/',              icon: '🏠', label: 'Home' },
  { path: '/orders',        icon: '📦', label: 'Orders' },
  { path: '/route',         icon: '🗺️', label: 'Route' },
  { path: '/notifications', icon: '🔔', label: 'Alerts' },
];

function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
      background: '#fff', borderTop: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const active = loc.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => nav(tab.path)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 0', outline: 'none',
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: active ? 800 : 500,
              color: active ? '#0d9488' : '#94a3b8',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- Main layout ---------- */
function AppLayout() {
  const { token } = useAuth();

  return (
    <>
      <div style={{ paddingBottom: token ? 72 : 0, minHeight: '100dvh', background: '#f8fafc' }}>
        <Routes>
          <Route path="/login"  element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignUpPage /></PublicOnly>} />

          <Route path="/"              element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/orders"        element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/route"         element={<RequireAuth><RoutePage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {token && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
