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
      // ENHANCED VALIDATION - Accept complete webhook data with enhanced fields
      const orderData = req.body;
      
      // Generate idempotency key if not provided
      let idempotencyKey = req.headers['x-idempotency-key'];
      if (!idempotencyKey) {
        const { v4: uuidv4 } = require('uuid');
        idempotencyKey = uuidv4();
      }
      
      // Process enhanced order data with comprehensive field mapping
      const processedOrder = {
        orderId: orderData.orderId || `ORD-${Date.now()}`,
        externalOrderId: orderData.externalOrderId || orderData.orderId || `EXT-${Date.now()}`,
        restaurantId: orderData.restaurantId || 'NYC-DELI-001',
        
        // Enhanced customer information
        customer: {
          name: orderData.customer?.name || 'Unknown Customer',
          phone: orderData.customer?.phone || 'N/A',
          email: orderData.customer?.email || null
        },
        
        // Enhanced order details
        orderType: orderData.orderType || 'pickup',
        orderTime: orderData.orderTime || new Date().toISOString(),
        requestedTime: orderData.requestedTime || null,
        
        // Enhanced item processing
        items: this.processOrderItems(orderData.items || []),
        
        // Enhanced totals with all fields
        totals: {
          subtotal: parseFloat(orderData.totals?.subtotal || orderData.subtotal || 0),
          tax: parseFloat(orderData.totals?.tax || orderData.tax || 0),
          tip: parseFloat(orderData.totals?.tip || orderData.tip || 0),
          discount: parseFloat(orderData.totals?.discount || orderData.discount || 0),
          deliveryFee: parseFloat(orderData.totals?.deliveryFee || orderData.deliveryFee || 0),
          total: parseFloat(orderData.totals?.total || orderData.total || 0)
        },
        
        // Enhanced payment information
        payment: {
          method: orderData.payment?.method || null,
          status: orderData.payment?.status || 'pending',
          transactionId: orderData.payment?.transactionId || null
        },
        
        // Enhanced notes and status
        notes: orderData.notes || orderData.specialInstructions || '',
        status: orderData.status || 'received'
      };
      
      logger.info(`Creating enhanced order ${processedOrder.orderId}`, {
        client: req.apiKey?.name || 'webhook',
        orderId: processedOrder.orderId,
        externalOrderId: processedOrder.externalOrderId,
        restaurantId: processedOrder.restaurantId,
        customerEmail: processedOrder.customer.email,
        orderType: processedOrder.orderType,
        requestedTime: processedOrder.requestedTime,
        itemCount: processedOrder.items.length,
        total: processedOrder.totals.total,
        paymentStatus: processedOrder.payment.status
      });
      
      const order = await orderService.createOrder(processedOrder, idempotencyKey);
      res.status(201).json({
        success: true,
        data: order,
        message: 'Enhanced order created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Order creation failed in controller:', {
        error: error.message,
        stack: error.stack,
        orderData: processedOrder
      });
      next(error);
    }
  }

  // Helper method to process order items with enhanced data
  processOrderItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }
    
    return items.map(item => ({
      itemId: item.itemId || item.id || null,
      name: item.name || 'Unknown Item',
      quantity: parseInt(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      totalPrice: parseFloat(item.totalPrice) || 0,
      specialInstructions: item.specialInstructions || item.notes || null,
      modifiers: this.processItemModifiers(item.modifiers || [])
    }));
  }

  // Helper method to process item modifiers
  processItemModifiers(modifiers) {
    if (!Array.isArray(modifiers)) {
      return [];
    }
    
    return modifiers.map(modifier => ({
      name: modifier.name || 'Unknown Modifier',
      price: parseFloat(modifier.price) || 0
    }));
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

  async deleteAllOrders(req, res, next) {
    try {
      logger.warn('Delete all orders requested', {
        client: req.apiKey?.name || 'unknown',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      const result = await orderService.deleteAllOrders();
      
      logger.warn(`All orders deleted successfully - ${result.deletedCount} orders removed`, {
        client: req.apiKey?.name || 'unknown',
        deletedCount: result.deletedCount
      });
      
      res.json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          message: result.message
        },
        message: 'All orders deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new OrderController();
