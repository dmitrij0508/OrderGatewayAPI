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
    const debugStartTime = Date.now();
    const debugSteps = [];
    
    try {
      // STEP 1: Debug incoming request
      logger.debugRequest(req, 'Order Creation Request');
      debugSteps.push({
        description: 'Incoming request logged',
        status: 'completed',
        data: { method: req.method, url: req.url, bodySize: JSON.stringify(req.body).length },
        duration: Date.now() - debugStartTime
      });

      // STEP 2: Extract and debug raw order data
      const orderData = req.body;
      logger.debugPayload('Raw Order Data', orderData);
      debugSteps.push({
        description: 'Raw order data extracted',
        status: 'completed',
        data: { hasData: !!orderData, dataType: typeof orderData, keys: Object.keys(orderData || {}) },
        duration: Date.now() - debugStartTime
      });
      
      // STEP 3: Generate idempotency key with debugging
      let idempotencyKey = req.headers['x-idempotency-key'];
      if (!idempotencyKey) {
        const { v4: uuidv4 } = require('uuid');
        idempotencyKey = uuidv4();
        logger.debug('🔑 Generated new idempotency key', { idempotencyKey });
      } else {
        logger.debug('🔑 Using provided idempotency key', { idempotencyKey });
      }
      debugSteps.push({
        description: 'Idempotency key processed',
        status: 'completed',
        data: { hasKey: !!req.headers['x-idempotency-key'], generated: !req.headers['x-idempotency-key'] },
        duration: Date.now() - debugStartTime
      });
      
      // STEP 4: Log detailed order data analysis before processing
      logger.debug('📊 ORDER ANALYSIS - Pre-processing', {
        hasOrderId: !!(orderData.orderId || orderData.id),
        hasCustomer: !!orderData.customer,
        hasItems: !!(orderData.items && Array.isArray(orderData.items)),
        itemCount: orderData.items ? orderData.items.length : 0,
        hasTotals: !!(orderData.totals || orderData.total),
        hasPayment: !!orderData.payment,
        originalFields: Object.keys(orderData || {})
      });

      // Process enhanced order data with comprehensive field mapping
      logger.info('Processing order data:', { orderData });
      
      // STEP 5: Process order data with detailed field mapping debugging
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
        
        // Enhanced item processing - inline for better compatibility
        items: Array.isArray(orderData.items) ? orderData.items.map(item => ({
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

      // STEP 6: Debug transformation results
      logger.debugTransformation('Order Data Processing', orderData, processedOrder, {
        fieldsGenerated: ['orderId', 'externalOrderId'].filter(field => !orderData[field]),
        customerFieldsMapped: Object.keys(processedOrder.customer),
        itemsProcessed: processedOrder.items.length,
        totalsCalculated: Object.keys(processedOrder.totals),
        paymentFieldsMapped: Object.keys(processedOrder.payment)
      });
      debugSteps.push({
        description: 'Order data transformation completed',
        status: 'completed',
        data: { 
          itemsProcessed: processedOrder.items.length,
          totalAmount: processedOrder.totals.total,
          hasCustomer: !!processedOrder.customer.name
        },
        duration: Date.now() - debugStartTime
      });
      
      logger.info('Processed order ready for service:', { processedOrder });

      // STEP 7: Log detailed analysis of processed order
      logger.debug('📋 PROCESSED ORDER ANALYSIS', {
        structure: {
          orderId: processedOrder.orderId,
          hasExternalId: !!processedOrder.externalOrderId,
          restaurantId: processedOrder.restaurantId,
          customerComplete: !!(processedOrder.customer.name && processedOrder.customer.phone),
          orderType: processedOrder.orderType,
          itemCount: processedOrder.items.length,
          totalAmount: processedOrder.totals.total,
          paymentStatus: processedOrder.payment.status,
          hasNotes: !!processedOrder.notes
        },
        itemDetails: processedOrder.items.map((item, index) => ({
          index,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          hasModifiers: item.modifiers.length > 0,
          modifierCount: item.modifiers.length
        })),
        financials: {
          subtotal: processedOrder.totals.subtotal,
          tax: processedOrder.totals.tax,
          tip: processedOrder.totals.tip,
          total: processedOrder.totals.total,
          calculatedTotal: processedOrder.totals.subtotal + processedOrder.totals.tax + processedOrder.totals.tip
        }
      });
      
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

      // STEP 8: Call service with debugging
      debugSteps.push({
        description: 'Calling order service',
        status: 'in-progress',
        data: { orderId: processedOrder.orderId, idempotencyKey },
        duration: Date.now() - debugStartTime
      });
      
      const order = await orderService.createOrder(processedOrder, idempotencyKey);
      
      debugSteps.push({
        description: 'Order service completed successfully',
        status: 'completed',
        data: { createdOrderId: order.orderId, serviceResponse: !!order },
        duration: Date.now() - debugStartTime
      });

      // STEP 9: Log final success and debug summary
      const totalDuration = Date.now() - debugStartTime;
      logger.debugSteps('Order Creation Process', debugSteps);
      
      logger.debug('🎉 ORDER CREATION SUCCESS', {
        orderId: order.orderId,
        totalProcessingTime: totalDuration + 'ms',
        stepsCompleted: debugSteps.length,
        client: req.apiKey?.name || 'webhook',
        finalOrderStructure: {
          hasItems: order.items && order.items.length > 0,
          itemCount: order.items ? order.items.length : 0,
          totalAmount: order.totals ? order.totals.total : null,
          status: order.status
        }
      });
      
      res.status(201).json({
        success: true,
        data: order,
        message: 'Enhanced order created successfully',
        debug: process.env.NODE_ENV !== 'production' ? {
          processingTime: totalDuration + 'ms',
          stepsCompleted: debugSteps.length,
          transformationApplied: true
        } : undefined,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Enhanced error debugging
      const totalDuration = Date.now() - debugStartTime;
      debugSteps.push({
        description: 'Error occurred',
        status: 'failed',
        error: error.message,
        duration: totalDuration
      });

      logger.debugSteps('Order Creation Process (FAILED)', debugSteps);
      
      logger.error('❌ ORDER CREATION FAILED - Detailed Debug', {
        error: error.message,
        stack: error.stack,
        processingTime: totalDuration + 'ms',
        failedAtStep: debugSteps.length,
        requestAnalysis: {
          hasBody: !!req.body,
          bodyKeys: req.body ? Object.keys(req.body) : null,
          method: req.method,
          url: req.url,
          contentType: req.get('Content-Type'),
          userAgent: req.get('User-Agent')
        },
        processedOrderSnapshot: debugSteps.find(s => s.description.includes('transformation')) ? 
          'Transformation completed' : 'Transformation not reached'
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
      modifiers: (item.modifiers || []).map(modifier => ({
        name: modifier.name || 'Unknown Modifier',
        price: parseFloat(modifier.price) || 0
      }))
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

  async clearOrdersByRestaurant(req, res, next) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId) {
        return res.status(400).json({
          error: 'Restaurant ID is required',
          message: 'Please provide restaurantId as a query parameter',
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Clear orders by restaurant requested', {
        client: req.apiKey?.name || 'unknown',
        restaurantId: restaurantId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      const result = await orderService.clearOrdersByRestaurant(restaurantId);
      
      logger.info(`Orders cleared for restaurant ${restaurantId} - ${result.deletedCount} orders removed`, {
        client: req.apiKey?.name || 'unknown',
        restaurantId: restaurantId,
        deletedCount: result.deletedCount
      });
      
      res.json({
        success: true,
        data: {
          restaurantId: restaurantId,
          deletedCount: result.deletedCount,
          message: result.message
        },
        message: `Orders cleared for restaurant ${restaurantId}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new OrderController();
