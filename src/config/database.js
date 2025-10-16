const useSQLite = process.env.USE_SQLITE !== 'false';
if (useSQLite) {
  module.exports = require('./database-sqlite');
} else {
  const { Pool } = require('pg');
  const logger = require('../utils/logger');
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pos_gateway',
    user: process.env.DB_USER || 'pos_gateway_user',
    password: process.env.DB_PASSWORD || 'P0SG@teway2024!',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
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
  module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    end: () => pool.end()
  };
}
