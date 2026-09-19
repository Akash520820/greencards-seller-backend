const Product = require("../models/product.model");
const logger = require("../shared/utils/logger");

// ─── In-memory SSE client registry ───────────────────────────────────────────
// Key:   product publicId (string)
// Value: Set of active Express response objects
//
// When a product's stock changes (seller updates inventory, order is placed,
// order is cancelled), broadcastStockUpdate() pushes the new stock data to
// every frontend that subscribed to that product.
const clients = new Map();

/**
 * SSE endpoint — Layer 1 of 3-layer stock defense.
 * Frontend subscribes here to receive real-time stock changes.
 * EventSource automatically reconnects on drop.
 *
 * GET /api/v1/stock/stream?productIds=prd_abc,prd_xyz
 */
const streamStockUpdates = async (req, res) => {
  const productIds = (req.query.productIds || "").split(",").filter(Boolean);

  // Server-Sent Events headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering for SSE

  // CORS — only allow the user portal origin
  const allowedOrigin = process.env.USER_PORTAL_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");

  res.flushHeaders();

  // Push initial stock snapshot so the frontend immediately has current data
  if (productIds.length > 0) {
    try {
      const products = await Product.find(
        { publicId: { $in: productIds } },
        { publicId: 1, stock: 1, colorVariants: 1, isActive: 1 }
      );
      res.write(`event: initial\ndata: ${JSON.stringify(products)}\n\n`);
    } catch (err) {
      logger.error("SSE: failed to send initial stock snapshot", { error: err.message });
    }
  }

  // Register this browser connection for each requested product
  productIds.forEach((id) => {
    if (!clients.has(id)) clients.set(id, new Set());
    clients.get(id).add(res);
  });

  // Heartbeat every 25s — Render's free tier closes idle connections after 30s.
  // The frontend EventSource will reconnect automatically, but heartbeating
  // avoids the unnecessary reconnect round-trip.
  const heartbeat = setInterval(() => {
    try {
      res.write(":heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  // Cleanup on client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    productIds.forEach((id) => {
      clients.get(id)?.delete(res);
      if (clients.get(id)?.size === 0) clients.delete(id);
    });
  });
};

/**
 * Broadcasts a stock update to all SSE clients subscribed to a product.
 *
 * Call this after ANY stock change:
 *   - Seller updates product inventory
 *   - ORDER_CREATED event reserves stock
 *   - ORDER_CANCELLED event restores stock
 *
 * @param {string} publicId     - Product publicId e.g. "prd_1a2b3c4d5e6f"
 * @param {object} stockData    - { stock, colorVariants, isActive }
 */
const broadcastStockUpdate = (publicId, stockData) => {
  const productClients = clients.get(publicId);
  if (!productClients || productClients.size === 0) return;

  const payload = JSON.stringify({ productId: publicId, ...stockData });
  const message = `event: stock_update\ndata: ${payload}\n\n`;

  productClients.forEach((res) => {
    try {
      res.write(message);
    } catch (err) {
      // Client disconnected without triggering the 'close' event
      productClients.delete(res);
      logger.warn("SSE: removed stale client connection", { productId: publicId });
    }
  });
};

/**
 * Internal stock query endpoint — called by user-backend's validateCartStock.
 * Returns the live stock data for a single product by publicId.
 *
 * GET /internal/stock/:publicId
 */
const getStockByPublicId = async (req, res) => {
  const { publicId } = req.params;

  // Verify internal secret
  if (req.headers["x-internal-secret"] !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const product = await Product.findOne(
    { publicId },
    { publicId: 1, stock: 1, colorVariants: 1, isActive: 1 }
  );

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.status(200).json({
    publicId:      product.publicId,
    stock:         product.stock,
    colorVariants: product.colorVariants,
    isActive:      product.isActive,
  });
};

module.exports = { streamStockUpdates, broadcastStockUpdate, getStockByPublicId };
