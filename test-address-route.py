#!/usr/bin/env python3
"""
Tests: correct coordinate detection from address string, and route distance display.
"""
import urllib.request, urllib.error, json, time, sys

ESB = "http://localhost:8290"
ROS = "http://localhost:8001"

def post(url, data, token=None):
    body = json.dumps(data).encode()
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def get(url, token=None):
    headers = {}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

PASS = 0; FAIL = 0

def ok(msg): global PASS; PASS += 1; print(f"  ✅ PASS – {msg}")
def fail(msg): global FAIL; FAIL += 1; print(f"  ❌ FAIL – {msg}")

print("="*50)
print("  SwiftTrack – Address & Route Detection Test")
print("="*50)

# ── 1. Districts loaded in ROS ────────────────────────────────────────────────
print("\n▶ 1. Districts loaded in ROS")
d = get(f"{ROS}/districts")
if d.get("total", 0) >= 25:
    ok(f"{d['total']} districts loaded")
else:
    fail(f"Only {d.get('total',0)} districts loaded")

# ── 2. Login ──────────────────────────────────────────────────────────────────
print("\n▶ 2. Login as customer")
login = post(f"{ESB}/auth/login", {"email": "testcustomer_1772633726@swifttrack.test", "password": "Test@12345"})
cust_token = login["token"]
cust_id    = login["user"]["customer_id"]
print(f"  customer_id: {cust_id}")
ok("Login successful")

# ── 3. Place order with string address containing district name ───────────────
test_cases = [
    ("45 Peradeniya Road, Kandy",    "Kandy",    7.2906, 80.6337),
    ("56 Main Street, Galle",         "Galle",    6.0535, 80.2210),
    ("12 Court Road, Jaffna",         "Jaffna",   9.6615, 80.0255),
]

oids = []
for addr, district, exp_lat, exp_lng in test_cases:
    print(f"\n▶ 3. Place order – address: '{addr}'")
    oid = f"ORD-ADDRTEST-{int(time.time()*1000)}"
    oids.append(oid)
    try:
        result = post(f"{ESB}/cms/orders",
            {"order_id": oid, "customer_id": cust_id, "totalAmount": 500, "priority": "high",
             "delivery_address": addr,
             "items": [{"product_id": "P1", "name": "Test", "quantity": 1, "price": 500}]},
            cust_token)
        if "created" in result.get("message","").lower() or result.get("order_id"):
            ok(f"Order placed: {oid}")
        else:
            fail(f"Unexpected response: {result}")
            continue
        time.sleep(0.8)
        # Check in ROS
        orders = get(f"{ROS}/orders")["orders"]
        match = [o for o in orders if o["order_id"] == oid]
        if not match:
            fail(f"Order not found in ROS")
            continue
        da = match[0]["delivery_address"]
        stored_district = da.get("district")
        stored_lat      = da.get("latitude")
        ok(f"Stored in ROS — district={stored_district}, lat={stored_lat:.4f}")
        if stored_district == district:
            ok(f"District correctly detected as '{district}'")
        else:
            fail(f"District should be '{district}' but got '{stored_district}'")
        if stored_lat and abs(stored_lat - exp_lat) < 0.05:
            ok(f"Latitude correct ({stored_lat:.4f} ≈ {exp_lat})")
        else:
            fail(f"Wrong latitude: got {stored_lat}, expected ~{exp_lat}")
    except Exception as e:
        fail(f"Exception: {e}")
    time.sleep(0.3)

# ── 4. Login as driver and check route ────────────────────────────────────────
print("\n▶ 4. Accept order and check route display")
try:
    drv_login = post(f"{ESB}/auth/login", {"email": "testdriver99@swifttrack.test", "password": "Driver@123"})
    drv_token  = drv_login["token"]
    drv_id     = drv_login["user"]["driver_id"]
    print(f"  driver_id: {drv_id}")

    # Accept the first test order
    accept = post(f"{ESB}/ros/orders/accept",
        {"order_id": oids[0], "driver_id": drv_id}, drv_token)
    print(f"  Accept: {accept.get('message','')}")

    time.sleep(0.5)
    route = get(f"{ROS}/routes/optimize/{drv_id}")
    if isinstance(route.get("route"), list) and len(route["route"]) > 0:
        ok(f"Route returned {len(route['route'])} stops")
        total_km = route.get("total_distance_km", 0)
        est_min  = route.get("estimated_time_minutes", 0)
        print(f"  total_distance_km      : {total_km}")
        print(f"  estimated_time_minutes : {est_min}")
        if total_km > 0:
            ok(f"Total distance is non-zero ({total_km:.2f} km)")
        else:
            fail("Total distance is 0 — coordinates still wrong")
        # Check delivery stop has district info
        delivery_stops = [s for s in route["route"] if s["type"] == "delivery"]
        if delivery_stops:
            s = delivery_stops[0]
            print(f"  delivery stop address  : {s.get('address')}")
            print(f"  delivery stop district : {s.get('district')}")
            print(f"  distance_from_previous : {s.get('distance_from_previous')} km")
            if s.get("district"):
                ok(f"District info present in route stop: {s['district']}")
            else:
                fail("District missing in route stop")
    else:
        fail(f"No route returned: {route.get('message','')}")
except Exception as e:
    fail(f"Route check failed: {e}")

print("\n" + "="*50)
print(f"  Results: {PASS} passed / {FAIL} failed")
print("="*50)
sys.exit(FAIL)
