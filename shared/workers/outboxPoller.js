const Outbox = require("../../models/outbox.model");
const logger = require("../utils/logger");

const SERVICE_URLS = {
  "user-backend":       process.env.USER_BACKEND_INTERNAL_URL,
  "admin-backend":      process.env.ADMIN_BACKEND_INTERNAL_URL,
  "superadmin-backend": process.env.SUPERADMIN_BACKEND_INTERNAL_URL,
};

const MAX_ATTEMPTS = 5;

const pollAndPublish = async () => {
  let events;
  try {
    events = await Outbox.find({ status: "PENDING" }).sort({ createdAt: 1 }).limit(50);
  } catch (err) {
    logger.error("Seller outbox poller: failed to query pending events", { error: err.message });
    return;
  }

  for (const event of events) {
    const targetUrl = SERVICE_URLS[event.targetService];
    if (!targetUrl) {
      logger.warn(`Seller outbox poller: no URL for "${event.targetService}" — skipping ${event._id}`);
      continue;
    }

    try {
      const response = await fetch(`${targetUrl}/internal/events`, {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-internal-secret": process.env.INTERNAL_API_SECRET,
        },
        body:   JSON.stringify({ eventType: event.eventType, payload: event.payload }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await Outbox.findByIdAndUpdate(event._id, { status: "PUBLISHED", publishedAt: new Date() });
      logger.info(`Seller outbox: delivered ${event.eventType} → ${event.targetService}`);
    } catch (err) {
      const newAttempts = event.attempts + 1;
      await Outbox.findByIdAndUpdate(event._id, {
        attempts:      newAttempts,
        lastAttemptAt: new Date(),
        errorMessage:  err.message,
        status:        newAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      });
      if (newAttempts >= MAX_ATTEMPTS) {
        logger.error(`Seller outbox: event ${event._id} FAILED after ${MAX_ATTEMPTS} attempts`, { error: err.message });
      }
    }
  }
};

const startPoller = () => {
  logger.info("Seller outbox poller started — polling every 5s");
  pollAndPublish();
  setInterval(pollAndPublish, 5_000);
};

module.exports = { startPoller, pollAndPublish };
