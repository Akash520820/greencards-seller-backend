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

const app = express();

// Trust reverse proxy (Render / API Gateway) for express-rate-limit and X-Forwarded-For
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(apiLimiter);

// Seller Microservice Routes (handles both /seller and /sellers)
app.use("/api/v1/sellers", sellerRouter);
app.use("/api/v1/seller", sellerRouter);

// Stock stream (SSE) + internal service-to-service routes
// Note: /internal/* routes bypass apiLimiter — they are not public endpoints
app.use("/api/v1/stock", stockRouter);
app.use("/internal",     stockRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
