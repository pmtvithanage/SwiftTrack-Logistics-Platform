import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../api';

interface RouteStop {
  sequence: number;
  type: 'start' | 'pickup' | 'delivery' | 'end';
  location: string;
  address: string;
  district?: string;
  order_id?: string;
  customer_name?: string;
  customer_phone?: string;
  priority?: string;
  status?: string;
  totalAmount?: number;
  distance_from_previous?: number;
  coordinates?: { latitude: number; longitude: number };
}

interface RouteData {
  driver_id: string;
  driver_name: string;
  total_distance_km: number;
  estimated_time_minutes: number;
  total_orders: number;
  orders_to_pickup: number;
  warehouse_visit_required: boolean;
  route: RouteStop[];
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#fee2e2', text: '#dc2626' },
  medium: { bg: '#fef9c3', text: '#92400e' },
  low:    { bg: '#dcfce7', text: '#166534' },
};

const TYPE_ICON: Record<string, { icon: string; bg: string }> = {
  start:    { icon: 'my_location',       bg: '#0d9488' },
  pickup:   { icon: 'inventory_2',       bg: '#7c3aed' },
  delivery: { icon: 'local_shipping',    bg: '#0d9488' },
  end:      { icon: 'warehouse',         bg: '#475569' },
};

export default function RoutePage() {
  const { user, token } = useAuth();
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRoute = useCallback(async () => {
    if (!user?.driver_id) { setError('Driver ID not found'); setLoading(false); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(ENDPOINTS.optimizeRoute(user.driver_id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load route');
      if (data.error) throw new Error(data.error);
      setRoute(data as RouteData);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  }, [user?.driver_id, token]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  const stops = route?.route ?? [];

  return (
    <div>
      <div style={{ background: '#fff', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>My Route</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Optimized delivery path</div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <span className="material-icons-round" style={{ fontSize: 44, color: '#f59e0b', marginBottom: 10, display: 'block' }}>warning</span>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>{error}</div>
            <button onClick={fetchRoute} style={{
              background: '#0d9488', color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>Try again</button>
          </div>
        ) : !route || stops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="material-icons-round" style={{ fontSize: 52, color: '#94a3b8', marginBottom: 14, display: 'block' }}>map</span>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#475569' }}>No route yet</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Accept orders to see your optimized route</div>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px', display: 'flex',
              justifyContent: 'space-around', marginBottom: 16, border: '1px solid #e2e8f0',
            }}>
              <SummaryItem value={String(route.total_orders)} label="Orders" />
              <SummaryItem value={`${route.total_distance_km.toFixed(1)} km`} label="Total dist." />
              <SummaryItem value={`${route.estimated_time_minutes} min`} label="Est. time" />
              {route.orders_to_pickup > 0 && (
                <SummaryItem value={String(route.orders_to_pickup)} label="To pickup" />
              )}
            </div>

            {/* Route stops */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Route Stops</div>

            {stops.map((stop, idx) => {
              const pc = stop.priority ? PRIORITY_COLORS[stop.priority] : null;
              const tc = TYPE_ICON[stop.type] ?? TYPE_ICON.delivery;
              const isLast = idx === stops.length - 1;
              const displayAddr = stop.district
                ? `${stop.address || stop.district}${stop.district && stop.address && !stop.address.toLowerCase().includes(stop.district.toLowerCase()) ? ` (${stop.district})` : ''}`
                : (stop.address || '—');

              return (
                <div key={idx} style={{ display: 'flex', marginBottom: 4 }}>
                  {/* Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12, width: 30 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 15, background: tc.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span className="material-icons-round" style={{ fontSize: 16, color: '#fff' }}>{tc.icon}</span>
                    </div>
                    {!isLast && <div style={{ width: 2, flex: 1, background: '#e2e8f0', minHeight: 14, margin: '2px 0' }} />}
                  </div>

                  {/* Card */}
                  <div style={{
                    flex: 1, background: '#fff', borderRadius: 14, padding: '10px 14px',
                    marginBottom: 8, border: `1px solid ${stop.type === 'delivery' ? '#f1f5f9' : '#e0e7ff'}`,
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {stop.type === 'start' ? 'Start' : stop.type === 'pickup' ? 'Warehouse Pickup' : stop.type === 'end' ? 'Return' : `Stop #${stop.sequence}`}
                      </span>
                      {pc && stop.type === 'delivery' && (
                        <span style={{ background: pc.bg, color: pc.text, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize' }}>
                          {stop.priority}
                        </span>
                      )}
                    </div>

                    {/* Customer / location name */}
                    {stop.customer_name && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{stop.customer_name}</div>
                    )}

                    {/* Order ID */}
                    {stop.order_id && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Order #{stop.order_id.slice(-10)}</div>
                    )}

                    {/* Address */}
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: '16px' }}>{displayAddr}</div>

                    {/* Phone + amount row */}
                    {(stop.customer_phone || stop.totalAmount) && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                        {stop.customer_phone && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            <span className="material-icons-round" style={{ fontSize: 12, verticalAlign: 'middle' }}>phone</span> {stop.customer_phone}
                          </span>
                        )}
                        {stop.totalAmount && stop.totalAmount > 0 && (
                          <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 700 }}>
                            LKR {stop.totalAmount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Distance from previous */}
                    {stop.distance_from_previous != null && stop.distance_from_previous > 0 && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        <span className="material-icons-round" style={{ fontSize: 12, verticalAlign: 'middle' }}>straighten</span>{' '}
                        {stop.distance_from_previous.toFixed(1)} km from previous stop
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0d9488' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
    </div>
  );
}
