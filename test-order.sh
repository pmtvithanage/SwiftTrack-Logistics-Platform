#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  SwiftTrack – Order Place & Fetch Test
#  Tests: signup/login → place order → fetch orders
# ─────────────────────────────────────────────────────────────

ESB="http://localhost:8290"
PASS=0; FAIL=0

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✅ PASS${NC} – $1"; ((PASS++)); }
fail() { echo -e "${RED}  ❌ FAIL${NC} – $1"; ((FAIL++)); }
info() { echo -e "${CYAN}  ▶ $1${NC}"; }
sep()  { echo -e "${YELLOW}──────────────────────────────────────────${NC}"; }

# ── Helper: pretty-print JSON ──────────────────────────────────────────────────
pj() { echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"; }

sep
echo -e "${YELLOW}  SwiftTrack — Order Place & Fetch Test${NC}"
sep

# ── 1. ESB Health Check ────────────────────────────────────────────────────────
info "1. ESB health check"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$ESB/health")
if [ "$HEALTH" = "200" ]; then
  ok "ESB is up (HTTP 200)"
else
  fail "ESB not reachable (HTTP $HEALTH) — make sure ./start-all.sh is running"
  echo ""; echo "Aborting – ESB must be running first."; exit 1
fi

# ── 2. Sign up a test customer ──────────────────────────────────────────────────
sep
info "2. Registering test customer"

TEST_EMAIL="testcustomer_$(date +%s)@swifttrack.test"
TEST_PASS="Test@12345"
TEST_NAME="Test Customer"
TEST_PHONE="0771234567"
TEST_ADDR="123 Main St, Colombo"

SIGNUP_RES=$(curl -s -X POST "$ESB/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name":    "'"$TEST_NAME"'",
    "email":   "'"$TEST_EMAIL"'",
    "phone":   "'"$TEST_PHONE"'",
    "password":"'"$TEST_PASS"'",
    "role":    "customer",
    "address": "'"$TEST_ADDR"'"
  }')
echo "  Response: $(pj "$SIGNUP_RES")"

TOKEN=$(echo "$SIGNUP_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
  ok "Signup successful – got JWT token"
  CUSTOMER_ID=$(echo "$SIGNUP_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('customer_id',''))" 2>/dev/null)
  info "  customer_id = $CUSTOMER_ID"
else
  fail "Signup failed – trying login with existing account"

  # Try login if email already exists
  LOGIN_RES=$(curl -s -X POST "$ESB/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"'"$TEST_EMAIL"'","password":"'"$TEST_PASS"'"}')
  echo "  Login response: $(pj "$LOGIN_RES")"

  TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
  CUSTOMER_ID=$(echo "$LOGIN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('customer_id',''))" 2>/dev/null)

  if [ -n "$TOKEN" ]; then
    ok "Login successful – got JWT token"
  else
    fail "Both signup and login failed – aborting"
    exit 1
  fi
fi

echo "  customer_id : $CUSTOMER_ID"
echo "  token       : ${TOKEN:0:40}..."

# ── 3. Place a test order ──────────────────────────────────────────────────────
sep
ORDER_ID="ORD-TEST-$(date +%s)"
info "3. Placing order: $ORDER_ID"

ORDER_RES=$(curl -s -X POST "$ESB/cms/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_id":    "'"$ORDER_ID"'",
    "customer_id": "'"$CUSTOMER_ID"'",
    "totalAmount": 2750.00,
    "priority":    "high",
    "delivery_address": {
      "address":   "'"$TEST_ADDR"'",
      "latitude":  6.9271,
      "longitude": 79.8612
    },
    "items": [
      {
        "product_id": "PROD-001",
        "name":       "Organic Apples (1kg)",
        "quantity":   2,
        "price":      850.00,
        "image":      ""
      },
      {
        "product_id": "PROD-002",
        "name":       "Whole Milk (1L)",
        "quantity":   3,
        "price":      350.00,
        "image":      ""
      }
    ]
  }')

echo "  Response: $(pj "$ORDER_RES")"

PLACE_STATUS=$(echo "$ORDER_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null)
if echo "$PLACE_STATUS" | grep -qi "success\|created"; then
  ok "Order placed successfully (order_id: $ORDER_ID)"
else
  fail "Order placement failed — message: $PLACE_STATUS"
fi

# ── 4. Fetch orders for this customer ─────────────────────────────────────────
sep
info "4. Fetching orders for customer: $CUSTOMER_ID"
sleep 1   # brief pause for DB write

FETCH_RES=$(curl -s -X GET "$ESB/cms/orders/$CUSTOMER_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "  Response: $(pj "$FETCH_RES")"

ORDER_COUNT=$(echo "$FETCH_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count',0))" 2>/dev/null)
if [ "$ORDER_COUNT" -gt "0" ] 2>/dev/null; then
  ok "Fetched $ORDER_COUNT order(s) for customer"

  # Check if our test order is in the results
  FOUND=$(echo "$FETCH_RES" | python3 -c "
import sys, json
d = json.load(sys.stdin)
orders = d.get('orders', [])
target = '$ORDER_ID'
match = [o for o in orders if o.get('orderID') == target or o.get('order_id') == target]
print('yes' if match else 'no')
" 2>/dev/null)

  if [ "$FOUND" = "yes" ]; then
    ok "Test order '$ORDER_ID' found in fetched results"
  else
    fail "Test order '$ORDER_ID' NOT found in fetched results (may be eventual consistency delay)"
  fi
else
  fail "No orders returned (count=$ORDER_COUNT)"
fi

# ── 5. Summary ─────────────────────────────────────────────────────────────────
sep
echo -e "${YELLOW}  Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC}"
sep
exit $FAIL
