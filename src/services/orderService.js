const database = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
class OrderService {
  async createOrder(orderData, idempotencyKey) {
    try {
      const existingOrder = await database.query(
        'SELECT id, order_id, status FROM orders WHERE idempotency_key = ?',
        [idempotencyKey]
      );
      if (existingOrder.rows.length > 0) {
        logger.info(`Idempotent request - returning existing order ${existingOrder.rows[0].order_id}`);
        return await this.getOrderById(existingOrder.rows[0].order_id);
      }
      const internalId = uuidv4();
      const orderResult = await database.query(`
        INSERT INTO orders (
          id, order_id, external_order_id, restaurant_id, idempotency_key,
          customer_name, customer_phone, customer_email,
          order_type, order_time, requested_time,
          subtotal, tax, tip, discount, delivery_fee, total,
          payment_method, payment_status, payment_transaction_id,
          notes, status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        internalId,
        orderData.orderId,
        orderData.externalOrderId,
        orderData.restaurantId,
        idempotencyKey,
        orderData.customer.name,
        orderData.customer.phone,
        orderData.customer.email || null,
        orderData.orderType,
        orderData.orderTime,
        orderData.requestedTime || null,
        orderData.totals.subtotal,
        orderData.totals.tax,
        orderData.totals.tip || 0,
        orderData.totals.discount || 0,
        orderData.totals.deliveryFee || 0,
        orderData.totals.total,
        orderData.payment?.method || null,
        orderData.payment?.status || 'pending',
        orderData.payment?.transactionId || null,
        orderData.notes || null,
        'received'
      ]);
      const insertedOrderResult = await database.query(
        'SELECT id FROM orders WHERE order_id = ?',
        [orderData.orderId]
      );
      if (insertedOrderResult.rows.length === 0) {
        throw new Error('Failed to retrieve created order');
      }
      const order = insertedOrderResult.rows[0];
      logger.info(`Order record created with internal ID: ${order.id}`);
      for (let i = 0; i < orderData.items.length; i++) {
        const item = orderData.items[i];
        const itemResult = await database.run(`
          INSERT INTO order_items (
            id, order_id, item_id, name, quantity, unit_price, total_price, special_instructions, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          uuidv4(),
          order.id,
          item.itemId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.totalPrice,
          item.specialInstructions || null
        ]);
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modifier of item.modifiers) {
            await database.run(`
              INSERT INTO order_item_modifiers (
                id, order_item_id, name, price, created_at
              ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
              uuidv4(),
              itemResult.lastID,
              modifier.name,
              modifier.price
            ]);
          }
        }
      }
      logger.info(`Order created successfully: ${orderData.orderId}`);
      return await this.getOrderById(orderData.orderId);
    } catch (error) {
      logger.error('Failed to create order:', error);
      throw error;
    }
  }
  async getOrderById(orderId) {
    try {
      const orderResult = await database.query(`
        SELECT * FROM orders WHERE order_id = ?
      `, [orderId]);
      if (orderResult.rows.length === 0) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
      }
      const order = orderResult.rows[0];
      const itemsResult = await database.query(`
        SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at
      `, [order.id]);
      const itemsWithModifiers = await Promise.all(itemsResult.rows.map(async (item) => {
        const modifiersResult = await database.query(`
          SELECT name, price FROM order_item_modifiers WHERE order_item_id = ?
        `, [item.id]);
        return {
          itemId: item.item_id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price),
          totalPrice: parseFloat(item.total_price),
          modifiers: modifiersResult.rows.map(mod => ({
            name: mod.name,
            price: parseFloat(mod.price)
          })),
          specialInstructions: item.special_instructions
        };
      }));
      return {
        orderId: order.order_id,
        externalOrderId: order.external_order_id,
        restaurantId: order.restaurant_id,
        customer: {
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email
        },
        orderType: order.order_type,
        orderTime: order.order_time,
        requestedTime: order.requested_time,
        items: itemsWithModifiers,
        totals: {
          subtotal: parseFloat(order.subtotal),
          tax: parseFloat(order.tax),
          tip: parseFloat(order.tip),
          discount: parseFloat(order.discount),
          deliveryFee: parseFloat(order.delivery_fee),
          total: parseFloat(order.total)
        },
        payment: {
          method: order.payment_method,
          status: order.payment_status,
          transactionId: order.payment_transaction_id
        },
        notes: order.notes,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      };
    } catch (error) {
      logger.error(`Failed to get order ${orderId}:`, error);
      throw error;
    }
  }
  async updateOrderStatus(orderId, status, estimatedTime = null, notes = null) {
    try {
      const result = await database.run(`
        UPDATE orders
        SET status = ?, estimated_time = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `, [status, estimatedTime, notes, orderId]);
      if (result.changes === 0) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
      }
      logger.info(`Order ${orderId} status updated to ${status}`);
      await this.notifyStatusChange(orderId, status);
      return { orderId, status, estimatedTime };
    } catch (error) {
      logger.error(`Failed to update order status ${orderId}:`, error);
      throw error;
    }
  }
  async cancelOrder(orderId, reason, notes = null) {
    try {
      const result = await database.run(`
        UPDATE orders
        SET status = 'cancelled', cancellation_reason = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ? AND status NOT IN ('completed', 'cancelled')
      `, [reason, notes, orderId]);
      if (result.changes === 0) {
        const error = new Error('Order not found or cannot be cancelled');
        error.name = 'ConflictError';
        throw error;
      }
      logger.info(`Order ${orderId} cancelled - reason: ${reason}`);
      await this.notifyStatusChange(orderId, 'cancelled');
      return { orderId, status: 'cancelled', reason };
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }
  async getAllOrders(options = {}) {
    try {
      const { limit = 10, offset = 0, status, restaurantId } = options;
      let whereClause = '';
      let params = [];
      if (status || restaurantId) {
        const conditions = [];
        if (status) {
          conditions.push('status = ?');
          params.push(status);
        }
        if (restaurantId) {
          conditions.push('restaurant_id = ?');
          params.push(restaurantId);
        }
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
      const countResult = await database.query(`
        SELECT COUNT(*) as total FROM orders ${whereClause}
      `, params);
      const total = countResult.rows[0].total;
      const ordersResult = await database.query(`
        SELECT
          order_id, external_order_id, restaurant_id,
          customer_name, customer_phone, customer_email,
          order_type, order_time, status, total,
          created_at, updated_at
        FROM orders
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
      const orders = ordersResult.rows.map(order => ({
        orderId: order.order_id,
        externalOrderId: order.external_order_id,
        restaurantId: order.restaurant_id,
        customer: {
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email
        },
        orderType: order.order_type,
        orderTime: order.order_time,
        status: order.status,
        total: parseFloat(order.total),
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }));
      return {
        orders,
        total: parseInt(total)
      };
    } catch (error) {
      logger.error('Failed to get all orders:', error);
      throw error;
    }
  }
  async getOrderStatus(orderId) {
    try {
      const result = await database.query(`
        SELECT order_id, status, estimated_time, updated_at
        FROM orders
        WHERE order_id = ?
      `, [orderId]);
      if (result.rows.length === 0) {
        const error = new Error('Order not found');
        error.name = 'NotFoundError';
        throw error;
      }
      return {
        orderId: result.rows[0].order_id,
        status: result.rows[0].status,
        estimatedTime: result.rows[0].estimated_time,
        lastUpdated: result.rows[0].updated_at
      };
    } catch (error) {
      logger.error(`Failed to get order status ${orderId}:`, error);
      throw error;
    }
  }
  async notifyStatusChange(orderId, status) {
    try {
      logger.info(`Status change notification: ${orderId} -> ${status}`);
      const webhookUrl = process.env.SYNC_AGENT_WEBHOOK_URL;
      if (webhookUrl) {
        await axios.post(webhookUrl, {
          orderId,
          status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Failed to notify status change for ${orderId}:`, error);
    }
  }
}
module.exports = new OrderService();
