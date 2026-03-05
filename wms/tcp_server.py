"""
SwiftTrack WMS TCP Server v2.0
Handles order processing and status updates via proprietary TCP/IP protocol
Message format: key1=value1|key2=value2|...\n
"""
import socketserver
import logging
import json
import time
import socket
from datetime import datetime
from threading import Thread
from collections import defaultdict
import pymongo
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [WMS] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://lala:lala%23%24patronus78@cluster0.ezv2ieh.mongodb.net/?appName=Cluster0")
DB_NAME = "WMS"

mongo_client = None
orders_collection = None
order_references = defaultdict(dict)

# ESB status update listener
STATUS_UPDATE_HOST = os.getenv("STATUS_UPDATE_HOST", "127.0.0.1")
STATUS_UPDATE_PORT = int(os.getenv("STATUS_UPDATE_PORT", 5001))


def init_mongodb():
    global mongo_client, orders_collection
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.admin.command('ping')
        db = mongo_client[DB_NAME]
        orders_collection = db["orders"]
        orders_collection.create_index([("orderId", pymongo.ASCENDING)], unique=True)
        orders_collection.create_index([("created_at", pymongo.DESCENDING)])
        logger.info("✅ WMS connected to MongoDB")
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.warning(f"MongoDB unavailable: {e}. Operating without persistence.")
        return False
    except Exception as e:
        logger.warning(f"MongoDB init error: {e}")
        return False


class TCPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        logger.info(f"Connection from {self.client_address}")
        try:
            data_buffer = bytearray()
            while True:
                chunk = self.request.recv(4096)
                if not chunk:
                    return
                data_buffer.extend(chunk)
                if b"\n" in chunk:
                    break
                if len(data_buffer) > 65536:
                    break

            data_str = data_buffer.decode('utf-8').strip()
            logger.info(f"Received: {data_str}")

            order_dict = {}
            for pair in data_str.split("|"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    try:
                        if v.startswith("{") or v.startswith("["):
                            v = json.loads(v)
                    except json.JSONDecodeError:
                        pass
                    order_dict[k.strip()] = v

            event = order_dict.get("event", "")

            if event == "test":
                self.request.sendall(b"status=success|message=Test received|event=test_response\n")
            elif event == "update_status":
                self._handle_status_update(order_dict)
            else:
                self._handle_order_processing(order_dict)

        except Exception as e:
            logger.error(f"Handler error: {e}", exc_info=True)
            try:
                self.request.sendall(f"status=error|message={str(e)}\n".encode('utf-8'))
            except Exception:
                pass

    def _handle_order_processing(self, order_dict):
        order_id = order_dict.get("orderId", f"ORD-{int(time.time())}")
        reference = f"REF-{int(time.time())}"
        priority = order_dict.get("priority", "low").lower()
        if priority not in ["high", "low"]:
            priority = "low"
        total_amount = float(order_dict.get("totalAmount", 0.0))
        now = datetime.now()

        order_references[order_id] = {"reference_number": reference, "status": "pending", "priority": priority}

        if orders_collection is not None:
            try:
                orders_collection.update_one(
                    {"orderId": order_id},
                    {"$set": {
                        "orderId": order_id,
                        "status": "pending",
                        "priority": priority,
                        "totalAmount": total_amount,
                        "order_data": order_dict,
                        "created_at": now,
                        "last_updated": now,
                    }},
                    upsert=True
                )
                logger.info(f"Order {order_id} saved to MongoDB")
            except Exception as e:
                logger.error(f"MongoDB write error: {e}")

        response = f"status=success|message=Order processed|orderId={order_id}|reference_number={reference}|priority={priority}\n"
        self.request.sendall(response.encode('utf-8'))
        logger.info(f"Processed order {order_id}")

    def _handle_status_update(self, data_dict):
        order_id = data_dict.get("orderId", "")
        status = data_dict.get("status", "")
        if not order_id or not status:
            self.request.sendall(b"status=error|message=Missing orderId or status\n")
            return

        ref_data = order_references.get(order_id, {})
        reference = ref_data.get("reference_number", f"REF-UNKNOWN-{int(time.time())}")

        if order_id in order_references:
            order_references[order_id]["status"] = status

        if orders_collection is not None:
            try:
                now = datetime.now()
                orders_collection.update_one(
                    {"orderId": order_id},
                    {
                        "$set": {"status": status, "last_updated": now},
                        "$push": {"status_history": {"status": status, "timestamp": now}}
                    }
                )
                logger.info(f"Order {order_id} status → {status}")
            except Exception as e:
                logger.error(f"MongoDB status update error: {e}")

        # Forward to ESB status listener (non-blocking)
        forward_data = f"orderId={order_id}|status={status}|reference_number={reference}|timestamp={time.time()}"
        Thread(target=self._forward_status, args=(forward_data,), daemon=True).start()

        response = f"status=success|message=Status updated|orderId={order_id}|reference_number={reference}\n"
        self.request.sendall(response.encode('utf-8'))

    def _forward_status(self, data):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(2)
                sock.connect((STATUS_UPDATE_HOST, STATUS_UPDATE_PORT))
                sock.sendall(f"{data}\n".encode('utf-8'))
        except (ConnectionRefusedError, socket.timeout):
            logger.debug("Status forwarding target not available (non-critical)")
        except Exception as e:
            logger.debug(f"Status forward error: {e}")


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    init_mongodb()
    HOST, PORT = "0.0.0.0", 9999
    with ThreadedTCPServer((HOST, PORT), TCPHandler) as server:
        print(f"✅ SwiftTrack WMS TCP Server listening on {HOST}:{PORT}")
        print("   Protocol: key=value|key=value|...\\n")
        print("   Events: new_order, update_status, test")
        server.serve_forever()
