const database = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
class OrderService {
  async createOrder(orderData, idempotencyKey) {
    const serviceStartTime = Date.now();
    const serviceSteps = [];
    
    try {
      // SERVICE STEP 1: Debug incoming service call
      logger.debugPayload('Service - Incoming Order Data', orderData);
      logger.debug('🔧 SERVICE DEBUG - Create Order Called', {
        orderId: orderData.orderId,
        idempotencyKey,
        hasCustomer: !!orderData.customer,
        itemCount: orderData.items ? orderData.items.length : 0,
        totalAmount: orderData.totals ? orderData.totals.total : null
      });
      serviceSteps.push({
        description: 'Service method called with order data',
        status: 'completed',
        data: { orderId: orderData.orderId, hasIdempotencyKey: !!idempotencyKey },
        duration: Date.now() - serviceStartTime
      });

      // SERVICE STEP 2: Check for existing order by idempotency key
      const idempotencyQuery = 'SELECT id, order_id, status FROM orders WHERE idempotency_key = ?';
      logger.debugDatabase('Idempotency Check', idempotencyQuery, [idempotencyKey]);
      
      const existingOrder = await database.query(idempotencyQuery, [idempotencyKey]);
      
      logger.debugDatabase('Idempotency Check Result', idempotencyQuery, [idempotencyKey], existingOrder);
      serviceSteps.push({
        description: 'Idempotency check completed',
        status: 'completed',
        data: { existingOrderFound: existingOrder.rows.length > 0 },
        duration: Date.now() - serviceStartTime
      });
      
      if (existingOrder.rows.length > 0) {
        logger.debug('🔄 IDEMPOTENT REQUEST DETECTED', {
          existingOrderId: existingOrder.rows[0].order_id,
          existingStatus: existingOrder.rows[0].status,
          idempotencyKey
        });
        logger.info(`Idempotent request - returning existing order ${existingOrder.rows[0].order_id}`);
        return await this.getOrderById(existingOrder.rows[0].order_id);
      }

      // SERVICE STEP 3: Generate internal ID and prepare data
      const internalId = uuidv4();
      logger.debug('🆔 Generated internal ID', { internalId, publicOrderId: orderData.orderId });
      serviceSteps.push({
        description: 'Internal ID generated',
        status: 'completed',
        data: { internalId },
        duration: Date.now() - serviceStartTime
      });
      
      // Log what we're about to insert
      logger.info('Creating order with data:', {
        internalId,
        orderId: orderData.orderId,
        externalOrderId: orderData.externalOrderId,
        customer: orderData.customer,
        orderType: orderData.orderType,
        totals: orderData.totals
      });

      // SERVICE STEP 4: Prepare and log SQL parameters
      const orderInsertParams = [
        internalId,
        orderData.orderId,
        orderData.externalOrderId,
        orderData.restaurantId,
        idempotencyKey,
        orderData.customer.name,
        orderData.customer.phone || 'N/A',
        orderData.customer.email,
        orderData.orderType,
        orderData.orderTime,
        orderData.requestedTime,
        orderData.totals.subtotal || 0,
        orderData.totals.tax || 0,
        orderData.totals.tip || 0,
        orderData.totals.discount || 0,
        orderData.totals.deliveryFee || 0,
        orderData.totals.total || 0,
        orderData.payment?.method,
        orderData.payment?.status || 'pending',
        orderData.payment?.transactionId,
        orderData.notes || '',
        orderData.status || 'received'
      ];

      logger.debug('💾 SQL PARAMETERS PREPARED', {
        parameterCount: orderInsertParams.length,
        parameters: orderInsertParams.map((param, index) => ({
          index,
          type: typeof param,
          value: typeof param === 'string' && param.length > 50 ? param.substring(0, 50) + '...' : param,
          isNull: param === null,
          isEmpty: param === ''
        }))
      });

      // SERVICE STEP 5: Insert main order record with detailed logging
      const orderInsertQuery = `
        INSERT INTO orders (
          id, order_id, external_order_id, restaurant_id, idempotency_key,
          customer_name, customer_phone, customer_email,
          order_type, order_time, requested_time,
          subtotal, tax, tip, discount, delivery_fee, total,
          payment_method, payment_status, payment_transaction_id,
          notes, status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 
          ?, ?, ?, 
          ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, 
          ?, ?, datetime('now'), datetime('now')
        )
      `;

      logger.debugDatabase('Main Order Insert', orderInsertQuery, orderInsertParams);
      
      const orderResult = await database.run(orderInsertQuery, orderInsertParams);
      
      logger.debugDatabase('Main Order Insert Result', orderInsertQuery, orderInsertParams, orderResult);
      logger.debug('✅ ORDER RECORD INSERTED', {
        internalId,
        orderId: orderData.orderId,
        changes: orderResult.changes,
        lastID: orderResult.lastID
      });
      serviceSteps.push({
        description: 'Main order record inserted',
        status: 'completed',
        data: { changes: orderResult.changes, lastID: orderResult.lastID },
        duration: Date.now() - serviceStartTime
      });

      logger.info(`Order main record inserted successfully`);

      // SERVICE STEP 6: Process items if any
      if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
        logger.debug('🛒 PROCESSING ORDER ITEMS', {
          itemCount: orderData.items.length,
          items: orderData.items.map((item, index) => ({
            index,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            hasModifiers: item.modifiers && item.modifiers.length > 0,
            modifierCount: item.modifiers ? item.modifiers.length : 0
          }))
        });

        for (let i = 0; i < orderData.items.length; i++) {
          const item = orderData.items[i];
          const itemId = uuidv4();
          
          const itemInsertQuery = `
            INSERT INTO order_items (
              id, order_id, item_id, name, quantity, unit_price, total_price, special_instructions, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `;

          const itemParams = [
            itemId,
            internalId, // Use the main order internal ID
            item.itemId || `ITEM-${i + 1}`,
            item.name || 'Unknown Item',
            item.quantity || 1,
            item.unitPrice || 0,
            item.totalPrice || 0,
            item.specialInstructions || null
          ];

          logger.debugDatabase(`Item ${i + 1} Insert`, itemInsertQuery, itemParams);
          const itemResult = await database.run(itemInsertQuery, itemParams);
          logger.debugDatabase(`Item ${i + 1} Insert Result`, itemInsertQuery, itemParams, itemResult);
          
          // Process modifiers if any
          if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
            logger.debug(`🏷️ Processing ${item.modifiers.length} modifiers for item ${item.name}`);
            
            for (let j = 0; j < item.modifiers.length; j++) {
              const modifier = item.modifiers[j];
              const modifierInsertQuery = `
                INSERT INTO order_item_modifiers (
                  id, order_item_id, name, price, created_at
                ) VALUES (?, ?, ?, ?, datetime('now'))
              `;

              const modifierParams = [
                uuidv4(),
                itemId,
                modifier.name || 'Unknown Modifier',
                modifier.price || 0
              ];

              logger.debugDatabase(`Item ${i + 1} Modifier ${j + 1} Insert`, modifierInsertQuery, modifierParams);
              const modifierResult = await database.run(modifierInsertQuery, modifierParams);
              logger.debugDatabase(`Item ${i + 1} Modifier ${j + 1} Result`, modifierInsertQuery, modifierParams, modifierResult);
            }
          }
        }
        
        serviceSteps.push({
          description: 'Order items processed',
          status: 'completed',
          data: { itemsInserted: orderData.items.length },
          duration: Date.now() - serviceStartTime
        });
        
        logger.info(`Inserted ${orderData.items.length} items for order ${orderData.orderId}`);
      } else {
        logger.debug('⚠️ NO ITEMS TO PROCESS', {
          hasItems: !!orderData.items,
          isArray: Array.isArray(orderData.items),
          itemCount: orderData.items ? orderData.items.length : 0
        });
        serviceSteps.push({
          description: 'No items to process',
          status: 'completed',
          data: { itemsInserted: 0 },
          duration: Date.now() - serviceStartTime
        });
      }

      // SERVICE STEP 7: Retrieve and return created order
      const totalServiceDuration = Date.now() - serviceStartTime;
      serviceSteps.push({
        description: 'Retrieving created order',
        status: 'in-progress',
        data: { orderId: orderData.orderId },
        duration: totalServiceDuration
      });

      logger.info(`Order created successfully: ${orderData.orderId}`);
      
      const createdOrder = await this.getOrderById(orderData.orderId);
      
      serviceSteps.push({
        description: 'Order retrieval completed',
        status: 'completed',
        data: { hasOrder: !!createdOrder, orderItemCount: createdOrder.items ? createdOrder.items.length : 0 },
        duration: Date.now() - serviceStartTime
      });

      // Final service debug summary
      logger.debugSteps('Order Service Process', serviceSteps);
      logger.debug('🎯 SERVICE COMPLETION SUCCESS', {
        orderId: orderData.orderId,
        totalServiceTime: (Date.now() - serviceStartTime) + 'ms',
        stepsCompleted: serviceSteps.length,
        finalOrder: {
          id: createdOrder.orderId,
          itemCount: createdOrder.items ? createdOrder.items.length : 0,
          totalAmount: createdOrder.totals ? createdOrder.totals.total : null,
          status: createdOrder.status
        }
      });
      
      return createdOrder;
      
    } catch (error) {
      const totalServiceDuration = Date.now() - serviceStartTime;
      serviceSteps.push({
        description: 'Service error occurred',
        status: 'failed',
        error: error.message,
        duration: totalServiceDuration
      });

      logger.debugSteps('Order Service Process (FAILED)', serviceSteps);
      
      logger.error('❌ SERVICE CREATION FAILED - Detailed Debug', {
        error: error.message,
        stack: error.stack,
        sqliteError: error.code,
        serviceProcessingTime: totalServiceDuration + 'ms',
        failedAtStep: serviceSteps.length,
        orderDataSnapshot: {
          orderId: orderData?.orderId,
          externalOrderId: orderData?.externalOrderId,
          hasCustomer: !!(orderData?.customer),
          hasItems: !!(orderData?.items && Array.isArray(orderData.items)),
          itemCount: orderData?.items ? orderData.items.length : 0,
          hasTotals: !!(orderData?.totals),
          totalAmount: orderData?.totals?.total
        },
        databaseState: {
          lastQuery: 'Check logs for last executed query',
          errorCode: error.code,
          errorErrno: error.errno
        }
      });
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
        SET status = ?, estimated_time = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
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
        SET status = 'cancelled', cancellation_reason = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
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
          order_type, order_time, requested_time, status, 
          subtotal, tax, tip, discount, delivery_fee, total,
          payment_method, payment_status, payment_transaction_id,
          notes, created_at, updated_at
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
        requestedTime: order.requested_time,
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
  async deleteAllOrders() {
    try {
      // First, delete all order item modifiers
      await database.run('DELETE FROM order_item_modifiers');
      logger.info('Deleted all order item modifiers');
      
      // Then, delete all order items
      await database.run('DELETE FROM order_items');
      logger.info('Deleted all order items');
      
      // Finally, delete all orders
      const result = await database.run('DELETE FROM orders');
      const deletedCount = result.changes;
      
      logger.info(`Successfully deleted all orders - ${deletedCount} orders removed`);
      
      return {
        deletedCount,
        message: `Successfully deleted ${deletedCount} orders and all related data`
      };
    } catch (error) {
      logger.error('Failed to delete all orders:', error);
      throw error;
    }
  }

  async clearOrdersByRestaurant(restaurantId) {
    try {
      // First, get the list of orders for this restaurant to delete their items/modifiers
      const ordersResult = await database.query(`
        SELECT id FROM orders WHERE restaurant_id = ?
      `, [restaurantId]);
      
      const orderIds = ordersResult.rows.map(row => row.id);
      
      if (orderIds.length === 0) {
        logger.info(`No orders found for restaurant ${restaurantId}`);
        return {
          deletedCount: 0,
          message: `No orders found for restaurant ${restaurantId}`
        };
      }
      
      // Delete order item modifiers for this restaurant's orders
      for (const orderId of orderIds) {
        await database.run(`
          DELETE FROM order_item_modifiers 
          WHERE order_item_id IN (
            SELECT id FROM order_items WHERE order_id = ?
          )
        `, [orderId]);
      }
      logger.info(`Deleted order item modifiers for restaurant ${restaurantId}`);
      
      // Delete order items for this restaurant's orders
      await database.run(`
        DELETE FROM order_items 
        WHERE order_id IN (
          SELECT id FROM orders WHERE restaurant_id = ?
        )
      `, [restaurantId]);
      logger.info(`Deleted order items for restaurant ${restaurantId}`);
      
      // Finally, delete the orders for this restaurant
      const result = await database.run('DELETE FROM orders WHERE restaurant_id = ?', [restaurantId]);
      const deletedCount = result.changes;
      
      logger.info(`Successfully cleared orders for restaurant ${restaurantId} - ${deletedCount} orders removed`);
      
      return {
        deletedCount,
        message: `Successfully cleared ${deletedCount} orders for restaurant ${restaurantId}`
      };
    } catch (error) {
      logger.error(`Failed to clear orders for restaurant ${restaurantId}:`, error);
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
