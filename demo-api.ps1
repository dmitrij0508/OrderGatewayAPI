# Order Gateway API Demo Script
Write-Host "Order Gateway API Demo" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

# Change to API directory
Set-Location "D:\Software\Dmitri\Working\POS_Mobile\Git\POSSyncAgent\API"

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow

# Start the server in background
Write-Host "Starting API server..." -ForegroundColor Yellow
$job = Start-Job -ScriptBlock {
    Set-Location "D:\Software\Dmitri\Working\POS_Mobile\Git\POSSyncAgent\API"
    node server.js
}

Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test the API
Write-Host "Testing API endpoints..." -ForegroundColor Green

# Test 1: Health Check
Write-Host "`n1. Health Check:" -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
    Write-Host "Status: $($health.status)" -ForegroundColor Green
    Write-Host "Database: $($health.database)" -ForegroundColor Green
}
catch {
    Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: API Documentation
Write-Host "`n2. API Documentation:" -ForegroundColor Cyan
try {
    $api = Invoke-RestMethod -Uri "http://localhost:3000/api" -Method Get
    Write-Host "API Name: $($api.name)" -ForegroundColor Green
    Write-Host "Version: $($api.version)" -ForegroundColor Green
}
catch {
    Write-Host "API documentation failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Menu (with API key)
Write-Host "`n3. Menu Test:" -ForegroundColor Cyan
try {
    $headers = @{ 'X-API-Key' = 'pos-mobile-app-key' }
    $menu = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/menu?restaurantId=NYC-DELI-001" -Method Get -Headers $headers
    Write-Host "Menu loaded: $($menu.data.name)" -ForegroundColor Green
    Write-Host "Items count: $($menu.data.items.Count)" -ForegroundColor Green
}
catch {
    Write-Host "Menu test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nServer is running! Access it at:" -ForegroundColor Green
Write-Host "   Health: http://localhost:3000/health" -ForegroundColor White
Write-Host "   API Docs: http://localhost:3000/api" -ForegroundColor White
Write-Host "   Menu: http://localhost:3000/api/v1/menu (requires API key)" -ForegroundColor White

Write-Host "`nAvailable API Keys:" -ForegroundColor Yellow
Write-Host "   Mobile App: pos-mobile-app-key" -ForegroundColor White
Write-Host "   Website: pos-website-key" -ForegroundColor White
Write-Host "   Admin: pos-admin-key" -ForegroundColor White
Write-Host "   Sync Agent: sync-agent-key" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Open browser to http://localhost:3000/health" -ForegroundColor White
Write-Host "   2. Test order creation with sample-order.json" -ForegroundColor White
Write-Host "   3. View complete testing guide in TESTING_GUIDE_COMPLETE.md" -ForegroundColor White

Write-Host "`nPress any key to stop the server..." -ForegroundColor Red
Read-Host

# Stop the server
Write-Host "Stopping server..." -ForegroundColor Yellow
Stop-Job $job
Remove-Job $job

Write-Host "Demo complete!" -ForegroundColor Green