const Product = require("../models/product.model");
const Outbox = require("../models/outbox.model");
const { broadcastStockUpdate } = require("./stock.controller");
const logger = require("../shared/utils/logger");

/**
 * Internal event handler — receives events from user-backend's outbox poller.
 *
 * POST /internal/events
 *
 * This is a Saga participant: it reacts to ORDER_CREATED by atomically
 * reserving stock, then emits STOCK_RESERVED or STOCK_FAILED back to
 * user-backend via its own outbox.
 *
 * All routes calling this handler are protected by INTERNAL_API_SECRET.
 */
const handleIncomingEvent = async (req, res) => {
  const { eventType, payload } = req.body;

  logger.info(`Internal event received: ${eventType}`, { payload });

  // Acknowledge immediately — the actual processing is async
  // This prevents the outbox poller from timing out and retrying unnecessarily
  res.status(200).json({ received: true });

  try {
    switch (eventType) {
      case "ORDER_CREATED":
        await handleOrderCreated(payload);
        break;
      case "ORDER_CANCELLED":
        await handleOrderCancelled(payload);
        break;
      default:
        logger.warn(`Unknown internal event type: ${eventType}`);
    }
  } catch (err) {
    logger.error(`Error processing internal event ${eventType}`, { error: err.message, payload });
  }
};

/**
 * Atomically reserves stock for each line item in the order.
 * Uses MongoDB's $inc + $gte to prevent race conditions (Layer 3 of 3-layer defense).
 * On success, emits STOCK_RESERVED. On failure, emits STOCK_FAILED.
 */
const handleOrderCreated = async (payload) => {
  const { orderId, publicId, userId, items } = payload;

  const reservationResults = await Promise.allSettled(
    items.map((item) => atomicReserveStock(item.productId, item.variant?.color, item.variant?.size, item.quantity))
  );

  const failedItems = reservationResults
    .map((r, i) => (r.status === "rejected" || r.value === false ? items[i] : null))
    .filter(Boolean);

  const allReserved = failedItems.length === 0;
  const eventType   = allReserved ? "STOCK_RESERVED" : "STOCK_FAILED";

  // If partial failure — restore the ones that DID succeed
  if (!allReserved && failedItems.length < items.length) {
    const successItems = items.filter((item, i) =>
      reservationResults[i].status === "fulfilled" && reservationResults[i].value === true
    );
    await Promise.allSettled(
      successItems.map((item) => restoreStock(item.productId, item.variant?.color, item.variant?.size, item.quantity))
    );
  }

  // Emit Saga response event via outbox
  await Outbox.create({
    eventType,
    targetService: "user-backend",
    payload: {
      orderId,
      publicId,
      userId,
      failedItems: allReserved ? [] : failedItems,
    },
  });

  // Broadcast updated stock to all SSE subscribers for each product
  if (allReserved) {
    for (const item of items) {
      try {
        const product = await Product.findOne(
          { publicId: item.productId },
          { publicId: 1, stock: 1, colorVariants: 1, isActive: 1 }
        );
        if (product) {
          broadcastStockUpdate(product.publicId, {
            stock:         product.stock,
            colorVariants: product.colorVariants,
            isActive:      product.isActive,
          });
        }
      } catch (err) {
        logger.warn(`Failed to broadcast stock update for ${item.productId}`, { error: err.message });
      }
    }
  }

  logger.info(`Saga: ${eventType} for order ${orderId}`, { failedCount: failedItems.length });
};

/**
 * Restores stock when an order is cancelled.
 */
const handleOrderCancelled = async (payload) => {
  const { items } = payload;

  await Promise.allSettled(
    (items || []).map((item) =>
      restoreStock(item.productId, item.variant?.color, item.variant?.size, item.quantity)
    )
  );

  // Broadcast updated stock after restoration
  for (const item of items || []) {
    try {
      const product = await Product.findOne(
        { publicId: item.productId },
        { publicId: 1, stock: 1, colorVariants: 1, isActive: 1 }
      );
      if (product) {
        broadcastStockUpdate(product.publicId, {
          stock:         product.stock,
          colorVariants: product.colorVariants,
          isActive:      product.isActive,
        });
      }
    } catch (err) {
      logger.warn(`Failed to broadcast stock update after cancel for ${item.productId}`, { error: err.message });
    }
  }
};

/**
 * Atomically decrements stock for one order line item.
 * Uses $gte condition — returns false if stock is insufficient (race-condition safe).
 */
const atomicReserveStock = async (publicId, color, size, quantity) => {
  if (color && size) {
    const updated = await Product.findOneAndUpdate(
      {
        publicId,
        isActive: true,
        colorVariants: {
          $elemMatch: {
            color,
            sizes: { $elemMatch: { size, stock: { $gte: quantity } } },
          },
        },
      },
      {
        $inc: {
          "colorVariants.$[cv].sizes.$[sz].stock": -quantity,
          totalSold: quantity,
        },
      },
      {
        arrayFilters: [{ "cv.color": color }, { "sz.size": size, "sz.stock": { $gte: quantity } }],
        new: true,
      }
    );
    return updated !== null;
  }

  const updated = await Product.findOneAndUpdate(
    { publicId, isActive: true, stock: { $gte: quantity } },
    { $inc: { stock: -quantity, totalSold: quantity } },
    { new: true }
  );
  return updated !== null;
};

/**
 * Restores stock (used for cancellations and Saga compensations).
 */
const restoreStock = async (publicId, color, size, quantity) => {
  if (color && size) {
    return Product.findOneAndUpdate(
      { publicId, colorVariants: { $elemMatch: { color, "sizes.size": size } } },
      { $inc: { "colorVariants.$[cv].sizes.$[sz].stock": quantity } },
      {
        arrayFilters: [{ "cv.color": color }, { "sz.size": size }],
        new: true,
      }
    );
  }
  return Product.findOneAndUpdate({ publicId }, { $inc: { stock: quantity } }, { new: true });
};

module.exports = { handleIncomingEvent };
