const useSQLite = process.env.USE_SQLITE !== 'false';
if (useSQLite) {
  module.exports = require('./database-sqlite');
} else {
  const { Pool } = require('pg');
  const logger = require('../utils/logger');

  const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || null;
  const sslEnabled = process.env.DB_SSL === 'true';
  const basePoolConfig = {
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  };
  const pool = new Pool(
    connectionString
      ? { connectionString, ssl: sslEnabled ? { rejectUnauthorized: false } : false, ...basePoolConfig }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          database: process.env.DB_NAME || 'pos_gateway',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          ssl: sslEnabled ? { rejectUnauthorized: false } : false,
          ...basePoolConfig
        }
  );

  pool.on('connect', () => {
    logger.info('🐘 Connected to PostgreSQL database');
  });
  pool.on('error', (err) => {
    logger.error('💥 Unexpected error on idle client', err);
    process.exit(-1);
  });
  process.on('SIGINT', () => {
    logger.info('Closing database pool...');
    pool.end();
  });

  // Translate SQLite-style placeholders (?) to PostgreSQL ($1, $2, ...) and adjust common dialect differences
  function translateQuery(sql, paramCount) {
    let index = 0;
    let translated = '';
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === '?' && index < paramCount) {
        index += 1;
        translated += `$${index}`;
      } else {
        translated += ch;
      }
    }
    // Replace SQLite datetime('now') with CURRENT_TIMESTAMP
    translated = translated.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    // PRAGMA statements are SQLite-only; throw if encountered
    if (/^\s*PRAGMA/i.test(translated)) {
      throw new Error('PRAGMA statements are not supported in PostgreSQL mode');
    }
    // If INSERT lacks RETURNING and code expects lastID, append RETURNING id
    if (/^\s*INSERT\s+/i.test(translated) && !/RETURNING\s+/i.test(translated)) {
      translated += ' RETURNING id';
    }
    return translated;
  }

  async function query(text, params = []) {
    const translated = translateQuery(text, params.length);
    return pool.query(translated, params);
  }

  async function run(text, params = []) {
    const res = await query(text, params);
    const lastRow = res.rows && res.rows[0] ? res.rows[0] : null;
    return {
      changes: res.rowCount,
      lastID: lastRow && lastRow.id ? lastRow.id : null,
      rows: res.rows
    };
  }

  module.exports = {
    query,
    run,
    getClient: () => pool.connect(),
    end: () => pool.end()
  };
}
