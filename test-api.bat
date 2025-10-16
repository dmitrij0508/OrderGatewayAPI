@echo off
echo ================================
echo Order Gateway API - Quick Test
echo ================================
echo.

echo Step 1: Testing API health...
curl -s http://localhost:3000/health
echo.
echo.

echo Step 2: Creating a test order...
curl -X POST http://localhost:3000/api/v1/orders ^
-H "Content-Type: application/json" ^
-H "X-API-Key: pos-mobile-app-key" ^
-H "X-Idempotency-Key: quicktest-123" ^
-d "{\"orderId\":\"TEST-001\",\"restaurantId\":\"DEMO-RESTAURANT\",\"customer\":{\"name\":\"Test Customer\",\"phone\":\"+1-555-0199\"},\"orderType\":\"pickup\",\"orderTime\":\"2024-10-10T12:00:00Z\",\"items\":[{\"itemId\":\"ITEM-001\",\"name\":\"Test Item\",\"quantity\":1,\"unitPrice\":10.00,\"totalPrice\":10.00}],\"totals\":{\"subtotal\":10.00,\"tax\":0.80,\"total\":10.80}}"
echo.
echo.

echo Step 3: Checking order status...
curl -H "X-API-Key: pos-mobile-app-key" http://localhost:3000/api/v1/orders/TEST-001/status
echo.
echo.

echo Step 4: Getting menu data...
curl -H "X-API-Key: pos-mobile-app-key" http://localhost:3000/api/v1/menu
echo.
echo.

echo ================================
echo Test complete!
echo If you see JSON responses above, the API is working correctly.
echo ================================
pause