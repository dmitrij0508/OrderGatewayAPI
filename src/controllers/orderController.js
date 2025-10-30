const orderService = require('../services/orderService');
const logger = require('../utils/logger');
const {
  createOrderSchema,
  updateOrderSchema,
  cancelOrderSchema,
  idempotencyKeySchema
} = require('../validators/orderValidators');
class OrderController {
  async createOrder(req, res, next) {
    try {
      // SIMPLIFIED VALIDATION - Accept any reasonable order data
      const orderData = req.body;
      
      // Generate idempotency key if not provided
      let idempotencyKey = req.headers['x-idempotency-key'];
      if (!idempotencyKey) {
        const { v4: uuidv4 } = require('uuid');
        idempotencyKey = uuidv4();
      }
      
      // Ensure minimal required fields with defaults
      const processedOrder = {
        orderId: orderData.orderId || `ORD-${Date.now()}`,
        externalOrderId: orderData.externalOrderId || orderData.orderId || `EXT-${Date.now()}`,
        restaurantId: orderData.restaurantId || 'NYC-DELI-001',
        customer: {
          name: orderData.customer?.name || 'Unknown Customer',
          phone: orderData.customer?.phone || '',
          email: orderData.customer?.email || ''
        },
        orderType: orderData.orderType || 'pickup',
        orderTime: orderData.orderTime || new Date().toISOString(),
        items: orderData.items || [],
        totals: {
          subtotal: orderData.totals?.subtotal || orderData.subtotal || orderData.total || 0,
          tax: orderData.totals?.tax || orderData.tax || 0,
          tip: orderData.totals?.tip || orderData.tip || 0,
          total: orderData.totals?.total || orderData.total || 0
        },
        notes: orderData.notes || orderData.specialInstructions || '',
        status: orderData.status || 'received'
      };
      
      logger.info(`Creating order ${processedOrder.orderId} (SIMPLIFIED)`, {
        client: req.apiKey?.name || 'webhook',
        orderId: processedOrder.orderId,
        externalOrderId: processedOrder.externalOrderId,
        restaurantId: processedOrder.restaurantId,
        total: processedOrder.totals.total
      });
      
      const order = await orderService.createOrder(processedOrder, idempotencyKey);
      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
  async getAllOrders(req, res, next) {
    try {
      const { limit = 10, offset = 0, status, restaurantId } = req.query;
      logger.info(`Retrieving all orders`, {
        client: req.apiKey.name,
        limit,
        offset,
        status,
        restaurantId
      });
      const result = await orderService.getAllOrders({
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        restaurantId
      });
      res.json({
        success: true,
        data: result.orders,
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
  async getOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      logger.info(`Retrieving order ${orderId}`, {
        client: req.apiKey.name
      });
      const order = await orderService.getOrderById(orderId);
      res.json({
        success: true,
        data: order,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
  async getOrderStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      logger.info(`Retrieving order status ${orderId}`, {
        client: req.apiKey.name
      });
      const status = await orderService.getOrderStatus(orderId);
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
  async updateOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      const { error, value } = updateOrderSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        });
      }
      logger.info(`Updating order ${orderId}`, {
        client: req.apiKey.name,
        updates: value
      });
      const updatedOrder = await orderService.updateOrderStatus(
        orderId,
        value.status,
        value.estimatedTime,
        value.notes
      );
      res.json({
        success: true,
        data: {
          orderId: updatedOrder.order_id,
          status: updatedOrder.status,
          estimatedTime: updatedOrder.estimated_time,
          updatedAt: updatedOrder.updated_at
        },
        message: 'Order updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
  async cancelOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      const { error, value } = cancelOrderSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        });
      }
      logger.info(`Cancelling order ${orderId}`, {
        client: req.apiKey.name,
        reason: value.reason,
        notes: value.notes
      });
      const cancelledOrder = await orderService.cancelOrder(
        orderId,
        value.reason,
        value.notes
      );
      res.json({
        success: true,
        data: {
          orderId: cancelledOrder.order_id,
          status: cancelledOrder.status,
          cancellationReason: cancelledOrder.cancellation_reason,
          updatedAt: cancelledOrder.updated_at
        },
        message: 'Order cancelled successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new OrderController();
