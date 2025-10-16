const logger = require('../utils/logger');
const API_KEYS = new Map([
  ['pos-mobile-app-key', { name: 'Mobile App', permissions: ['orders:create', 'orders:read', 'menu:read'] }],
  ['pos-website-key', { name: 'Website', permissions: ['orders:create', 'orders:read', 'menu:read'] }],
  ['pos-admin-key', { name: 'Admin Dashboard', permissions: ['*'] }],
  ['sync-agent-key', { name: 'POS Sync Agent', permissions: ['orders:update', 'status:webhook'] }]
]);
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    logger.warn('Authentication failed: No API key provided', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({
      error: 'Authentication required',
      message: 'API key must be provided in X-API-Key header',
      timestamp: new Date().toISOString()
    });
  }
  const keyInfo = API_KEYS.get(apiKey);
  if (!keyInfo) {
    logger.warn('Authentication failed: Invalid API key', {
      ip: req.ip,
      path: req.path,
      apiKeyPrefix: apiKey.substring(0, 8) + '...',
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid',
      timestamp: new Date().toISOString()
    });
  }
  req.apiKey = {
    key: apiKey,
    name: keyInfo.name,
    permissions: keyInfo.permissions
  };
  logger.info('Authentication successful', {
    client: keyInfo.name,
    ip: req.ip,
    path: req.path
  });
  next();
};
const hasPermission = (req, permission) => {
  const permissions = req.apiKey?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
};
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!hasPermission(req, permission)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        client: req.apiKey?.name,
        requiredPermission: permission,
        userPermissions: req.apiKey?.permissions,
        ip: req.ip,
        path: req.path
      });
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This operation requires '${permission}' permission`,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};
module.exports = {
  authMiddleware,
  requirePermission,
  hasPermission
};
