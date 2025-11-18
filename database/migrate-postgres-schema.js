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

  const raw = fs.readFileSync(schemaPath, 'utf8');
  // Try enabling useful extensions but do not fail if unavailable
  try { await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'); } catch (_) {}
  try { await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;'); } catch (_) {}

  let sql = raw;
  try {
    await db.query(sql);
    logger.info('📐 Applied PostgreSQL schema.sql (bootstrap)');
    return { success: true };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    // Retry by swapping uuid_generate_v4() with gen_random_uuid() if uuid-ossp missing
    if (/uuid_generate_v4\(\)/i.test(msg)) {
      try {
        sql = raw.replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
        await db.query(sql);
        logger.info('📐 Applied PostgreSQL schema.sql using gen_random_uuid()');
        return { success: true, used: 'gen_random_uuid' };
      } catch (e2) {
        logger.error('Failed applying schema with gen_random_uuid()', { error: e2.message });
      }
    }
    logger.error('Failed to apply PostgreSQL schema.sql', { error: msg });
    return { success: false, error: e };
  }
}

module.exports = { applyPostgresSchemaIfMissing };
