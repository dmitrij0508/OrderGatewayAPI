const request = require('supertest');

// Ensure APP authority for tests that don't depend on POS catalog
process.env.PRICE_AUTHORITY = 'APP';

const app = require('../server');

const ADMIN_KEY = 'pos-admin-key';

describe('Orders validation and totals reconciliation', () => {
  test('rejects missing sku/qty/price with 400', async () => {
    const payload = {
      orderId: `ORD-${Date.now()}`,
      externalOrderId: `EXT-${Date.now()}`,
      restaurantId: 'NYC-DELI-001',
      customer: { name: 'Test', phone: '555-1234' },
      orderType: 'pickup',
      orderTime: new Date().toISOString(),
      items: [
        { name: 'Coffee', quantity: 1, unitPrice: 2.99 }, // missing sku
        { sku: 'COFFEE-12OZ', name: 'Coffee', quantity: 0, unitPrice: 2.99 }, // qty invalid
        { sku: 'COFFEE-12OZ', name: 'Coffee', quantity: 1 } // price missing
      ],
      totals: { subtotal: 2.99, tax: 0.00, tip: 0.00, discount: 0.00, deliveryFee: 0.00, total: 2.99 }
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('X-API-Key', ADMIN_KEY)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Validation/i);
    expect(Array.isArray(res.body.details || [])).toBe(true);
  });

  test('rejects totals mismatch with 400', async () => {
    const payload = {
      orderId: `ORD-${Date.now()}-TM`,
      externalOrderId: `EXT-${Date.now()}-TM`,
      restaurantId: 'NYC-DELI-001',
      customer: { name: 'Test', phone: '555-1234' },
      orderType: 'pickup',
      orderTime: new Date().toISOString(),
      items: [ { sku: 'COFFEE-12OZ', name: 'Coffee', quantity: 1, unitPrice: 3.50 } ],
      totals: { subtotal: 3.00, tax: 0.00, tip: 0.00, discount: 0.00, deliveryFee: 0.00, total: 3.00 }
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('X-API-Key', ADMIN_KEY)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Totals mismatch/i);
    expect(res.body.details).toBeTruthy();
  });
});
