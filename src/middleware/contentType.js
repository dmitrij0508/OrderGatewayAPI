const logger = require('../utils/logger');

/**
 * Enforce application/x-www-form-urlencoded for specific routes.
 * Returns 415 Unsupported Media Type if header doesn't match.
 */
function requireFormUrlEncoded(req, res, next) {
  const contentType = (req.get('Content-Type') || '').toLowerCase();

  // Allow charset or boundary parameters, but must start with the media type
  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    return next();
  }

  logger.warn('Unsupported Media Type for this endpoint', {
    path: req.path,
    method: req.method,
    receivedContentType: req.get('Content-Type') || 'none',
    expected: 'application/x-www-form-urlencoded',
  });

  return res.status(415).json({
    error: 'Unsupported Media Type',
    message: 'Use Content-Type: application/x-www-form-urlencoded for this endpoint',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { requireFormUrlEncoded };
