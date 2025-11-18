/* Production check script
   Usage:
     node scripts/check-prod.js
   Optional env vars:
     PROD_BASE_URL=https://ordergatewayapi.onrender.com/api/v1
     PROD_API_KEY=pos-mobile-app-key
     PROD_RESTAURANT_ID=NYC-DELI-001
*/
require('dotenv').config();
const base = process.env.PROD_BASE_URL || 'https://ordergatewayapi.onrender.com/api/v1';
const apiKey = process.env.PROD_API_KEY || 'pos-mobile-app-key';
const restaurantId = process.env.PROD_RESTAURANT_ID || 'NYC-DELI-001';

async function timed(name, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = (performance.now() - start).toFixed(1);
  return { name, ms, result };
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, { headers });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

(async () => {
  try {
    console.log('Checking production API:', base);
    const health = await timed('health', () => getJSON(base.replace(/\/api\/v1$/, '') + '/health'));
    const menu = await timed('menu', () => getJSON(`${base}/menu?restaurantId=${encodeURIComponent(restaurantId)}`, { 'X-API-Key': apiKey }));

    const summary = {
      base,
      health: { status: health.result.status, ok: health.result.ok, ms: health.ms },
      menu: {
        status: menu.result.status,
        ok: menu.result.ok,
        ms: menu.ms,
        items: Array.isArray(menu.result.data?.items) ? menu.result.data.items.length : null
      }
    };

    console.table(summary);

    if (!health.result.ok) console.error('Health endpoint failing');
    if (!menu.result.ok) console.error('Menu endpoint failing');
    if (menu.result.ok && (!summary.menu.items || summary.menu.items === 0)) {
      console.warn('Menu endpoint returned zero items. Check seeding for restaurantId:', restaurantId);
    }
  } catch (e) {
    console.error('Production check failed:', e.message);
    process.exit(1);
  }
})();
