const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');

async function tableExists(tableName) {
  try {
    const res = await db.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = ? LIMIT 1",
      [tableName]
    );
    return res.rows.length > 0;
  } catch (e) {
    logger.warn('Postgres schema check failed', { error: e.message });
    return false;
  }
}

async function applyPostgresSchemaIfMissing() {
  // Only relevant when using PostgreSQL
  const usingSqlite = process.env.USE_SQLITE
    ? process.env.USE_SQLITE === 'true'
    : !(process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING);
  if (usingSqlite) return { skipped: true, reason: 'sqlite' };

  const hasMenus = await tableExists('menus');
  if (hasMenus) {
    return { skipped: true, reason: 'exists' };
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    logger.warn('Postgres schema.sql not found, skipping bootstrap');
    return { skipped: true, reason: 'missing-file' };
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  // Split on semicolons while preserving inside values/strings can be tricky; we trust Postgres to handle full script in one exec via single query.
  try {
    await db.query(sql);
    logger.info('📐 Applied PostgreSQL schema.sql (bootstrap)');
    return { success: true };
  } catch (e) {
    logger.error('Failed to apply PostgreSQL schema.sql', { error: e.message });
    return { success: false, error: e };
  }
}

module.exports = { applyPostgresSchemaIfMissing };
