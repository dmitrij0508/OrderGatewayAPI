const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requirePermission } = require('../middleware/auth');
router.get('/',
  requirePermission('orders:read'),
  orderController.getAllOrders
);
router.post('/',
  requirePermission('orders:create'),
  orderController.createOrder
);
router.get('/:orderId',
  requirePermission('orders:read'),
  orderController.getOrder
);
router.get('/:orderId/status',
  requirePermission('orders:read'),
  orderController.getOrderStatus
);
router.put('/:orderId',
  requirePermission('orders:update'),
  orderController.updateOrder
);
router.post('/:orderId/cancel',
  requirePermission('orders:create'),
  orderController.cancelOrder
);

// DELETE ALL ORDERS - Testing/Admin endpoint
router.delete('/all',
  requirePermission('orders:create'),
  orderController.deleteAllOrders
);

// CLEAR ORDERS BY RESTAURANT - POS Integration endpoint
router.delete('/clear',
  requirePermission('orders:create'),
  orderController.clearOrdersByRestaurant
);

// HEALTH CHECK ENDPOINT - No database operations
router.get('/health',
  async (req, res) => {
    res.json({
      success: true,
      message: 'Orders API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
);

// OHMYAPP WEBHOOK DEBUGGING ENDPOINT - Dedicated webhook payload analysis
router.post('/debug/ohmyapp-webhook',
  requirePermission('orders:create'),
  async (req, res, next) => {
    try {
      const logger = require('../utils/logger');
      
      // Enhanced webhook request logging
      logger.info('🎣 OHMYAPP WEBHOOK DEBUG - Incoming Request', {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: logger.sanitizeObject(req.headers, ['authorization', 'cookie', 'x-api-key']),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        xForwardedFor: req.get('X-Forwarded-For'),
        xRealIp: req.get('X-Real-IP'),
        bodySize: req.body ? JSON.stringify(req.body).length : 0,
        queryParams: req.query,
        hasBody: !!req.body
      });

      // Deep payload analysis
      const payload = req.body;
      
      // Check for common OhMyApp.io webhook patterns
      const webhookAnalysis = {
        payloadStructure: {
          type: typeof payload,
          isObject: typeof payload === 'object' && payload !== null,
          isArray: Array.isArray(payload),
          hasData: !!payload,
          rootKeys: typeof payload === 'object' && payload !== null ? Object.keys(payload) : null,
          keyCount: typeof payload === 'object' && payload !== null ? Object.keys(payload).length : 0
        },
        
        // Check for nested data structures common in webhooks
        nestedDataCheck: {
          hasDataProperty: !!(payload && payload.data),
          hasOrderProperty: !!(payload && payload.order),
          hasEventProperty: !!(payload && payload.event),
          hasPayloadProperty: !!(payload && payload.payload),
          dataKeys: payload && payload.data ? Object.keys(payload.data) : null,
          orderKeys: payload && payload.order ? Object.keys(payload.order) : null
        },
        
        // Null value analysis
        nullValueAnalysis: payload ? this.analyzeNullValues(payload) : null,
        
        // Field mapping analysis for OhMyApp.io
        ohmyAppFieldMapping: {
          // Check common OhMyApp field variations
          orderId: this.findFieldValue(payload, ['orderId', 'order_id', 'id', 'orderNumber', 'order_number']),
          customer: this.findFieldValue(payload, ['customer', 'customerInfo', 'client', 'user']),
          items: this.findFieldValue(payload, ['items', 'orderItems', 'products', 'line_items']),
          totals: this.findFieldValue(payload, ['totals', 'total', 'amount', 'price', 'cost']),
          payment: this.findFieldValue(payload, ['payment', 'paymentInfo', 'billing']),
          restaurant: this.findFieldValue(payload, ['restaurant', 'restaurantId', 'merchant', 'store'])
        }
      };

      // Log comprehensive analysis
      logger.debug('🔍 OHMYAPP WEBHOOK ANALYSIS', webhookAnalysis);
      
      // Identify potential issues
      const issues = [];
      if (!payload) issues.push('No payload received');
      if (payload && Object.keys(payload).length === 0) issues.push('Empty payload object');
      if (webhookAnalysis.nullValueAnalysis && webhookAnalysis.nullValueAnalysis.nullCount > 0) {
        issues.push(`${webhookAnalysis.nullValueAnalysis.nullCount} null values detected`);
      }
      if (!webhookAnalysis.ohmyAppFieldMapping.orderId.found) issues.push('No order ID found in common locations');
      if (!webhookAnalysis.ohmyAppFieldMapping.customer.found) issues.push('No customer data found');
      if (!webhookAnalysis.ohmyAppFieldMapping.items.found) issues.push('No items data found');

      res.json({
        success: true,
        debug: {
          message: 'OhMyApp webhook analysis completed',
          webhook: {
            source: 'OhMyApp.io',
            timestamp: new Date().toISOString(),
            analysis: webhookAnalysis,
            potentialIssues: issues,
            recommendations: this.generateWebhookRecommendations(webhookAnalysis, issues)
          },
          rawPayload: payload,
          processingHints: {
            suggestedFieldMapping: this.generateFieldMappingSuggestions(payload),
            dataExtractionPath: this.suggestDataExtractionPath(payload)
          }
        }
      });
      
    } catch (error) {
      logger.error('OhMyApp webhook analysis failed:', error);
      res.status(500).json({
        error: 'Webhook analysis failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// WEBHOOK FIELD COMPARISON ENDPOINT - Compare different webhook formats
router.post('/debug/webhook-compare',
  requirePermission('orders:create'),
  async (req, res, next) => {
    try {
      const logger = require('../utils/logger');
      const payload = req.body;
      
      // Compare with expected order structure
      const expectedStructure = {
        orderId: 'string',
        externalOrderId: 'string',
        restaurantId: 'string',
        customer: {
          name: 'string',
          phone: 'string',
          email: 'string'
        },
        orderType: 'string',
        orderTime: 'string',
        items: 'array',
        totals: {
          subtotal: 'number',
          tax: 'number',
          tip: 'number',
          total: 'number'
        },
        payment: {
          method: 'string',
          status: 'string'
        },
        notes: 'string',
        status: 'string'
      };

      const comparison = this.compareStructures(payload, expectedStructure);
      
      logger.debug('🆚 WEBHOOK STRUCTURE COMPARISON', {
        comparison,
        missingFields: comparison.missing,
        extraFields: comparison.extra,
        typeConflicts: comparison.conflicts
      });

      res.json({
        success: true,
        debug: {
          message: 'Webhook structure comparison completed',
          expected: expectedStructure,
          received: payload,
          comparison: comparison,
          mappingSuggestions: this.generateMappingSuggestions(comparison),
          transformationNeeded: comparison.missing.length > 0 || comparison.conflicts.length > 0
        }
      });
      
    } catch (error) {
      logger.error('Webhook comparison failed:', error);
      res.status(500).json({
        error: 'Webhook comparison failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// DEBUG ENDPOINT - Testing basic functionality
router.post('/debug',
  requirePermission('orders:create'),
  async (req, res, next) => {
    try {
      const logger = require('../utils/logger');
      logger.info('Debug endpoint called', { body: req.body, headers: req.headers });
      
      // Test database connection
      const database = require('../config/database');
      const testQuery = await database.query('SELECT COUNT(*) as count FROM orders');
      
      res.json({
        success: true,
        debug: {
          message: 'Debug endpoint working',
          orderCount: testQuery.rows[0].count,
          body: req.body,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Debug endpoint error:', error);
      res.status(500).json({
        error: 'Debug failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// PAYLOAD INSPECTION ENDPOINT - Detailed payload analysis without creation
router.post('/debug/inspect-payload',
  requirePermission('orders:create'),
  async (req, res, next) => {
    try {
      const logger = require('../utils/logger');
      
      // Log detailed request analysis
      logger.debugRequest(req, 'Payload Inspection');
      
      // Analyze payload structure
      const payload = req.body;
      const analysis = {
        payloadStructure: {
          type: typeof payload,
          isObject: typeof payload === 'object' && payload !== null,
          isArray: Array.isArray(payload),
          keys: typeof payload === 'object' && payload !== null ? Object.keys(payload) : null,
          keyCount: typeof payload === 'object' && payload !== null ? Object.keys(payload).length : 0
        },
        orderFields: {
          hasOrderId: !!(payload.orderId || payload.id),
          hasExternalOrderId: !!payload.externalOrderId,
          hasRestaurantId: !!payload.restaurantId,
          hasCustomer: !!payload.customer,
          hasItems: !!(payload.items && Array.isArray(payload.items)),
          hasTotals: !!(payload.totals || payload.total),
          hasPayment: !!payload.payment,
          hasNotes: !!(payload.notes || payload.specialInstructions)
        },
        customerAnalysis: payload.customer ? {
          hasName: !!payload.customer.name,
          hasPhone: !!payload.customer.phone,
          hasEmail: !!payload.customer.email,
          fields: Object.keys(payload.customer)
        } : null,
        itemsAnalysis: payload.items ? {
          itemCount: payload.items.length,
          items: payload.items.map((item, index) => ({
            index,
            hasName: !!item.name,
            hasQuantity: !!item.quantity,
            hasPrice: !!(item.unitPrice || item.price),
            hasModifiers: !!(item.modifiers && Array.isArray(item.modifiers)),
            modifierCount: item.modifiers ? item.modifiers.length : 0,
            fields: Object.keys(item)
          }))
        } : null,
        totalsAnalysis: {
          directTotal: payload.total,
          nestedTotals: payload.totals,
          hasSubtotal: !!(payload.totals?.subtotal || payload.subtotal),
          hasTax: !!(payload.totals?.tax || payload.tax),
          hasTip: !!(payload.totals?.tip || payload.tip)
        }
      };

      logger.debugPayload('Payload Inspection - Full Analysis', analysis);

      res.json({
        success: true,
        debug: {
          message: 'Payload inspection completed',
          analysis,
          rawPayload: payload,
          recommendations: [
            !analysis.orderFields.hasOrderId ? 'Consider adding orderId field' : null,
            !analysis.orderFields.hasCustomer ? 'Customer information missing' : null,
            !analysis.orderFields.hasItems ? 'No items found' : null,
            analysis.itemsAnalysis && analysis.itemsAnalysis.itemCount === 0 ? 'Items array is empty' : null
          ].filter(Boolean),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Payload inspection failed:', error);
      res.status(500).json({
        error: 'Payload inspection failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// TRANSFORMATION PREVIEW ENDPOINT - Show how payload would be transformed
router.post('/debug/transformation-preview',
  requirePermission('orders:create'),
  async (req, res, next) => {
    try {
      const logger = require('../utils/logger');
      const orderController = require('../controllers/orderController');
      
      // Get original data
      const originalData = req.body;
      
      // Apply same transformation logic as controller
      const processedOrder = {
        orderId: originalData.orderId || `ORD-${Date.now()}`,
        externalOrderId: originalData.externalOrderId || originalData.orderId || `EXT-${Date.now()}`,
        restaurantId: originalData.restaurantId || 'NYC-DELI-001',
        
        customer: {
          name: originalData.customer?.name || 'Unknown Customer',
          phone: originalData.customer?.phone || 'N/A',
          email: originalData.customer?.email || null
        },
        
        orderType: originalData.orderType || 'pickup',
        orderTime: originalData.orderTime || new Date().toISOString(),
        requestedTime: originalData.requestedTime || null,
        
        items: Array.isArray(originalData.items) ? originalData.items.map(item => ({
          itemId: item.itemId || item.id || null,
          name: item.name || 'Unknown Item',
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: parseFloat(item.totalPrice) || 0,
          specialInstructions: item.specialInstructions || item.notes || null,
          modifiers: Array.isArray(item.modifiers) ? item.modifiers.map(modifier => ({
            name: modifier.name || 'Unknown Modifier',
            price: parseFloat(modifier.price) || 0
          })) : []
        })) : [],
        
        totals: {
          subtotal: parseFloat(originalData.totals?.subtotal || originalData.subtotal || 0),
          tax: parseFloat(originalData.totals?.tax || originalData.tax || 0),
          tip: parseFloat(originalData.totals?.tip || originalData.tip || 0),
          discount: parseFloat(originalData.totals?.discount || originalData.discount || 0),
          deliveryFee: parseFloat(originalData.totals?.deliveryFee || originalData.deliveryFee || 0),
          total: parseFloat(originalData.totals?.total || originalData.total || 0)
        },
        
        payment: {
          method: originalData.payment?.method || null,
          status: originalData.payment?.status || 'pending',
          transactionId: originalData.payment?.transactionId || null
        },
        
        notes: originalData.notes || originalData.specialInstructions || '',
        status: originalData.status || 'received'
      };

      // Log transformation
      logger.debugTransformation('Preview Transformation', originalData, processedOrder);

      res.json({
        success: true,
        debug: {
          message: 'Transformation preview completed',
          original: originalData,
          transformed: processedOrder,
          transformationSummary: {
            fieldsGenerated: [
              !originalData.orderId ? 'orderId' : null,
              !originalData.externalOrderId ? 'externalOrderId' : null,
              !originalData.restaurantId ? 'restaurantId (defaulted)' : null,
              !originalData.orderTime ? 'orderTime' : null
            ].filter(Boolean),
            fieldsProcessed: {
              customer: Object.keys(processedOrder.customer),
              itemsCount: processedOrder.items.length,
              totalsFields: Object.keys(processedOrder.totals),
              paymentFields: Object.keys(processedOrder.payment)
            }
          },
          validationChecks: {
            hasRequiredOrderId: !!processedOrder.orderId,
            hasCustomerName: !!processedOrder.customer.name,
            hasItems: processedOrder.items.length > 0,
            hasValidTotal: processedOrder.totals.total > 0,
            allItemsHaveNames: processedOrder.items.every(item => !!item.name)
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Transformation preview failed:', error);
      res.status(500).json({
        error: 'Transformation preview failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// SQL PARAMETER PREVIEW ENDPOINT - Show what SQL parameters would be generated
router.post('/debug/sql-preview',
  requirePermission('orders:create'),
  async (req, res, next) => {
    try {
      const logger = require('../utils/logger');
      const { v4: uuidv4 } = require('uuid');
      
      // Apply transformation first
      const originalData = req.body;
      const processedOrder = {
        orderId: originalData.orderId || `ORD-${Date.now()}`,
        externalOrderId: originalData.externalOrderId || originalData.orderId || `EXT-${Date.now()}`,
        restaurantId: originalData.restaurantId || 'NYC-DELI-001',
        customer: {
          name: originalData.customer?.name || 'Unknown Customer',
          phone: originalData.customer?.phone || 'N/A',
          email: originalData.customer?.email || null
        },
        orderType: originalData.orderType || 'pickup',
        orderTime: originalData.orderTime || new Date().toISOString(),
        requestedTime: originalData.requestedTime || null,
        items: Array.isArray(originalData.items) ? originalData.items.map(item => ({
          itemId: item.itemId || item.id || null,
          name: item.name || 'Unknown Item',
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: parseFloat(item.totalPrice) || 0,
          specialInstructions: item.specialInstructions || item.notes || null,
          modifiers: Array.isArray(item.modifiers) ? item.modifiers.map(modifier => ({
            name: modifier.name || 'Unknown Modifier',
            price: parseFloat(modifier.price) || 0
          })) : []
        })) : [],
        totals: {
          subtotal: parseFloat(originalData.totals?.subtotal || originalData.subtotal || 0),
          tax: parseFloat(originalData.totals?.tax || originalData.tax || 0),
          tip: parseFloat(originalData.totals?.tip || originalData.tip || 0),
          discount: parseFloat(originalData.totals?.discount || originalData.discount || 0),
          deliveryFee: parseFloat(originalData.totals?.deliveryFee || originalData.deliveryFee || 0),
          total: parseFloat(originalData.totals?.total || originalData.total || 0)
        },
        payment: {
          method: originalData.payment?.method || null,
          status: originalData.payment?.status || 'pending',
          transactionId: originalData.payment?.transactionId || null
        },
        notes: originalData.notes || originalData.specialInstructions || '',
        status: originalData.status || 'received'
      };

      // Generate SQL parameters
      const internalId = uuidv4();
      const idempotencyKey = uuidv4();
      
      const sqlParameters = [
        internalId,
        processedOrder.orderId,
        processedOrder.externalOrderId,
        processedOrder.restaurantId,
        idempotencyKey,
        processedOrder.customer.name,
        processedOrder.customer.phone || 'N/A',
        processedOrder.customer.email,
        processedOrder.orderType,
        processedOrder.orderTime,
        processedOrder.requestedTime,
        processedOrder.totals.subtotal || 0,
        processedOrder.totals.tax || 0,
        processedOrder.totals.tip || 0,
        processedOrder.totals.discount || 0,
        processedOrder.totals.deliveryFee || 0,
        processedOrder.totals.total || 0,
        processedOrder.payment?.method,
        processedOrder.payment?.status || 'pending',
        processedOrder.payment?.transactionId,
        processedOrder.notes || '',
        processedOrder.status || 'received'
      ];

      logger.debug('SQL Preview Generated', { parameterCount: sqlParameters.length });

      res.json({
        success: true,
        debug: {
          message: 'SQL parameter preview completed',
          sqlQuery: `INSERT INTO orders (id, order_id, external_order_id, restaurant_id, idempotency_key, customer_name, customer_phone, customer_email, order_type, order_time, requested_time, subtotal, tax, tip, discount, delivery_fee, total, payment_method, payment_status, payment_transaction_id, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          parameters: sqlParameters.map((param, index) => ({
            index: index + 1,
            value: param,
            type: typeof param,
            isNull: param === null,
            isEmpty: param === '',
            length: typeof param === 'string' ? param.length : null
          })),
          itemQueries: processedOrder.items.map((item, itemIndex) => ({
            itemIndex,
            query: 'INSERT INTO order_items (id, order_id, item_id, name, quantity, unit_price, total_price, special_instructions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
            parameters: [
              `[ITEM_UUID_${itemIndex}]`,
              internalId,
              item.itemId || `ITEM-${itemIndex + 1}`,
              item.name || 'Unknown Item',
              item.quantity || 1,
              item.unitPrice || 0,
              item.totalPrice || 0,
              item.specialInstructions || null
            ],
            modifierQueries: item.modifiers.map((modifier, modIndex) => ({
              modifierIndex: modIndex,
              query: 'INSERT INTO order_item_modifiers (id, order_item_id, name, price, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
              parameters: [
                `[MODIFIER_UUID_${itemIndex}_${modIndex}]`,
                `[ITEM_UUID_${itemIndex}]`,
                modifier.name || 'Unknown Modifier',
                modifier.price || 0
              ]
            }))
          })),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('SQL preview failed:', error);
      res.status(500).json({
        error: 'SQL preview failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Helper methods for webhook debugging
function analyzeNullValues(obj, path = '') {
  let nullCount = 0;
  let nullPaths = [];
  
  function traverse(current, currentPath) {
    if (current === null) {
      nullCount++;
      nullPaths.push(currentPath);
    } else if (current === undefined) {
      nullCount++;
      nullPaths.push(currentPath + ' (undefined)');
    } else if (typeof current === 'object' && current !== null) {
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          traverse(item, `${currentPath}[${index}]`);
        });
      } else {
        Object.keys(current).forEach(key => {
          traverse(current[key], currentPath ? `${currentPath}.${key}` : key);
        });
      }
    }
  }
  
  traverse(obj, path);
  
  return {
    nullCount,
    nullPaths,
    hasNulls: nullCount > 0
  };
}

function findFieldValue(obj, fieldNames) {
  if (!obj || typeof obj !== 'object') {
    return { found: false, value: null, path: null };
  }
  
  for (const fieldName of fieldNames) {
    // Direct property check
    if (obj.hasOwnProperty(fieldName) && obj[fieldName] !== null && obj[fieldName] !== undefined) {
      return { found: true, value: obj[fieldName], path: fieldName };
    }
    
    // Nested property check
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        const nested = findFieldValue(value, [fieldName]);
        if (nested.found) {
          return { found: true, value: nested.value, path: `${key}.${nested.path}` };
        }
      }
    }
  }
  
  return { found: false, value: null, path: null };
}

function generateWebhookRecommendations(analysis, issues) {
  const recommendations = [];
  
  if (issues.includes('No payload received')) {
    recommendations.push('Check webhook configuration in OhMyApp.io platform');
    recommendations.push('Verify webhook URL is correct and accessible');
  }
  
  if (issues.includes('Empty payload object')) {
    recommendations.push('Check if OhMyApp.io is sending data in request body');
    recommendations.push('Verify Content-Type header is application/json');
  }
  
  if (issues.some(issue => issue.includes('null values'))) {
    recommendations.push('Review OhMyApp.io webhook payload structure');
    recommendations.push('Check if all required fields are being populated');
  }
  
  if (!analysis.ohmyAppFieldMapping.orderId.found) {
    recommendations.push('Map order ID field - check for id, order_id, orderNumber, or order_number');
  }
  
  if (!analysis.ohmyAppFieldMapping.customer.found) {
    recommendations.push('Map customer data - check for customer, customerInfo, client, or user object');
  }
  
  if (!analysis.ohmyAppFieldMapping.items.found) {
    recommendations.push('Map items data - check for items, orderItems, products, or line_items array');
  }
  
  return recommendations;
}

function generateFieldMappingSuggestions(payload) {
  if (!payload || typeof payload !== 'object') return {};
  
  const suggestions = {};
  const keys = Object.keys(payload);
  
  // Suggest order ID mapping
  const orderIdCandidates = keys.filter(key => 
    key.toLowerCase().includes('order') || 
    key.toLowerCase().includes('id') ||
    key.toLowerCase() === 'number'
  );
  if (orderIdCandidates.length > 0) {
    suggestions.orderId = orderIdCandidates;
  }
  
  // Suggest customer mapping
  const customerCandidates = keys.filter(key =>
    key.toLowerCase().includes('customer') ||
    key.toLowerCase().includes('client') ||
    key.toLowerCase().includes('user')
  );
  if (customerCandidates.length > 0) {
    suggestions.customer = customerCandidates;
  }
  
  // Suggest items mapping
  const itemsCandidates = keys.filter(key =>
    key.toLowerCase().includes('item') ||
    key.toLowerCase().includes('product') ||
    key.toLowerCase().includes('line')
  );
  if (itemsCandidates.length > 0) {
    suggestions.items = itemsCandidates;
  }
  
  return suggestions;
}

function suggestDataExtractionPath(payload) {
  if (!payload) return null;
  
  // Check if data is nested under common webhook wrapper properties
  if (payload.data) return 'payload.data';
  if (payload.order) return 'payload.order';
  if (payload.event && payload.event.data) return 'payload.event.data';
  if (payload.payload) return 'payload.payload';
  
  return 'payload'; // Direct access
}

function compareStructures(received, expected, path = '') {
  const comparison = {
    missing: [],
    extra: [],
    conflicts: [],
    matches: []
  };
  
  // Check expected fields
  if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
    Object.keys(expected).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (!received || !received.hasOwnProperty(key)) {
        comparison.missing.push({
          path: currentPath,
          expectedType: typeof expected[key] === 'object' ? 'object' : expected[key],
          found: false
        });
      } else {
        const expectedType = typeof expected[key] === 'object' && !Array.isArray(expected[key]) ? 'object' : expected[key];
        const receivedType = typeof received[key];
        
        if (expectedType !== receivedType && expectedType !== 'object') {
          comparison.conflicts.push({
            path: currentPath,
            expected: expectedType,
            received: receivedType,
            value: received[key]
          });
        } else {
          comparison.matches.push({
            path: currentPath,
            type: receivedType
          });
          
          // Recursively check nested objects
          if (typeof expected[key] === 'object' && typeof received[key] === 'object') {
            const nested = compareStructures(received[key], expected[key], currentPath);
            comparison.missing.push(...nested.missing);
            comparison.extra.push(...nested.extra);
            comparison.conflicts.push(...nested.conflicts);
            comparison.matches.push(...nested.matches);
          }
        }
      }
    });
  }
  
  // Check for extra fields in received
  if (received && typeof received === 'object' && received !== null) {
    Object.keys(received).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (!expected || !expected.hasOwnProperty(key)) {
        comparison.extra.push({
          path: currentPath,
          type: typeof received[key],
          value: received[key]
        });
      }
    });
  }
  
  return comparison;
}

function generateMappingSuggestions(comparison) {
  const suggestions = [];
  
  comparison.missing.forEach(missing => {
    // Find potential matches in extra fields
    const potentialMatches = comparison.extra.filter(extra => 
      extra.path.toLowerCase().includes(missing.path.toLowerCase()) ||
      missing.path.toLowerCase().includes(extra.path.toLowerCase())
    );
    
    if (potentialMatches.length > 0) {
      suggestions.push({
        missingField: missing.path,
        suggestedMapping: potentialMatches[0].path,
        confidence: 'medium'
      });
    }
  });
  
  return suggestions;
}

module.exports = router;
