const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { requirePermission } = require('../middleware/auth');
router.get('/',
  requirePermission('menu:read'),
  menuController.getMenu
);
module.exports = router;
