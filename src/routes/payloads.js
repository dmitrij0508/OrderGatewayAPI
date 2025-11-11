const express = require('express');
const router = express.Router();
const payloadController = require('../controllers/payloadController');
const { requirePermission } = require('../middleware/auth');

// Accept text bodies for non-JSON content-types (fallback)
router.use(express.text({ type: '*/*', limit: '10mb' }));

// Save a payload (body may include key/description/source and payload or raw JSON)
router.post('/', requirePermission('orders:create'), payloadController.savePayload);

// List saved payloads
router.get('/', requirePermission('orders:read'), payloadController.listPayloads);

// Load a saved payload by key or id
router.get('/:idOrKey', requirePermission('orders:read'), payloadController.getPayload);

module.exports = router;
