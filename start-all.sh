#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

PIDS=()

cleanup() {
    echo ""
    echo "Stopping all services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null
    done
    echo "All services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

start_service() {
    local name="$1"
    local dir="$2"
    local cmd="$3"
    local log="$LOG_DIR/${name}.log"

    echo "Starting $name..."
    bash -c "cd '$dir' && $cmd" > "$log" 2>&1 &
    local pid=$!
    PIDS+=("$pid")
    echo "  $name started (PID $pid) — logs: logs/${name}.log"
}

setup_python_venv() {
    local dir="$1"
    if [ ! -d "$dir/venv" ]; then
        echo "  Creating venv in $dir..."
        python3 -m venv "$dir/venv"
    fi
    "$dir/venv/bin/pip" install -q -r "$dir/requirements.txt"
}

echo "===================================="
echo "  SwiftTrack - Starting All Services"
echo "===================================="
echo ""

# --- Python services: set up venvs first ---
echo "Setting up Python environments..."
for svc in cms ros wms; do
    setup_python_venv "$SCRIPT_DIR/$svc"
done
echo ""

# --- Start backends ---
start_service "products"  "$SCRIPT_DIR/products"  "npm install --silent && npm start"
start_service "cms"       "$SCRIPT_DIR/cms"        "venv/bin/python app.py"
start_service "ros"       "$SCRIPT_DIR/ros"        "venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"
start_service "wms"       "$SCRIPT_DIR/wms"        "venv/bin/python tcp_server.py"

echo ""
echo "Waiting 5 seconds for backends to initialise..."
sleep 5

# --- Start ESB ---
start_service "esb"       "$SCRIPT_DIR/esb"        "npm install --silent && npm start"

echo ""
echo "Waiting 3 seconds for ESB to initialise..."
sleep 3

# --- Start front-ends ---
start_service "web"       "$SCRIPT_DIR/web"        "npm install --silent && npm start"
start_service "driver"    "$SCRIPT_DIR/driver"     "npm install --silent && npm start"

echo ""
echo "===================================="
echo "  All services launched!"
echo "  Web App (Customer) -> http://localhost:3000"
echo "  Driver App         -> http://localhost:3001"
echo "  ESB / API          -> http://localhost:8290"
echo "  CMS (SOAP)         -> http://localhost:8000"
echo "  ROS                -> http://localhost:8001"
echo "  WMS (TCP)          -> localhost:9999"
echo "  Products           -> http://localhost:5999"
echo ""
echo "  Logs saved to: logs/"
echo "  Press Ctrl+C to stop all services."
echo "===================================="

# Keep alive
wait
