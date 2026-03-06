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

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface Order {
  order_id: string;
  status: string;
  delivery_address?: DeliveryAddress;
  district?: string;
  priority?: string;
  created_at?: string;
  total_price?: number;
  totalAmount?: number;
  customer_name?: string;
  customer_phone?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  'ready-to-deliver': { label: 'Ready to Deliver', bg: '#f3e8ff', text: '#6b21a8', icon: 'inventory_2' },
  accepted:           { label: 'Accepted',          bg: '#ccfbf1', text: '#115e59', icon: 'check_circle' },
  'on-delivery':      { label: 'On Delivery',       bg: '#ffedd5', text: '#9a3412', icon: 'local_shipping' },
  delivered:          { label: 'Delivered',          bg: '#dcfce7', text: '#166534', icon: 'done_all' },
  cancelled:          { label: 'Cancelled',          bg: '#fee2e2', text: '#991b1b', icon: 'cancel' },
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
  const [updating, setUpdating] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.orders, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const arr: Order[] = Array.isArray(data) ? data : data.orders || [];
      setOrders(arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAction = useCallback(async (order_id: string, action: string) => {
    setUpdating(order_id);
    setMsg(null);
    try {
      let endpoint = '';
      if (action === 'accept')       endpoint = ENDPOINTS.acceptOrder;
      else if (action === 'on_delivery') endpoint = ENDPOINTS.onDelivery;
      else if (action === 'deliver') endpoint = ENDPOINTS.deliver;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id, driver_id: user?.driver_id || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || data.message || `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: 'Order updated successfully!' });
      fetchOrders();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally { setUpdating(null); }
  }, [token, user?.driver_id, fetchOrders]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const pending   = orders.filter(o => o.status === 'ready-to-deliver').length;
  const accepted  = orders.filter(o => o.status === 'accepted').length;
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
            { label: 'Pending',   value: pending,   color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Accepted',  value: accepted,  color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Active',    value: active,    color: '#0d9488', bg: '#f0fdfa' },
            { label: 'Delivered', value: delivered, color: '#16a34a', bg: '#f0fdf4' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, borderRadius: 16, padding: '12px 6px', textAlign: 'center',
              background: s.bg,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
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

        {msg && (
          <div style={{
            background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
            color: msg.type === 'ok' ? '#166534' : '#dc2626',
            borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{msg.text}</span>
            <span onClick={() => setMsg(null)} style={{ cursor: 'pointer', fontSize: 16, marginLeft: 8 }}>✕</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
        ) : orders.filter(o => ['accepted', 'on-delivery', 'delivered'].includes(o.status)).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="material-icons-round" style={{ fontSize: 44, color: '#94a3b8', marginBottom: 12, display: 'block' }}>inbox</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No accepted orders yet</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Accept an order to see it here</div>
          </div>
        ) : (
          orders.filter(o => ['accepted', 'on-delivery', 'delivered'].includes(o.status)).slice(0, 6).map(order => {
            const sc = STATUS_CONFIG[order.status] ?? { label: order.status, bg: '#f1f5f9', text: '#64748b', icon: 'circle' };
            const pc = order.priority ? PRIORITY_COLOR[order.priority] : null;
            const amount = order.totalAmount ?? order.total_price;
            const addr = getAddressStr(order.delivery_address) || order.district || '—';

            return (
              <div key={order.order_id} style={{
                background: '#fff', borderRadius: 18, marginBottom: 12,
                border: '1px solid #f1f5f9', overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {/* Top strip by status colour */}
                <div style={{ height: 4, background: sc.text, opacity: 0.25 }} />

                <div style={{ padding: '12px 14px' }}>
                  {/* Row 1: order id + status badge + time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-icons-round" style={{ fontSize: 15, color: sc.text }}>{sc.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>#{order.order_id?.slice(-8)}</span>
                      {pc && (
                        <span style={{
                          background: pc.bg, color: pc.text,
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'capitalize',
                        }}>{order.priority}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: sc.bg, color: sc.text,
                        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      }}>{sc.label}</span>
                    </div>
                  </div>

                  {/* Row 2: address */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                    <span className="material-icons-round" style={{ fontSize: 13, color: '#94a3b8', marginTop: 1, flexShrink: 0 }}>location_on</span>
                    <span style={{ fontSize: 12, color: '#64748b', lineHeight: '17px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {addr}
                    </span>
                  </div>

                  {/* Row 3: customer name + amount + time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {order.customer_name && (
                        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
                          <span className="material-icons-round" style={{ fontSize: 12, verticalAlign: 'middle' }}>person</span> {order.customer_name}
                        </span>
                      )}
                      {amount != null && amount > 0 && (
                        <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 700 }}>
                          LKR {Number(amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {order.created_at && (
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(order.created_at)}</span>
                    )}
                  </div>

                  {/* Action button */}
                  {order.status === 'ready-to-deliver' && (
                    <button disabled={updating === order.order_id}
                      onClick={() => handleAction(order.order_id, 'accept')}
                      style={actionBtnStyle('#7c3aed', updating === order.order_id)}>
                      {updating === order.order_id ? 'Updating…' : '✓ Accept Order'}
                    </button>
                  )}
                  {order.status === 'accepted' && (
                    <button disabled={updating === order.order_id}
                      onClick={() => handleAction(order.order_id, 'on_delivery')}
                      style={actionBtnStyle('#ea580c', updating === order.order_id)}>
                      {updating === order.order_id ? 'Updating…' : '🚚 Start Delivery'}
                    </button>
                  )}
                  {order.status === 'on-delivery' && (
                    <button disabled={updating === order.order_id}
                      onClick={() => handleAction(order.order_id, 'deliver')}
                      style={actionBtnStyle('#16a34a', updating === order.order_id)}>
                      {updating === order.order_id ? 'Updating…' : '✅ Mark Delivered'}
                    </button>
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

function actionBtnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    width: '100%', background: color, color: '#fff', border: 'none',
    borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
    marginTop: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
