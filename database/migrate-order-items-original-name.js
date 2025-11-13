const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function applyOrderItemsOriginalNameMigration() {
  try {
    // SQLite path: use PRAGMA to inspect columns
    const tableInfo = await database.query("PRAGMA table_info(order_items)");
    const columns = tableInfo.rows.map(c => c.name);
    const hasOriginalName = columns.includes('original_name');

    if (hasOriginalName) {
      logger.debug('🔁 order_items.original_name already present - skipping');
      return { success: true, skipped: true };
    }

    logger.info('🛠️ Adding original_name column to order_items for preserving raw item descriptions');
    await database.run('ALTER TABLE order_items ADD COLUMN original_name TEXT');
    logger.info('✅ original_name column added to order_items');
    return { success: true, skipped: false };
  } catch (error) {
    logger.warn('⚠️ Failed adding original_name column (may be Postgres or already applied). Attempting Postgres fallback.', { error: error.message });
    // Postgres fallback logic
    try {
      const pgCheck = await database.query("SELECT column_name FROM information_schema.columns WHERE table_name='order_items'");
      const pgCols = pgCheck.rows.map(r => r.column_name);
      if (!pgCols.includes('original_name')) {
        await database.run('ALTER TABLE order_items ADD COLUMN original_name TEXT');
        logger.info('✅ original_name column added to order_items (Postgres)');
        return { success: true, skipped: false };
      }
      logger.debug('🔁 order_items.original_name already present in Postgres - skipping');
      return { success: true, skipped: true };
    } catch (pgErr) {
      logger.error('❌ Migration failed for original_name column', { error: pgErr.message });
      return { success: false, error: pgErr.message };
    }
  }
}

module.exports = { applyOrderItemsOriginalNameMigration };