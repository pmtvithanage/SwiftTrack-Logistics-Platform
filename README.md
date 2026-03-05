# SwiftTrack Logistics Platform

A full-stack logistics management system with Firebase **replaced** by JWT + bcrypt + MongoDB authentication.

## ArchitectureA full-stA full-stack logistics management system with Firebase **replaced** by JWT + bcrypt + MongoDB authentication.ack logistics management system with Firebase **replaced** by JWT + bcrypt + MongoDB authentication.

```
newSwiftSystem/
├── esb/        Node.js/Express — Integration hub, auth, WebSocket (port 8290)
├── cms/        Python Flask — SOAP customer & order service (port 8000)
├── ros/        Python FastAPI — Route optimisation service (port 8001)
├── wms/        Python TCP Server — Warehouse management (port 9999)
├── products/   Node.js/Express — Product catalogue (port 5999)
├── web/        React 18 + TypeScript — Customer portal (port 3000)
├── mobile/     React Native/Expo — Driver app
└── start-all.bat
```

## Quick Start (Windows)

```bat
cd E:\swiftLogistics\newSwiftSystem
start-all.bat
```

This will open separate terminal windows for every service.

## Manual Start

### ESB (required first)
```bash
cd esb
npm install
npm start
```

### CMS
```bash
cd cms
pip install -r requirements.txt
python app.py
```

### ROS
```bash
cd ros
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### WMS
```bash
cd wms
pip install -r requirements.txt
python tcp_server.py
```

### Products Backend
```bash
cd products
npm install
npm start
```

### Web App
```bash
cd web
npm install
npm start
```
Open http://localhost:3000 — register as a **customer**.

### Mobile App (Driver)
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go. Accounts with `role: driver` are required.

> **Physical device**: Edit `mobile/constants/api.ts` and change `API_BASE_URL` to your machine's LAN IP, e.g. `http://192.168.1.10:8290`.

## Authentication

Firebase has been fully removed. The ESB handles signup/login using:
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT tokens (7-day expiry)
- **MongoDB** — user storage in `SwiftTrack` database

### Login response fields (backward-compatible)
```json
{
  "token": "<jwt>",
  "idToken": "<jwt>",
  "user": {
    "uid": "...",
    "email": "...",
    "displayName": "...",
    "customClaims": { "role": "customer|driver" },
    "customer_id": "...",
    "driver_id": "..."
  }
}
```

## Service URLs

| Service    | Port | Protocol |
|------------|------|----------|
| ESB        | 8290 | HTTP/REST + WebSocket |
| CMS        | 8000 | HTTP/SOAP (XML) |
| ROS        | 8001 | HTTP/REST (FastAPI) |
| WMS        | 9999 | TCP (pipe-delimited) |
| Products   | 5999 | HTTP/REST |
| Web App    | 3000 | HTTP |
|mobile APP  | 3001 |

## Database

MongoDB Atlas — ``

| Database   | Collections |
|------------|-------------|
| SwiftTrack | users, notifications |
| CMS        | customers, orders |
| ROS        | drivers, orders |
| WMS        | orders |
| products   | items, offers |

## UI Improvements

- **Web**: Completely redesigned with blue/indigo Tailwind CSS theme, animated offer banners, order timeline, product grid with filters, improved cart/checkout.
- **Mobile**: Modern card-based design, stats dashboard, color-coded statuses, priority badges, route visualization with distance estimates.

## Mobile app
this will run on port 3001