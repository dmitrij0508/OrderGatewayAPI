# Create Test Orders Script
# This script creates sample orders using the local API

$baseUrl = "http://localhost:3000"
$apiKey = "pos-mobile-app-key"  # Has orders:create permission
$headers = @{
    "X-API-Key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Creating Test Orders" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Test Order 1: Simple Pickup Order
Write-Host "[1/5] Creating pickup order - Turkey Club Sandwich..." -ForegroundColor Yellow
$order1 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-001"
    externalOrderId = "EXT-PICKUP-001"
    restaurantId = "NYC-DELI-001"
    customer = @{
        name = "John Smith"
        phone = "555-0101"
        email = "john.smith@example.com"
    }
    orderType = "pickup"
    orderTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    requestedTime = (Get-Date).AddMinutes(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    items = @(
        @{
            itemId = "SANDWICH-001"
            name = "Turkey Club Sandwich"
            quantity = 1
            unitPrice = 12.99
            totalPrice = 12.99
            specialInstructions = "No mayo, extra lettuce"
            modifiers = @(
                @{
                    name = "Extra Cheese"
                    price = 1.50
                }
            )
        },
        @{
            itemId = "DRINK-001"
            name = "Iced Tea"
            quantity = 1
            unitPrice = 2.99
            totalPrice = 2.99
        }
    )
    totals = @{
        subtotal = 17.48
        tax = 1.40
        tip = 0
        discount = 0
        deliveryFee = 0
        total = 18.88
    }
    payment = @{
        method = "credit_card"
        status = "completed"
        transactionId = "TXN-$(Get-Random -Minimum 1000 -Maximum 9999)"
        amount = 18.88
    }
    notes = "Please call when ready"
    status = "received"
}

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order1 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response1.data.orderId)" -ForegroundColor Green
    Write-Host "    Total: `$$($response1.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Start-Sleep -Seconds 1

# Test Order 2: Delivery Order with Multiple Items
Write-Host "[2/5] Creating delivery order - Pizza and Wings..." -ForegroundColor Yellow
$order2 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-002"
    externalOrderId = "EXT-DELIVERY-002"
    restaurantId = "NYC-PIZZA-001"
    customer = @{
        name = "Sarah Johnson"
        phone = "555-0202"
        email = "sarah.j@example.com"
        address = @{
            street = "456 Oak Avenue"
            city = "New York"
            state = "NY"
            zipCode = "10002"
        }
    }
    orderType = "delivery"
    orderTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    requestedTime = (Get-Date).AddMinutes(45).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    items = @(
        @{
            itemId = "PIZZA-001"
            name = "Large Pepperoni Pizza"
            quantity = 2
            unitPrice = 18.99
            totalPrice = 37.98
            specialInstructions = "Well done, extra sauce"
            modifiers = @(
                @{
                    name = "Extra Pepperoni"
                    price = 2.50
                },
                @{
                    name = "Extra Cheese"
                    price = 1.50
                }
            )
        },
        @{
            itemId = "WINGS-001"
            name = "Buffalo Wings 12pcs"
            quantity = 1
            unitPrice = 11.99
            totalPrice = 11.99
            modifiers = @(
                @{
                    name = "Ranch Dressing"
                    price = 0.50
                }
            )
        },
        @{
            itemId = "DRINK-002"
            name = "2-Liter Coca-Cola"
            quantity = 1
            unitPrice = 3.99
            totalPrice = 3.99
        }
    )
    totals = @{
        subtotal = 58.46
        tax = 4.68
        tip = 10.00
        discount = 0
        deliveryFee = 5.00
        total = 78.14
    }
    payment = @{
        method = "credit_card"
        status = "completed"
        transactionId = "TXN-$(Get-Random -Minimum 1000 -Maximum 9999)"
        amount = 78.14
    }
    notes = "Ring doorbell twice, leave at door"
    status = "received"
}

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order2 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response2.data.orderId)" -ForegroundColor Green
    Write-Host "    Total: `$$($response2.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Start-Sleep -Seconds 1

# Test Order 3: Dine-in Order
Write-Host "[3/5] Creating dine-in order - Burger and Fries..." -ForegroundColor Yellow
$order3 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-003"
    externalOrderId = "EXT-DINEIN-003"
    restaurantId = "NYC-BURGER-001"
    customer = @{
        name = "Michael Chen"
        phone = "555-0303"
        email = "mchen@example.com"
    }
    orderType = "dine-in"
    orderTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    items = @(
        @{
            itemId = "BURGER-001"
            name = "Classic Cheeseburger"
            quantity = 1
            unitPrice = 14.99
            totalPrice = 14.99
            specialInstructions = "Medium rare, no onions"
            modifiers = @(
                @{
                    name = "Extra Bacon"
                    price = 2.00
                },
                @{
                    name = "Avocado"
                    price = 1.50
                }
            )
        },
        @{
            itemId = "SIDES-001"
            name = "French Fries"
            quantity = 1
            unitPrice = 4.99
            totalPrice = 4.99
        },
        @{
            itemId = "SHAKE-001"
            name = "Chocolate Milkshake"
            quantity = 1
            unitPrice = 5.99
            totalPrice = 5.99
        }
    )
    totals = @{
        subtotal = 29.46
        tax = 2.36
        tip = 5.00
        discount = 0
        deliveryFee = 0
        total = 36.82
    }
    payment = @{
        method = "credit_card"
        status = "completed"
        transactionId = "TXN-$(Get-Random -Minimum 1000 -Maximum 9999)"
        amount = 36.82
    }
    notes = "Table 15"
    status = "received"
}

try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order3 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response3.data.orderId)" -ForegroundColor Green
    Write-Host "    Total: `$$($response3.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Start-Sleep -Seconds 1

# Test Order 4: Large Catering Order
Write-Host "[4/5] Creating catering order - Corporate Lunch..." -ForegroundColor Yellow
$order4 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-004"
    externalOrderId = "EXT-CATERING-004"
    restaurantId = "NYC-DELI-001"
    customer = @{
        name = "Tech Corp Inc."
        phone = "555-0404"
        email = "orders@techcorp.com"
        address = @{
            street = "789 Business Plaza, Suite 500"
            city = "New York"
            state = "NY"
            zipCode = "10003"
        }
    }
    orderType = "delivery"
    orderTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    requestedTime = (Get-Date).AddHours(2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    items = @(
        @{
            itemId = "PLATTER-001"
            name = "Sandwich Platter feeds 10"
            quantity = 2
            unitPrice = 79.99
            totalPrice = 159.98
        },
        @{
            itemId = "SALAD-001"
            name = "Garden Salad Large"
            quantity = 3
            unitPrice = 24.99
            totalPrice = 74.97
        },
        @{
            itemId = "DRINK-003"
            name = "Beverage Package for 10"
            quantity = 2
            unitPrice = 29.99
            totalPrice = 59.98
        }
    )
    totals = @{
        subtotal = 294.93
        tax = 23.59
        tip = 50.00
        discount = 29.49
        deliveryFee = 15.00
        total = 354.03
    }
    payment = @{
        method = "corporate_account"
        status = "completed"
        transactionId = "TXN-$(Get-Random -Minimum 1000 -Maximum 9999)"
        amount = 354.03
    }
    notes = "Delivery between 12:00-12:30 PM. Contact: Jim (ext. 2345)"
    status = "received"
}

try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order4 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response4.data.orderId)" -ForegroundColor Green
    Write-Host "    Total: `$$($response4.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Start-Sleep -Seconds 1

# Test Order 5: Simple Coffee Order
Write-Host "[5/5] Creating pickup order - Coffee and Pastry..." -ForegroundColor Yellow
$order5 = @{
    orderId = "ORD-$(Get-Date -Format 'yyyyMMddHHmmss')-005"
    externalOrderId = "EXT-COFFEE-005"
    restaurantId = "NYC-CAFE-001"
    customer = @{
        name = "Emma Wilson"
        phone = "555-0505"
        email = "emma.w@example.com"
    }
    orderType = "pickup"
    orderTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    requestedTime = (Get-Date).AddMinutes(15).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    items = @(
        @{
            itemId = "COFFEE-001"
            name = "Large Latte"
            quantity = 1
            unitPrice = 5.49
            totalPrice = 5.49
            modifiers = @(
                @{
                    name = "Extra Shot"
                    price = 0.75
                },
                @{
                    name = "Oat Milk"
                    price = 0.50
                }
            )
        },
        @{
            itemId = "PASTRY-001"
            name = "Blueberry Muffin"
            quantity = 1
            unitPrice = 3.99
            totalPrice = 3.99
        }
    )
    totals = @{
        subtotal = 10.73
        tax = 0.86
        tip = 1.50
        discount = 0
        deliveryFee = 0
        total = 13.09
    }
    payment = @{
        method = "mobile_payment"
        status = "completed"
        transactionId = "TXN-$(Get-Random -Minimum 1000 -Maximum 9999)"
        amount = 13.09
    }
    notes = "Name: Emma"
    status = "received"
}

try {
    $response5 = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers $headers -Body ($order5 | ConvertTo-Json -Depth 5)
    Write-Host "  ✓ Order created: $($response5.data.orderId)" -ForegroundColor Green
    Write-Host "    Total: `$$($response5.data.totals.total)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Order Creation Complete!" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# View created orders
Write-Host "Retrieving all orders..." -ForegroundColor Yellow
try {
    $allOrders = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Headers $headers
    Write-Host "✓ Total orders in system: $($allOrders.data.Count)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Recent orders:" -ForegroundColor Cyan
    $allOrders.data | Select-Object -First 5 | ForEach-Object {
        Write-Host "  • $($_.orderId) - $($_.customer.name) - `$$($_.totals.total) - $($_.orderType)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Failed to retrieve orders: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. View orders:  curl -H 'X-API-Key: pos-admin-key' http://localhost:3000/api/v1/orders" -ForegroundColor Gray
Write-Host "  2. Check logs:   curl -H 'X-API-Key: pos-admin-key' http://localhost:3000/api/v1/logs/payloads" -ForegroundColor Gray
Write-Host "  3. View order:   curl -H 'X-API-Key: pos-admin-key' http://localhost:3000/api/v1/orders/[ORDER_ID]" -ForegroundColor Gray
Write-Host ""
