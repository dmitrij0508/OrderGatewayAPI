param(
  [string]$ApiUrl = 'https://ordergatewayapi.onrender.com/api/v1/orders',
  [string]$ApiKey = 'pos-admin-key',
  [string]$RestaurantId = 'NYC-DELI-001',
  [string]$Sku = 'COFFEE-12OZ',
  [decimal]$Price = 2.99,
  [int]$SeedTs,
  [string]$IdempotencyKey
)

$ts = if ($PSBoundParameters.ContainsKey('SeedTs')) { $SeedTs } else { [int]([DateTime]::UtcNow.Subtract([datetime]'1970-01-01').TotalSeconds) }
$orderId = "ORD-$ts"
$extId = "EXT-$ts"
$idem = if ($PSBoundParameters.ContainsKey('IdempotencyKey')) { $IdempotencyKey } else { "TEST-$ts" }

$payload = [ordered]@{
  orderId = $orderId
  externalOrderId = $extId
  restaurantId = $RestaurantId
  customer = [ordered]@{
    name = 'Curl Test'
    phone = '555-1212'
    email = 'curl@test.local'
  }
  orderType = 'pickup'
  orderTime = (Get-Date).ToUniversalTime().ToString('o')
  items = @(
    [ordered]@{
      sku = $Sku
      name = 'Coffee 12oz'
      description = 'Coffee 12oz - House Brew'
      quantity = 1
      unitPrice = $Price
      totalPrice = $Price
      modifiers = @()
    }
  )
  totals = [ordered]@{
    subtotal = $Price
    tax = 0
    tip = 0
    discount = 0
    deliveryFee = 0
    total = $Price
  }
  payment = [ordered]@{
    method = 'cash'
    status = 'pending'
    transactionId = $extId
    amount = $Price
  }
}

$json = $payload | ConvertTo-Json -Depth 8
$tmp = [IO.Path]::GetTempFileName()
Set-Content -Path $tmp -Value $json -Encoding utf8

# Emit markers so external batch scripts can parse values reliably
Write-Host "MARKER:TS=$ts"
Write-Host "MARKER:ORDER_ID=$orderId"
Write-Host "MARKER:EXTERNAL_ID=$extId"
Write-Host "MARKER:IDEMPOTENCY_KEY=$idem"
Write-Host "POST $ApiUrl"
Write-Host "Idempotency-Key: $idem"
$Headers = @(
  'Content-Type: application/json',
  "X-API-Key: $ApiKey",
  "X-Idempotency-Key: $idem"
)

$curlArgs = @(
  '-sS', '-i',
  '-X','POST', $ApiUrl
)

foreach ($h in $Headers) { $curlArgs += @('-H', $h) }
$curlArgs += @('--data-binary', "@$tmp")

$resp = & curl.exe @curlArgs
Write-Output $resp

Remove-Item $tmp -ErrorAction SilentlyContinue
