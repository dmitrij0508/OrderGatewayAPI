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
      const idempotencyKey = req.headers['x-idempotency-key'];
      if (!idempotencyKey) {
        return res.status(400).json({
          error: 'Idempotency key required',
          message: 'X-Idempotency-Key header must be provided',
          timestamp: new Date().toISOString()
        });
      }
      const { error: idempotencyError } = idempotencyKeySchema.validate(idempotencyKey);
      if (idempotencyError) {
        return res.status(400).json({
          error: 'Invalid idempotency key',
          message: idempotencyError.details[0].message,
          timestamp: new Date().toISOString()
        });
      }
      const { error, value } = createOrderSchema.validate(req.body);
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
      logger.info(`Creating order ${value.orderId}`, {
        client: req.apiKey.name,
        orderId: value.orderId,
        externalOrderId: value.externalOrderId,
        restaurantId: value.restaurantId,
        orderType: value.orderType,
        itemCount: value.items.length,
        total: value.totals.total
      });
      const order = await orderService.createOrder(value, idempotencyKey);
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
