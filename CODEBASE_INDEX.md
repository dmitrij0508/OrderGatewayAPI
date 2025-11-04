# OrderGatewayAPI - Codebase Index

**Generated:** November 4, 2025  
**Repository:** OrderGatewayAPI  
**Branch:** main

## 📋 Overview

The OrderGatewayAPI is a reusable REST API Gateway designed for restaurant ordering integration. It supports POS systems and webhook integrations (including OhMyApp.io), providing comprehensive order management capabilities with enhanced debugging and logging.

---

## 🗂️ Project Structure

```
OrderGatewayAPI/
├── server.js                           # Main Express server entry point
├── package.json                         # Node.js dependencies
├── .env                                 # Environment configuration
├── setup.bat                            # Windows setup script
├── start-api.bat                        # Windows startup script
├── test-api.bat                         # Windows test script
├── demo-api.ps1                         # PowerShell demo script
├── test-create-order.ps1                # PowerShell order creation test
├── verify-setup.js                      # Setup verification script
├── test-server.js                       # Test server configuration
│
├── database/                            # Database management
│   ├── schema.sql                       # PostgreSQL schema
│   ├── schema-sqlite.sql                # SQLite schema
│   ├── migrate-ohmyapp-support.js       # OhMyApp migration script
│   └── migrations/
│       └── add_ohmyapp_support.sql      # OhMyApp SQL migration
│
├── src/
│   ├── config/                          # Configuration files
│   │   ├── database.js                  # PostgreSQL database config
│   │   └── database-sqlite.js           # SQLite database config
│   │
│   ├── controllers/                     # Request handlers
│   │   ├── orderController.js           # Order operations controller
│   │   └── menuController.js            # Menu operations controller
│   │
│   ├── middleware/                      # Express middleware
│   │   ├── auth.js                      # API key authentication
│   │   └── errorHandler.js              # Global error handling
│   │
│   ├── models/                          # Data models (empty - uses SQL directly)
│   │
│   ├── routes/                          # API route definitions
│   │   ├── orders.js                    # Order routes with debug endpoints
│   │   ├── menu.js                      # Menu routes
│   │   ├── status.js                    # Status webhook routes
│   │   └── logs.js                      # Log retrieval routes
│   │
│   ├── services/                        # Business logic
│   │   ├── orderService.js              # Order management logic
│   │   └── menuService.js               # Menu management logic
│   │
│   ├── utils/                           # Utility functions
│   │   └── logger.js                    # Winston logger with debug methods
│   │
│   └── validators/                      # Request validation
│       └── orderValidators.js           # Order schema validators (Joi)
│
├── logs/                                # Application logs
│   ├── combined.log                     # All logs
│   ├── error.log                        # Error-only logs
│   └── debug-payloads.log               # Detailed payload debug logs
│
├── tests/                               # Test files
│   ├── sample-order.json                # Sample order payload
│   └── test-api.sh                      # Linux test script
│
└── scripts/                             # Utility scripts
    └── migrate.js                       # Database migration script

```

---

## 🚀 API Endpoints

### Core Order Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/orders` | Create new order | ✅ |
| `GET` | `/api/v1/orders` | Get all orders (with filters) | ✅ |
| `GET` | `/api/v1/orders/:orderId` | Get order details | ✅ |
| `GET` | `/api/v1/orders/:orderId/status` | Get order status | ✅ |
| `PUT` | `/api/v1/orders/:orderId` | Update order | ✅ |
| `POST` | `/api/v1/orders/:orderId/cancel` | Cancel order | ✅ |
| `DELETE` | `/api/v1/orders/all` | Delete all orders (admin) | ✅ |
| `DELETE` | `/api/v1/orders/clear?restaurantId=X` | Clear orders by restaurant | ✅ |

### Debug Endpoints (for POS Integration)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/orders/debug` | Basic debug test | ✅ |
| `POST` | `/api/v1/orders/debug/inspect-payload` | Detailed payload analysis | ✅ |
| `POST` | `/api/v1/orders/debug/ohmyapp-webhook` | OhMyApp webhook analysis | ✅ |
| `POST` | `/api/v1/orders/debug/webhook-compare` | Compare webhook structures | ✅ |
| `POST` | `/api/v1/orders/debug/transformation-preview` | Preview data transformation | ✅ |
| `POST` | `/api/v1/orders/debug/sql-preview` | Preview SQL parameters | ✅ |

### Log Endpoints (NEW - for POS Payload Inspection)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/logs` | Retrieve recent log entries | ✅ |
| `GET` | `/api/v1/logs/files` | List available log files | ✅ |
| `GET` | `/api/v1/logs/stream` | Stream logs in real-time (SSE) | ✅ |
| `GET` | `/api/v1/logs/orders` | Filter logs for order operations | ✅ |
| `GET` | `/api/v1/logs/payloads` | Extract order payloads from logs | ✅ |

### Other Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/menu` | Get current menu | ✅ |
| `POST` | `/api/v1/status/webhook` | Status update webhook | ❌ |
| `GET` | `/health` | Health check | ❌ |
| `GET` | `/api` | API index | ❌ |

---

## 🔑 Authentication

All protected endpoints require an API key passed in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key-here" http://localhost:3000/api/v1/orders
```

### Default API Keys (Development)

- **dev-api-key-123** - Development testing
- **pos-integration-key-456** - POS system integration
- **webhook-listener-key-789** - Webhook receiver

---

## 📊 Order Data Structure

### Incoming Order Payload (POS System)

```json
{
  "orderId": "ORD-20241104-001",
  "externalOrderId": "EXT-001",
  "restaurantId": "NYC-DELI-001",
  "customer": {
    "name": "John Doe",
    "phone": "555-0123",
    "email": "john@example.com",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001"
    }
  },
  "orderType": "delivery",
  "orderTime": "2025-11-04T10:30:00Z",
  "requestedTime": "2025-11-04T11:00:00Z",
  "items": [
    {
      "itemId": "SANDWICH-001",
      "name": "Turkey Club",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98,
      "specialInstructions": "No mayo",
      "modifiers": [
        {
          "name": "Extra Cheese",
          "price": 1.50
        }
      ]
    }
  ],
  "totals": {
    "subtotal": 25.98,
    "tax": 2.08,
    "tip": 5.00,
    "discount": 0,
    "deliveryFee": 3.00,
    "total": 36.06
  },
  "payment": {
    "method": "credit_card",
    "status": "completed",
    "transactionId": "TXN-123456",
    "amount": 36.06
  },
  "notes": "Ring doorbell",
  "status": "received"
}
```

### OhMyApp.io Webhook Support

The API automatically detects and processes OhMyApp.io webhooks with special handling for:
- Combined `shippingFee` + `serviceFee` → `deliveryFee`
- Customer address structure
- Webhook metadata tracking
- Enhanced field mapping

---

## 🔍 Using the Logs Endpoint to Check POS Payloads

### 1. Retrieve Recent Order Logs

```bash
# Get last 50 logs related to orders
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?lines=50&search=orders"
```

### 2. Filter by Log Level

```bash
# Get only error logs
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?level=error&search=orders"
```

### 3. Search for Specific Order ID

```bash
# Find logs for a specific order
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?search=ORD-20241104-001"
```

### 4. Get Order Creation Payloads

```bash
# Get logs with payload details
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?search=Raw%20Order%20Data"
```

### 5. Stream Logs in Real-Time

```bash
# Watch logs as they come in (SSE)
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs/stream"
```

---

## 🛠️ Key Components

### 1. Logger (`src/utils/logger.js`)

Enhanced Winston logger with specialized debug methods:

- `logger.debugPayload(label, payload)` - Log detailed payload analysis
- `logger.debugTransformation(label, before, after)` - Track data transformations
- `logger.debugValidation(label, data, result)` - Log validation results
- `logger.debugDatabase(label, query, params)` - Database operation logging
- `logger.debugRequest(req, label)` - Comprehensive request logging
- `logger.debugSteps(label, steps)` - Step-by-step process tracking
- `logger.sanitizeObject(obj, sensitiveFields)` - Remove sensitive data

### 2. Order Controller (`src/controllers/orderController.js`)

Enhanced order processing with:

- **Webhook Detection** - Automatically detects OhMyApp.io and other webhooks
- **Null Value Analysis** - Identifies missing/null data in payloads
- **Field Mapping** - Intelligent field mapping for various POS formats
- **Nested Data Extraction** - Extracts order data from nested webhook structures
- **Comprehensive Logging** - Step-by-step debug logging throughout order creation

### 3. Database Configuration

Supports both PostgreSQL and SQLite:

- **PostgreSQL** - `src/config/database.js`
- **SQLite** - `src/config/database-sqlite.js`

Auto-migration support for OhMyApp.io fields on startup.

### 4. Middleware

- **auth.js** - API key authentication with permission-based access
- **errorHandler.js** - Centralized error handling and logging

---

## 📝 Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pos_orders
DB_USER=postgres
DB_PASSWORD=your_password

# Database (SQLite - fallback)
SQLITE_DB_PATH=./database/orders.db

# Logging
LOG_LEVEL=debug

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SKIP_RATE_LIMIT=false

# Proxy Configuration (for deployment)
TRUST_PROXY=true
DEBUG_PROXY=true
```

---

## 🎯 Common Use Cases

### Use Case 1: Debug POS Order Creation

1. **Send test order from POS**
2. **Check logs endpoint:**
   ```bash
   curl -H "X-API-Key: dev-api-key-123" \
     "http://localhost:3000/api/v1/logs?lines=100&search=POST%20/api/v1/orders"
   ```
3. **Review payload structure in logs**
4. **Adjust POS payload format if needed**

### Use Case 2: Inspect Webhook Payloads

1. **Use debug endpoint for analysis:**
   ```bash
   curl -X POST -H "X-API-Key: dev-api-key-123" \
     -H "Content-Type: application/json" \
     -d @webhook-payload.json \
     http://localhost:3000/api/v1/orders/debug/inspect-payload
   ```
2. **Review field mapping suggestions**
3. **Check transformation preview**

### Use Case 3: Monitor Order Processing

1. **Start log stream:**
   ```bash
   curl -H "X-API-Key: dev-api-key-123" \
     http://localhost:3000/api/v1/logs/stream
   ```
2. **Send orders from POS**
3. **Watch real-time processing logs**

---

## 🐛 Troubleshooting

### Issue: Orders Not Creating

1. Check logs: `GET /api/v1/logs?level=error`
2. Inspect payload: `POST /api/v1/orders/debug/inspect-payload`
3. Preview transformation: `POST /api/v1/orders/debug/transformation-preview`
4. Verify SQL parameters: `POST /api/v1/orders/debug/sql-preview`

### Issue: Missing Fields

1. Use webhook comparison: `POST /api/v1/orders/debug/webhook-compare`
2. Review field mapping in controller
3. Check for null values in logs

### Issue: Authentication Failing

1. Verify API key in request headers
2. Check `auth.js` for valid keys
3. Review authentication logs in `combined.log`

---

## 📚 Dependencies

### Core Dependencies
- **express** - Web framework
- **winston** - Logging
- **helmet** - Security headers
- **cors** - Cross-origin support
- **express-rate-limit** - Rate limiting
- **dotenv** - Environment configuration

### Database
- **pg** - PostgreSQL client
- **sqlite3** - SQLite client

### Validation
- **joi** - Schema validation

### Utilities
- **uuid** - UUID generation
- **compression** - Response compression

---

## 🚦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Initialize Database
```bash
# PostgreSQL
psql -U postgres -f database/schema.sql

# OR SQLite (automatic)
node verify-setup.js
```

### 4. Start Server
```bash
# Windows
start-api.bat

# Linux/Mac
npm start
```

### 5. Test API
```bash
# Windows
test-api.bat

# Linux/Mac
./tests/test-api.sh
```

---

## 📖 Additional Documentation

- **CONFIG_NOTES.md** - Configuration details
- **QUICK_START.md** - Quick start guide
- **PROXY-TRUST-FIX.md** - Proxy configuration
- **OHMYAPP-WEBHOOK-DEBUG-ENHANCEMENT.md** - OhMyApp integration guide

---

## 🔄 Recent Updates

- ✅ Added OhMyApp.io webhook support
- ✅ Enhanced logging with debug methods
- ✅ Added comprehensive debug endpoints
- ✅ Implemented logs endpoint for payload inspection
- ✅ Added webhook detection and analysis
- ✅ Improved field mapping for various POS formats

---

## 📞 Support

For issues or questions, check the logs first:
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?lines=200&level=error"
```

---

**End of Codebase Index**
