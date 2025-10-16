#!/bin/bash

# Order Gateway API Test Script
# Tests all major endpoints with sample data

API_BASE="http://localhost:3000/api/v1"
API_KEY="pos-mobile-app-key"
IDEMPOTENCY_KEY=$(uuidgen)

echo "🧪 Testing Order Gateway API..."
echo "================================"

# Test 1: Health Check
echo "1. Health Check"
curl -s "$API_BASE/../health" | jq '.'
echo ""

# Test 2: API Info
echo "2. API Documentation"
curl -s "$API_BASE/../api" | jq '.'
echo ""

# Test 3: Create Order
echo "3. Creating Test Order"
ORDER_RESPONSE=$(curl -s -X POST "$API_BASE/orders" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d @tests/sample-order.json)

echo "$ORDER_RESPONSE" | jq '.'

# Extract order ID for subsequent tests
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.orderId')
echo "Created Order ID: $ORDER_ID"
echo ""

# Test 4: Get Order Details
echo "4. Getting Order Details"
curl -s "$API_BASE/orders/$ORDER_ID" \
  -H "X-API-Key: $API_KEY" | jq '.'
echo ""

# Test 5: Get Order Status  
echo "5. Getting Order Status"
curl -s "$API_BASE/orders/$ORDER_ID/status" \
  -H "X-API-Key: $API_KEY" | jq '.'
echo ""

# Test 6: Update Order Status
echo "6. Updating Order Status"
curl -s -X PUT "$API_BASE/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sync-agent-key" \
  -d '{
    "status": "preparing",
    "estimatedTime": "2024-10-08T15:30:00Z",
    "notes": "Order is being prepared"
  }' | jq '.'
echo ""

# Test 7: Get Menu
echo "7. Getting Menu"
curl -s "$API_BASE/menu?restaurantId=NYC-DELI-001" \
  -H "X-API-Key: $API_KEY" | jq '.'
echo ""

# Test 8: Test Idempotency (should return existing order)
echo "8. Testing Idempotency (duplicate request)"
curl -s -X POST "$API_BASE/orders" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d @tests/sample-order.json | jq '.'
echo ""

# Test 9: Cancel Order
echo "9. Cancelling Order"
curl -s -X POST "$API_BASE/orders/$ORDER_ID/cancel" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "reason": "customer_request",
    "notes": "Customer changed their mind"
  }' | jq '.'
echo ""

# Test 10: Webhook Test
echo "10. Testing Status Webhook"
curl -s -X POST "$API_BASE/status/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Key: sync-agent-secret-key" \
  -d '{
    "orderId": "'$ORDER_ID'",
    "status": "completed",
    "estimatedTime": "2024-10-08T15:45:00Z"
  }' | jq '.'
echo ""

echo "✅ API Testing Complete!"