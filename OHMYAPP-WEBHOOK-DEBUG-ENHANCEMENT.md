# OhMyApp.io Webhook Debugging Enhancement

## 🎯 Purpose

This enhancement adds comprehensive debugging capabilities to identify and resolve issues where orders from OhMyApp.io webhooks are filled with null values. The debugging system provides detailed analysis of webhook payloads and automatic data extraction from nested structures.

## 🔍 Key Features Added

### 1. **Webhook Detection System**
- Automatically detects OhMyApp.io webhooks based on:
  - User-Agent headers
  - Origin/Referer domains
  - Webhook-specific headers (X-Webhook-Id, X-Event-Type, etc.)
  - Payload structure patterns
- Confidence scoring system (0-100%)

### 2. **Comprehensive Null Value Analysis**
- Tracks all null, undefined, and empty string values
- Reports exact paths where null values occur
- Warns when significant null data is detected
- Provides recommendations for fixing null value issues

### 3. **Automatic Data Extraction**
- Detects nested webhook data structures
- Automatically extracts order data from common webhook wrappers:
  - `payload.data`
  - `payload.order`
  - `payload.event.data`
  - `payload.payload`
  - `payload.body`
- Scores data structures to find the most "order-like" data

### 4. **Enhanced Field Mapping**
The system now supports multiple field name variations commonly used by different platforms:

#### Order Identification:
- `orderId`, `order_id`, `id`, `orderNumber`, `order_number`
- `externalOrderId`, `external_order_id`
- `restaurantId`, `restaurant_id`, `merchantId`, `merchant_id`

#### Customer Information:
- `customer.name`, `customer.customer_name`, `customerName`, `customer_name`, `client.name`
- `customer.phone`, `customer.phone_number`, `customerPhone`, `customer_phone`, `phone`
- `customer.email`, `customer.email_address`, `customerEmail`, `customer_email`, `email`

#### Order Details:
- `orderType`, `order_type`, `type`, `deliveryType`, `delivery_type`
- `orderTime`, `order_time`, `createdAt`, `created_at`, `timestamp`
- `requestedTime`, `requested_time`, `deliveryTime`, `delivery_time`

#### Items:
- `items`, `orderItems`, `products`, `line_items`
- Item fields: `itemId`, `item_id`, `id`, `productId`, `product_id`
- Item names: `name`, `item_name`, `title`, `product_name`, `description`
- Quantities: `quantity`, `qty`, `amount`
- Prices: `unitPrice`, `unit_price`, `price`, `cost`
- Totals: `totalPrice`, `total_price`, `total`, `line_total`

#### Totals:
- `subtotal`, `sub_total`, `itemsTotal`, `items_total`
- `tax`, `tax_amount`, `salesTax`, `sales_tax`
- `tip`, `tip_amount`, `gratuity`
- `total`, `total_amount`, `grandTotal`, `grand_total`, `finalAmount`, `final_amount`

#### Payment:
- `payment.method`, `payment.payment_method`, `paymentMethod`, `payment_method`
- `payment.status`, `payment.payment_status`, `paymentStatus`, `payment_status`
- `payment.transactionId`, `payment.transaction_id`, `transactionId`, `transaction_id`

## 🛠️ New Debug Endpoints

### 1. **OhMyApp Webhook Analysis**
```
POST /api/v1/orders/debug/ohmyapp-webhook
```
**Purpose**: Detailed analysis of OhMyApp.io webhook payloads
**Features**:
- Webhook detection and confidence scoring
- Payload structure analysis
- Null value detection and reporting
- Field mapping suggestions
- Data extraction recommendations

### 2. **Webhook Structure Comparison**
```
POST /api/v1/orders/debug/webhook-compare
```
**Purpose**: Compare received webhook structure with expected order format
**Features**:
- Missing field detection
- Extra field identification
- Type conflict analysis
- Automatic mapping suggestions

### 3. **Enhanced Debug Endpoints**
- **Payload Inspection**: `/debug/inspect-payload` - Complete payload analysis
- **Transformation Preview**: `/debug/transformation-preview` - Shows data transformation
- **SQL Preview**: `/debug/sql-preview` - Shows generated SQL parameters

## 📊 Enhanced Logging

### Debug Log Files:
- `logs/debug-payloads.log` - Detailed payload debugging
- `logs/combined.log` - All application logs
- `logs/error.log` - Error-specific logs

### Log Categories:
- 🎣 **OHMYAPP WEBHOOK DETECTED** - Webhook identification
- ⚠️ **NULL VALUES DETECTED** - Null value warnings
- 📦 **NESTED WEBHOOK DATA EXTRACTED** - Data extraction success
- 📋 **PROCESSING ORDER DATA** - Data processing steps
- 🔍 **PAYLOAD DEBUG** - Detailed payload analysis
- 🔄 **TRANSFORMATION DEBUG** - Data transformation logging

## 🚀 Usage Instructions

### 1. **Enable Debug Logging**
Set environment variables:
```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_PROXY=true
```

### 2. **Test Webhook Payload**
Send a test webhook to the debug endpoint:
```bash
POST /api/v1/orders/debug/ohmyapp-webhook
Content-Type: application/json
X-API-Key: your-api-key

{
  "your": "webhook payload here"
}
```

### 3. **Analyze Results**
Check the response for:
- Webhook detection confidence
- Null value locations
- Field mapping suggestions
- Data extraction recommendations

### 4. **Fix Issues**
Based on the analysis:
- Configure OhMyApp.io to send complete data
- Adjust field mappings if needed
- Use suggested data extraction paths

## 🔧 Troubleshooting Common Issues

### Issue 1: All Fields Are Null
**Symptoms**: Order created but all fields are null/empty
**Solution**: 
1. Use `/debug/ohmyapp-webhook` to analyze payload
2. Check if data is nested under `data`, `order`, or `event.data`
3. Verify OhMyApp.io webhook configuration

### Issue 2: Wrong Field Names
**Symptoms**: Some fields populated, others null
**Solution**:
1. Use `/debug/webhook-compare` to see field mapping
2. Check the enhanced field mapping list above
3. Update OhMyApp.io to use supported field names

### Issue 3: Partial Data Loss
**Symptoms**: Basic info works, but items/customer details are null
**Solution**:
1. Check null value analysis in logs
2. Verify nested object structures (customer, items, totals)
3. Ensure OhMyApp.io sends complete nested objects

## 📈 Monitoring and Alerts

The system now logs:
- Webhook detection confidence scores
- Null value counts and locations
- Data extraction success/failure
- Field mapping efficiency
- Processing time for webhook requests

Use these metrics to:
- Monitor webhook data quality
- Identify OhMyApp.io configuration issues
- Track null value trends
- Optimize field mapping

## 🎯 Expected Results

After implementing these enhancements:
1. **Immediate visibility** into webhook payload issues
2. **Automatic data extraction** from nested webhook structures  
3. **Comprehensive field mapping** for various naming conventions
4. **Detailed logging** for troubleshooting null value issues
5. **Recommendations** for fixing OhMyApp.io webhook configuration

The system will now automatically handle most common webhook payload variations and provide clear guidance for resolving any remaining null value issues.