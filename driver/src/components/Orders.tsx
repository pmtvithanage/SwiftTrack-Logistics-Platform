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
  totalAmount?: number;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  created_at?: string;
}

const STATUS_SECTIONS: Array<{ key: string; label: string; color: string; bg: string; icon: string }> = [
  { key: 'ready-to-deliver', label: 'Ready to Deliver', color: '#6b21a8', bg: '#f3e8ff', icon: 'inventory_2' },
  { key: 'accepted',         label: 'Accepted',         color: '#115e59', bg: '#ccfbf1', icon: 'check_circle' },
  { key: 'on-delivery',      label: 'On Delivery',      color: '#9a3412', bg: '#ffedd5', icon: 'local_shipping' },
  { key: 'delivered',        label: 'Delivered',         color: '#166534', bg: '#dcfce7', icon: 'done_all' },
  { key: 'cancelled',        label: 'Cancelled',         color: '#991b1b', bg: '#fee2e2', icon: 'cancel' },
];

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
  const [openSection, setOpenSection] = useState<string | null>('ready-to-deliver');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.orders, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const arr: Order[] = Array.isArray(data) ? data : data.orders || [];
      setOrders(arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAction = async (order: Order, action: string) => {
    setUpdating(order.order_id);
    setMsg(null);
    try {
      let endpoint = '';
      if (action === 'accept')           endpoint = ENDPOINTS.acceptOrder;
      else if (action === 'on_delivery') endpoint = ENDPOINTS.onDelivery;
      else if (action === 'deliver')     endpoint = ENDPOINTS.deliver;
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: order.order_id, driver_id: user?.driver_id || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || data.message || `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: 'Order status updated!' });
      fetchOrders();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally { setUpdating(null); }
  };

  const toggleSection = (key: string) =>
    setOpenSection(prev => (prev === key ? null : key));

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
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{msg.text}</span>
            <span onClick={() => setMsg(null)} style={{ cursor: 'pointer', fontSize: 16, marginLeft: 8 }}>✕</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="material-icons-round" style={{ fontSize: 44, color: '#94a3b8', marginBottom: 12, display: 'block' }}>inbox</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No orders assigned</div>
          </div>
        ) : (
          STATUS_SECTIONS.map(section => {
            const sectionOrders = orders.filter(o => o.status === section.key);
            if (sectionOrders.length === 0) return null;
            const isCollapsed = openSection !== section.key;

            return (
              <div key={section.key} style={{ marginBottom: 16 }}>
                {/* Section header */}
                <div
                  onClick={() => toggleSection(section.key)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: section.bg, borderRadius: isCollapsed ? 14 : '14px 14px 0 0',
                    padding: '11px 14px', cursor: 'pointer',
                    border: `1px solid ${section.color}22`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons-round" style={{ fontSize: 18, color: section.color }}>{section.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: section.color }}>{section.label}</span>
                    <span style={{
                      background: section.color, color: '#fff',
                      fontSize: 11, fontWeight: 700, borderRadius: 20,
                      padding: '1px 8px', minWidth: 22, textAlign: 'center',
                    }}>{sectionOrders.length}</span>
                  </div>
                  <span className="material-icons-round" style={{ fontSize: 20, color: section.color, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                    expand_more
                  </span>
                </div>

                {/* Section orders */}
                {!isCollapsed && (
                  <div style={{
                    border: `1px solid ${section.color}22`, borderTop: 'none',
                    borderRadius: '0 0 14px 14px', overflow: 'hidden',
                    background: '#fafafa',
                  }}>
                    {sectionOrders.map((order, idx) => {
                      const pc = order.priority ? PRIORITY_COLORS[order.priority] : null;
                      const isExpanded = expandedId === order.order_id;
                      const amount = order.totalAmount ?? order.total_price;
                      const isLast = idx === sectionOrders.length - 1;

                      return (
                        <div key={order.order_id} style={{
                          background: '#fff',
                          borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                        }}>
                          {/* Order header row */}
                          <div
                            onClick={() => setExpandedId(isExpanded ? null : order.order_id)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '12px 14px', cursor: 'pointer',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                #{order.order_id?.slice(-8)}
                                {pc && (
                                  <span style={{
                                    marginLeft: 6, background: pc.bg, color: pc.text,
                                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'capitalize',
                                  }}>{order.priority}</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getAddressStr(order.delivery_address) || order.district || '—'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {amount != null && amount > 0 && (
                                <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 700 }}>LKR {Number(amount).toLocaleString()}</span>
                              )}
                              <span className="material-icons-round" style={{ fontSize: 18, color: '#94a3b8', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                expand_more
                              </span>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f8fafc' }}>
                              {order.customer_name && <InfoRow label="Customer" value={order.customer_name} />}
                              {order.customer_phone && <InfoRow label="Phone" value={order.customer_phone} />}
                              {order.customer_id && <InfoRow label="Customer ID" value={order.customer_id} />}
                              {order.district && <InfoRow label="District" value={order.district} />}
                              {amount != null && <InfoRow label="Total" value={`LKR ${Number(amount).toLocaleString()}`} />}

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

                              {order.status === 'ready-to-deliver' && (
                                <ActionBtn label="Accept Order" color="#7c3aed" loading={updating === order.order_id}
                                  onClick={() => handleAction(order, 'accept')} />
                              )}
                              {order.status === 'accepted' && (
                                <ActionBtn label="🚚 Start Delivery" color="#ea580c" loading={updating === order.order_id}
                                  onClick={() => handleAction(order, 'on_delivery')} />
                              )}
                              {order.status === 'on-delivery' && (
                                <ActionBtn label="✅ Mark Delivered" color="#16a34a" loading={updating === order.order_id}
                                  onClick={() => handleAction(order, 'deliver')} />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
    <div style={{ display: 'flex', marginBottom: 6, marginTop: 6 }}>
      <span style={{ fontSize: 12, color: '#94a3b8', width: 96, flexShrink: 0 }}>{label}</span>
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
