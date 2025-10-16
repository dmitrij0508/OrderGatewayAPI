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
module.exports = router;
