const payloadService = require('../services/payloadService');
const logger = require('../utils/logger');

class PayloadController {
  constructor() {
    this.savePayload = this.savePayload.bind(this);
    this.getPayload = this.getPayload.bind(this);
    this.listPayloads = this.listPayloads.bind(this);
    this.getRawPayload = this.getRawPayload.bind(this);
    this.echo = this.echo.bind(this);
  }

  async savePayload(req, res, next) {
    try {
      // Minimal logic: take req.body.payload if provided, otherwise entire body.
      const key = (req.body && req.body.key) || req.get('X-Payload-Key');
      const description = (req.body && req.body.description) || req.get('X-Payload-Description');
      const source = (req.body && req.body.source) || req.get('X-Payload-Source');

      // Try to derive payload robustly
      let payload;
      if (req.body && typeof req.body === 'object' && Object.prototype.hasOwnProperty.call(req.body, 'payload')) {
        payload = req.body.payload;
      } else if (typeof req.body === 'string' && req.body.trim() !== '') {
        // Body was parsed by express.text; try JSON parse, else store as string
        try {
          payload = JSON.parse(req.body);
        } catch (_) {
          payload = req.body; // keep raw string
        }
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        payload = req.body;
      } else if (req.rawBody && req.rawBody.trim() !== '') {
        
        try {
          payload = JSON.parse(req.rawBody);
        } catch (_) {
          payload = req.rawBody; // keep raw string
        }
      } else {
        payload = {}; // final fallback
      }

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

  async getRawPayload(req, res, next) {
    try {
      const { idOrKey } = req.params;
      const record = await payloadService.getByKeyOrId(idOrKey);
      return res.json(record.payload);
    } catch (error) {
      next(error);
    }
  }

  async echo(req, res) {
    const info = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      hasBodyObject: !!req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0,
      isBodyString: typeof req.body === 'string',
      bodyType: typeof req.body,
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
      rawBodyLength: req.rawBody ? req.rawBody.length : 0
    };
    return res.json({ info, body: req.body, rawBodySample: req.rawBody ? req.rawBody.substring(0, 2000) : null });
  }
}

module.exports = new PayloadController();
