# Order Gateway API

A reusable REST API for restaurant ordering systems, designed to integrate with mobile apps, websites, and POS systems.

**🌐 Production API:** https://ordergatewayapi.onrender.com

> **🔍 NEW: Enhanced Logs Endpoint for POS Debugging**  
> Use `/api/v1/logs/payloads` to extract and analyze order payloads sent by POS systems.  
> See [LOGS_ENDPOINT_GUIDE.md](LOGS_ENDPOINT_GUIDE.md) for details.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+

### Installation

1. **Clone and install dependencies:**
```bash
cd API
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Set up database:**
```bash
# Create PostgreSQL database
createdb pos_gateway

# Run migrations
npm run db:migrate
```

4. **Start the server:**
```bash
# Development
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3000` (development) or `https://ordergatewayapi.onrender.com` (production)

### 🧪 Seeding Sample Data

Populate a starter menu, POS SKUs, and a sample order for local testing or demo purposes.

1. (Optional) Set `SEED_RESTAURANT_ID` in `.env` (defaults to `NYC-DELI-001`).
2. Run the seed script:
  ```bash
  node scripts/seed.js
  ```
3. Verify menu data:
  ```bash
  curl "http://localhost:3000/api/v1/menu?restaurantId=NYC-DELI-001" -H "X-API-Key: pos-mobile-app-key" | jq
  ```

Idempotent: re-running will skip existing menu + items and only add missing POS SKUs or sample order.

Production/PostgreSQL:
```bash
USE_SQLITE=false node scripts/seed.js
```
Ensure schema/migrations applied first. Missing optional tables (e.g. `pos_skus`) are skipped with a warning.

### ⚙️ Production Health Check

Run a quick smoke test against a deployed instance:
```bash
node scripts/check-prod.js
```
Optional environment overrides:
```bash
set PROD_BASE_URL=https://ordergatewayapi.onrender.com/api/v1
set PROD_API_KEY=pos-mobile-app-key
set PROD_RESTAURANT_ID=NYC-DELI-001
node scripts/check-prod.js
```
Outputs timing + item count; warns if menu empty.

### 🗃️ Recommended PostgreSQL Indexes

Indexes improve query performance at scale:
```sql
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_pos_skus_sku ON pos_skus(sku);
```
Included in `database/migrations/add_indexes.sql` for manual execution on Postgres.

### 🐢 Slow Query Logging

Set `DB_SLOW_QUERY_MS` (e.g. `250`) to emit a warning log for any PostgreSQL query exceeding that duration. Example:
```bash
DB_SLOW_QUERY_MS=250 npm start
```
Log entry includes elapsed ms, row count, and truncated SQL.


## 📖 API Documentation

### Authentication
All endpoints require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: pos-mobile-app-key" https://ordergatewayapi.onrender.com/api/v1/orders
```

### Available API Keys
- `pos-mobile-app-key` - Mobile app access
- `pos-website-key` - Website access  
- `pos-admin-key` - Admin dashboard access
- `sync-agent-key` - POS Sync Agent access

### Endpoints

#### Orders

**Create Order**
```http
POST /api/v1/orders
Content-Type: application/json
X-API-Key: pos-mobile-app-key
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "orderId": "ORD-20241008-001",
  "externalOrderId": "APP-789123",
  "restaurantId": "NYC-DELI-001",
  "customer": {
    "name": "John Doe",
    "phone": "555-0123",
    "email": "john@example.com"
  },
  "orderType": "pickup",
  "orderTime": "2024-10-08T14:30:00Z",
  "items": [
    {
      "itemId": "SANDWICH-001",
      "name": "Turkey Club Sandwich",
      "quantity": 1,
      "unitPrice": 12.99,
      "totalPrice": 12.99,
      "specialInstructions": "No mayo"
    }
  ],
  "totals": {
    "subtotal": 12.99,
    "tax": 1.04,
    "total": 14.03
  }
}
```

**Get Order**
```http
GET /api/v1/orders/ORD-20241008-001
X-API-Key: pos-mobile-app-key
```

**Get Order Status**
```http
GET /api/v1/orders/ORD-20241008-001/status
X-API-Key: pos-mobile-app-key
```

**Cancel Order**
```http
POST /api/v1/orders/ORD-20241008-001/cancel
Content-Type: application/json
X-API-Key: pos-mobile-app-key

{
  "reason": "customer_request",
  "notes": "Customer changed mind"
}
```

#### Menu

**Get Menu**
```http
GET /api/v1/menu?restaurantId=NYC-DELI-001
X-API-Key: pos-mobile-app-key
```

#### Status Webhooks (Internal)

**Status Update Webhook**
```http
POST /api/v1/status/webhook
Content-Type: application/json
X-Webhook-Key: sync-agent-secret-key

{
  "orderId": "ORD-20241008-001",
  "status": "preparing",
  "estimatedTime": "2024-10-08T15:00:00Z"
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database (Development - SQLite or local Postgres)
USE_SQLITE=true             # true = SQLite (default for dev), false = PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pos_gateway
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# Database (Production - Render Postgres)
# Prefer a single connection string
# DATABASE_URL=postgresql://<user>:<password>@<host>/<db>
# Set USE_SQLITE=false and DB_SSL=true when using Render/AWS/etc.
# Example in `.env.production`

# Security
API_KEY_HEADER=X-API-Key
JWT_SECRET=your-jwt-secret

# Integration
SYNC_AGENT_WEBHOOK_URL=http://localhost:8080/webhook/order-status
SYNC_AGENT_API_KEY=sync-agent-secret-key
```

## 🔌 Integration with POSSyncAgent

The Order Gateway API is designed to work seamlessly with the POSSyncAgent:

1. **Order Flow**: Mobile App → Gateway API → POSSyncAgent → POS System
2. **Status Updates**: POS System → POSSyncAgent → Gateway API → Mobile App
3. **Menu Sync**: POS System → POSSyncAgent → Gateway API → Mobile App

### Integration Steps

1. **Configure POSSyncAgent** to poll the Gateway API for new orders
2. **Set up webhooks** for status updates back to the Gateway API
3. **Sync menu data** from POS system to Gateway API

## 📊 Order Status Flow

```
received → preparing → ready → completed
    ↓
cancelled (any time before completed)
```

## 🛡️ Security Features

- **API Key Authentication** - Secure access control
- **Idempotency Keys** - Prevent duplicate orders
- **Rate Limiting** - Prevent abuse
- **Request Validation** - Comprehensive input validation
- **CORS Protection** - Configurable origin restrictions

## 🧪 Testing

### Manual Testing

```bash
# Health check
curl https://ordergatewayapi.onrender.com/health

# Create test order
curl -X POST https://ordergatewayapi.onrender.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pos-mobile-app-key" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d @test-order.json
```

### Sample Payloads

See `tests/` directory for complete sample payloads and test scripts.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │────│  Gateway API     │────│  POSSyncAgent   │
│                 │    │                  │    │                 │
│ • Order Create  │    │ • Validation     │    │ • POS Integration│
│ • Status Check  │    │ • Persistence    │    │ • Printer Fallback│
│ • Menu Browse   │    │ • Rate Limiting  │    │ • Status Sync   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                        ┌──────────────────┐
                        │   PostgreSQL     │
                        │                  │
                        │ • Orders         │
                        │ • Menu Items     │
                        │ • API Usage      │
                        └──────────────────┘
```

## 📈 Production Deployment

### Database Setup
```sql
-- Create database user
CREATE USER pos_gateway_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE pos_gateway TO pos_gateway_user;
```

### PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Start API with PM2
pm2 start server.js --name pos-gateway-api

# Set up auto-restart
pm2 startup
pm2 save
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name api.yourrestaurant.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🤝 Integration Examples

### Mobile App (React Native)
```javascript
const api = {
  baseURL: 'https://ordergatewayapi.onrender.com/api/v1',
  apiKey: 'pos-mobile-app-key'
};

// Create order
async function createOrder(orderData) {
  const response = await fetch(`${api.baseURL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': api.apiKey,
      'X-Idempotency-Key': generateUUID()
    },
    body: JSON.stringify(orderData)
  });
  return response.json();
}
```

### Website Integration
```javascript
// Check order status
async function checkOrderStatus(orderId) {
  const response = await fetch(`${api.baseURL}/orders/${orderId}/status`, {
    headers: {
      'X-API-Key': 'pos-website-key'
    }
  });
  return response.json();
}
```

## 📝 License

MIT License - see LICENSE file for details.

---

**🎯 Ready for Integration!** This API provides a solid foundation for any restaurant's digital ordering system.