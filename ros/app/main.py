from fastapi import FastAPI, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
import math
import json
import re
import httpx
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# ─── District coordinates loader ─────────────────────────────────────────────

def load_district_coordinates():
    try:
        # Use __file__-relative path so it works regardless of CWD
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "district_coordinates.json")
        with open(json_path, "r") as f:
            data = json.load(f)
            return data["districts"]
    except Exception as e:
        print(f"Warning: Could not load district coordinates: {e}")
        return {}

DISTRICT_DATA = load_district_coordinates()


def find_coordinates_by_address(address):
    if not DISTRICT_DATA or not address:
        return None
    address_lower = address.lower()
    for district_name, district_info in DISTRICT_DATA.items():
        if district_name.lower() in address_lower:
            return {"district": district_name, "latitude": district_info["latitude"], "longitude": district_info["longitude"]}
    for district_name, district_info in DISTRICT_DATA.items():
        for alias in district_info.get("aliases", []):
            pattern = r'\b' + re.escape(alias.lower()) + r'\b'
            if re.search(pattern, address_lower):
                return {"district": district_name, "latitude": district_info["latitude"], "longitude": district_info["longitude"]}
    return None


def get_all_districts():
    return list(DISTRICT_DATA.keys()) if DISTRICT_DATA else []


async def geocode_with_google(address: str):
    """Call Google Geocoding API to resolve an address to lat/lng."""
    if not GOOGLE_MAPS_API_KEY or not address:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": GOOGLE_MAPS_API_KEY},
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                r = data["results"][0]
                loc = r["geometry"]["location"]
                return {
                    "latitude": loc["lat"],
                    "longitude": loc["lng"],
                    "formatted_address": r.get("formatted_address", address),
                    "source": "google",
                }
    except Exception as e:
        print(f"Google Geocoding error: {e}")
    return None


async def resolve_coordinates(address: str):
    """Resolve address to coordinates: Google Geocoding first, district lookup fallback."""
    result = await geocode_with_google(address)
    if result:
        return result
    detected = find_coordinates_by_address(address)
    if detected:
        detected["source"] = "district_lookup"
        return detected
    return None


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class DriverSignupRequest(BaseModel):
    user_id: str
    driver_id: str
    name: str
    email: str
    phone: str
    address: str
    latitude: float = None
    longitude: float = None


class DeliveryAddress(BaseModel):
    address: str
    latitude: float = None
    longitude: float = None


class CreateOrderRequest(BaseModel):
    order_id: str
    customer_name: str
    customer_phone: str
    delivery_address: DeliveryAddress
    priority: str
    driver_id: str = None
    status: str = "ready-to-deliver"
    totalAmount: float = None


class OrderAcceptRequest(BaseModel):
    order_id: str
    driver_id: str


class OrderOnDeliveryRequest(BaseModel):
    order_id: str
    driver_id: str


class OrderDeliveryRequest(BaseModel):
    order_id: str
    driver_id: str
    delivery_proof: str = None


# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="SwiftTrack ROS", description="Route Optimisation System", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://lala:lala%23%24patronus78@cluster0.ezv2ieh.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client["ROS"]
drivers_collection = db.drivers
orders_collection = db.orders

WMS_LOCATION = {"address": "Union Place, Colombo, Sri Lanka", "latitude": 6.9189, "longitude": 79.8562}
DRIVER_DEFAULT_START = {"address": "College House, 94 Cumaratunga Munidasawa Mw, Colombo 00700, Sri Lanka", "latitude": 6.9020, "longitude": 79.8607}


# ─── Route optimization utilities ────────────────────────────────────────────

def calculate_distance(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def optimize_route(driver_orders, driver_location, wms_location, orders_to_pickup=None):
    if not driver_orders:
        return [], 0, {}

    locations = {
        'wms': (wms_location["latitude"], wms_location["longitude"]),
        'driver': (driver_location["latitude"], driver_location["longitude"]),
    }
    for o in driver_orders:
        locations[o["order_id"]] = (o["delivery_address"]["latitude"], o["delivery_address"]["longitude"])

    route = ['driver']
    total_distance = 0
    current = 'driver'

    need_pickup = bool(orders_to_pickup)
    if need_pickup:
        d = calculate_distance(*locations['driver'], *locations['wms'])
        total_distance += d
        route.append('wms')
        current = 'wms'

    high = [o for o in driver_orders if o["priority"] == "high"]
    low  = [o for o in driver_orders if o["priority"] != "high"]

    def nearest_neighbor(orders_list):
        nonlocal current, total_distance
        unvisited = [o["order_id"] for o in orders_list]
        while unvisited:
            min_d, nearest = float('inf'), None
            for oid in unvisited:
                d = calculate_distance(*locations[current], *locations[oid])
                if d < min_d:
                    min_d, nearest = d, oid
            route.append(nearest)
            total_distance += min_d
            current = nearest
            unvisited.remove(nearest)

    nearest_neighbor(high)
    nearest_neighbor(low)

    # Return to WMS
    if current != 'wms':
        d = calculate_distance(*locations[current], *locations['wms'])
        total_distance += d
        route.append('wms')

    return route, total_distance, locations


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "SwiftTrack ROS v2.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ROS"}


@app.get("/districts")
async def get_districts():
    return {"districts": get_all_districts(), "total": len(get_all_districts())}


# ─── Driver Signup (no Firebase) ─────────────────────────────────────────────

@app.post("/drivers/signup")
async def driver_signup(request: DriverSignupRequest):
    existing = await drivers_collection.find_one({"driver_id": request.driver_id})
    if existing:
        # Idempotent — return existing
        existing["_id"] = str(existing["_id"])
        return {"message": "Driver already registered", "driver": existing}

    lat = request.latitude
    lng = request.longitude
    location_info = None

    if lat is None or lng is None:
        detected = await resolve_coordinates(request.address)
        if detected:
            lat = detected["latitude"]
            lng = detected["longitude"]
            location_info = {
                "formatted_address": detected.get("formatted_address", detected.get("district", "")),
                "source": detected.get("source", "unknown"),
                "auto_detected": True,
            }
        else:
            lat = DRIVER_DEFAULT_START["latitude"]
            lng = DRIVER_DEFAULT_START["longitude"]
            location_info = {"address": DRIVER_DEFAULT_START["address"], "auto_detected": False}

    doc = {
        "user_id": request.user_id,
        "driver_id": request.driver_id,
        "name": request.name,
        "email": request.email,
        "phone": request.phone,
        "role": "driver",
        "current_location": {"address": request.address, "latitude": lat, "longitude": lng},
        "status": "available",
        "assigned_orders": [],
        "completed_orders": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await drivers_collection.insert_one(doc)
    new_driver = await drivers_collection.find_one({"_id": result.inserted_id})
    new_driver["_id"] = str(new_driver["_id"])

    resp = {"message": "Driver registered successfully", "driver": new_driver}
    if location_info:
        resp["location_detection"] = location_info
    return resp


@app.get("/drivers")
async def list_drivers():
    drivers = await drivers_collection.find().to_list(length=None)
    for d in drivers:
        d["_id"] = str(d["_id"])
    return {"drivers": drivers, "count": len(drivers)}


# ─── Orders ──────────────────────────────────────────────────────────────────

@app.post("/orders/ready-to-deliver")
async def create_order(request: CreateOrderRequest):
    existing = await orders_collection.find_one({"order_id": request.order_id})
    if existing:
        existing["_id"] = str(existing["_id"])
        return {"message": "Order already exists", "order": existing}

    if request.priority not in ["high", "low"]:
        raise HTTPException(status_code=400, detail="Priority must be 'high' or 'low'")

    # Auto-detect coordinates from address string if not provided
    lat = request.delivery_address.latitude
    lng = request.delivery_address.longitude
    district = None
    if (lat is None or lng is None) and request.delivery_address.address:
        detected = await resolve_coordinates(request.delivery_address.address)
        if detected:
            lat = detected["latitude"]
            lng = detected["longitude"]
            district = detected.get("formatted_address", detected.get("district"))
    # Final fallback to warehouse location
    if lat is None or lng is None:
        lat = WMS_LOCATION["latitude"]
        lng = WMS_LOCATION["longitude"]

    doc = {
        "order_id": request.order_id,
        "customer_name": request.customer_name,
        "customer_phone": request.customer_phone,
        "totalAmount": request.totalAmount,
        "delivery_address": {
            "address": request.delivery_address.address,
            "latitude": lat,
            "longitude": lng,
            "district": district,
        },
        "priority": request.priority,
        "status": request.status,
        "driver_id": request.driver_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await orders_collection.insert_one(doc)
    new = await orders_collection.find_one({"_id": result.inserted_id})
    new["_id"] = str(new["_id"])
    new["created_at"] = new["created_at"].isoformat() + 'Z'
    new["updated_at"] = new["updated_at"].isoformat() + 'Z'
    return {"message": "Order created", "order": new}


@app.get("/orders")
async def list_orders():
    orders = await orders_collection.find().to_list(length=None)
    for o in orders:
        o["_id"] = str(o["_id"])
        if isinstance(o.get("created_at"), datetime):
            o["created_at"] = o["created_at"].isoformat() + 'Z'
        if isinstance(o.get("updated_at"), datetime):
            o["updated_at"] = o["updated_at"].isoformat() + 'Z'
    return {"orders": orders, "count": len(orders)}


@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await orders_collection.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order["_id"] = str(order["_id"])
    if isinstance(order.get("created_at"), datetime):
        order["created_at"] = order["created_at"].isoformat() + 'Z'
    return {"order": order}


@app.post("/orders/accept")
async def accept_order(request: OrderAcceptRequest):
    order = await orders_collection.find_one({"order_id": request.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    driver = await drivers_collection.find_one({"driver_id": request.driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if order["status"] not in ["ready-to-deliver"]:
        raise HTTPException(status_code=400, detail=f"Order is already {order['status']}")

    await orders_collection.update_one(
        {"order_id": request.order_id},
        {"$set": {"status": "accepted", "driver_id": request.driver_id, "updated_at": datetime.utcnow()}}
    )
    await drivers_collection.update_one(
        {"driver_id": request.driver_id},
        {"$addToSet": {"assigned_orders": request.order_id}}
    )
    return {"message": f"Order {request.order_id} accepted by driver {request.driver_id}"}


@app.post("/orders/on-delivery")
async def mark_on_delivery(request: OrderOnDeliveryRequest):
    order = await orders_collection.find_one({"order_id": request.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("driver_id") != request.driver_id:
        raise HTTPException(status_code=400, detail="Order not assigned to this driver")
    if order["status"] != "accepted":
        raise HTTPException(status_code=400, detail=f"Order is {order['status']}, not accepted")

    await orders_collection.update_one(
        {"order_id": request.order_id},
        {"$set": {"status": "on-delivery", "picked_up_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )
    return {"message": f"Order {request.order_id} marked as on-delivery"}


@app.post("/orders/deliver")
async def deliver_order(request: OrderDeliveryRequest):
    order = await orders_collection.find_one({"order_id": request.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("driver_id") != request.driver_id:
        raise HTTPException(status_code=400, detail="Order not assigned to this driver")
    if order["status"] != "on-delivery":
        raise HTTPException(status_code=400, detail=f"Order is {order['status']}, not on-delivery")

    update = {"status": "delivered", "delivered_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
    if request.delivery_proof:
        update["delivery_proof"] = request.delivery_proof

    await orders_collection.update_one({"order_id": request.order_id}, {"$set": update})
    await drivers_collection.update_one(
        {"driver_id": request.driver_id},
        {"$pull": {"assigned_orders": request.order_id}, "$addToSet": {"completed_orders": request.order_id}}
    )
    return {"message": f"Order {request.order_id} delivered successfully"}


@app.delete("/orders/{order_id}")
async def remove_order(order_id: str):
    order = await orders_collection.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("driver_id"):
        await drivers_collection.update_one(
            {"driver_id": order["driver_id"]},
            {"$pull": {"assigned_orders": order_id, "completed_orders": order_id}}
        )
    await orders_collection.delete_one({"order_id": order_id})
    return {"message": f"Order {order_id} removed"}


# ─── Route Optimization ───────────────────────────────────────────────────────

@app.get("/routes/optimize/{driver_id}")
async def optimize_route_endpoint(driver_id: str = Path(...)):
    driver = await drivers_collection.find_one({"driver_id": driver_id})
    if not driver:
        return {"error": "Driver not found", "driver_id": driver_id}

    all_orders_cursor = orders_collection.find({
        "driver_id": driver_id,
        "status": {"$in": ["accepted", "on-delivery"]}
    })
    all_driver_orders = await all_orders_cursor.to_list(length=None)

    orders_to_pickup = [o for o in all_driver_orders if o["status"] == "accepted"]
    orders_on_delivery = [o for o in all_driver_orders if o["status"] == "on-delivery"]

    if not all_driver_orders:
        return {
            "message": "No orders assigned to driver",
            "driver_id": driver_id,
            "driver_name": driver["name"],
            "total_orders": 0,
            "route": []
        }

    optimal_route, total_distance, locations = optimize_route(
        all_driver_orders, driver["current_location"], WMS_LOCATION, orders_to_pickup
    )

    route_points = []
    last_order = None

    for i, node in enumerate(optimal_route):
        coords = locations[node]
        seq = i + 1

        if node == 'driver':
            start_addr = driver["current_location"].get("address") or DRIVER_DEFAULT_START["address"]
            route_points.append({
                "sequence": seq,
                "location": f"Start – {driver['name']}",
                "address": start_addr,
                "type": "start",
                "coordinates": {"latitude": coords[0], "longitude": coords[1]},
            })
        elif node == 'wms':
            prev_coords = locations[optimal_route[i - 1]]
            dist = round(calculate_distance(*prev_coords, *coords), 2)
            point_type = "pickup" if i < len(optimal_route) - 1 else "end"
            route_points.append({
                "sequence": seq,
                "location": "WMS Warehouse",
                "address": WMS_LOCATION["address"],
                "type": point_type,
                "coordinates": {"latitude": coords[0], "longitude": coords[1]},
                "distance_from_previous": dist,
                "orders_to_pickup": [o["order_id"] for o in orders_to_pickup] if point_type == "pickup" else [],
            })
        else:
            order = next(o for o in all_driver_orders if o["order_id"] == node)
            last_order = order
            prev_coords = locations[optimal_route[i - 1]] if i > 0 else coords
            dist = round(calculate_distance(*prev_coords, *coords), 2)
            route_points.append({
                "sequence": seq,
                "location": f"Delivery – {order['customer_name']}",
                "address": order["delivery_address"]["address"],
                "district": order["delivery_address"].get("district"),
                "type": "delivery",
                "order_id": order["order_id"],
                "customer_name": order["customer_name"],
                "customer_phone": order["customer_phone"],
                "priority": order["priority"],
                "status": order["status"],
                "totalAmount": order.get("totalAmount", 0.0),
                "coordinates": {"latitude": coords[0], "longitude": coords[1]},
                "distance_from_previous": dist,
            })

    estimated_time_minutes = int(total_distance / 40 * 60) + len(all_driver_orders) * 15

    return {
        "message": "Route optimized",
        "driver_id": driver_id,
        "driver_name": driver["name"],
        "total_orders": len(all_driver_orders),
        "orders_to_pickup": len(orders_to_pickup),
        "orders_on_delivery": len(orders_on_delivery),
        "warehouse_visit_required": len(orders_to_pickup) > 0,
        "total_distance_km": round(total_distance, 2),
        "estimated_time_minutes": estimated_time_minutes,
        "totalAmount": last_order.get("totalAmount", 0.0) if last_order else 0.0,
        "route": route_points
    }


if __name__ == "__main__":
    import uvicorn
    print("✅ SwiftTrack ROS starting on http://0.0.0.0:8001")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
