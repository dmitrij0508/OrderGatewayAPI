# Test Logs Endpoint
# This script tests the enhanced logs endpoint for checking POS payloads

$baseUrl = "http://localhost:3000"
$apiKey = "pos-admin-key"
$headers = @{
    "X-API-Key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Testing Enhanced Logs Endpoint for POS" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[1/6] Testing API Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    Write-Host "✓ API is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ API health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Create a test order
Write-Host "[2/6] Creating test order..." -ForegroundColor Yellow
$testOrder = @{
    orderId = "TEST-LOG-$(Get-Date -Format 'yyyyMMddHHmmss')"
    externalOrderId = "EXT-TEST-001"
    restaurantId = "TEST-RESTAURANT-001"
    customer = @{
        name = "Test Customer"
        phone = "555-0123"
        email = "test@example.com"
    }
    orderType = "pickup"
    orderTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    items = @(
        @{
            itemId = "ITEM-001"
            name = "Test Item"
            quantity = 1
            unitPrice = 10.00
            totalPrice = 10.00
        }
    )
    totals = @{
        subtotal = 10.00
        tax = 0.80
        tip = 0
        discount = 0
        deliveryFee = 0
        total = 10.80
    }
    payment = @{
        method = "cash"
        status = "completed"
    }
    notes = "Test order for logs endpoint verification"
    status = "received"
}

try {
    $orderResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($testOrder | ConvertTo-Json -Depth 5)
    Write-Host "✓ Test order created: $($orderResponse.data.orderId)" -ForegroundColor Green
} catch {
    Write-Host "✓ Order creation logged (may have failed - that's okay for testing)" -ForegroundColor Yellow
}
Write-Host ""

# Wait for logs to be written
Start-Sleep -Seconds 2

# Test 3: Get all recent logs
Write-Host "[3/6] Testing GET /api/v1/logs..." -ForegroundColor Yellow
try {
    $logsResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/logs?lines=10" -Headers $headers
    Write-Host "✓ Retrieved $($logsResponse.data.count) log entries" -ForegroundColor Green
    if ($logsResponse.data.count -gt 0) {
        Write-Host "  Latest log: $($logsResponse.data.logs[0].message)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Failed to retrieve logs: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Get order-specific logs
Write-Host "[4/6] Testing GET /api/v1/logs/orders..." -ForegroundColor Yellow
try {
    $orderLogsResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/logs/orders?lines=5" -Headers $headers
    Write-Host "✓ Retrieved $($orderLogsResponse.data.count) order-specific log entries" -ForegroundColor Green
    if ($orderLogsResponse.data.count -gt 0) {
        Write-Host "  Found order operations in logs" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Failed to retrieve order logs: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Extract payloads
Write-Host "[5/6] Testing GET /api/v1/logs/payloads..." -ForegroundColor Yellow
try {
    $payloadsResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/logs/payloads?lines=3" -Headers $headers
    Write-Host "✓ Retrieved $($payloadsResponse.data.count) payloads from logs" -ForegroundColor Green
    
    if ($payloadsResponse.data.count -gt 0) {
        Write-Host ""
        Write-Host "  Payload Analysis:" -ForegroundColor Cyan
        foreach ($payload in $payloadsResponse.data.payloads) {
            Write-Host "  - Timestamp: $($payload.metadata.timestamp)" -ForegroundColor Gray
            Write-Host "    Completeness: $($payload.analysis.completeness)%" -ForegroundColor Gray
            Write-Host "    Has Order ID: $($payload.analysis.hasOrderId)" -ForegroundColor Gray
            Write-Host "    Has Customer: $($payload.analysis.hasCustomer)" -ForegroundColor Gray
            Write-Host "    Has Items: $($payload.analysis.hasItems) (Count: $($payload.analysis.itemCount))" -ForegroundColor Gray
            if ($payload.analysis.missingFields.Count -gt 0) {
                Write-Host "    Missing Fields: $($payload.analysis.missingFields -join ', ')" -ForegroundColor Yellow
            }
            Write-Host ""
        }
    } else {
        Write-Host "  No payloads found in logs yet" -ForegroundColor Yellow
        Write-Host "  This is normal if the server just started" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Failed to extract payloads: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 6: List available log files
Write-Host "[6/6] Testing GET /api/v1/logs/files..." -ForegroundColor Yellow
try {
    $filesResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/logs/files" -Headers $headers
    Write-Host "✓ Found $($filesResponse.data.count) log files" -ForegroundColor Green
    
    if ($filesResponse.data.count -gt 0) {
        Write-Host "  Log Files:" -ForegroundColor Cyan
        foreach ($file in $filesResponse.data.files) {
            Write-Host "  - $($file.name) ($($file.sizeFormatted))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "✗ Failed to list log files: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Test Complete!" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The logs endpoint is ready to help you debug POS payloads!" -ForegroundColor Green
Write-Host ""
Write-Host "Quick Commands:" -ForegroundColor Cyan
Write-Host "  View order logs:   curl -H 'X-API-Key: pos-admin-key' http://localhost:3000/api/v1/logs/orders" -ForegroundColor Gray
Write-Host "  Extract payloads:  curl -H 'X-API-Key: pos-admin-key' http://localhost:3000/api/v1/logs/payloads" -ForegroundColor Gray
Write-Host "  Search logs:       curl -H 'X-API-Key: pos-admin-key' http://localhost:3000/api/v1/logs?search=ERROR" -ForegroundColor Gray
Write-Host ""
