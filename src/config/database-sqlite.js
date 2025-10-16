const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');
const dbPath = path.join(__dirname, '../../database/pos_gateway.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Failed to connect to SQLite database:', err);
    process.exit(1);
  } else {
    logger.info('🗄️ Connected to SQLite database');
  }
});
db.run('PRAGMA foreign_keys = ON');
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve({ rows });
      }
    });
  });
};
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          changes: this.changes,
          lastID: this.lastID,
          rows: [{ id: this.lastID }]
        });
      }
    });
  });
};
process.on('SIGINT', () => {
  logger.info('Closing SQLite database...');
  db.close();
});
module.exports = {
  query,
  run,
  getClient: () => ({
    query: async (sql, params) => {
      if (sql.toUpperCase().includes('INSERT') || sql.toUpperCase().includes('UPDATE') || sql.toUpperCase().includes('DELETE')) {
        return run(sql, params);
      }
      return query(sql, params);
    },
    release: () => {},
    query: async (text) => {
      if (text === 'BEGIN') return run('BEGIN TRANSACTION');
      if (text === 'COMMIT') return run('COMMIT');
      if (text === 'ROLLBACK') return run('ROLLBACK');
      return query(text);
    }
  }),
  end: () => {
    return new Promise((resolve) => {
      db.close(resolve);
    });
  }
};
