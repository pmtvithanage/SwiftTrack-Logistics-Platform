import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../api';

type DeliveryAddress = string | { address: string; latitude?: number; longitude?: number };

function getAddressStr(addr?: DeliveryAddress): string {
  if (!addr) return '';
  if (typeof addr === 'object') return addr.address || '';
  return addr;
}

interface Order {
  order_id: string;
  status: string;
  delivery_address?: DeliveryAddress;
  district?: string;
  priority?: string;
  created_at?: string;
  total_price?: number;
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  'ready-to-deliver': { bg: '#f3e8ff', text: '#6b21a8' },
  accepted:     { bg: '#ccfbf1', text: '#115e59' },
  'on-delivery':{ bg: '#ffedd5', text: '#9a3412' },
  delivered:    { bg: '#dcfce7', text: '#166534' },
  cancelled:    { bg: '#fee2e2', text: '#991b1b' },
};

const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#fee2e2', text: '#dc2626' },
  medium: { bg: '#fef9c3', text: '#ca8a04' },
  low:    { bg: '#dcfce7', text: '#16a34a' },
};

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.orders, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const pending   = orders.filter(o => o.status === 'ready-to-deliver').length;
  const active    = orders.filter(o => o.status === 'on-delivery').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', background: '#fff', borderBottom: '1px solid #f1f5f9',
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Good day,</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{user?.name ?? 'Driver'}</div>
        </div>
        <button onClick={handleLogout} style={{
          background: '#fee2e2', border: 'none', borderRadius: 10,
          padding: '8px 14px', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>Logout</button>
      </div>

      <div style={{ padding: 20 }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Pending', value: pending, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Active', value: active, color: '#0d9488', bg: '#f0fdfa' },
            { label: 'Delivered', value: delivered, color: '#16a34a', bg: '#f0fdf4' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, borderRadius: 16, padding: 14, textAlign: 'center',
              background: s.bg,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { icon: 'map', label: 'My Route', path: '/route' },
            { icon: 'inventory_2', label: 'Orders', path: '/orders' },
            { icon: 'notifications', label: 'Alerts', path: '/notifications' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={{
              flex: 1, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16,
              padding: 16, textAlign: 'center', cursor: 'pointer',
            }}>
              <span className="material-icons-round" style={{ fontSize: 28, marginBottom: 6, color: '#475569', display: 'block' }}>{a.icon}</span>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{a.label}</div>
            </button>
          ))}
        </div>

        {/* Recent orders */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Recent Orders</span>
          <button onClick={() => navigate('/orders')} style={{
            background: 'none', border: 'none', color: '#0d9488', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>See all</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="material-icons-round" style={{ fontSize: 44, color: '#94a3b8', marginBottom: 12, display: 'block' }}>inbox</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No orders yet</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>New orders will appear here</div>
          </div>
        ) : (
          orders.slice(0, 5).map(order => {
            const sc = STATUS_COLOR[order.status] ?? { bg: '#f1f5f9', text: '#64748b' };
            const pc = order.priority ? PRIORITY_COLOR[order.priority] : null;
            return (
              <div key={order.order_id} onClick={() => navigate('/orders')}
                style={{
                  background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  border: '1px solid #f1f5f9', cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, marginRight: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>#{order.order_id?.slice(-6)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getAddressStr(order.delivery_address) || order.district || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-block', background: sc.bg, color: sc.text,
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    textTransform: 'capitalize',
                  }}>{order.status}</span>
                  {pc && (
                    <span style={{
                      display: 'block', background: pc.bg, color: pc.text,
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      marginTop: 4, textTransform: 'capitalize',
                    }}>{order.priority}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
