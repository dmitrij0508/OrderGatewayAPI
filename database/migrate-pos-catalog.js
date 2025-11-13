const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function applyPosCatalogMigration() {
  try {
    // Check if table exists
    const info = await database.query("PRAGMA table_info(pos_skus)");
    if (Array.isArray(info.rows) && info.rows.length > 0) {
      logger.info('POS catalog table already exists');
      return { success: true, created: false };
    }

    // Create table
    const createSql = `
      CREATE TABLE IF NOT EXISTS pos_skus (
        sku TEXT PRIMARY KEY,
        name TEXT,
        price REAL NOT NULL,
        taxable INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        last_updated TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now'))
      );
    `;
    await database.run(createSql);
    await database.run('CREATE INDEX IF NOT EXISTS idx_pos_skus_active ON pos_skus(active)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_pos_skus_price ON pos_skus(price)');

    logger.info('✅ POS catalog table created');
    return { success: true, created: true };
  } catch (error) {
    logger.warn('⚠️ POS catalog migration failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { applyPosCatalogMigration };
