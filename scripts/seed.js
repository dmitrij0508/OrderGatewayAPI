/* Seed script: populates sample menu, items, POS SKUs, and a test order.
   Works with both SQLite (default dev) and PostgreSQL (USE_SQLITE=false).
*/
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

const RESTAURANT_ID = process.env.SEED_RESTAURANT_ID || 'NYC-DELI-001';

async function ensureMenu() {
  // Check if menus already exist
  let existing;
  try {
    existing = await db.query('SELECT id, restaurant_id FROM menus WHERE restaurant_id = ?', [RESTAURANT_ID]);
  } catch (e) {
    // If table missing (Postgres deployed without schema), abort early
    logger.error('Menus table not available. Run migrations / apply schema first.', e);
    return null;
  }
  if (existing.rows.length) {
    logger.info(`Menu already present for ${RESTAURANT_ID} - skipping creation`);
    return existing.rows[0].id;
  }
  // Insert menu (Postgres needs RETURNING id; our database layer auto-appends)
  const menuId = uuidv4();
  await db.run('INSERT INTO menus (id, restaurant_id, name, description, version, last_updated, created_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [menuId, RESTAURANT_ID, 'Main Menu', 'New York Deli & Cafe Main Menu']);
  logger.info(`Created menu ${menuId}`);
  return menuId;
}

async function seedMenuItems(menuId) {
  const items = [
    { name: 'Turkey Club Sandwich', price: 12.99 },
    { name: 'Pastrami on Rye', price: 14.5 },
    { name: 'Chicken Caesar Salad', price: 11.99 },
    { name: 'Matzo Ball Soup', price: 8.99 },
    { name: 'Bagel with Cream Cheese', price: 4.99 },
    { name: 'Coffee', price: 2.99 },
    { name: 'Iced Tea', price: 2.5 }
  ];
  // Check if menu_items already exist
  const existing = await db.query('SELECT COUNT(*) as c FROM menu_items WHERE menu_id = ?', [menuId]);
  const count = parseInt(existing.rows[0].c || existing.rows[0].count || 0);
  if (count > 0) {
    logger.info(`Menu items already present (${count}) - skipping item inserts`);
    return;
  }
  for (const item of items) {
    await db.run('INSERT INTO menu_items (id, menu_id, name, price, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', [uuidv4(), menuId, item.name, item.price]);
  }
  logger.info(`Inserted ${items.length} menu items for menu ${menuId}`);
}

async function seedPosSkus() {
  // Attempt to detect pos_skus table existence
  try {
    let exists = false;
    try {
      const info = await db.query("PRAGMA table_info(pos_skus)");
      exists = info.rows && info.rows.length >= 0; // Table exists if pragma returns
    } catch (_) {
      // Postgres path
      const pgInfo = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name='pos_skus'");
      exists = pgInfo.rows.length > 0;
    }
    if (!exists) {
      logger.warn('pos_skus table not found. Skipping POS SKU seed.');
      return;
    }
    // Count existing
    const countRes = await db.query('SELECT COUNT(*) as c FROM pos_skus');
    const count = parseInt(countRes.rows[0].c || countRes.rows[0].count || 0);
    if (count > 0) {
      logger.info('POS SKUs already present - skipping');
      return;
    }
    const skus = [
      { sku: 'TURKEY-CLUB', name: 'Turkey Club Sandwich', price: 12.99 },
      { sku: 'PASTRAMI-RYE', name: 'Pastrami on Rye', price: 14.5 },
      { sku: 'CAESAR-SALAD', name: 'Chicken Caesar Salad', price: 11.99 },
      { sku: 'MATZO-SOUP', name: 'Matzo Ball Soup', price: 8.99 },
      { sku: 'BAGEL-CC', name: 'Bagel with Cream Cheese', price: 4.99 },
      { sku: 'COFFEE-12OZ', name: 'Coffee 12oz', price: 2.99 },
      { sku: 'ICED-TEA', name: 'Iced Tea', price: 2.5 }
    ];
    for (const s of skus) {
      await db.run('INSERT INTO pos_skus (sku, name, price, taxable, active) VALUES (?, ?, ?, 1, 1)', [s.sku, s.name, s.price]);
    }
    logger.info(`Inserted ${skus.length} POS SKUs`);
  } catch (e) {
    logger.warn('Failed seeding POS SKUs', { error: e.message });
  }
}

async function seedSampleOrder(menuId) {
  // If an order already exists for seed customer, skip
  const existing = await db.query('SELECT order_id FROM orders WHERE customer_name = ? LIMIT 1', ['Seed User']);
  if (existing.rows.length) {
    logger.info('Sample order already exists - skipping');
    return;
  }
  // Pick one item from menu_items
  const itemsRes = await db.query('SELECT id, name, price FROM menu_items WHERE menu_id = ? LIMIT 2', [menuId]);
  if (!itemsRes.rows.length) {
    logger.warn('No menu items found to create sample order');
    return;
  }
  const orderPublicId = `ORD-SEED-${Date.now()}`;
  const internalId = uuidv4();
  const now = new Date().toISOString();
  const subtotal = itemsRes.rows.reduce((s, r) => s + Number(r.price), 0);
  const tax = +(subtotal * 0.08875).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  // Insert order (use columns that exist universally)
  await db.run(`INSERT INTO orders (
      id, order_id, external_order_id, restaurant_id, idempotency_key,
      customer_name, customer_phone, customer_email,
      order_type, order_time, requested_time,
      subtotal, tax, tip, discount, delivery_fee, total,
      payment_method, payment_status, payment_transaction_id,
      notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [internalId, orderPublicId, orderPublicId, RESTAURANT_ID, uuidv4(), 'Seed User', '555-0000', 'seed@example.com', 'pickup', now, null, subtotal, tax, 0, 0, 0, total, 'cash', 'pending', null, 'Seed order for testing', 'received']
  );

  // Insert items
  for (const r of itemsRes.rows) {
    const itemId = uuidv4();
    await db.run(`INSERT INTO order_items (
        id, order_id, item_id, name, quantity, unit_price, total_price, special_instructions, category, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [itemId, internalId, r.id || r.name, r.name, 1, r.price, r.price, null, 'General']
    );
  }
  logger.info(`Seed order ${orderPublicId} created with ${itemsRes.rows.length} items`);
}

async function run() {
  try {
    const menuId = await ensureMenu();
    if (menuId) {
      await seedMenuItems(menuId);
    }
    await seedPosSkus();
    if (menuId) {
      await seedSampleOrder(menuId);
    }
    logger.info('✅ Seeding complete');
  } catch (e) {
    logger.error('Seeding failed', e);
  } finally {
    try { await db.end(); } catch (_) {}
  }
}

run();
