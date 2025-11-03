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

module.exports = router;
