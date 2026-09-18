const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");

const notFound = require("./shared/middleware/notFound.middleware");
const errorHandler = require("./shared/middleware/errorHandler.middleware");
const { apiLimiter } = require("./shared/middleware/rateLimiter.middleware");

const sellerRouter = require("./routes/seller.routes");

const app = express();

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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
