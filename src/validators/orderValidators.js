const Joi = require('joi');
const createOrderSchema = Joi.object({
  orderId: Joi.string()
    .pattern(/^ORD-[A-Z0-9]+-[0-9]+$|^ORD-[0-9]{8}-[0-9]{3}$/)
    .required()
    .messages({
      'string.pattern.base': 'orderId must follow format: ORD-YYYYMMDD-NNN or ORD-PREFIX-NNN'
    }),
  externalOrderId: Joi.string()
    .required()
    .max(100),
  restaurantId: Joi.string()
    .required()
    .max(50),
  customer: Joi.object({
    name: Joi.string().required().max(255),
    phone: Joi.string()
      .pattern(/^(\+[1-9]\d{1,14}|[0-9]{3}-[0-9]{4}|\([0-9]{3}\) [0-9]{3}-[0-9]{4}|[0-9]{10,15})$/)
      .required()
      .messages({
        'string.pattern.base': 'phone must be a valid phone number (e.g., +44 7836327169, 555-0123, (555) 555-0123, or 1234567890)'
      }),
    email: Joi.string().email().optional()
  }).required(),
  orderType: Joi.string()
    .valid('pickup', 'delivery', 'dine-in')
    .required(),
  orderTime: Joi.date().iso().required(),
  requestedTime: Joi.date().iso().optional(),
  items: Joi.array().min(1).items(
    Joi.object({
      itemId: Joi.string().required().max(50),
      name: Joi.string().required().max(255),
      quantity: Joi.number().integer().min(1).required(),
      unitPrice: Joi.number().min(0).precision(2).required(),
      totalPrice: Joi.number().min(0).precision(2).required(),
      modifiers: Joi.array().items(
        Joi.object({
          name: Joi.string().required().max(100),
          price: Joi.number().min(0).precision(2).required()
        })
      ).optional(),
      specialInstructions: Joi.string().max(500).optional()
    })
  ).required(),
  totals: Joi.object({
    subtotal: Joi.number().min(0).precision(2).required(),
    tax: Joi.number().min(0).precision(2).required(),
    tip: Joi.number().min(0).precision(2).optional().default(0),
    discount: Joi.number().min(0).precision(2).optional().default(0),
    deliveryFee: Joi.number().min(0).precision(2).optional().default(0),
    total: Joi.number().min(0).precision(2).required()
  }).required(),
  payment: Joi.object({
    method: Joi.string().valid('credit_card', 'debit_card', 'cash', 'mobile_payment').optional(),
    status: Joi.string().valid('pending', 'authorized', 'captured', 'failed').optional(),
    transactionId: Joi.string().max(100).optional()
  }).optional(),
  notes: Joi.string().max(1000).optional()
});
const updateOrderSchema = Joi.object({
  status: Joi.string()
    .valid('received', 'preparing', 'ready', 'completed', 'cancelled')
    .optional(),
  estimatedTime: Joi.date().iso().optional(),
  notes: Joi.string().max(1000).optional()
});
const cancelOrderSchema = Joi.object({
  reason: Joi.string()
    .valid('customer_request', 'out_of_stock', 'payment_failed', 'other')
    .required(),
  notes: Joi.string().max(500).optional()
});
const idempotencyKeySchema = Joi.string()
  .uuid({ version: ['uuidv4'] })
  .required()
  .messages({
    'string.guid': 'X-Idempotency-Key must be a valid UUID v4'
  });
module.exports = {
  createOrderSchema,
  updateOrderSchema,
  cancelOrderSchema,
  idempotencyKeySchema
};
