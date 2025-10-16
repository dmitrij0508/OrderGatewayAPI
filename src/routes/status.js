const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.post('/webhook', async (req, res) => {
  try {
    const webhookKey = req.headers['x-webhook-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (webhookKey !== process.env.SYNC_AGENT_API_KEY) {
      return res.status(401).json({
        error: 'Invalid webhook authentication',
        timestamp: new Date().toISOString()
      });
    }
    const { orderId, status, estimatedTime, notes } = req.body;
    if (!orderId || !status) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'orderId and status are required',
        timestamp: new Date().toISOString()
      });
    }
    logger.info(`Status webhook received for order ${orderId}`, {
      orderId,
      status,
      estimatedTime,
      notes
    });
    res.json({
      success: true,
      message: 'Status update received',
      orderId,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;
