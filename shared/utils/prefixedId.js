/**
 * Generates human-readable prefixed IDs for cross-service entity references.
 * Identical copy to user-backend/shared/utils/prefixedId.js — kept in sync manually.
 */
const { v4: uuidv4 } = require("uuid");

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
  const short = uuidv4().replace(/-/g, "").substring(0, 12);
  return `${prefix}_${short}`;
};

module.exports = { generateId, PREFIXES };
