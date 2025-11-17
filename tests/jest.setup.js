// Global Jest setup to clean up resources and avoid open-handle leaks
// IMPORTANT: Set env vars BEFORE requiring the app or database so modules pick them up at import time.
process.env.USE_SQLITE = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Default to APP price authority in tests unless explicitly overridden per-test
process.env.PRICE_AUTHORITY = process.env.PRICE_AUTHORITY || 'APP';

// Now safely require modules that read environment variables at import-time
const database = require('../src/config/database');
const app = require('../server');

// Apply schema migrations before tests run
beforeAll(async () => {
  try {
    // Ensure original_name column exists
    const tableInfo = await database.query("PRAGMA table_info(order_items)");
    const columns = tableInfo.rows.map(c => c.name);
    if (!columns.includes('original_name')) {
      await database.run('ALTER TABLE order_items ADD COLUMN original_name TEXT');
    }
    // Ensure category column exists
    if (!columns.includes('category')) {
      await database.run('ALTER TABLE order_items ADD COLUMN category TEXT');
    }
  } catch (e) {
    // Migration errors are non-fatal for tests
    console.warn('Migration warning:', e.message);
  }
});

// Close DB and logger transports after all tests complete
afterAll(async () => {
  try {
    if (app && typeof app.shutdown === 'function') {
      await app.shutdown();
    } else if (database && typeof database.end === 'function') {
      await database.end();
    }
  } catch (e) {
    // swallow errors during teardown
  }
});
