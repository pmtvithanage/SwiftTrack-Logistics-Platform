import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../api';

declare global { interface Window { google: any; } }

// ─── Route Map ───────────────────────────────────────────────────────────────
const STOP_COLORS: Record<string, string> = {
  start:    '#0d9488',
  pickup:   '#7c3aed',
  delivery: '#0ea5e9',
  end:      '#475569',
};

function RouteMap({ stops }: { stops: RouteStop[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(!!window.google?.maps);

  useEffect(() => {
    if (window.google?.maps) { setReady(true); return; }
    const t = setInterval(() => { if (window.google?.maps) { setReady(true); clearInterval(t); } }, 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = window.google;

    const validStops = stops.filter(s => s.coordinates?.latitude && s.coordinates?.longitude);
    if (validStops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const positions = validStops.map(s => ({
      lat: s.coordinates!.latitude,
      lng: s.coordinates!.longitude,
    }));

    const map = new google.maps.Map(mapRef.current, {
      zoom: 8,
      center: positions[0],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
    });

    // Place numbered markers
    validStops.forEach((stop, i) => {
      const pos = positions[i];
      bounds.extend(pos);
      const color = STOP_COLORS[stop.type] ?? '#0d9488';
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: stop.customer_name || stop.address || stop.type,
        label: { text: String(stop.sequence ?? i + 1), color: '#fff', fontWeight: 'bold', fontSize: '11px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 16,
        },
      });
      const infoContent = [
        stop.customer_name ? `<b>${stop.customer_name}</b><br/>` : '',
        stop.address || stop.district || '',
        stop.order_id ? `<br/><span style="color:#64748b;font-size:11px">Order #${stop.order_id.slice(-10)}</span>` : '',
      ].join('');
      const info = new google.maps.InfoWindow({ content: `<div style="font-size:13px;max-width:180px">${infoContent}</div>` });
      marker.addListener('click', () => info.open(map, marker));
    });

    map.fitBounds(bounds);

    // Draw road-following route via Directions API
    if (positions.length >= 2) {
      const ds = new google.maps.DirectionsService();
      const dr = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#0d9488', strokeWeight: 4, strokeOpacity: 0.85 },
      });
      const origin = positions[0];
      const destination = positions[positions.length - 1];
      const waypoints = positions.slice(1, -1).slice(0, 23).map((p: {lat: number; lng: number}) => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        stopover: true,
      }));
      ds.route(
        { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false },
        (result: any, status: any) => {
          if (status === 'OK') { dr.setDirections(result); }
          else {
            // Fallback: simple polyline
            new google.maps.Polyline({
              path: positions,
              map,
              strokeColor: '#0d9488',
              strokeOpacity: 0.7,
              strokeWeight: 3,
              geodesic: true,
            });
          }
        }
      );
    }
  }, [ready, stops]);

  const hasCoords = stops.some(s => s.coordinates?.latitude);

  if (!hasCoords) return null;

  return (
    <div style={{ marginTop: 20, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Route Map</div>
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative', height: 340 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!ready && (
          <div style={{
            position: 'absolute', inset: 0, background: '#f8fafc',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14,
          }}>Loading map…</div>
        )}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, paddingLeft: 2 }}>
        {Object.entries(STOP_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [updating, setUpdating] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  const handleAction = useCallback(async (order_id: string, action: string) => {
    setUpdating(order_id);
    setMsg(null);
    try {
      let endpoint = '';
      if (action === 'on_delivery') endpoint = ENDPOINTS.onDelivery;
      else if (action === 'deliver')    endpoint = ENDPOINTS.deliver;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id, driver_id: user?.driver_id || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || data.message || `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: 'Order status updated!' });
      fetchRoute();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally { setUpdating(null); }
  }, [token, user?.driver_id, fetchRoute]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  const stops = route?.route ?? [];

  return (
    <div>
      <div style={{ background: '#fff', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>My Route</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Optimized delivery path</div>
      </div>

      <div style={{ padding: 16 }}>
        {msg && (
          <div style={{
            background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
            color: msg.type === 'ok' ? '#166534' : '#dc2626',
            borderRadius: 12, padding: '10px 14px', fontSize: 13,
            marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{msg.text}</span>
            <span onClick={() => setMsg(null)} style={{ cursor: 'pointer', fontSize: 16, lineHeight: 1, marginLeft: 8 }}>✕</span>
          </div>
        )}
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

                    {/* Status action buttons for delivery stops */}
                    {stop.type === 'delivery' && stop.order_id && stop.status === 'accepted' && (
                      <button
                        disabled={updating === stop.order_id}
                        onClick={() => handleAction(stop.order_id!, 'on_delivery')}
                        style={{
                          width: '100%', background: '#ea580c', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
                          marginTop: 10, cursor: updating === stop.order_id ? 'not-allowed' : 'pointer',
                          opacity: updating === stop.order_id ? 0.6 : 1,
                        }}
                      >
                        {updating === stop.order_id ? 'Updating…' : '🚚 Start Delivery'}
                      </button>
                    )}
                    {stop.type === 'delivery' && stop.order_id && stop.status === 'on-delivery' && (
                      <button
                        disabled={updating === stop.order_id}
                        onClick={() => handleAction(stop.order_id!, 'deliver')}
                        style={{
                          width: '100%', background: '#16a34a', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
                          marginTop: 10, cursor: updating === stop.order_id ? 'not-allowed' : 'pointer',
                          opacity: updating === stop.order_id ? 0.6 : 1,
                        }}
                      >
                        {updating === stop.order_id ? 'Updating…' : '✅ Mark Delivered'}
                      </button>
                    )}
                    {stop.type === 'delivery' && stop.order_id && stop.status === 'delivered' && (
                      <div style={{
                        marginTop: 10, background: '#f0fdf4', borderRadius: 10,
                        padding: '8px 12px', fontSize: 12, color: '#166534', fontWeight: 700, textAlign: 'center',
                      }}>✓ Delivered</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Route Map */}
            <RouteMap stops={stops} />
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
