# Create Simple Test Orders
# Simplified version without complex nested structures

$baseUrl = "http://localhost:3000"
$apiKey = "pos-mobile-app-key"
$headers = @{
    "X-API-Key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Creating Simple Test Orders" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Order 1: Pickup
Write-Host "[1/5] Creating pickup order..." -ForegroundColor Yellow
$order1 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-001"
    customer = @{
        name = "John Smith"
        phone = "555-0101"
        email = "john.smith@example.com"
    }
    orderType = "pickup"
    items = @(
        @{
            name = "Turkey Club Sandwich"
            quantity = 1
            unitPrice = 12.99
            totalPrice = 12.99
        },
        @{
            name = "Iced Tea"
            quantity = 1
            unitPrice = 2.99
            totalPrice = 2.99
        }
    )
    totals = @{
        subtotal = 15.98
        tax = 1.28
        total = 17.26
    }
    payment = @{
        method = "credit_card"
        status = "completed"
    }
    notes = "Please call when ready"
}

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order1 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response1.data.orderId)" -ForegroundColor Green
    Write-Host "    Customer: $($response1.data.customer.name)" -ForegroundColor Gray
    Write-Host "    Total: `$$($response1.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Order 2: Delivery
Write-Host "[2/5] Creating delivery order..." -ForegroundColor Yellow
$order2 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-002"
    customer = @{
        name = "Sarah Johnson"
        phone = "555-0202"
        email = "sarah.j@example.com"
    }
    orderType = "delivery"
    items = @(
        @{
            name = "Large Pepperoni Pizza"
            quantity = 2
            unitPrice = 18.99
            totalPrice = 37.98
        },
        @{
            name = "Buffalo Wings"
            quantity = 1
            unitPrice = 11.99
            totalPrice = 11.99
        }
    )
    totals = @{
        subtotal = 49.97
        tax = 4.00
        tip = 10.00
        deliveryFee = 5.00
        total = 68.97
    }
    payment = @{
        method = "credit_card"
        status = "completed"
    }
    notes = "Ring doorbell, leave at door"
}

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order2 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response2.data.orderId)" -ForegroundColor Green
    Write-Host "    Customer: $($response2.data.customer.name)" -ForegroundColor Gray
    Write-Host "    Total: `$$($response2.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Order 3: Dine-in
Write-Host "[3/5] Creating dine-in order..." -ForegroundColor Yellow
$order3 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-003"
    customer = @{
        name = "Michael Chen"
        phone = "555-0303"
    }
    orderType = "dine-in"
    items = @(
        @{
            name = "Classic Cheeseburger"
            quantity = 1
            unitPrice = 14.99
            totalPrice = 14.99
        },
        @{
            name = "French Fries"
            quantity = 1
            unitPrice = 4.99
            totalPrice = 4.99
        },
        @{
            name = "Chocolate Milkshake"
            quantity = 1
            unitPrice = 5.99
            totalPrice = 5.99
        }
    )
    totals = @{
        subtotal = 25.97
        tax = 2.08
        tip = 5.00
        total = 33.05
    }
    payment = @{
        method = "credit_card"
        status = "completed"
    }
    notes = "Table 15"
}

try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order3 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response3.data.orderId)" -ForegroundColor Green
    Write-Host "    Customer: $($response3.data.customer.name)" -ForegroundColor Gray
    Write-Host "    Total: `$$($response3.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Order 4: Large order
Write-Host "[4/5] Creating large catering order..." -ForegroundColor Yellow
$order4 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-004"
    customer = @{
        name = "Tech Corp Inc"
        phone = "555-0404"
        email = "orders@techcorp.com"
    }
    orderType = "delivery"
    items = @(
        @{
            name = "Sandwich Platter"
            quantity = 2
            unitPrice = 79.99
            totalPrice = 159.98
        },
        @{
            name = "Garden Salad Large"
            quantity = 3
            unitPrice = 24.99
            totalPrice = 74.97
        }
    )
    totals = @{
        subtotal = 234.95
        tax = 18.80
        tip = 40.00
        deliveryFee = 15.00
        discount = 23.50
        total = 285.25
    }
    payment = @{
        method = "corporate_account"
        status = "completed"
    }
    notes = "Delivery 12:00-12:30 PM"
}

try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order4 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response4.data.orderId)" -ForegroundColor Green
    Write-Host "    Customer: $($response4.data.customer.name)" -ForegroundColor Gray
    Write-Host "    Total: `$$($response4.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Order 5: Coffee
Write-Host "[5/5] Creating coffee order..." -ForegroundColor Yellow
$order5 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-005"
    customer = @{
        name = "Emma Wilson"
        phone = "555-0505"
    }
    orderType = "pickup"
    items = @(
        @{
            name = "Large Latte"
            quantity = 1
            unitPrice = 5.49
            totalPrice = 5.49
        },
        @{
            name = "Blueberry Muffin"
            quantity = 1
            unitPrice = 3.99
            totalPrice = 3.99
        }
    )
    totals = @{
        subtotal = 9.48
        tax = 0.76
        tip = 1.50
        total = 11.74
    }
    payment = @{
        method = "mobile_payment"
        status = "completed"
    }
}

try {
    $response5 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order5 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response5.data.orderId)" -ForegroundColor Green
    Write-Host "    Customer: $($response5.data.customer.name)" -ForegroundColor Gray
    Write-Host "    Total: `$$($response5.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# View created orders
Write-Host "Retrieving all orders..." -ForegroundColor Yellow
try {
    $allOrders = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Headers $headers
    Write-Host "✓ Total orders in system: $($allOrders.data.Count)" -ForegroundColor Green
    Write-Host ""
    
    if ($allOrders.data.Count -gt 0) {
        Write-Host "Recent orders:" -ForegroundColor Cyan
        $allOrders.data | Select-Object -First 10 | ForEach-Object {
            $orderTypeLabel = switch ($_.orderType) {
                "pickup" { "[P]" }
                "delivery" { "[D]" }
                "dine-in" { "[I]" }
                default { "[O]" }
            }
            Write-Host "  $orderTypeLabel $($_.orderId) - $($_.customer.name) - `$$($_.totals.total)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "✗ Failed to retrieve orders: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "✨ All done! Test the logs endpoint:" -ForegroundColor Cyan
Write-Host "   .\test-logs-endpoint.ps1" -ForegroundColor Gray
Write-Host ""
