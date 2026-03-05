const API = 'http://localhost:8290';

export const ENDPOINTS = {
  login:     `${API}/auth/login`,
  signup:    `${API}/auth/signup`,
  logout:    `${API}/auth/logout`,
  me:        `${API}/auth/me`,
  orders:    `${API}/ros/orders`,
  orderById: (id: string) => `${API}/ros/orders/${id}`,
  acceptOrder: `${API}/ros/orders/accept`,
  onDelivery:  `${API}/ros/orders/on-delivery`,
  deliver:     `${API}/ros/orders/deliver`,
  optimizeRoute: (driverId: string) => `${API}/ros/routes/optimize/${driverId}`,
  notifications: `${API}/notifications`,
  driverNotifications: (driverId: string) => `${API}/notifications/driver/${driverId}`,
  markRead: (id: string) => `${API}/notifications/${id}/read`,
};
