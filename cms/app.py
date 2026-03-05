from flask import Flask, request, Response
import uuid
import xml.etree.ElementTree as ET
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# MongoDB connection
MONGODB_URI = os.getenv("MONGO_URI", "mongodb+srv://lala:lala%23%24patronus78@cluster0.ezv2ieh.mongodb.net/?appName=Cluster0")
DB_NAME = "CMS"

# Load district coordinates from XML
DISTRICT_COORDINATES = {}

def load_district_coordinates():
    global DISTRICT_COORDINATES
    try:
        xml_file_path = os.path.join(os.path.dirname(__file__), 'district_coordinates.xml')
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
        for district in root.findall('district'):
            name = district.get('name')
            lat = float(district.find('latitude').text)
            lng = float(district.find('longitude').text)
            aliases = []
            aliases_el = district.find('aliases')
            if aliases_el is not None:
                aliases = [a.text.lower() for a in aliases_el.findall('alias')]
            DISTRICT_COORDINATES[name] = {'latitude': lat, 'longitude': lng, 'aliases': aliases}
        print(f"Loaded {len(DISTRICT_COORDINATES)} districts")
    except Exception as e:
        print(f"Warning: Could not load district coordinates: {e}")

load_district_coordinates()

try:
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    customers_collection = db["customers"]
    orders_collection = db["orders"]
    print("✅ CMS connected to MongoDB")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    client = None

# ─── SOAP Helpers ─────────────────────────────────────────────────────────────

def soap_response(body):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>{body}</soap:Body>
</soap:Envelope>"""

def get_text(root, tag):
    for el in root.iter():
        if el.tag.endswith(tag):
            return el.text
    return None

def detect_district(address):
    if not address:
        return None
    addr_lower = address.lower().strip()
    for dname, ddata in DISTRICT_COORDINATES.items():
        if dname.lower() in addr_lower:
            return {"district": dname, "latitude": ddata["latitude"], "longitude": ddata["longitude"]}
        for alias in ddata["aliases"]:
            if alias in addr_lower:
                return {"district": dname, "latitude": ddata["latitude"], "longitude": ddata["longitude"]}
    return None

# ─── /customerService (SOAP) ──────────────────────────────────────────────────

@app.route('/customerService', methods=['POST'])
def customer_service():
    try:
        root = ET.fromstring(request.data)

        for el in root.iter():

            # create_customer — no longer needs firebaseUID; uses user_id from ESB
            if el.tag.endswith('create_customer'):
                user_id    = get_text(root, 'user_id')
                customer_id = get_text(root, 'customer_id') or f"CUST-{str(uuid.uuid4())[:8].upper()}"
                name       = get_text(root, 'name')
                email      = get_text(root, 'email')
                phone      = get_text(root, 'phone')
                address    = get_text(root, 'address')
                lat        = get_text(root, 'latitude')
                lng        = get_text(root, 'longitude')

                if not name or not email or not phone:
                    body = '<create_customer_response><status>Error</status><message>Missing required fields: name, email, phone</message></create_customer_response>'
                    return Response(soap_response(body), content_type='text/xml')

                existing = customers_collection.find_one({"email": email})
                if existing:
                    # Return existing customer info silently (idempotent)
                    body = f'<create_customer_response><status>Success</status><customer_id>{existing["customer_id"]}</customer_id><message>Customer already exists</message></create_customer_response>'
                    return Response(soap_response(body), content_type='text/xml')

                location = {"address": address or ""}
                if address:
                    detected = detect_district(address)
                    if detected:
                        location["latitude"] = detected["latitude"]
                        location["longitude"] = detected["longitude"]
                        location["district"] = detected["district"]
                if lat and lng:
                    location["latitude"] = float(lat)
                    location["longitude"] = float(lng)

                doc = {
                    "user_id": user_id or "",
                    "customer_id": customer_id,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "role": "customer",
                    "current_location": location,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
                customers_collection.insert_one(doc)
                body = f'<create_customer_response><status>Success</status><customer_id>{customer_id}</customer_id><message>Customer created successfully</message></create_customer_response>'
                return Response(soap_response(body), content_type='text/xml')

            elif el.tag.endswith('get_customer'):
                cid = get_text(root, 'customer_id')
                if not cid:
                    body = '<get_customer_response><status>Error</status><message>customer_id is required</message></get_customer_response>'
                    return Response(soap_response(body), content_type='text/xml')

                c = customers_collection.find_one({"customer_id": cid})
                if not c:
                    body = '<get_customer_response><status>Error</status><message>Customer not found</message></get_customer_response>'
                    return Response(soap_response(body), content_type='text/xml')

                loc = c.get('current_location', {})
                location_xml = f"""<current_location>
                    <address>{loc.get('address','')}</address>
                    <latitude>{loc.get('latitude','')}</latitude>
                    <longitude>{loc.get('longitude','')}</longitude>
                </current_location>"""

                body = f"""<get_customer_response>
                  <status>Success</status>
                  <customer>
                    <customer_id>{c['customer_id']}</customer_id>
                    <name>{c['name']}</name>
                    <email>{c['email']}</email>
                    <phone>{c['phone']}</phone>
                    <role>{c['role']}</role>
                    {location_xml}
                  </customer>
                </get_customer_response>"""
                return Response(soap_response(body), content_type='text/xml')

        return Response("Method not found", status=400)
    except Exception as e:
        body = f'<soap_error><status>Error</status><message>{str(e)}</message></soap_error>'
        return Response(soap_response(body), content_type='text/xml', status=500)


# ─── /orderService (SOAP) ─────────────────────────────────────────────────────

@app.route('/orderService', methods=['POST'])
def order_service():
    try:
        root = ET.fromstring(request.data)

        for el in root.iter():

            if el.tag.endswith('create_order'):
                order_id    = get_text(root, 'orderID')
                customer_id = get_text(root, 'customer_id')
                total_amount = get_text(root, 'totalAmount')
                priority    = get_text(root, 'priority') or 'low'
                delivery_addr = get_text(root, 'delivery_address') or ''

                if not order_id or not customer_id or not total_amount:
                    body = '<create_order_response><status>Error</status><message>Missing required fields</message></create_order_response>'
                    return Response(soap_response(body), content_type='text/xml')

                # Verify customer
                customer = customers_collection.find_one({"customer_id": customer_id})
                if not customer:
                    body = '<create_order_response><status>Error</status><message>Customer not found</message></create_order_response>'
                    return Response(soap_response(body), content_type='text/xml')

                # Extract items
                items = []
                for item_el in root.iter():
                    if item_el.tag.endswith('item'):
                        pid, iname, qty, price, img = None, None, 1, 0.0, ""
                        for child in item_el:
                            tag = child.tag.split('}')[-1]
                            if tag == 'product_id': pid = child.text
                            elif tag == 'name': iname = child.text
                            elif tag == 'quantity': qty = int(child.text or 1)
                            elif tag == 'price': price = float(child.text or 0)
                            elif tag == 'image': img = child.text or ""
                        if pid and iname:
                            items.append({"product_id": pid, "name": iname, "quantity": qty, "price": price, "image": img})

                doc = {
                    "orderID": order_id,
                    "customer_id": customer_id,
                    "items": items,
                    "totalAmount": float(total_amount),
                    "priority": priority,
                    "delivery_address": delivery_addr,
                    "customer_name": customer.get('name', ''),
                    "customer_phone": customer.get('phone', ''),
                    "customer_location": customer.get('current_location', {}),
                    "status": "pending",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
                orders_collection.insert_one(doc)
                body = f'''<create_order_response>
                  <status>Success</status>
                  <orderID>{order_id}</orderID>
                  <message>Order created successfully</message>
                </create_order_response>'''
                return Response(soap_response(body), content_type='text/xml')

            elif el.tag.endswith('get_customer_orders'):
                cid = get_text(root, 'customer_id')
                if not cid:
                    body = '<get_customer_orders_response><status>Error</status><message>customer_id required</message></get_customer_orders_response>'
                    return Response(soap_response(body), content_type='text/xml')
                orders = list(orders_collection.find({"customer_id": cid}))
                orders_xml = _build_orders_xml(orders)
                body = f'''<get_customer_orders_response>
                  <status>Success</status>
                  <customer_id>{cid}</customer_id>
                  <orders_count>{len(orders)}</orders_count>
                  <orders>{orders_xml}</orders>
                </get_customer_orders_response>'''
                return Response(soap_response(body), content_type='text/xml')

            elif el.tag.endswith('get_order'):
                oid = get_text(root, 'orderID')
                if not oid:
                    body = '<get_order_response><status>Error</status><message>orderID required</message></get_order_response>'
                    return Response(soap_response(body), content_type='text/xml')
                order = orders_collection.find_one({"orderID": oid})
                if not order:
                    body = '<get_order_response><status>Error</status><message>Order not found</message></get_order_response>'
                    return Response(soap_response(body), content_type='text/xml')
                orders_xml = _build_orders_xml([order])
                body = f'<get_order_response><status>Success</status><orders>{orders_xml}</orders></get_order_response>'
                return Response(soap_response(body), content_type='text/xml')

        return Response("Method not found", status=400)
    except Exception as e:
        return Response(f"Error: {e}", status=500)


def _build_orders_xml(orders):
    xml = ""
    for o in orders:
        items_xml = ""
        for item in o.get('items', []):
            items_xml += f"""<item>
              <product_id>{item.get('product_id','')}</product_id>
              <name>{item.get('name','')}</name>
              <quantity>{item.get('quantity',0)}</quantity>
              <price>{item.get('price',0)}</price>
              <image>{item.get('image','')}</image>
            </item>"""
        created = o.get('created_at', '')
        if isinstance(created, datetime):
            created = created.isoformat()
        updated = o.get('updated_at', '')
        if isinstance(updated, datetime):
            updated = updated.isoformat()
        xml += f"""<order>
          <_id>{str(o.get('_id',''))}</_id>
          <orderID>{o.get('orderID','')}</orderID>
          <customer_id>{o.get('customer_id','')}</customer_id>
          <totalAmount>{o.get('totalAmount',0)}</totalAmount>
          <priority>{o.get('priority','')}</priority>
          <status>{o.get('status','pending')}</status>
          <delivery_address>{o.get('delivery_address','')}</delivery_address>
          <created_at>{created}</created_at>
          <updated_at>{updated}</updated_at>
          <items>{items_xml}</items>
        </order>"""
    return xml


# ─── GET /getOrders/<customerID> ──────────────────────────────────────────────

@app.route('/getOrders/<customer_id>', methods=['GET'])
def get_orders_by_customer(customer_id):
    try:
        customer = customers_collection.find_one({"customer_id": customer_id})
        if not customer:
            body = '<get_orders_response><status>Error</status><message>Customer not found</message></get_orders_response>'
            return Response(soap_response(body), content_type='text/xml')
        orders = list(orders_collection.find({"customer_id": customer_id}))
        orders_xml = _build_orders_xml(orders)
        body = f'''<get_orders_response>
          <status>Success</status>
          <customer_id>{customer_id}</customer_id>
          <orders_count>{len(orders)}</orders_count>
          <orders>{orders_xml}</orders>
        </get_orders_response>'''
        return Response(soap_response(body), content_type='text/xml')
    except Exception as e:
        body = f'<get_orders_response><status>Error</status><message>{str(e)}</message></get_orders_response>'
        return Response(soap_response(body), content_type='text/xml', status=500)


# ─── POST /api/updateStatus ───────────────────────────────────────────────────

@app.route('/api/updateStatus', methods=['POST'])
def update_order_status():
    try:
        root = ET.fromstring(request.data)
        # Use exact tag match to avoid endswith('status') matching <update_status>
        order_id = None
        status = None
        for el in root.iter():
            tag = el.tag.split('}')[-1]  # strip namespace if any
            if tag == 'orderID' and el.text:
                order_id = el.text.strip()
            elif tag == 'status' and el.text:
                status = el.text.strip()
        if not order_id or not status:
            body = '<update_status_response><status>Error</status><message>orderID and status are required</message></update_status_response>'
            return Response(soap_response(body), content_type='text/xml')
        result = orders_collection.update_one({"orderID": order_id}, {"$set": {"status": status, "updated_at": datetime.utcnow()}})
        if result.matched_count == 0:
            body = '<update_status_response><status>Error</status><message>Order not found</message></update_status_response>'
            return Response(soap_response(body), content_type='text/xml')
        body = f'<update_status_response><status>Success</status><orderID>{order_id}</orderID><new_status>{status}</new_status></update_status_response>'
        return Response(soap_response(body), content_type='text/xml')
    except Exception as e:
        body = f'<update_status_response><status>Error</status><message>{str(e)}</message></update_status_response>'
        return Response(soap_response(body), content_type='text/xml', status=500)


# ─── POST /getDeliveryLocation ────────────────────────────────────────────────

@app.route('/getDeliveryLocation', methods=['POST'])
def get_delivery_location():
    try:
        root = ET.fromstring(request.data)
        order_id = get_text(root, 'orderID')
        if not order_id:
            body = '<get_delivery_location_response><status>Error</status><message>orderID required</message></get_delivery_location_response>'
            return Response(soap_response(body), content_type='text/xml')

        order = orders_collection.find_one({"orderID": order_id})
        if not order:
            body = '<get_delivery_location_response><status>Error</status><message>Order not found</message></get_delivery_location_response>'
            return Response(soap_response(body), content_type='text/xml')

        customer = customers_collection.find_one({"customer_id": order.get('customer_id')})
        if not customer:
            body = '<get_delivery_location_response><status>Error</status><message>Customer not found</message></get_delivery_location_response>'
            return Response(soap_response(body), content_type='text/xml')

        loc = customer.get('current_location', {})
        body = f'''<get_delivery_location_response>
          <status>Success</status>
          <orderID>{order_id}</orderID>
          <customer_id>{customer['customer_id']}</customer_id>
          <customer_name>{customer.get('name','')}</customer_name>
          <customer_phone>{customer.get('phone','')}</customer_phone>
          <priority>{order.get('priority','')}</priority>
          <order_status>{order.get('status','')}</order_status>
          <totalAmount>{order.get('totalAmount','')}</totalAmount>
          <delivery_location>
            <address>{loc.get('address','')}</address>
            <latitude>{loc.get('latitude','')}</latitude>
            <longitude>{loc.get('longitude','')}</longitude>
          </delivery_location>
        </get_delivery_location_response>'''
        return Response(soap_response(body), content_type='text/xml')
    except Exception as e:
        body = f'<get_delivery_location_response><status>Error</status><message>{str(e)}</message></get_delivery_location_response>'
        return Response(soap_response(body), content_type='text/xml', status=500)


# ─── Health check ─────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return {"status": "ok", "service": "SwiftTrack CMS (SOAP)", "port": 8000}


if __name__ == '__main__':
    print("✅ SwiftTrack CMS SOAP Server starting on http://127.0.0.1:8000")
    app.run(host='0.0.0.0', port=8000, debug=False)
