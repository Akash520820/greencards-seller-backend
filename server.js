require("dotenv").config();
const app = require("./app");
const connectDB = require("./shared/db/index");
const logger = require("./shared/utils/logger");

const PORT = process.env.SELLER_SERVICE_PORT || 5002;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`🏪 Seller Microservice running on port ${PORT}`);
      console.log(`🏪 Seller Microservice running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("MongoDB connection failed in Seller Microservice:", err);
    process.exit(1);
  });
