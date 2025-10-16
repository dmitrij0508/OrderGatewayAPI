const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const logger = require('./src/utils/logger');
const database = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');
const { authMiddleware } = require('./src/middleware/auth');
const orderRoutes = require('./src/routes/orders');
const menuRoutes = require('./src/routes/menu');
const statusRoutes = require('./src/routes/status');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(helmet());
app.use(compression());
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key']
}));
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});
app.get('/health', async (req, res) => {
  try {
    await database.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});
app.get('/api', (req, res) => {
  res.json({
    name: 'POS Order Gateway API',
    version: '1.0.0',
    description: 'Reusable REST endpoints for restaurant ordering integration',
    endpoints: {
      orders: {
        'POST /api/v1/orders': 'Create new order',
        'GET /api/v1/orders/:id': 'Get order details',
        'GET /api/v1/orders/:id/status': 'Get order status',
        'POST /api/v1/orders/:id/cancel': 'Cancel order'
      },
      menu: {
        'GET /api/v1/menu': 'Get current menu'
      },
      status: {
        'POST /api/v1/status/webhook': 'Status update webhook (internal)'
      }
    },
    authentication: 'API Key required in X-API-Key header',
    idempotency: 'Use X-Idempotency-Key header for safe retries'
  });
});
app.use('/api/v1/orders', authMiddleware, orderRoutes);
app.use('/api/v1/menu', authMiddleware, menuRoutes);
app.use('/api/v1/status', statusRoutes);
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});
app.use(errorHandler);
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.end();
  process.exit(0);
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await database.end();
  process.exit(0);
});
app.listen(PORT, () => {
  logger.info(`🚀 Order Gateway API started on port ${PORT}`);
  logger.info(`📖 API Index: http://localhost:${PORT}/api`);
  logger.info(`💓 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
module.exports = app;
