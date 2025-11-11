const payloadService = require('../services/payloadService');
const logger = require('../utils/logger');

class PayloadController {
  constructor() {
    this.savePayload = this.savePayload.bind(this);
    this.getPayload = this.getPayload.bind(this);
    this.listPayloads = this.listPayloads.bind(this);
  }

  async savePayload(req, res, next) {
    try {
      // Minimal logic: take req.body.payload if provided, otherwise entire body.
      const key = req.body.key || req.get('X-Payload-Key');
      const description = req.body.description || req.get('X-Payload-Description');
      const source = req.body.source || req.get('X-Payload-Source');

      const payload = Object.prototype.hasOwnProperty.call(req.body, 'payload')
        ? req.body.payload
        : req.body;

      const result = await payloadService.save({ key, description, source, payload });
      res.status(201).json({
        success: true,
        message: 'Payload saved successfully',
        key: result.key,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to save payload:', error);
      next(error);
    }
  }

  async getPayload(req, res, next) {
    try {
      const { idOrKey } = req.params;
      const record = await payloadService.getByKeyOrId(idOrKey);
      res.json({
        success: true,
        data: record,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to load payload:', error);
      next(error);
    }
  }

  async listPayloads(req, res, next) {
    try {
      const { limit = 20, offset = 0, source } = req.query;
      const data = await payloadService.list({
        limit: parseInt(limit),
        offset: parseInt(offset),
        source
      });
      res.json({
        success: true,
        data: data.items,
        pagination: { total: data.total, limit: parseInt(limit), offset: parseInt(offset) },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to list payloads:', error);
      next(error);
    }
  }
}

module.exports = new PayloadController();
