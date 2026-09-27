require("dotenv").config();
const app = require("./app");
const connectDB = require("./shared/db/index");
const logger = require("./shared/utils/logger");
const { startPoller } = require("./shared/workers/outboxPoller");
const startKeepAlive = require("./shared/utils/keepAlive");

// ─── Fail-fast: required env vars ────────────────────────────────────────────
const REQUIRED_ENV_VARS = [
  "MONGODB_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];
const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`[seller-backend] Missing required environment variables: ${missing.join(", ")}`);
  console.error("Set them in your .env file (local) or Render Dashboard (production).");
  process.exit(1);
}

const PORT = process.env.PORT || process.env.SELLER_SERVICE_PORT || 5002;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`🏪 Seller Microservice running on port ${PORT}`);
      console.log(`🏪 Seller Microservice running on port ${PORT}`);
    });
    // Start background outbox poller — delivers STOCK_RESERVED/STOCK_FAILED to user-backend
    startPoller();
    // Start keep-alive self-pinging on Render
    startKeepAlive();
  })
  .catch((err) => {
    logger.error("MongoDB connection failed in Seller Microservice:", err);
    process.exit(1);
  });
