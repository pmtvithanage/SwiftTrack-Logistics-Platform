# SwiftTrack Logistics Platform

A full-stack logistics management system built on a microservices architecture. Handles customer ordering, warehouse management, route optimisation, and real-time driver delivery tracking.

## System Architecture

```
SwiftTrack-Logistics-Platform/
            ├── esb/        Node.js/Express  — API Gateway, JWT auth, WebSocket  (port 8290)
            ├── cms/        Python Flask     — SOAP customer & order service      (port 8000)
            ├── ros/        Python FastAPI   — Route optimisation service         (port 8001)
            ├── wms/        Python TCP       — Warehouse management server        (port 9999)
            ├── products/   Node.js/Express  — Product catalogue REST API         (port 5999)
            ├── web/        React 18 + TS    — Customer portal                   (port 3000)
            ├── driver/     React 18 + TS    — Driver mobile PWA                 (port 3001)
            ├── logs/       — Runtime log files for every service
            ├── start-all.sh — One-command launcher (Linux/macOS)
            └── architecture.md — Mermaid architecture diagram
```

### Communication Protocols

| From → To          | Protocol            |
|--------------------|---------------------|
| Web/Driver → ESB   | REST / HTTP + JWT   |
| ESB → CMS          | SOAP over XML       |
| ESB → Products     | REST / HTTP         |
| ESB → ROS          | REST / HTTP         |
| ESB → WMS          | TCP/IP (pipe-delimited) |
| WMS → CMS          | HTTP status update  |
| All Python/Node → DB | MongoDB Atlas     |
| ROS/Web/Driver → Google | HTTPS / Maps JS SDK |

---

## Quick Start

```bash
cd /path/to/SwiftTrack-Logistics-Platform
chmod +x start-all.sh
./start-all.sh
```

`start-all.sh` will:
1. Kill any processes already running on the service ports
2. Create Python virtual environments and install dependencies
3. Start all backend services, wait for them to initialise
4. Start the ESB gateway
5. Start both React front-ends

Press **Ctrl+C** to stop all services.

---

## Manual Start

### 1. ESB (start first — all clients depend on it)
```bash
cd esb
npm install
npm start
```

### 2. CMS
```bash
cd cms
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 3. ROS
```bash
cd ros
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. WMS
```bash
cd wms
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python tcp_server.py
```

### 5. Products
```bash
cd products
npm install
npm start
```

### 6. Web App (Customer)
```bash
cd web
npm install
npm start
# Opens http://localhost:3000 — register as a customer
```

### 7. Driver App
```bash
cd driver
npm install
npm start
# Opens http://localhost:3001 — register/login as a driver
```

---

## Service URLs

| Service       | Port | Protocol              | Description                        |
|---------------|------|-----------------------|------------------------------------|
| ESB           | 8290 | HTTP REST + WebSocket | API gateway, auth, notifications   |
| CMS           | 8000 | HTTP SOAP (XML)       | Customer & order management        |
| ROS           | 8001 | HTTP REST (FastAPI)   | Route optimisation, driver orders  |
| WMS           | 9999 | TCP (pipe-delimited)  | Warehouse management               |
| Products      | 5999 | HTTP REST             | Product catalogue & offers         |
| Web App       | 3000 | HTTP                  | Customer portal (React)            |
| Driver App    | 3001 | HTTP                  | Driver PWA (React)                 |

---

## Authentication

Firebase has been replaced. The ESB handles auth using:
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT tokens (7-day expiry)
- **MongoDB** — user storage in `SwiftTrack` database

### Roles
| Role       | App          | Capabilities                                              |
|------------|--------------|-----------------------------------------------------------|
| `customer` | Web (3000)   | Browse products, manage cart, place orders, track orders  |
| `driver`   | Driver (3001)| View assigned orders, accept, start delivery, deliver, view optimised route map |

### Login response
```json
{
  "token": "<jwt>",
  "user": {
    "uid": "...",
    "email": "...",
    "displayName": "...",
    "role": "customer | driver",
    "customer_id": "...",
    "driver_id": "..."
  }
}
```

---

## Database

MongoDB Atlas — cloud-hosted, shared across services.

| Database    | Collections              | Used by           |
|-------------|--------------------------|-------------------|
| SwiftTrack  | users, notifications     | ESB               |
| CMS         | customers, orders        | CMS               |
| ROS         | drivers, orders          | ROS               |
| WMS         | orders                   | WMS               |
| products    | items, offers            | Products          |

---

## Key Features

### Customer Web App (port 3000)
- Product grid with category filters and search
- Animated promotions/offers banner
- Cart with quantity controls
- **Google Maps Places Autocomplete** for delivery address
- Embedded Google Map with pinned delivery location
- Order placement → forwarded to CMS, WMS, and ROS automatically
- My Orders with full order summary, itemised receipt, and delivery timeline

### Driver PWA (port 3001)
- Dashboard with stats (Pending, Accepted, Active, Delivered)
- **My Orders** — collapsible sections per status (accordion), expandable order cards with full detail
- **Route Page** — Google Maps with numbered markers and road-following Directions API polyline
- Accept orders, start delivery, and mark delivered from both the Route page and Orders page
- Real-time toast notifications

### Route Optimisation (ROS)
- **Google Geocoding API** resolves delivery addresses to coordinates (falls back to district lookup)
- Nearest-neighbour route optimisation starting from driver's current location
- Warehouse pickup at **Union Place, Colombo** (6.9189, 79.8562)
- Driver default start: **College House, Colombo 00700** (6.9020, 79.8607)

### Warehouse Management (WMS)
- Proprietary TCP protocol (`key=value|key=value\n` pipe-delimited)
- Receives new orders from ESB and updates CMS order status to `processing`
- MongoDB persistence with in-memory fallback when DB is unavailable

---

## Google Maps Integration

API Key is configured in:
- `web/public/index.html` — Maps JS SDK + Places library
- `driver/public/index.html` — Maps JS SDK + Places library
- `ros/.env` — `GOOGLE_MAPS_API_KEY` for server-side Geocoding

APIs enabled: Maps JavaScript API, Geocoding API, Places API, Directions API.

---

## Logs

All service logs are written to `logs/` at runtime:

| File             | Service         |
|------------------|-----------------|
| logs/cms.log     | CMS Flask       |
| logs/ros.log     | ROS FastAPI     |
| logs/wms.log     | WMS TCP         |
| logs/esb.log     | ESB Node.js     |
| logs/products.log| Products Node.js|
| logs/web.log     | Web React       |
| logs/driver.log  | Driver React    |

---

## Order Lifecycle

```
Customer places order (Web)
    → ESB validates & forwards
        → CMS creates order (status: pending)
        → WMS notified via TCP (status: processing)
        → ROS stores order (status: ready-to-deliver)
            → Driver accepts (status: accepted)
            → Driver starts delivery (status: on-delivery)
            → Driver marks delivered (status: delivered)
```
