const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const debugDir = path.join(__dirname, '../../logs/webhook-debug');

// Ensure debug directory exists
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
  logger.info(`📁 Created debug log directory: ${debugDir}`);
}

/**
 * Saves raw webhook payloads for manual inspection.
 * @param {string} prefix - Identifier, e.g. 'ohmyapp'
 * @param {object} payload - Raw JSON body
 * @param {object} meta - Optional metadata (headers, timestamps)
 */
function saveWebhookDebug(prefix, payload, meta = {}) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${prefix}-${timestamp}.json`;
    const filePath = path.join(debugDir, fileName);
    const data = {
      timestamp: new Date().toISOString(),
      meta,
      payload
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    logger.info(`🪣 Webhook debug payload saved: ${fileName}`);
  } catch (error) {
    logger.error('Failed to save webhook debug file:', error);
  }
}

module.exports = { saveWebhookDebug };
