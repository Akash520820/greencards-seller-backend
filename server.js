require("dotenv").config();
const app = require("./app");
const connectDB = require("./shared/db/index");
const logger = require("./shared/utils/logger");
const { startPoller } = require("./shared/workers/outboxPoller");
const startKeepAlive = require("./shared/utils/keepAlive");

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
