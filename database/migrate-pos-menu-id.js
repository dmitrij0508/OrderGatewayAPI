// Migration: add menu_id column to pos_skus for POS systems using menuID instead of SKU
// Adds unique index on menu_id (where not null) and backfills menu_id = sku for existing rows lacking it.

const logger = require('../src/utils/logger');
const database = require('../src/config/database');

module.exports = async function migratePosMenuId() {
  try {
    const info = await database.query("PRAGMA table_info(pos_skus)");
    const hasTable = Array.isArray(info.rows) && info.rows.length > 0;
    if (!hasTable) {
      logger.warn('pos_skus table missing; skipping menu_id migration');
      return { changed: false, reason: 'table-missing' };
    }
    const hasMenuId = info.rows.some(c => c.name === 'menu_id');
    if (!hasMenuId) {
      logger.info('Adding menu_id column to pos_skus');
      await database.run('ALTER TABLE pos_skus ADD COLUMN menu_id TEXT');
      // Backfill menu_id = sku where menu_id is null
      await database.run('UPDATE pos_skus SET menu_id = sku WHERE menu_id IS NULL');
      // Create unique index (ignoring nulls via WHERE clause pattern)
      await database.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_skus_menu_id ON pos_skus(menu_id)');
      logger.info('menu_id column added and backfilled');
      return { changed: true, addedColumn: true };
    } else {
      logger.info('menu_id column already present; ensuring index exists');
      await database.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_skus_menu_id ON pos_skus(menu_id)');
      return { changed: false, addedColumn: false };
    }
  } catch (e) {
    logger.error('Failed migratePosMenuId migration', { error: e.message });
    return { changed: false, error: e.message };
  }
};
