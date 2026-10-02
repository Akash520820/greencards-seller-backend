const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");

const notFound = require("./shared/middleware/notFound.middleware");
const errorHandler = require("./shared/middleware/errorHandler.middleware");
const { apiLimiter } = require("./shared/middleware/rateLimiter.middleware");

const sellerRouter = require("./routes/seller.routes");
const stockRouter  = require("./routes/stock.routes");
const { handleIncomingEvent: handleSellerIncomingEvent, handleInternalCommand: handleSellerInternalCommand } = require("./controllers/events.controller");
const internalSecretGuard = require("./shared/middleware/internalSecret.middleware");

const app = express();

// Trust reverse proxy (Render / API Gateway) for express-rate-limit and X-Forwarded-For
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());

// ─── CORS allowlist ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (
  process.env.FRONTEND_ORIGINS ||
  "https://akash520820.github.io,http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        ALLOWED_ORIGINS.includes(origin) ||
        ALLOWED_ORIGINS.includes(origin.replace(/\/$/, "")) ||
        origin.endsWith(".github.io")
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// Health check endpoint (for Render & keep-alive pings - exempt from rate limiter)
app.get(["/health", "/api/v1/health"], (req, res) => {
  res.status(200).json({ status: "ok", service: "seller-backend", timestamp: new Date().toISOString() });
});

app.use(apiLimiter);

// Seller Microservice Routes (handles both /seller and /sellers)
app.use("/api/v1/sellers", sellerRouter);
app.use("/api/v1/seller", sellerRouter);

// Stock stream (SSE) + internal service-to-service routes
// Note: /internal/* routes bypass apiLimiter — they are not public endpoints
app.use("/api/v1/stock", stockRouter);
app.use("/internal",     stockRouter);

// Internal command endpoint — receives admin-driven mutations (suspend/reinstate seller).
// Called directly by admin-backend. NOT exposed through the API gateway.
// 🔒 Protected by x-internal-secret header guard.
app.post("/internal/commands", internalSecretGuard, handleSellerInternalCommand);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
