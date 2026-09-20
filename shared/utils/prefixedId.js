/**
 * Generates human-readable prefixed IDs for cross-service entity references.
 * Identical copy to user-backend/shared/utils/prefixedId.js — kept in sync manually.
 *
 * Uses Node's built-in crypto.randomBytes — no external package needed,
 * fully CommonJS-compatible (uuid v9+ is ESM-only and breaks Jest).
 */
const crypto = require("crypto");

const PREFIXES = {
  user:     "usr",
  seller:   "sel",
  product:  "prd",
  order:    "ord",
  shipment: "shp",
  staff:    "stf",
  category: "cat",
};

const generateId = (entity) => {
  const prefix = PREFIXES[entity];
  if (!prefix) throw new Error(`Unknown entity type: "${entity}". Valid types: ${Object.keys(PREFIXES).join(", ")}`);
  const short = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${short}`;
};

module.exports = { generateId, PREFIXES };
