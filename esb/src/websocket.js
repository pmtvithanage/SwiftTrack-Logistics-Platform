import { WebSocketServer } from "ws";

let wss = null;
const clients = new Set();

export const setupWebSocket = (server) => {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`🔌 WebSocket client connected (total: ${clients.size})`);

    ws.send(JSON.stringify({ type: "connected", message: "SwiftTrack real-time connected" }));

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Echo back for now; extend with room-based subscriptions if needed
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (_) {}
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`🔌 WebSocket client disconnected (total: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
      clients.delete(ws);
    });
  });

  console.log("✅ WebSocket server initialized at /ws");
};

// Broadcast a message to all connected clients
export const broadcast = (data) => {
  if (!wss) return;
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  }
};
