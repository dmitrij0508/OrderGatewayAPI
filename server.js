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

// Auto-apply OhMyApp.io migration on startup
const { applyOhMyAppMigration } = require('./database/migrate-ohmyapp-support');
const app = express();
const PORT = process.env.PORT || 3000;

// Configure Express to trust proxy headers when deployed behind a proxy
// This is essential for platforms like Render, Heroku, Railway, etc.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1); // Trust first proxy
  logger.info('🔒 Proxy trust enabled for production deployment');
} else if (process.env.TRUST_PROXY) {
  // Allow specific trust proxy configuration via environment variable
  app.set('trust proxy', process.env.TRUST_PROXY);
  logger.info(`🔒 Proxy trust configured: ${process.env.TRUST_PROXY}`);
}

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
  legacyHeaders: false,
  // Skip rate limiting in case of proxy configuration issues
  skip: (req) => {
    // Skip rate limiting if we can't reliably identify the client IP
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
      return true;
    }
    return false;
  },
  // Custom key generator that handles proxy scenarios gracefully
  keyGenerator: (req) => {
    try {
      // Use the real IP when behind a proxy, fallback to connection IP
      return req.ip || req.connection?.remoteAddress || 'unknown';
    } catch (error) {
      logger.warn('Rate limiter key generation failed, using fallback', { error: error.message });
      return 'fallback-key';
    }
  }
});
app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  // Enhanced logging with proxy debugging information
  const requestInfo = {
    ip: req.ip,
    ips: req.ips,
    remoteAddress: req.connection?.remoteAddress,
    xForwardedFor: req.get('X-Forwarded-For'),
    xRealIp: req.get('X-Real-IP'),
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  logger.info(`${req.method} ${req.path}`, requestInfo);
  
  // Debug proxy configuration in development
  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_PROXY === 'true') {
    logger.debug('🌐 PROXY DEBUG INFO', {
      trustProxy: app.get('trust proxy'),
      proxyHeaders: {
        'X-Forwarded-For': req.get('X-Forwarded-For'),
        'X-Real-IP': req.get('X-Real-IP'),
        'X-Forwarded-Proto': req.get('X-Forwarded-Proto'),
        'X-Forwarded-Host': req.get('X-Forwarded-Host')
      },
      requestIpInfo: {
        ip: req.ip,
        ips: req.ips,
        socket: req.socket?.remoteAddress,
        connection: req.connection?.remoteAddress
      }
    });
  }
  
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
        'GET /api/v1/orders': 'Get all orders (with filters)',
        'GET /api/v1/orders/:id': 'Get order details',
        'GET /api/v1/orders/:id/status': 'Get order status',
        'POST /api/v1/orders/:id/cancel': 'Cancel order',
        'DELETE /api/v1/orders/all': 'Delete all orders (admin)',
        'DELETE /api/v1/orders/clear?restaurantId=X': 'Clear orders by restaurant (POS integration)'
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
// Apply database migration before starting server
async function startServer() {
  try {
    // Apply OhMyApp.io migration
    const migrationResult = await applyOhMyAppMigration();
    
    if (migrationResult.success || migrationResult.canProceed) {
      logger.info('✅ Database migration completed');
    } else {
      logger.warn('⚠️ Database migration had issues, but starting server anyway');
    }
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`🚀 Order Gateway API started on port ${PORT}`);
      logger.info(`📖 API Index: http://localhost:${PORT}/api`);
      logger.info(`💓 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🎣 OhMyApp.io webhook support: ${migrationResult.success ? 'ENABLED' : 'PARTIAL'}`);
      
      if (migrationResult.missingColumns > 0) {
        logger.warn(`⚠️ Some database columns are missing (${migrationResult.missingColumns}). OhMyApp.io features may be limited.`);
      }
    });
  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    // Try to start server anyway
    logger.info('🔄 Attempting to start server without migration...');
    
    app.listen(PORT, () => {
      logger.info(`🚀 Order Gateway API started on port ${PORT} (migration failed)`);
      logger.info(`📖 API Index: http://localhost:${PORT}/api`);
      logger.info(`💓 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.warn(`⚠️ OhMyApp.io webhook support: LIMITED (migration failed)`);
    });
  }
}

startServer();
module.exports = app;
