const logger = require("./logger");

/**
 * Sends a security event to superadmin-backend's append-only audit log.
 * Identical pattern to user-backend — fire-and-forget, never throws.
 */
const logSecurityEvent = async ({
  action,
  performedBy,
  targetEntity,
  targetId,
  severity = "INFO",
  metadata = {},
  ipAddress,
}) => {
  const superadminUrl = process.env.SUPERADMIN_BACKEND_INTERNAL_URL;
  if (!superadminUrl) {
    logger.warn("logSecurityEvent: SUPERADMIN_BACKEND_INTERNAL_URL not set", { action, severity });
    return;
  }
  try {
    await fetch(`${superadminUrl}/internal/audit`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET,
      },
      body:   JSON.stringify({ action, performedBy, targetEntity, targetId, severity, metadata, ipAddress }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    logger.error("logSecurityEvent: failed to write audit log", { action, severity, error: err.message });
  }
};

module.exports = { logSecurityEvent };
