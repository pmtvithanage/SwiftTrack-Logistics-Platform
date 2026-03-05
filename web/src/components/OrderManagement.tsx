import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../App';

interface Order {
  order_id: string;
  customer_id: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  total_price?: number;
  delivery_address?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  driver_id?: string;
  district?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; step: number }> = {
  pending:      { label: 'Order Placed',    color: 'bg-yellow-100 text-yellow-700',  icon: 'schedule', step: 0 },
  processing:   { label: 'Processing',      color: 'bg-teal-100 text-teal-700',      icon: 'settings',  step: 1 },
  ready:        { label: 'Ready',           color: 'bg-purple-100 text-purple-700',  icon: 'inventory_2', step: 2 },
  on_delivery:  { label: 'On Delivery',     color: 'bg-orange-100 text-orange-700',  icon: 'local_shipping', step: 3 },
  delivered:    { label: 'Delivered',       color: 'bg-green-100 text-green-700',    icon: 'check_circle', step: 4 },
  cancelled:    { label: 'Cancelled',       color: 'bg-red-100 text-red-700',        icon: 'cancel', step: -1 },
};

const STEPS = ['pending', 'processing', 'ready', 'on_delivery', 'delivered'];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-slate-100 text-slate-600', icon: '•', step: 0 };
  return (
    <span className={`badge ${cfg.color}`}>
      <span className="material-icons-round" style={{ fontSize: 14, lineHeight: 1, verticalAlign: "middle" }}>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

function OrderTimeline({ status }: { status: string }) {
  const currentStep = STATUS_CONFIG[status]?.step ?? 0;
  if (status === 'cancelled') return null;
  return (
    <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const cfg = STATUS_CONFIG[s];
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <React.Fragment key={s}>
            <div className={`flex flex-col items-center flex-shrink-0 ${isCurrent ? 'opacity-100' : isCompleted ? 'opacity-70' : 'opacity-30'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 ${
                isCompleted ? 'bg-teal-600 border-teal-600 text-white' :
                isCurrent ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white'
              }`}>
                {isCompleted ? <span className="material-icons-round" style={{ fontSize: 14 }}>check</span> : <span className="material-icons-round" style={{ fontSize: 14 }}>{cfg.icon}</span>}
              </div>
              <span className="text-xs text-slate-500 mt-1 whitespace-nowrap">{cfg.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 min-w-[20px] ${i < currentStep ? 'bg-teal-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function OrderManagement() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user?.customer_id) {
      setError('No customer ID found. Please re-login.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/cms/orders/${user.customer_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders');
      const arr = Array.isArray(data) ? data : data.orders || [];
      // Sort newest first
      setOrders(arr.sort((a: Order, b: Order) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.customer_id, token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-900">My Orders</h1>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-slate-200 rounded-xl" />
              <div className="flex-1">
                <div className="h-4 bg-slate-200 rounded-full w-1/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded-full w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <div className="mb-3"><span className="material-icons-round" style={{ fontSize: 48, color: "#f59e0b" }}>warning</span></div>
        <p className="text-slate-600 mb-4">{error}</p>
        <button onClick={fetchOrders} className="btn-primary">Try again</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          My Orders <span className="text-slate-400 font-normal text-base">({orders.length})</span>
        </h1>
        <button onClick={fetchOrders} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 20v-5h-.581M5.032 9A9 9 0 1120 15" />
          </svg>
          Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center py-16">
          <div className="mb-4"><span className="material-icons-round" style={{ fontSize: 56, color: "#cbd5e1" }}>inbox</span></div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h2>
          <p className="text-slate-500 mb-6">Your orders will appear here once you start shopping.</p>
          <a href="/dashboard" className="btn-primary">Browse products</a>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const isExpanded = expandedId === order.order_id;
            const date = order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            }) : '—';
            return (
              <div key={order.order_id} className="card">
                {/* Header row */}
                <div
                  className="flex items-start justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.order_id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="material-icons-round" style={{ fontSize: 22 }}>{STATUS_CONFIG[order.status]?.icon ?? 'inventory_2'}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">
                          Order #{order.order_id?.slice(-8) ?? order.order_id}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {order.total_price != null && (
                      <span className="font-bold text-slate-900">Rs. {Number(order.total_price).toFixed(2)}</span>
                    )}
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Timeline */}
                <OrderTimeline status={order.status} />

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    {order.delivery_address && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-slate-400 w-28 flex-shrink-0">Delivery to</span>
                        <span className="text-slate-700">{order.delivery_address}</span>
                      </div>
                    )}
                    {order.district && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-slate-400 w-28 flex-shrink-0">District</span>
                        <span className="text-slate-700">{order.district}</span>
                      </div>
                    )}
                    {order.driver_id && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-slate-400 w-28 flex-shrink-0">Driver ID</span>
                        <span className="text-slate-700 font-mono text-xs">{order.driver_id}</span>
                      </div>
                    )}
                    {order.items && order.items.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">Items</p>
                        <div className="space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                              <span>{item.name} × {item.quantity}</span>
                              <span className="font-medium">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
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
}
