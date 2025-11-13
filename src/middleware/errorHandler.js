const logger = require('../utils/logger');
const errorHandler = (err, req, res, next) => {
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    timestamp: new Date().toISOString()
  });
  let status = 500;
  let message = 'Internal server error';
  let details = {};
  if (err.statusCode) {
    status = err.statusCode;
    message = err.message || message;
    if (err.details) details = err.details;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = err.details || {};
  } else if (err.name === 'TotalsMismatchError' || err.message === 'Totals mismatch') {
    status = 400;
    message = 'Totals mismatch';
    details = err.details || {};
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = 'Resource not found';
  } else if (err.name === 'ConflictError') {
    status = 409;
    message = 'Resource conflict';
  } else if (err.code === '23505') {
    status = 409;
    message = 'Duplicate resource';
    details = { constraint: err.constraint };
  } else if (err.code === '23503') {
    status = 400;
    message = 'Invalid reference';
    details = { constraint: err.constraint };
  } else if (err.code === '42P01') {
    status = 500;
    message = 'Database schema error';
  }
  if (process.env.NODE_ENV === 'production' && status === 500) {
    message = 'Something went wrong';
    details = {};
  }
  res.status(status).json({
    error: message,
    ...(Object.keys(details).length > 0 && { details }),
    timestamp: new Date().toISOString(),
    requestId: req.id || req.headers['x-request-id'] || 'unknown'
  });
};
module.exports = errorHandler;
