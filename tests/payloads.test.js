const request = require('supertest');
const app = require('../server');

describe('Saved Payloads API', () => {
  const API_KEY = 'pos-admin-key';
  const KEY = `jest_sample_${Date.now()}`;

  it('saves a payload', async () => {
    const res = await request(app)
      .post('/api/v1/payloads')
      .set('X-API-Key', API_KEY)
      .send({ key: KEY, description: 'Jest test payload', source: 'jest', payload: { foo: 'bar', n: 42 } });

    expect([201, 200]).toContain(res.status);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('key', KEY);
  });

  it('loads the saved payload by key', async () => {
    const res = await request(app)
      .get(`/api/v1/payloads/${KEY}`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('key', KEY);
    expect(res.body.data).toHaveProperty('payload');
    expect(res.body.data.payload).toMatchObject({ foo: 'bar', n: 42 });
  });

  it('lists saved payloads', async () => {
    const res = await request(app)
      .get('/api/v1/payloads?limit=5')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const keys = res.body.data.map(i => i.key);
    expect(keys).toContain(KEY);
  });
});
