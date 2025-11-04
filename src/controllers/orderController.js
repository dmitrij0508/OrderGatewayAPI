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
      // STEP 1: Debug incoming request with webhook detection
      logger.debugRequest(req, 'Order Creation Request');
      
      // Detect if this is an OhMyApp.io webhook
      const isOhMyAppWebhook = this.detectOhMyAppWebhook(req);
      if (isOhMyAppWebhook.isWebhook) {
        logger.info('🎣 OHMYAPP WEBHOOK DETECTED', {
          confidence: isOhMyAppWebhook.confidence,
          indicators: isOhMyAppWebhook.indicators,
          userAgent: req.get('User-Agent'),
          contentType: req.get('Content-Type'),
          origin: req.get('Origin')
        });
      }
      
      debugSteps.push({
        description: 'Incoming request logged',
        status: 'completed',
        data: { 
          method: req.method, 
          url: req.url, 
          bodySize: JSON.stringify(req.body).length,
          isOhMyAppWebhook: isOhMyAppWebhook.isWebhook,
          webhookConfidence: isOhMyAppWebhook.confidence
        },
        duration: Date.now() - debugStartTime
      });

      // STEP 2: Extract and debug raw order data with null value analysis
      const orderData = req.body;
      logger.debugPayload('Raw Order Data', orderData);
      
      // Analyze null values specifically for OhMyApp webhooks
      const nullAnalysis = this.analyzeNullValues(orderData);
      if (nullAnalysis.hasNulls) {
        logger.warn('⚠️ NULL VALUES DETECTED IN WEBHOOK PAYLOAD', {
          nullCount: nullAnalysis.nullCount,
          nullPaths: nullAnalysis.nullPaths,
          isOhMyAppWebhook: isOhMyAppWebhook.isWebhook,
          recommendation: 'Check OhMyApp.io webhook configuration for incomplete data'
        });
      }
      
      // Enhanced data extraction for potential nested webhook data
      const extractedData = this.extractWebhookData(orderData, isOhMyAppWebhook);
      if (extractedData.wasExtracted) {
        logger.info('📦 NESTED WEBHOOK DATA EXTRACTED', {
          originalKeys: Object.keys(orderData || {}),
          extractedKeys: Object.keys(extractedData.data || {}),
          extractionPath: extractedData.path
        });
      }
      
      debugSteps.push({
        description: 'Raw order data extracted and analyzed',
        status: 'completed',
        data: { 
          hasData: !!orderData, 
          dataType: typeof orderData, 
          keys: Object.keys(orderData || {}),
          nullCount: nullAnalysis.nullCount,
          dataExtracted: extractedData.wasExtracted,
          extractionPath: extractedData.path
        },
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
      // Use extracted data if available, otherwise use original
      const dataToProcess = extractedData.wasExtracted ? extractedData.data : orderData;
      
      logger.debug('📋 PROCESSING ORDER DATA', {
        usingExtractedData: extractedData.wasExtracted,
        extractionPath: extractedData.path,
        dataKeys: Object.keys(dataToProcess || {}),
        hasOrderId: !!(dataToProcess.orderId || dataToProcess.order_id || dataToProcess.id),
        hasCustomer: !!dataToProcess.customer,
        hasItems: !!(dataToProcess.items && Array.isArray(dataToProcess.items))
      });
      
      const processedOrder = {
        orderId: dataToProcess.orderId || dataToProcess.order_id || dataToProcess.id || `ORD-${Date.now()}`,
        externalOrderId: dataToProcess.externalOrderId || dataToProcess.external_order_id || dataToProcess.orderId || dataToProcess.order_id || dataToProcess.id || `EXT-${Date.now()}`,
        restaurantId: dataToProcess.restaurantId || dataToProcess.restaurant_id || dataToProcess.merchantId || dataToProcess.merchant_id || 'NYC-DELI-001',
        
        // Enhanced customer information with OhMyApp.io address support
        customer: {
          name: dataToProcess.customer?.name || dataToProcess.customer?.customer_name || dataToProcess.customerName || dataToProcess.customer_name || dataToProcess.client?.name || 'Unknown Customer',
          phone: dataToProcess.customer?.phone || dataToProcess.customer?.phone_number || dataToProcess.customerPhone || dataToProcess.customer_phone || dataToProcess.phone || 'N/A',
          email: dataToProcess.customer?.email || dataToProcess.customer?.email_address || dataToProcess.customerEmail || dataToProcess.customer_email || dataToProcess.email || null,
          // Handle OhMyApp.io customer address
          address: dataToProcess.customer?.address ? {
            street: dataToProcess.customer.address.street || '',
            city: dataToProcess.customer.address.city || '',
            state: dataToProcess.customer.address.state || '',
            zipCode: dataToProcess.customer.address.zipCode || '',
            full: `${dataToProcess.customer.address.street || ''} ${dataToProcess.customer.address.city || ''} ${dataToProcess.customer.address.state || ''} ${dataToProcess.customer.address.zipCode || ''}`.trim()
          } : null
        },
        
        // Enhanced order details with multiple field name support
        orderType: dataToProcess.orderType || dataToProcess.order_type || dataToProcess.type || dataToProcess.deliveryType || dataToProcess.delivery_type || 'pickup',
        orderTime: dataToProcess.orderTime || dataToProcess.order_time || dataToProcess.createdAt || dataToProcess.created_at || dataToProcess.timestamp || new Date().toISOString(),
        requestedTime: dataToProcess.requestedTime || dataToProcess.requested_time || dataToProcess.deliveryTime || dataToProcess.delivery_time || null,
        
        // Enhanced item processing with multiple field name support
        items: Array.isArray(dataToProcess.items) ? dataToProcess.items.map(item => ({
          itemId: item.itemId || item.item_id || item.id || item.productId || item.product_id || null,
          name: item.name || item.item_name || item.title || item.product_name || item.description || 'Unknown Item',
          quantity: parseInt(item.quantity || item.qty || item.amount || 1),
          unitPrice: parseFloat(item.unitPrice || item.unit_price || item.price || item.cost || 0),
          totalPrice: parseFloat(item.totalPrice || item.total_price || item.total || item.line_total || 0),
          specialInstructions: item.specialInstructions || item.special_instructions || item.notes || item.comments || null,
          modifiers: Array.isArray(item.modifiers || item.options || item.add_ons) ? (item.modifiers || item.options || item.add_ons).map(modifier => ({
            name: modifier.name || modifier.option_name || modifier.title || 'Unknown Modifier',
            price: parseFloat(modifier.price || modifier.cost || modifier.additional_cost || 0)
          })) : []
        })) : (Array.isArray(dataToProcess.orderItems) ? dataToProcess.orderItems.map(item => ({
          itemId: item.itemId || item.item_id || item.id || null,
          name: item.name || item.item_name || 'Unknown Item',
          quantity: parseInt(item.quantity || 1),
          unitPrice: parseFloat(item.unitPrice || item.price || 0),
          totalPrice: parseFloat(item.totalPrice || item.total || 0),
          specialInstructions: item.specialInstructions || item.notes || null,
          modifiers: []
        })) : []),
        
        // Enhanced totals with OhMyApp.io specific fields
        totals: {
          subtotal: parseFloat(dataToProcess.totals?.subtotal || dataToProcess.subtotal || dataToProcess.sub_total || dataToProcess.itemsTotal|| dataToProcess.items_total || 0),
          tax: parseFloat(dataToProcess.totals?.tax || dataToProcess.tax || dataToProcess.tax_amount || dataToProcess.salesTax || dataToProcess.sales_tax || 0),
          tip: parseFloat(dataToProcess.totals?.tip || dataToProcess.tip || dataToProcess.tip_amount || dataToProcess.gratuity || 0),
          discount: parseFloat(dataToProcess.totals?.discount || dataToProcess.discount || dataToProcess.discount_amount || 0),
          // Handle OhMyApp.io specific delivery fee fields - combine shippingFee + serviceFee
          deliveryFee: parseFloat(
            dataToProcess.totals?.deliveryFee || 
            dataToProcess.deliveryFee || 
            dataToProcess.delivery_fee || 
            dataToProcess.shippingCost || 
            dataToProcess.shipping_cost ||
            // OhMyApp.io specific: combine shippingFee and serviceFee
            ((parseFloat(dataToProcess.totals?.shippingFee || 0)) + (parseFloat(dataToProcess.totals?.serviceFee || 0))) ||
            0
          ),
          total: parseFloat(dataToProcess.totals?.total || dataToProcess.total || dataToProcess.total_amount || dataToProcess.grandTotal || dataToProcess.grand_total || dataToProcess.finalAmount || dataToProcess.final_amount || 0)
        },
        
        // Enhanced payment information with OhMyApp.io specific fields
        payment: {
          method: dataToProcess.payment?.method || dataToProcess.payment?.payment_method || dataToProcess.paymentMethod || dataToProcess.payment_method || dataToProcess.paymentType || dataToProcess.payment_type || null,
          status: dataToProcess.payment?.status || dataToProcess.payment?.payment_status || dataToProcess.paymentStatus || dataToProcess.payment_status || dataToProcess.status || 'pending',
          transactionId: dataToProcess.payment?.transactionId || dataToProcess.payment?.transaction_id || dataToProcess.transactionId || dataToProcess.transaction_id || dataToProcess.paymentId || dataToProcess.payment_id || null,
          // Handle OhMyApp.io payment amount field
          amount: parseFloat(dataToProcess.payment?.amount || 0)
        },
        
        // Enhanced notes and status with OhMyApp.io specific fields
        notes: dataToProcess.notes || dataToProcess.special_instructions || dataToProcess.specialInstructions || dataToProcess.comments || dataToProcess.remarks || '',
        status: dataToProcess.status || dataToProcess.order_status || dataToProcess.orderStatus || 'received',
        
        // Handle OhMyApp.io specific fields
        source: dataToProcess.source || 'api',
        webhookMetadata: dataToProcess.webhookMetadata || null,
        originalOrderId: dataToProcess.originalOrderId || null,
        createdAt: dataToProcess.createdAt || null,
        
        // Additional OhMyApp.io fields for debugging
        _ohmyAppFields: {
          hasShippingFee: !!(dataToProcess.totals?.shippingFee),
          hasServiceFee: !!(dataToProcess.totals?.serviceFee),
          hasAddress: !!(dataToProcess.customer?.address),
          hasWebhookMetadata: !!(dataToProcess.webhookMetadata),
          source: dataToProcess.source
        }
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

  // Helper method to detect OhMyApp.io webhooks
  detectOhMyAppWebhook(req) {
    const indicators = [];
    let confidence = 0;
    
    // Check User-Agent - OhMyApp.io sends "OhMyApp-Webhook/1.7.1"
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('OhMyApp-Webhook')) {
      indicators.push('User-Agent is OhMyApp-Webhook');
      confidence += 50;
    } else if (userAgent.toLowerCase().includes('ohmyapp')) {
      indicators.push('User-Agent contains ohmyapp');
      confidence += 30;
    } else if (userAgent.toLowerCase().includes('webhook')) {
      indicators.push('User-Agent contains webhook');
      confidence += 15;
    }
    
    // Check for OhMyApp.io specific headers
    const webhookSource = req.get('X-Webhook-Source');
    if (webhookSource && webhookSource.includes('ohmyapp')) {
      indicators.push(`X-Webhook-Source header: ${webhookSource}`);
      confidence += 40;
    }
    
    // Check Origin/Referer
    const origin = req.get('Origin') || '';
    const referer = req.get('Referer') || '';
    if (origin.includes('ohmyapp.io') || referer.includes('ohmyapp.io')) {
      indicators.push('Origin/Referer from ohmyapp.io domain');
      confidence += 40;
    }
    
    // Check for webhook-specific headers
    const webhookHeaders = ['X-Webhook-Id', 'X-Event-Type', 'X-Signature', 'X-Hub-Signature'];
    webhookHeaders.forEach(header => {
      if (req.get(header)) {
        indicators.push(`Webhook header present: ${header}`);
        confidence += 10;
      }
    });
    
    // Check payload structure for OhMyApp.io specific patterns
    const body = req.body;
    if (body && typeof body === 'object') {
      // OhMyApp.io specific fields
      if (body.source === 'ohmyapp-webhook') {
        indicators.push('Source field indicates ohmyapp-webhook');
        confidence += 35;
      }
      
      if (body.webhookMetadata) {
        indicators.push('WebhookMetadata present (OhMyApp pattern)');
        confidence += 20;
      }
      
      if (body.originalOrderId) {
        indicators.push('OriginalOrderId present (OhMyApp pattern)');
        confidence += 15;
      }
      
      // Check for OhMyApp.io specific totals structure
      if (body.totals && (body.totals.shippingFee !== undefined || body.totals.serviceFee !== undefined)) {
        indicators.push('OhMyApp.io totals structure (shippingFee/serviceFee)');
        confidence += 25;
      }
      
      // Check for OhMyApp.io customer address structure
      if (body.customer && body.customer.address && body.customer.address.street !== undefined) {
        indicators.push('OhMyApp.io customer address structure');
        confidence += 15;
      }
      
      // Check for items with modifiers structure
      if (body.items && Array.isArray(body.items) && body.items.some(item => item.modifiers && Array.isArray(item.modifiers))) {
        const hasModifierIds = body.items.some(item => 
          item.modifiers && item.modifiers.some(mod => mod.modifierId)
        );
        if (hasModifierIds) {
          indicators.push('OhMyApp.io modifier structure (modifierId present)');
          confidence += 15;
        }
      }
      
      // Common webhook patterns
      if (body.event || body.eventType) {
        indicators.push('Event-based payload structure');
        confidence += 10;
      }
      if (body.createdAt || body.timestamp) {
        indicators.push('Timestamp field present');
        confidence += 5;
      }
    }
    
    return {
      isWebhook: confidence > 25,
      confidence: Math.min(confidence, 100),
      indicators,
      source: confidence > 60 ? 'OhMyApp.io' : (confidence > 30 ? 'Webhook' : 'Unknown'),
      detectedFields: body ? {
        hasSource: !!body.source,
        sourceValue: body.source,
        hasWebhookMetadata: !!body.webhookMetadata,
        hasOhMyAppTotals: !!(body.totals && (body.totals.shippingFee !== undefined || body.totals.serviceFee !== undefined)),
        hasOhMyAppAddress: !!(body.customer && body.customer.address)
      } : null
    };
  }

  // Helper method to analyze null values in payload
  analyzeNullValues(obj, path = '') {
    let nullCount = 0;
    let nullPaths = [];
    
    function traverse(current, currentPath) {
      if (current === null) {
        nullCount++;
        nullPaths.push(currentPath);
      } else if (current === undefined) {
        nullCount++;
        nullPaths.push(currentPath + ' (undefined)');
      } else if (current === '') {
        nullCount++;
        nullPaths.push(currentPath + ' (empty string)');
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

  // Helper method to extract webhook data from nested structures
  extractWebhookData(payload, webhookInfo) {
    if (!payload || typeof payload !== 'object') {
      return { wasExtracted: false, data: payload, path: 'direct' };
    }
    
    // Try common webhook data extraction patterns
    const extractionPaths = [
      { path: 'data', data: payload.data },
      { path: 'order', data: payload.order },
      { path: 'event.data', data: payload.event?.data },
      { path: 'payload', data: payload.payload },
      { path: 'body', data: payload.body }
    ];
    
    for (const extraction of extractionPaths) {
      if (extraction.data && typeof extraction.data === 'object') {
        // Check if extracted data looks more like an order than the original
        const originalOrderScore = this.scoreOrderLikeness(payload);
        const extractedOrderScore = this.scoreOrderLikeness(extraction.data);
        
        if (extractedOrderScore > originalOrderScore) {
          logger.info('📤 EXTRACTED NESTED ORDER DATA', {
            extractionPath: extraction.path,
            originalScore: originalOrderScore,
            extractedScore: extractedOrderScore,
            originalKeys: Object.keys(payload),
            extractedKeys: Object.keys(extraction.data)
          });
          
          return {
            wasExtracted: true,
            data: extraction.data,
            path: extraction.path,
            originalData: payload
          };
        }
      }
    }
    
    return { wasExtracted: false, data: payload, path: 'direct' };
  }

  // Helper method to score how "order-like" a data structure is
  scoreOrderLikeness(data) {
    if (!data || typeof data !== 'object') return 0;
    
    let score = 0;
    const keys = Object.keys(data);
    
    // Order identification fields
    if (keys.some(k => k.toLowerCase().includes('order'))) score += 20;
    if (keys.some(k => k.toLowerCase() === 'id' || k.toLowerCase().includes('id'))) score += 15;
    
    // Customer fields
    if (keys.some(k => k.toLowerCase().includes('customer'))) score += 15;
    if (keys.some(k => k.toLowerCase().includes('name'))) score += 10;
    if (keys.some(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('email'))) score += 10;
    
    // Order content fields
    if (keys.some(k => k.toLowerCase().includes('item'))) score += 15;
    if (keys.some(k => k.toLowerCase().includes('total') || k.toLowerCase().includes('amount'))) score += 10;
    if (keys.some(k => k.toLowerCase().includes('tax'))) score += 5;
    if (keys.some(k => k.toLowerCase().includes('payment'))) score += 10;
    
    return score;
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
