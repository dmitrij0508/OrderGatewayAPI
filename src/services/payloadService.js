const database = require('../config/database');
const logger = require('../utils/logger');

class PayloadService {
  async save({ key, description = null, source = null, payload }) {
    // Ensure migration ran (create table if missing) for test contexts
    try {
      const info = await database.query("PRAGMA table_info(saved_payloads)");
      if (!info.rows || info.rows.length === 0) {
        // Attempt lightweight create (idempotent)
        await database.run(`CREATE TABLE IF NOT EXISTS saved_payloads (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          payload_key TEXT UNIQUE NOT NULL,
          description TEXT,
          source TEXT,
          payload TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`);
        await database.run('CREATE INDEX IF NOT EXISTS idx_saved_payloads_created_at ON saved_payloads(created_at)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_saved_payloads_source ON saved_payloads(source)');
        logger.info('🛠️ Auto-created saved_payloads table (late init)');
      }
    } catch (e) {
      logger.warn('Failed auto-table check/create for saved_payloads', { error: e.message });
    }
    if (!payload) {
      const err = new Error('Payload is required');
      err.name = 'ValidationError';
      throw err;
    }

    // Auto-generate key if not provided
    const payloadKey = key || `payload_${Date.now()}`;

    const insertSql = `
      INSERT INTO saved_payloads (payload_key, description, source, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(payload_key) DO UPDATE SET
        description = COALESCE(excluded.description, saved_payloads.description),
        source = COALESCE(excluded.source, saved_payloads.source),
        payload = excluded.payload,
        updated_at = datetime('now')
      ;
    `;
    const payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload);

    logger.debugDatabase('Save Payload', insertSql, [payloadKey, description, source, payloadText]);

    await database.run(insertSql, [payloadKey, description, source, payloadText]);

    return { key: payloadKey };
  }

  async getByKeyOrId(identifier) {
    // Late init safeguard in read path too
    try {
      const info = await database.query("PRAGMA table_info(saved_payloads)");
      if (!info.rows || info.rows.length === 0) {
        await database.run(`CREATE TABLE IF NOT EXISTS saved_payloads (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          payload_key TEXT UNIQUE NOT NULL,
          description TEXT,
          source TEXT,
          payload TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`);
        logger.info('🛠️ Auto-created saved_payloads table during getByKeyOrId');
      }
    } catch (e) {
      logger.warn('Failed auto-table check in getByKeyOrId', { error: e.message });
    }
    const isUuidLike = identifier.length > 30 && identifier.includes('-');

    const sql = isUuidLike
      ? 'SELECT id, payload_key, description, source, payload, created_at, updated_at FROM saved_payloads WHERE id = ?'
      : 'SELECT id, payload_key, description, source, payload, created_at, updated_at FROM saved_payloads WHERE payload_key = ?';

    const result = await database.query(sql, [identifier]);

    if (result.rows.length === 0) {
      const err = new Error('Saved payload not found');
      err.name = 'NotFoundError';
      throw err;
    }

    const row = result.rows[0];
    let parsed;
    try {
      parsed = JSON.parse(row.payload);
    } catch (e) {
      parsed = row.payload; // Not JSON, return as string
    }

    return {
      id: row.id,
      key: row.payload_key,
      description: row.description,
      source: row.source,
      payload: parsed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async list({ limit = 20, offset = 0, source } = {}) {
    // Late init safeguard for list path
    try {
      const info = await database.query("PRAGMA table_info(saved_payloads)");
      if (!info.rows || info.rows.length === 0) {
        await database.run(`CREATE TABLE IF NOT EXISTS saved_payloads (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          payload_key TEXT UNIQUE NOT NULL,
          description TEXT,
          source TEXT,
          payload TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`);
        logger.info('🛠️ Auto-created saved_payloads table during list');
      }
    } catch (e) {
      logger.warn('Failed auto-table check in list', { error: e.message });
    }
    const params = [];
    let where = '';
    if (source) {
      where = 'WHERE source = ?';
      params.push(source);
    }

    const count = await database.query(`SELECT COUNT(*) as total FROM saved_payloads ${where}`, params);
    const total = parseInt(count.rows[0].total);

    const rows = await database.query(
      `SELECT id, payload_key, description, source, length(payload) as size, created_at, updated_at
       FROM saved_payloads ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      total,
      items: rows.rows.map(r => ({
        id: r.id,
        key: r.payload_key,
        description: r.description,
        source: r.source,
        size: r.size,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    };
  }
}

module.exports = new PayloadService();
