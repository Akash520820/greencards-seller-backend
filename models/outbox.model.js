const mongoose = require("mongoose");

/**
 * Transactional Outbox for seller-backend.
 * See user-backend/models/outbox.model.js for full documentation.
 */
const outboxSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        "ORDER_CREATED",
        "ORDER_CANCELLED",
        "ORDER_PAID",
        "STOCK_RESERVED",
        "STOCK_FAILED",
        "RETURN_REQUESTED",
        "REFUND_ISSUED",
      ],
    },
    payload:       { type: mongoose.Schema.Types.Mixed, required: true },
    targetService: {
      type: String,
      required: true,
      enum: ["user-backend", "seller-backend", "admin-backend", "superadmin-backend"],
    },
    status:        { type: String, enum: ["PENDING", "PUBLISHED", "FAILED"], default: "PENDING", index: true },
    attempts:      { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    publishedAt:   { type: Date },
    errorMessage:  { type: String },
  },
  { timestamps: true }
);

outboxSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Outbox", outboxSchema);
