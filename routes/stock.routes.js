const { Router } = require("express");
const { streamStockUpdates, getStockByPublicId } = require("../controllers/stock.controller");
const { handleIncomingEvent } = require("../controllers/events.controller");

const router = Router();

// ─── Internal secret middleware ───────────────────────────────────────────────
// All /internal/* routes are NOT exposed through the API gateway.
// They are called directly by other microservices using a shared INTERNAL_API_SECRET.
const requireInternalSecret = (req, res, next) => {
  if (req.headers["x-internal-secret"] !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized — invalid internal secret" });
  }
  next();
};

// ─── Public SSE route (called by user portal frontend) ────────────────────────
// GET /api/v1/stock/stream?productIds=prd_abc,prd_xyz
router.get("/stream", streamStockUpdates);

// ─── Internal routes (service-to-service only) ────────────────────────────────
// GET /internal/stock/:publicId     — live stock query from user-backend
// POST /internal/events             — Saga event delivery from outbox poller
router.get("/internal/stock/:publicId", requireInternalSecret, getStockByPublicId);
router.post("/internal/events",         requireInternalSecret, handleIncomingEvent);

module.exports = router;
