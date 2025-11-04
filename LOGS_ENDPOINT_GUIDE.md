# Logs Endpoint Guide - Checking POS Payloads

**Purpose:** Use the logs endpoint to inspect and debug payloads sent by POS systems to `/api/v1/orders`

---

## 🎯 Quick Reference

### Available Log Endpoints

1. **`GET /api/v1/logs`** - Get all recent logs with filtering
2. **`GET /api/v1/logs/orders`** - Get only order-related logs ⭐
3. **`GET /api/v1/logs/payloads`** - Extract order payloads from logs ⭐⭐
4. **`GET /api/v1/logs/files`** - List available log files
5. **`GET /api/v1/logs/stream`** - Stream logs in real-time

---

## 🔍 Most Useful: Extract Payloads Endpoint

### Endpoint
```
GET /api/v1/logs/payloads
```

### What It Does
Automatically extracts and analyzes order payloads from log files, showing you **exactly** what POS systems are sending.

### Example Request
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs/payloads?lines=10"
```

### Example Response
```json
{
  "success": true,
  "data": {
    "payloads": [
      {
        "payload": {
          "orderId": "ORD-20241104-001",
          "customer": {
            "name": "Test Customer",
            "phone": "555-0123"
          },
          "items": [
            {
              "itemId": "SANDWICH-001",
              "name": "Turkey Club",
              "quantity": 1,
              "unitPrice": 12.99,
              "totalPrice": 12.99
            }
          ],
          "totals": {
            "subtotal": 12.99,
            "tax": 1.04,
            "total": 14.03
          }
        },
        "metadata": {
          "timestamp": "2025-11-04 10:30:22",
          "level": "error",
          "source": "error-log",
          "method": "POST",
          "path": "/api/v1/orders",
          "ip": "::ffff:127.0.0.1",
          "userAgent": "PostmanRuntime/7.48.0"
        },
        "analysis": {
          "valid": true,
          "fields": ["orderId", "customer", "items", "totals"],
          "fieldCount": 4,
          "hasOrderId": true,
          "hasCustomer": true,
          "hasItems": true,
          "itemCount": 1,
          "hasTotals": true,
          "totalAmount": 14.03,
          "hasPayment": false,
          "customerFields": ["name", "phone"],
          "missingFields": ["payment"],
          "isComplete": false,
          "completeness": 75
        }
      }
    ],
    "count": 1,
    "totalLinesScanned": 50,
    "hint": "Use this endpoint to see exactly what payloads POS systems are sending to /api/v1/orders"
  }
}
```

### What You Get
- **payload** - The exact JSON sent by the POS
- **metadata** - When, where, and how it was sent
- **analysis** - Automatic validation and field detection:
  - Which fields are present
  - Which fields are missing
  - Completeness percentage
  - Item count
  - Total amount

---

## 📋 Order-Specific Logs Endpoint

### Endpoint
```
GET /api/v1/logs/orders
```

### What It Does
Filters logs to show only order-related operations.

### Example Request
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs/orders?lines=50"
```

### Use Cases
- See all order creation attempts
- Track order processing flow
- Find errors in order handling

---

## 🔎 General Logs Endpoint (with Search)

### Endpoint
```
GET /api/v1/logs
```

### Query Parameters
- `lines` - Number of log lines to return (default: 100, max: 1000)
- `level` - Filter by log level: `info`, `warn`, `error`, `debug`
- `search` - Search term to filter log entries

### Examples

#### 1. Find logs for a specific order ID
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?search=ORD-20241104-001&lines=100"
```

#### 2. Get only error logs
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?level=error&lines=50"
```

#### 3. Search for POST requests to orders
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?search=POST%20/api/v1/orders"
```

#### 4. Find payload debug logs
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs?search=Raw%20Order%20Data"
```

---

## 📊 Real-Time Log Streaming

### Endpoint
```
GET /api/v1/logs/stream
```

### What It Does
Streams logs in real-time using Server-Sent Events (SSE).

### Example (using curl)
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs/stream"
```

### Example (using JavaScript)
```javascript
const eventSource = new EventSource('http://localhost:3000/api/v1/logs/stream', {
  headers: {
    'X-API-Key': 'dev-api-key-123'
  }
});

eventSource.onmessage = (event) => {
  const logEntry = JSON.parse(event.data);
  console.log('New log:', logEntry);
};
```

### Use Cases
- Monitor order creation in real-time
- Watch for errors as they happen
- Debug live POS integration

---

## 🎬 Typical Workflow

### Step 1: Test POS Order Creation
Send a test order from your POS system:
```bash
curl -X POST \
  -H "X-API-Key: pos-integration-key-456" \
  -H "Content-Type: application/json" \
  -d @test-order.json \
  http://localhost:3000/api/v1/orders
```

### Step 2: Check if Order Was Created
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/orders"
```

### Step 3: If It Failed, Check Logs
```bash
# Get the exact payload that was sent
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs/payloads?lines=1"
```

### Step 4: Analyze the Issue
The payload analysis will show:
- ✅ What fields are present
- ❌ What fields are missing
- 📊 Completeness percentage
- 💡 Suggestions for fixing

### Step 5: Fix and Retry
Based on the analysis, update your POS payload and try again.

---

## 🛠️ PowerShell Examples (Windows)

### Get Recent Payloads
```powershell
$headers = @{ "X-API-Key" = "dev-api-key-123" }
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/logs/payloads?lines=5" -Headers $headers
$response.data.payloads | ForEach-Object {
    Write-Host "=== Payload at $($_.metadata.timestamp) ===" -ForegroundColor Cyan
    $_.payload | ConvertTo-Json -Depth 10
    Write-Host "Analysis: $($_.analysis.completeness)% complete" -ForegroundColor Yellow
    if ($_.analysis.missingFields.Count -gt 0) {
        Write-Host "Missing fields: $($_.analysis.missingFields -join ', ')" -ForegroundColor Red
    }
}
```

### Get Order Logs
```powershell
$headers = @{ "X-API-Key" = "dev-api-key-123" }
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/logs/orders?lines=20" -Headers $headers
$response.data.logs | ForEach-Object {
    Write-Host "[$($_.timestamp)] $($_.message)" -ForegroundColor Green
}
```

### Search for Specific Order
```powershell
$orderId = "ORD-20241104-001"
$headers = @{ "X-API-Key" = "dev-api-key-123" }
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/logs?search=$orderId" -Headers $headers
$response.data.logs | Format-List
```

---

## 📂 Log Files Location

Logs are stored in the `logs/` directory:

- **`combined.log`** - All logs (info, warn, error, debug)
- **`error.log`** - Error logs only
- **`debug-payloads.log`** - Detailed payload debugging

### List Available Log Files
```bash
curl -H "X-API-Key: dev-api-key-123" \
  "http://localhost:3000/api/v1/logs/files"
```

---

## 🔧 Troubleshooting Common Issues

### Issue: "No log files found"

**Cause:** Logs directory doesn't exist or is empty.

**Solution:** 
1. Start the API server to generate logs
2. Send a test order
3. Try the logs endpoint again

### Issue: Empty payloads array

**Cause:** No order creation attempts have been logged yet.

**Solution:**
1. Send a test order to `/api/v1/orders`
2. Check logs/payloads endpoint again

### Issue: Can't see recent logs

**Cause:** Logs may be in different log file (date-based naming).

**Solution:**
1. Use `/api/v1/logs/files` to see all available log files
2. Increase `lines` parameter to search more entries

---

## 💡 Pro Tips

1. **Use `/api/v1/logs/payloads` first** - It's the fastest way to see what POS is sending

2. **Check the analysis object** - It tells you exactly what's wrong:
   ```json
   "analysis": {
     "isComplete": false,
     "completeness": 75,
     "missingFields": ["payment"]
   }
   ```

3. **Use real-time streaming during testing** - Start the stream, then send orders

4. **Combine with debug endpoints** - Use `/api/v1/orders/debug/inspect-payload` for even more detail

5. **Search by timestamp** - If you know when the order was sent:
   ```bash
   curl -H "X-API-Key: dev-api-key-123" \
     "http://localhost:3000/api/v1/logs?search=2025-11-04%2010:30"
   ```

---

## 📊 Payload Analysis Explained

The `analysis` object in `/api/v1/logs/payloads` response shows:

| Field | Type | Description |
|-------|------|-------------|
| `valid` | boolean | Is it a valid object? |
| `fields` | array | All top-level field names |
| `fieldCount` | number | Total number of fields |
| `hasOrderId` | boolean | Has orderId/order_id/id field? |
| `hasCustomer` | boolean | Has customer object? |
| `hasItems` | boolean | Has items array? |
| `itemCount` | number | Number of items in order |
| `hasTotals` | boolean | Has totals/total field? |
| `totalAmount` | number | Total order amount |
| `hasPayment` | boolean | Has payment object? |
| `customerFields` | array | Fields in customer object |
| `missingFields` | array | Required fields that are missing |
| `isComplete` | boolean | Has all required fields? |
| `completeness` | number | Percentage of required fields present (0-100) |

### Example Interpretation

```json
{
  "completeness": 75,
  "missingFields": ["payment"],
  "hasOrderId": true,
  "hasCustomer": true,
  "hasItems": true,
  "itemCount": 2
}
```

**Translation:** "Your payload is 75% complete. It has an order ID, customer info, and 2 items. The only thing missing is payment information."

---

## 🚀 Next Steps

1. **Try it now:**
   ```bash
   curl -H "X-API-Key: dev-api-key-123" \
     "http://localhost:3000/api/v1/logs/payloads?lines=5"
   ```

2. **Send a test order** (if you haven't already)

3. **Check the analysis** - Fix any missing fields

4. **Use debug endpoints** for deeper inspection:
   - `/api/v1/orders/debug/inspect-payload`
   - `/api/v1/orders/debug/transformation-preview`

---

**Happy Debugging! 🐛🔍**
