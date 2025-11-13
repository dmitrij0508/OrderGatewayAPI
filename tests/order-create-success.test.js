const request = require('supertest');
const app = require('../server');

// Ensure APP price authority so provided unitPrice is accepted
process.env.PRICE_AUTHORITY = 'APP';

describe('Order creation success', () => {
  test('creates a valid order and returns 201', async () => {
    const now = new Date().toISOString();
    const orderPayload = {
      orderId: `ORD-${Date.now()}`,
      externalOrderId: `EXT-${Date.now()}`,
      restaurantId: 'NYC-DELI-001',
      customer: { name: 'Test User', phone: '555-0000', email: 'user@example.com' },
      orderType: 'pickup',
      orderTime: now,
      items: [
        {
          sku: 'COFFEE-12OZ',
          name: 'Coffee 12oz',
          description: 'Coffee 12oz - House Brew',
          quantity: 1,
          unitPrice: 2.99,
          totalPrice: 2.99,
          modifiers: []
        }
      ],
      totals: {
        subtotal: 2.99,
        tax: 0,
        tip: 0,
        discount: 0,
        deliveryFee: 0,
        total: 2.99
      },
      payment: {
        method: 'cash',
        status: 'pending',
        amount: 2.99
      }
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('X-API-Key', 'pos-admin-key')
      .set('Content-Type', 'application/json')
      .send(orderPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBe(orderPayload.orderId);
    expect(res.body.data.items[0].originalName).toMatch(/Coffee 12oz - House Brew/);
    expect(res.body.data.totals.total).toBeCloseTo(2.99, 2);
  });
});
