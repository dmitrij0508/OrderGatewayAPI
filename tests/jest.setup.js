// Global Jest setup to clean up resources and avoid open-handle leaks
// IMPORTANT: Set env vars BEFORE requiring the app or database so modules pick them up at import time.
process.env.USE_SQLITE = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Default to APP price authority in tests unless explicitly overridden per-test
process.env.PRICE_AUTHORITY = process.env.PRICE_AUTHORITY || 'APP';

// Now safely require modules that read environment variables at import-time
const database = require('../src/config/database');
const app = require('../server');

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
