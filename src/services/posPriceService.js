const database = require('../config/database');
const logger = require('../utils/logger');

let hasTableChecked = false;
let tableExistsCache = false;

async function ensureTableExists() {
  if (hasTableChecked) return tableExistsCache;
  try {
    const res = await database.query("PRAGMA table_info(pos_skus)");
    tableExistsCache = Array.isArray(res.rows) && res.rows.length > 0;
  } catch (e) {
    tableExistsCache = false;
  } finally {
    hasTableChecked = true;
  }
  return tableExistsCache;
}

async function getPriceForSku(sku) {
  if (!sku) return null;
  const exists = await ensureTableExists();
  if (!exists) {
    logger.debug('POS catalog table not present; skipping price lookup', { table: 'pos_skus' });
    return null;
  }
  try {
    const result = await database.query('SELECT price FROM pos_skus WHERE sku = ?', [sku]);
    if (result.rows.length > 0) {
      const price = Number(result.rows[0].price);
      return Number.isFinite(price) ? price : null;
    }
    return null;
  } catch (e) {
    logger.warn('POS SKU price lookup failed', { sku, error: e.message });
    return null;
  }
}

module.exports = { getPriceForSku };
