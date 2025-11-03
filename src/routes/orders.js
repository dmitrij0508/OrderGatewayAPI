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

module.exports = router;
