const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { requirePermission } = require('../middleware/auth');
router.get('/',
  requirePermission('menu:read'),
  menuController.getMenu
);
router.get('/categories',
  requirePermission('menu:read'),
  menuController.getCategories
);
module.exports = router;
