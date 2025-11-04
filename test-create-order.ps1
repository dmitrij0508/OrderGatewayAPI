# Test Order Creation Script
# This script sends a POST request to create a test order

$apiUrl = "http://localhost:3000/api/v1/orders"
$apiKey = "pos-mobile-app-key"

$orderData = @{
    order_id = "TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
    external_order_id = "EXT-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
    restaurant_id = "REST-001"
    customer_name = "John Doe"
    customer_phone = "+1234567890"
    customer_email = "john@example.com"
    customer_address = "123 Main St, City, State 12345"
    order_type = "delivery"
    order_time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    subtotal = 25.50
    tax = 2.55
    tip = 5.00
    total = 33.05
    payment_method = "credit_card"
    payment_status = "captured"
    items = @(
        @{
            item_id = "ITEM-001"
            name = "Burger"
            quantity = 2
            price = 10.00
            category = "Main Course"
            modifiers = @(
                @{
                    modifier_id = "MOD-001"
                    name = "Extra Cheese"
                    price = 1.50
                    quantity = 1
                }
            )
        },
        @{
            item_id = "ITEM-002"
            name = "Fries"
            quantity = 1
            price = 5.50
            category = "Sides"
        }
    )
}

$jsonBody = $orderData | ConvertTo-Json -Depth 10

Write-Host "Creating test order..." -ForegroundColor Cyan
Write-Host "API URL: $apiUrl" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $apiUrl `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "X-API-Key" = $apiKey
        } `
        -Body $jsonBody `
        -UseBasicParsing

    Write-Host "✅ Order created successfully!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
}
catch {
    Write-Host "❌ Error creating order!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}
