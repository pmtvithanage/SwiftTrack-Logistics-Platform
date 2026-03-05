# SwiftTrack Logistics Platform — System Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Services](#3-services)
   - [ESB — Enterprise Service Bus](#31-esb--enterprise-service-bus)
   - [CMS — Customer Management System](#32-cms--customer-management-system)
   - [ROS — Route Optimisation System](#33-ros--route-optimisation-system)
   - [WMS — Warehouse Management System](#34-wms--warehouse-management-system)
   - [Products — Product Catalogue Service](#35-products--product-catalogue-service)
   - [Web — Customer Portal](#36-web--customer-portal)
   - [Driver — Driver App](#37-driver--driver-app)
4. [Authentication & Authorisation](#4-authentication--authorisation)
5. [Data Flow & Communication Protocols](#5-data-flow--communication-protocols)
6. [Order Lifecycle](#6-order-lifecycle)
7. [Database Design](#7-database-design)
8. [API Reference](#8-api-reference)
9. [Real-Time Events (WebSocket)](#9-real-time-events-websocket)
10. [Configuration & Environment Variables](#10-configuration--environment-variables)
11. [Running the System](#11-running-the-system)

---

## 1. System Overview

**SwiftTrack** is a full-stack logistics management platform that allows customers to browse products, place delivery orders, and track their status in real time. Drivers accept orders through a dedicated app, pick up goods from a central warehouse, and deliver them to customers. The platform coordinates all services through a central ESB (Enterprise Service Bus).

**Key capabilities:**
- Customer self-registration, login, and order placement
- Automatic route optimisation for drivers using the Haversine formula
- Priority-based order queuing (high / low)
- Real-time order status updates via WebSocket
- Warehouse tracking using a TCP-based proprietary protocol
- Product catalogue with stock management and promotional offers

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                             │
│                                                                 │
│   ┌──────────────────────┐      ┌───────────────────────────┐   │
│   │   Web (React 18)     │      │  Driver App (React/TS)    │   │
│   │   Customer Portal    │      │  Browser-based Driver UI  │   │
│   │   :3000              │      │  :3001 (dev)              │   │
│   └──────────┬───────────┘      └─────────────┬─────────────┘   │
└──────────────┼────────────────────────────────┼─────────────────┘
               │  HTTP REST + WebSocket          │
               ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ESB  (Node.js/Express)  :8290                 │
│                                                                 │
│  ┌──────────┐  ┌───────┐  ┌──────┐  ┌──────┐  ┌──────────────┐ │
│  │  /auth   │  │ /cms  │  │ /ros │  │ /wms │  │ /api/products│ │
│  └──────────┘  └───────┘  └──────┘  └──────┘  └──────────────┘ │
│                                                                 │
│  ┌─────────────────────┐   ┌───────────────────────────────┐    │
│  │  JWT Auth Middleware│   │  WebSocket Server  (/ws)      │    │
│  └─────────────────────┘   └───────────────────────────────┘    │
└──────┬────────────┬──────────────┬─────────────────────────────┘
       │  SOAP/XML  │  REST/JSON   │  TCP/IP
       ▼            ▼              ▼
┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐
│ CMS        │ │ ROS      │ │ WMS          │ │ Products         │
│ Flask      │ │ FastAPI  │ │ TCP Server   │ │ Node.js/Express  │
│ :8000      │ │ :8001    │ │ :9999        │ │ :5999            │
└────────────┘ └──────────┘ └──────────────┘ └──────────────────┘
       │              │              │                │
       └──────────────┴──────────────┴────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │     MongoDB Atlas   │
                    │  DBs: SwiftTrack   │
                    │       CMS          │
                    │       ROS          │
                    │       WMS          │
                    └────────────────────┘
```

**Protocol summary:**

| From        | To       | Protocol         |
|-------------|----------|------------------|
| Web / Driver | ESB      | HTTP REST + JWT  |
| Web / Driver | ESB      | WebSocket (`/ws`) |
| ESB         | CMS      | SOAP over HTTP   |
| ESB         | ROS      | REST/JSON        |
| ESB         | WMS      | TCP/IP (key=value pipe-delimited) |
| ESB         | Products | REST/JSON (internal proxy) |

---

## 3. Services

### 3.1 ESB — Enterprise Service Bus

| Property | Value |
|----------|-------|
| Runtime  | Node.js 18+ / Express 4 |
| Port     | **8290** |
| Directory | `esb/` |
| Entry point | `esb/src/server.js` |

The ESB is the single point of entry for all client applications. It handles authentication, translates REST calls into the protocol expected by each downstream service, and fans out events across services.

**Responsibilities:**
- User sign-up and login (bcrypt + JWT)
- Proxying REST → SOAP for CMS
- Proxying REST → REST for ROS
- Proxying REST → TCP for WMS
- Publishing real-time notifications via WebSocket
- Storing and serving `Notification` records to drivers

**Key dependencies:**

| Package | Purpose |
|---------|---------|
| `express` | HTTP framework |
| `jsonwebtoken` | JWT generation & verification |
| `bcryptjs` | Password hashing (salt rounds: 12) |
| `mongoose` | MongoDB ODM |
| `ws` | WebSocket server |
| `xml2js` | XML parsing |
| `node-fetch` | HTTP calls to downstream services |
| `uuid` | ID generation |

**Route map:**

| Prefix | Module | Description |
|--------|--------|-------------|
| `POST /auth/signup` | `routes/auth.js` | Register customer or driver |
| `POST /auth/login` | `routes/auth.js` | Authenticate and receive JWT |
| `GET /auth/me` | `routes/auth.js` | Return current user profile |
| `POST /auth/logout` | `routes/auth.js` | Invalidate refresh token |
| `/cms/*` | `routes/cms.js` | Proxy to CMS over SOAP |
| `/ros/*` | `routes/ros.js` | Proxy to ROS over REST |
| `/wms/*` | `routes/wms.js` | Proxy to WMS over TCP |
| `/notifications/*` | `routes/notifications.js` | CRUD for notifications |
| `/api/products/*` | `routes/products.js` | Proxy to Products service |
| `GET /health` | inline | Liveness check |
| `WS /ws` | `websocket.js` | Real-time push channel |

---

### 3.2 CMS — Customer Management System

| Property | Value |
|----------|-------|
| Runtime  | Python 3.10+ / Flask |
| Port     | **8000** |
| Directory | `cms/` |
| Entry point | `cms/app.py` |
| Database | MongoDB — `CMS` (`customers`, `orders`) |

The CMS exposes a **SOAP** interface. All communication is via XML envelopes sent over HTTP POST.

**Endpoints:**

| HTTP Path | SOAP Action | Description |
|-----------|------------|-------------|
| `POST /customerService` | `create_customer` | Create a new customer record |
| `POST /customerService` | `get_customer` | Fetch a customer by `customer_id` |
| `POST /orderService` | `create_order` | Create an order with line items |
| `POST /orderService` | `get_order` | Fetch a single order |
| `GET /orders` | — | List all orders (REST helper) |
| `GET /orders/<customer_id>` | — | List orders for a customer |
| `POST /api/updateStatus` | `order_status_update` | Update order status from ESB/ROS |

**Order statuses (life cycle):**

```
pending → processing → ready → on_delivery → delivered
```

**District Geo-Detection:**  
The CMS parses `district_coordinates.xml` at startup. When an address string is provided without explicit coordinates, it scans for district names and aliases to attach `latitude`/`longitude` automatically.

---

### 3.3 ROS — Route Optimisation System

| Property | Value |
|----------|-------|
| Runtime  | Python 3.10+ / FastAPI |
| Port     | **8001** |
| Directory | `ros/` |
| Entry point | `ros/app/main.py` |
| Database | MongoDB — `ROS` (`drivers`, `orders`) |

The ROS manages drivers and pending orders, and computes optimised delivery routes using the **Haversine** distance formula.

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/drivers/signup` | — | Register a new driver in ROS |
| `GET`  | `/drivers/{driver_id}` | — | Get driver info |
| `PUT`  | `/drivers/{driver_id}/location` | — | Update driver GPS coordinates |
| `POST` | `/orders/ready-to-deliver` | — | Add a new order to the delivery queue |
| `GET`  | `/orders/pending` | — | List all pending orders |
| `POST` | `/orders/accept` | Driver | Driver accepts an order |
| `POST` | `/orders/on-delivery` | Driver | Mark order as in transit |
| `POST` | `/orders/deliver` | Driver | Mark order as delivered  |
| `GET`  | `/routes/optimize/{driver_id}` | — | Return optimised route for driver |

**Route optimisation logic:**
1. High-priority orders are always served before low-priority ones.
2. Within each priority tier, the nearest-neighbour heuristic minimises total travel distance.
3. If the driver has undelivered orders requiring warehouse pickup, the WMS location (Colombo 07) is inserted as the first waypoint.
4. Distance is calculated with the Haversine formula (Earth radius = 6371 km).

---

### 3.4 WMS — Warehouse Management System

| Property | Value |
|----------|-------|
| Runtime  | Python 3.10+ / `socketserver` |
| Port     | **9999** (TCP) |
| Directory | `wms/` |
| Entry point | `wms/tcp_server.py` |
| Database | MongoDB — `WMS` (`orders`) |

The WMS communicates using a **proprietary newline-terminated key=value pipe-delimited protocol** over raw TCP sockets.

**Message format:**
```
key1=value1|key2=value2|...\n
```

**Events:**

| `event` value | Direction | Description |
|--------------|-----------|-------------|
| `test` | ESB → WMS | Health ping |
| `new_order` | ESB → WMS | Register a new order |
| `update_status` | ESB → WMS | Update order status |

**Response format:**
```
status=success|message=Order processed|orderId=ORD-123|reference_number=REF-456|priority=high\n
```

WMS also generates a unique warehouse reference number (`REF-...`) for each incoming order.

---

### 3.5 Products — Product Catalogue Service

| Property | Value |
|----------|-------|
| Runtime  | Node.js 18+ / Express 4 |
| Port     | **5999** |
| Directory | `products/` |
| Entry point | `products/src/server.js` |
| Database | MongoDB — collection `items` |

**Endpoints (all under `/api/products`):**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | List products; supports `?category`, `?search`, `?minPrice`, `?maxPrice` |
| `GET`  | `/:id` | Fetch single product by MongoDB ID |
| `GET`  | `/categories` | Return list of distinct categories |
| `GET`  | `/offers` | Return active promotional offers |
| `POST` | `/decrement` | Decrement stock: `{ productId, quantity }` |

**Product schema fields:** `name`, `price`, `category`, `description`, `image`, `stock`

---

### 3.6 Web — Customer Portal

| Property | Value |
|----------|-------|
| Runtime  | React 18 + TypeScript |
| Dev port | **3000** |
| Directory | `web/` |
| Styling   | Tailwind CSS |

**Pages / Routes:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `LoginPage` | Email + password login |
| `/signup` | `SignUpPage` | New customer registration |
| `/dashboard` | `Dashboard` | Product browsing |
| `/orders` | `OrderManagement` | View & track own orders |
| `/cart` | `CartPage` | Shopping cart & checkout |
| `/promotions` | `PromotionsPage` | Browse active promotions |

All routes behind `/dashboard`, `/orders`, `/cart`, and `/promotions` are protected and require an authenticated JWT.

Auth state is persisted in `localStorage` (`authToken`, `userData`) and rehydrated on page load. Cart state is managed by the `CartContext` context provider.

---

### 3.7 Driver — Driver App

| Property | Value |
|----------|-------|
| Runtime  | React + TypeScript |
| Dev port | **3001** (or Expo Go for mobile) |
| Directory | `driver/` |

**Screens:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `LoginPage` | Driver login |
| `/signup` | `SignUpPage` | New driver registration |
| `/` | `Dashboard` | Summary view |
| `/orders` | `Orders` | List of pending / accepted orders |
| `/route` | `RoutePage` | Optimised route map from ROS |
| `/notifications` | `Notifications` | Alerts and status updates |

Navigation uses a fixed bottom tab bar. JWT is stored and checked via `AuthContext`. Drivers must have `role: driver` to access the app.

---

## 4. Authentication & Authorisation

Authentication is handled entirely by the ESB. Firebase has been removed.

### Sign-up flow

```
Client → POST /auth/signup
         ├── Validate fields
         ├── Hash password with bcrypt (salt rounds 12)
         ├── Save User to MongoDB (SwiftTrack.users)
         ├── If customer → POST SOAP /customerService (create_customer) to CMS
         ├── If driver   → POST /drivers/signup to ROS
         └── Return { token, user }
```

### Login flow

```
Client → POST /auth/login
         ├── Find user by email
         ├── bcrypt.compare(password, hash)
         └── Return { token, idToken, user }
```

Both `token` and `idToken` are set to the same JWT for backward compatibility with older client code.

### JWT structure

```json
{
  "id": "<MongoDB _id>",
  "email": "user@example.com",
  "role": "customer | driver",
  "iat": 1234567890,
  "exp": 1234567890
}
```

- **Algorithm:** HS256
- **Expiry:** 7 days (configurable via `JWT_EXPIRES_IN`)
- **Secret:** `JWT_SECRET` env variable (default: `swifttrack_super_secret_key_2026`)

### Middleware

| Middleware | Function |
|-----------|----------|
| `authenticate` | Verifies Bearer JWT; attaches full `User` document to `req.user` |
| `requireRole(...roles)` | Guards routes to specific roles (`customer`, `driver`) |

---

## 5. Data Flow & Communication Protocols

### ESB → CMS (SOAP over HTTP)

All requests are wrapped in a SOAP envelope:

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <create_order>
      <orderID>ORD-001</orderID>
      <customer_id>CUST-ABCD1234</customer_id>
      <totalAmount>1500</totalAmount>
      <priority>high</priority>
      <delivery_address>Kandy, Sri Lanka</delivery_address>
      <items>
        <item>
          <product_id>...</product_id>
          <name>Item Name</name>
          <quantity>2</quantity>
          <price>750</price>
        </item>
      </items>
    </create_order>
  </soap:Body>
</soap:Envelope>
```

CMS responds with a matching SOAP envelope.

### ESB → ROS (REST/JSON)

Standard HTTP requests with `Content-Type: application/json`. For example, when an order is placed:

```
POST http://localhost:8001/orders/ready-to-deliver
{
  "order_id": "ORD-001",
  "customer_name": "Alice",
  "customer_phone": "+94771234567",
  "delivery_address": {
    "address": "Kandy, Sri Lanka",
    "latitude": 7.2906,
    "longitude": 80.6337
  },
  "priority": "high",
  "driver_id": null
}
```

### ESB → WMS (TCP/IP)

Raw TCP socket connection to port 9999. Messages are pipe-delimited key=value pairs terminated by `\n`:

```
event=new_order|orderId=ORD-001|customer_id=CUST-ABCD1234|totalAmount=1500|priority=high\n
```

The WMS replies on the same connection:

```
status=success|message=Order processed|orderId=ORD-001|reference_number=REF-1709123456|priority=high\n
```

---

## 6. Order Lifecycle

```
Customer places order (Web)
         │
         ▼
POST /cms/orders  (ESB)
         │
         ├─► SOAP create_order → CMS  ──► status: "pending"
         │
         ├─► TCP new_order → WMS  ──► generates REF number
         │         │
         │         └─► WMS confirmed → SOAP updateStatus → CMS  ──► status: "processing"
         │
         └─► REST ready-to-deliver → ROS  ──► order queued for drivers
                   │
                   ▼
         Driver views optimised route (GET /ros/routes/optimize/:driverId)
                   │
                   ▼
         POST /ros/orders/accept  (Driver App)
                   │
                   ├─► ROS updates order assignment
                   └─► SOAP updateStatus → CMS  ──► status: "ready"
                             │
                             │  (Notification created: "Order Accepted")
                             ▼
         Driver picks up goods from WMS
                   │
                   ▼
         POST /ros/orders/on-delivery  (Driver App)
                   │
                   ├─► ROS marks in-transit
                   ├─► SOAP updateStatus → CMS  ──► status: "on_delivery"
                   └─► TCP update_status → WMS  ──► status: "on-delivery"
                             │
                             │  (Notification created: "Order On Delivery")
                             ▼
         POST /ros/orders/deliver  (Driver App)
                   │
                   ├─► ROS marks delivered
                   └─► SOAP updateStatus → CMS  ──► status: "delivered"
                             │
                             │  (Notification created: "Order Delivered")
                             ▼
                   Customer sees "Delivered" in Web portal
```

---

## 7. Database Design

The platform uses **MongoDB Atlas** with four logical databases.

### `SwiftTrack` — ESB database

**Collection: `users`**

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Full name |
| `email` | String | Unique, lowercase |
| `phone` | String | Contact number |
| `password` | String | bcrypt hash |
| `role` | `customer` \| `driver` | User role |
| `address` | String | Default address |
| `location.address` | String | Driver GPS address |
| `location.latitude` | Number | Driver GPS lat |
| `location.longitude` | Number | Driver GPS lng |
| `driver_id` | String | `DRV-XXXXXXXX` (drivers) |
| `is_available` | Boolean | Driver availability |
| `assigned_orders` | String[] | Active order IDs |
| `customer_id` | String | `CUST-XXXXXXXX` (customers) |
| `refreshToken` | String | Stored refresh token |

**Collection: `notifications`**

| Field | Type | Description |
|-------|------|-------------|
| `type` | Enum | `new_order`, `status_update`, `route_change`, `priority_change`, `system` |
| `title` | String | Short heading |
| `message` | String | Full notification body |
| `orderId` | String | Associated order (nullable) |
| `driverId` | String | Target driver (nullable) |
| `customerId` | String | Target customer (nullable) |
| `priority` | `high` \| `medium` \| `low` | Display urgency |
| `isRead` | Boolean | Read status |

---

### `CMS` — Customer Management database

**Collection: `customers`**

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | String | ESB MongoDB `_id` |
| `customer_id` | String | `CUST-XXXXXXXX` |
| `name` | String | Full name |
| `email` | String | Email |
| `phone` | String | Phone |
| `role` | String | Always `"customer"` |
| `current_location.address` | String | Delivery address |
| `current_location.latitude` | Number | Detected lat |
| `current_location.longitude` | Number | Detected lng |
| `current_location.district` | String | Detected district |

**Collection: `orders`**

| Field | Type | Description |
|-------|------|-------------|
| `order_id` | String | Unique order ID |
| `customer_id` | String | Customer reference |
| `totalAmount` | Number | Order value |
| `priority` | `high` \| `low` | Fulfilment priority |
| `status` | String | Lifecycle status |
| `delivery_address` | String | Delivery address text |
| `items` | Array | List of ordered products |
| `created_at` | DateTime | Timestamp |

---

### `ROS` — Route Optimisation database

**Collection: `drivers`**

| Field | Description |
|-------|-------------|
| `user_id` | ESB user `_id` |
| `driver_id` | `DRV-XXXXXXXX` |
| `name`, `email`, `phone` | Profile |
| `address` | Home/base address |
| `location.latitude/longitude` | Current GPS |
| `assigned_orders` | Active order IDs |
| `is_available` | Availability flag |

**Collection: `orders`**

| Field | Description |
|-------|-------------|
| `order_id` | Unique order ID |
| `customer_name`, `customer_phone` | Recipient info |
| `delivery_address` | Address + coordinates |
| `priority` | `high` / `low` |
| `status` | ROS lifecycle state |
| `driver_id` | Assigned driver (nullable) |
| `totalAmount` | Order value |

---

### `WMS` — Warehouse Management database

**Collection: `orders`**

| Field | Description |
|-------|-------------|
| `orderId` | Unique order ID |
| `status` | `pending`, `on-delivery`, `delivered`, etc. |
| `priority` | `high` / `low` |
| `totalAmount` | Order value |
| `order_data` | Raw TCP message as object |
| `reference_number` | WMS-internal `REF-...` number |
| `created_at` / `last_updated` | Timestamps |

---

## 8. API Reference

### Auth endpoints (`/auth`)

#### `POST /auth/signup`
Register a new user.

**Request body:**
```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "phone": "+94771234567",
  "password": "secret123",
  "confirmPassword": "secret123",
  "role": "customer",
  "address": "Kandy, Sri Lanka"
}
```

**Response `201`:**
```json
{
  "message": "Signup successful",
  "token": "<jwt>",
  "user": {
    "id": "...",
    "name": "Alice Smith",
    "email": "alice@example.com",
    "phone": "+94771234567",
    "role": "customer",
    "customer_id": "CUST-ABCD1234"
  }
}
```

---

#### `POST /auth/login`
Authenticate an existing user.

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Response `200`:**
```json
{
  "token": "<jwt>",
  "idToken": "<jwt>",
  "user": {
    "uid": "...",
    "email": "alice@example.com",
    "displayName": "Alice Smith",
    "customClaims": { "role": "customer" },
    "customer_id": "CUST-ABCD1234"
  }
}
```

---

### Order endpoints (`/cms`)

#### `POST /cms/orders`
Place a new order. Requires `Authorization: Bearer <token>` with role `customer`.

**Request body:**
```json
{
  "order_id": "ORD-001",
  "customer_id": "CUST-ABCD1234",
  "totalAmount": 1500,
  "priority": "high",
  "delivery_address": {
    "address": "Kandy, Sri Lanka",
    "latitude": 7.2906,
    "longitude": 80.6337
  },
  "items": [
    {
      "product_id": "64abc...",
      "name": "Widget",
      "quantity": 2,
      "price": 750,
      "image": "https://..."
    }
  ]
}
```

#### `GET /cms/orders/:customerId`
Retrieve order history for the authenticated customer.

#### `GET /cms/orders/all`
Retrieve all orders (admin/driver use).

---

### Route endpoints (`/ros`)

#### `GET /ros/routes/optimize/:driverId`
Returns the optimised delivery route for a driver. Requires Bearer token.

**Response:**
```json
{
  "route": ["driver", "WMS", "ORD-001", "ORD-002"],
  "total_distance_km": 34.7,
  "orders": [ ... ]
}
```

#### `POST /ros/orders/accept`
Accept a pending order. Role: `driver`.

```json
{ "order_id": "ORD-001", "driver_id": "DRV-XYZ12345" }
```

#### `POST /ros/orders/on-delivery`
Mark order as in transit. Role: `driver`.

#### `POST /ros/orders/deliver`
Mark order as delivered. Role: `driver`.

---

### Notification endpoints (`/notifications`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications` | All notifications (latest 50) |
| `GET` | `/notifications/driver/:driverId` | Notifications for a specific driver |
| `POST` | `/notifications` | Create a notification |
| `PUT` | `/notifications/:id/read` | Mark as read |
| `DELETE` | `/notifications` | Clear all notifications |

---

### Product endpoints (`/api/products`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/products` | List products (`?category`, `?search`, `?minPrice`, `?maxPrice`) |
| `GET` | `/api/products/:id` | Single product |
| `GET` | `/api/products/categories` | Distinct categories |
| `GET` | `/api/products/offers` | Active promotions |
| `POST` | `/api/products/decrement` | Decrement stock |

---

### WMS endpoints (`/wms`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/wms/orders` | Send new order to WMS via TCP |
| `PUT` | `/wms/orders/:orderId/status` | Update WMS order status |
| `GET` | `/wms/health` | WMS TCP health check |

---

## 9. Real-Time Events (WebSocket)

Connect to: `ws://localhost:8290/ws`

**Inbound messages (client → server):**

```json
{ "type": "ping" }
```

**Outbound messages (server → client):**

| Type | When | Payload |
|------|------|---------|
| `connected` | On connect | `{ message: "SwiftTrack real-time connected" }` |
| `pong` | Reply to ping | `{}` |
| `order_update` | Status change | `{ orderId, status, ... }` |
| `new_notification` | New notification | Full notification object |

The ESB broadcasts to all connected clients using the `broadcast()` utility. Clients should implement reconnect logic for dropped connections.

---

## 10. Configuration & Environment Variables

Each service supports a `.env` file in its root directory.

### ESB (`esb/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8290` | ESB listen port |
| `MONGO_URI` | (Atlas URI) | MongoDB connection string |
| `JWT_SECRET` | `swifttrack_super_secret_key_2026` | Signing secret — **change in production** |
| `JWT_EXPIRES_IN` | `7d` | Token TTL |
| `CMS_URL` | `http://localhost:8000` | CMS base URL |
| `ROS_URL` | `http://localhost:8001` | ROS base URL |
| `WMS_HOST` | `127.0.0.1` | WMS TCP host |
| `WMS_PORT` | `9999` | WMS TCP port |

### CMS (`cms/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | (Atlas URI) | MongoDB connection string |

### ROS (`ros/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | (Atlas URI) | MongoDB connection string |

### WMS (`wms/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | (Atlas URI) | MongoDB connection string |

### Products (`products/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5999` | Service listen port |
| `MONGO_URI` | (Atlas URI) | MongoDB connection string |

> **Security note:** Never commit `.env` files or real credentials to version control. The `JWT_SECRET` and database credentials shown in defaults are for development only and must be rotated in any production deployment.

---

## 11. Running the System

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm or yarn
- MongoDB Atlas account (or local MongoDB 6+)

### Start order (dependencies matter)

Start services in this order to avoid connection errors:

1. **WMS** (no upstream dependencies)
2. **CMS** (no upstream dependencies)
3. **ROS** (no upstream dependencies)
4. **Products** (no upstream dependencies)
5. **ESB** (depends on all four above)
6. **Web** and **Driver** (depend on ESB)

### Linux / macOS

```bash
# WMS
cd wms && pip install -r requirements.txt && python tcp_server.py &

# CMS
cd cms && pip install -r requirements.txt && python app.py &

# ROS
cd ros && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 &

# Products
cd products && npm install && npm start &

# ESB
cd esb && npm install && npm start &

# Web portal
cd web && npm install && npm start &

# Driver app
cd driver && npm install && npm start &
```

Or use the provided helper:
```bash
chmod +x start-all.sh && ./start-all.sh
```

### Windows

```bat
start-all.bat
```

### Health checks

| Service | URL |
|---------|-----|
| ESB | `GET http://localhost:8290/health` |
| CMS | `GET http://localhost:8000/` |
| ROS | `GET http://localhost:8001/docs` (Swagger UI) |
| WMS | `GET http://localhost:8290/wms/health` (via ESB) |
| Products | `GET http://localhost:5999/health` |

---

*Documentation generated for SwiftTrack Logistics Platform v2.0.0 — March 2026*
