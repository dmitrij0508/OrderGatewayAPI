const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function applySavedPayloadsMigration() {
  try {
    logger.info('🔄 Applying Saved Payloads migration...');

    const statements = [
      `CREATE TABLE IF NOT EXISTS saved_payloads (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        payload_key TEXT UNIQUE NOT NULL,
        description TEXT,
        source TEXT,
        payload TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      "CREATE INDEX IF NOT EXISTS idx_saved_payloads_created_at ON saved_payloads(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_saved_payloads_source ON saved_payloads(source)"
    ];

    for (const sql of statements) {
      try {
        await database.run(sql);
        logger.info(`✅ Applied: ${sql.split('\n')[0]}...`);
      } catch (err) {
        logger.warn(`⚠️ Statement failed (continuing): ${sql.substring(0, 80)}...`, { error: err.message });
      }
    }

    // Quick smoke check
    try {
      const info = await database.query("PRAGMA table_info(saved_payloads)");
      logger.info('📋 saved_payloads table columns:', info.rows.map(r => r.name));
    } catch (e) {
      logger.warn('Could not inspect saved_payloads table:', e.message);
    }

    logger.info('🎉 Saved Payloads migration completed.');
    return { success: true };
  } catch (error) {
    logger.error('💥 Saved Payloads migration failed:', error);
    return { success: false, error: error.message, canProceed: true };
  }
}

if (require.main === module) {
  applySavedPayloadsMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { applySavedPayloadsMigration };
