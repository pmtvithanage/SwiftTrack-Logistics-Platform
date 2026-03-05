import React, { useEffect, useState, useCallback } from 'react';
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
  total_price?: number;
  customer_id?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  created_at?: string;
}

const STATUS_FLOW = ['ready-to-deliver', 'accepted', 'on-delivery', 'delivered'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'ready-to-deliver': { label: 'Ready to Deliver', bg: '#f3e8ff', text: '#6b21a8' },
  accepted:           { label: 'Accepted',         bg: '#ccfbf1', text: '#115e59' },
  'on-delivery':      { label: 'On Delivery',      bg: '#ffedd5', text: '#9a3412' },
  delivered:          { label: 'Delivered',         bg: '#dcfce7', text: '#166534' },
  cancelled:          { label: 'Cancelled',         bg: '#fee2e2', text: '#991b1b' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#fee2e2', text: '#dc2626' },
  medium: { bg: '#fefce8', text: '#ca8a04' },
  low:    { bg: '#f0fdf4', text: '#16a34a' },
};

export default function Orders() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.orders, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const arr: Order[] = Array.isArray(data) ? data : data.orders || [];
      setOrders(arr.sort((a, b) => STATUS_FLOW.indexOf(a.status) - STATUS_FLOW.indexOf(b.status)));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAction = async (order: Order, action: string) => {
    setUpdating(order.order_id);
    setMsg(null);
    try {
      let endpoint = '';
      const body: Record<string, string> = { order_id: order.order_id, driver_id: user?.driver_id || '' };

      if (action === 'accept')      endpoint = ENDPOINTS.acceptOrder;
      else if (action === 'on_delivery') endpoint = ENDPOINTS.onDelivery;
      else if (action === 'deliver') endpoint = ENDPOINTS.deliver;

      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || data.message || `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: 'Order status updated!' });
      fetchOrders();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally { setUpdating(null); }
  };

  return (
    <div>
      <div style={{ background: '#fff', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>My Orders</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{orders.length} total</div>
      </div>

      <div style={{ padding: 16 }}>
        {msg && (
          <div style={{
            background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
            color: msg.type === 'ok' ? '#166534' : '#dc2626',
            borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 12,
          }}>{msg.text}</div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="material-icons-round" style={{ fontSize: 44, color: '#94a3b8', marginBottom: 12, display: 'block' }}>inbox</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No orders assigned</div>
          </div>
        ) : (
          orders.map(order => {
            const sc = STATUS_CONFIG[order.status] ?? { label: order.status, bg: '#f1f5f9', text: '#64748b' };
            const pc = order.priority ? PRIORITY_COLORS[order.priority] : null;
            const isExpanded = expandedId === order.order_id;

            return (
              <div key={order.order_id} style={{
                background: '#fff', borderRadius: 18, marginBottom: 10,
                border: '1px solid #f1f5f9', overflow: 'hidden',
              }}>
                {/* Header row */}
                <div onClick={() => setExpandedId(isExpanded ? null : order.order_id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: 16, cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Order #{order.order_id?.slice(-8)}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getAddressStr(order.delivery_address) || order.district || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', background: sc.bg, color: sc.text,
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    }}>{sc.label}</span>
                    {pc && (
                      <span style={{
                        display: 'block', background: pc.bg, color: pc.text,
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, marginTop: 4,
                        textTransform: 'capitalize',
                      }}>{order.priority}!</span>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f8fafc' }}>
                    {order.customer_id && <InfoRow label="Customer ID" value={order.customer_id} />}
                    {order.district && <InfoRow label="District" value={order.district} />}
                    {order.total_price != null && <InfoRow label="Total" value={`Rs. ${Number(order.total_price).toFixed(2)}`} />}

                    {order.items && order.items.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Items</div>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                            <span>{item.name} ×{item.quantity}</span>
                            <span>Rs. {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {order.status === 'ready-to-deliver' && (
                      <ActionBtn label="Accept Order" color="#7c3aed" loading={updating === order.order_id}
                        onClick={() => handleAction(order, 'accept')} />
                    )}
                    {order.status === 'accepted' && (
                      <ActionBtn label="Start Delivery" color="#ea580c" loading={updating === order.order_id}
                        onClick={() => handleAction(order, 'on_delivery')} />
                    )}
                    {order.status === 'on-delivery' && (
                      <ActionBtn label="Mark Delivered" color="#16a34a" loading={updating === order.order_id}
                        onClick={() => handleAction(order, 'deliver')} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#94a3b8', width: 90 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }: {
  label: string; color: string; loading: boolean; onClick: () => void;
}) {
  return (
    <button disabled={loading} onClick={onClick} style={{
      width: '100%', background: color, color: '#fff', border: 'none',
      borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700,
      marginTop: 12, cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.6 : 1, boxShadow: `0 3px 8px ${color}44`,
    }}>
      {loading ? 'Updating…' : label}
    </button>
  );
}
