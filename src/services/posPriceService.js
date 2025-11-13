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

async function getPriceForKey(sku, menuId, precedence = 'sku') {
  const exists = await ensureTableExists();
  if (!exists) {
    logger.debug('POS catalog table not present; skipping price lookup', { table: 'pos_skus' });
    return null;
  }
  // Normalize precedence
  const pref = (precedence || 'sku').toLowerCase();
  let price = null;
  try {
    if (pref === 'menuid' && menuId) {
      // Attempt menu_id column first
      const r = await database.query('SELECT price FROM pos_skus WHERE menu_id = ?', [menuId]);
      if (r.rows.length > 0) price = Number(r.rows[0].price);
      // Fallback to sku if not found and sku provided
      if ((price === null || !Number.isFinite(price)) && sku) {
        const r2 = await database.query('SELECT price FROM pos_skus WHERE sku = ?', [sku]);
        if (r2.rows.length > 0) price = Number(r2.rows[0].price);
      }
    } else if (sku) {
      const r = await database.query('SELECT price FROM pos_skus WHERE sku = ?', [sku]);
      if (r.rows.length > 0) price = Number(r.rows[0].price);
      if ((price === null || !Number.isFinite(price)) && menuId) {
        const r2 = await database.query('SELECT price FROM pos_skus WHERE menu_id = ?', [menuId]);
        if (r2.rows.length > 0) price = Number(r2.rows[0].price);
      }
    } else if (menuId) {
      const r = await database.query('SELECT price FROM pos_skus WHERE menu_id = ?', [menuId]);
      if (r.rows.length > 0) price = Number(r.rows[0].price);
    }
    if (price !== null && Number.isFinite(price)) return +price;
    return null;
  } catch (e) {
    logger.warn('POS item key price lookup failed', { sku, menuId, precedence: pref, error: e.message });
    return null;
  }
}

// Backward compatibility wrapper (sku-only)
async function getPriceForSku(sku) {
  return getPriceForKey(sku, null, 'sku');
}

module.exports = { getPriceForKey, getPriceForSku };
