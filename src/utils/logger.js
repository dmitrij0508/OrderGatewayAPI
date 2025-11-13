const winston = require('winston');
const path = require('path');
const util = require('util');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Select transports based on environment; avoid file I/O in tests to prevent open handles
const baseTransports = [];
if (process.env.NODE_ENV !== 'test') {
  baseTransports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log')
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/debug-payloads.log'),
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
        })
      )
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'pos-order-gateway-api' },
  transports: baseTransports
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Enhanced debugging methods for detailed payload inspection
logger.debugPayload = function(label, payload, options = {}) {
  const { maxDepth = 5, maxLength = 1000, sanitizeFields = ['password', 'token', 'secret'] } = options;
  
  try {
    // Sanitize sensitive fields
    const sanitizedPayload = this.sanitizeObject(payload, sanitizeFields);
    
    // Truncate if too large
    const payloadStr = JSON.stringify(sanitizedPayload, null, 2);
    const truncatedPayload = payloadStr.length > maxLength 
      ? payloadStr.substring(0, maxLength) + '... [TRUNCATED]'
      : payloadStr;
    
    this.debug(`🔍 PAYLOAD DEBUG - ${label}`, {
      payloadSize: payloadStr.length,
      payloadType: typeof payload,
      isArray: Array.isArray(payload),
      keys: typeof payload === 'object' && payload !== null ? Object.keys(payload) : null,
      payload: truncatedPayload
    });
  } catch (error) {
    this.error(`Failed to debug payload for ${label}:`, { error: error.message });
  }
};

logger.debugTransformation = function(label, before, after, transformationDetails = {}) {
  try {
    this.debug(`🔄 TRANSFORMATION DEBUG - ${label}`, {
      beforeType: typeof before,
      beforeKeys: typeof before === 'object' && before !== null ? Object.keys(before) : null,
      beforeSample: typeof before === 'object' ? JSON.stringify(before).substring(0, 200) + '...' : before,
      afterType: typeof after,
      afterKeys: typeof after === 'object' && after !== null ? Object.keys(after) : null,
      afterSample: typeof after === 'object' ? JSON.stringify(after).substring(0, 200) + '...' : after,
      transformationDetails
    });
  } catch (error) {
    this.error(`Failed to debug transformation for ${label}:`, { error: error.message });
  }
};

logger.debugValidation = function(label, data, validationResult, schema = null) {
  try {
    this.debug(`✅ VALIDATION DEBUG - ${label}`, {
      isValid: validationResult.error ? false : true,
      validationError: validationResult.error ? {
        message: validationResult.error.message,
        details: validationResult.error.details?.map(d => ({
          path: d.path.join('.'),
          message: d.message,
          value: d.context?.value
        }))
      } : null,
      dataKeys: typeof data === 'object' && data !== null ? Object.keys(data) : null,
      schemaType: schema?.type || 'unknown'
    });
  } catch (error) {
    this.error(`Failed to debug validation for ${label}:`, { error: error.message });
  }
};

logger.debugDatabase = function(label, query, params = [], result = null) {
  try {
    this.debug(`🗄️ DATABASE DEBUG - ${label}`, {
      query: query.replace(/\s+/g, ' ').trim(),
      parameterCount: params.length,
      parameters: params.map((param, index) => ({
        index,
        type: typeof param,
        value: typeof param === 'string' && param.length > 50 
          ? param.substring(0, 50) + '...' 
          : param
      })),
      resultInfo: result ? {
        hasRows: result.rows ? result.rows.length : 'unknown',
        changes: result.changes || 'unknown',
        lastID: result.lastID || 'unknown'
      } : null
    });
  } catch (error) {
    this.error(`Failed to debug database operation for ${label}:`, { error: error.message });
  }
};

logger.debugRequest = function(req, label = 'Request') {
  try {
    this.debug(`📨 REQUEST DEBUG - ${label}`, {
      method: req.method,
      url: req.url,
      headers: this.sanitizeObject(req.headers, ['authorization', 'cookie', 'x-api-key']),
      query: req.query,
      params: req.params,
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      bodyType: typeof req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      timestamp: new Date().toISOString()
    });
    
    // Log body separately with detailed analysis
    if (req.body) {
      this.debugPayload(`${label} - Body`, req.body);
    }
  } catch (error) {
    this.error(`Failed to debug request for ${label}:`, { error: error.message });
  }
};

logger.debugSteps = function(label, steps) {
  try {
    this.debug(`👣 STEP-BY-STEP DEBUG - ${label}`, {
      totalSteps: steps.length,
      steps: steps.map((step, index) => ({
        step: index + 1,
        description: step.description,
        status: step.status || 'unknown',
        data: step.data ? (typeof step.data === 'object' 
          ? Object.keys(step.data) 
          : typeof step.data) : null,
        duration: step.duration || null,
        error: step.error || null
      }))
    });
  } catch (error) {
    this.error(`Failed to debug steps for ${label}:`, { error: error.message });
  }
};

logger.sanitizeObject = function(obj, sensitiveFields = []) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const isKeyNamesensitive = sensitiveFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isKeyNamesensitive) {
      sanitized[key] = '[SANITIZED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = this.sanitizeObject(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

module.exports = logger;
