import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../api';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  priority?: string;
  createdAt?: string;
  orderId?: string;
}

const TYPE_ICON: Record<string, string> = {
  new_order:       'inventory_2',
  status_update:   'sync',
  route_change:    'map',
  priority_change: 'bolt',
  system:          'notifications',
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#fee2e2', text: '#dc2626' },
  medium: { bg: '#fef9c3', text: '#92400e' },
  low:    { bg: '#dcfce7', text: '#166534' },
};

export default function Notifications() {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const url = user?.driver_id
        ? ENDPOINTS.driverNotifications(user.driver_id)
        : ENDPOINTS.notifications;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const arr: Notification[] = Array.isArray(data) ? data : data.notifications || [];
      setNotifications(arr.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user?.driver_id, token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try {
      await fetch(ENDPOINTS.markRead(id), { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch { /* ignore */ }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div>
      <div style={{ background: '#fff', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Notifications</div>
        {unreadCount > 0 && (
          <div style={{ fontSize: 12, color: '#0d9488', fontWeight: 600, marginTop: 2 }}>{unreadCount} unread</div>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="material-icons-round" style={{ fontSize: 48, color: '#94a3b8', marginBottom: 14, display: 'block' }}>notifications</span>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#475569' }}>No notifications</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>You're all caught up!</div>
          </div>
        ) : (
          notifications.map(notif => {
            const icon = TYPE_ICON[notif.type] ?? 'notifications';
            const pc = notif.priority ? PRIORITY_COLORS[notif.priority] : null;
            const timeStr = notif.createdAt
              ? new Date(notif.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div
                key={notif._id}
                onClick={() => !notif.isRead && markRead(notif._id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: notif.isRead ? '#fff' : '#f0fdfa',
                  border: `1px solid ${notif.isRead ? '#f1f5f9' : '#99f6e4'}`,
                  borderRadius: 16, padding: 14, marginBottom: 10, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 12, background: '#f0fdfa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span className="material-icons-round" style={{ fontSize: 22, color: '#0d9488' }}>{icon}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: '#0d9488', flexShrink: 0, marginLeft: 6 }} />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: '17px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {notif.message}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    {timeStr ? <span style={{ fontSize: 11, color: '#94a3b8' }}>{timeStr}</span> : <span />}
                    {pc && (
                      <span style={{
                        background: pc.bg, color: pc.text,
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        textTransform: 'capitalize',
                      }}>{notif.priority}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
