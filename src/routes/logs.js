const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * GET /api/v1/logs
 * Retrieve recent log entries
 * Query parameters:
 *  - lines: number of lines to return (default: 100, max: 1000)
 *  - level: filter by log level (info, warn, error, debug)
 *  - search: search term to filter log entries
 */
router.get('/', async (req, res) => {
  try {
    const lines = Math.min(parseInt(req.query.lines) || 100, 1000);
    const levelFilter = req.query.level?.toLowerCase();
    const searchTerm = req.query.search?.toLowerCase();

    // Determine log file path (logs are stored in the logs directory)
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Get the most recent log file
    let logFiles = [];
    try {
      const files = await fs.readdir(logsDir);
      logFiles = files
        .filter(f => f.startsWith('combined-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          time: f
        }))
        .sort((a, b) => b.time.localeCompare(a.time));
    } catch (err) {
      // If logs directory doesn't exist or is empty, return empty logs
      return res.json({
        success: true,
        data: {
          logs: [],
          count: 0,
          message: 'No log files found'
        }
      });
    }

    if (logFiles.length === 0) {
      return res.json({
        success: true,
        data: {
          logs: [],
          count: 0,
          message: 'No log files found'
        }
      });
    }

    // Read the most recent log file
    const logFilePath = logFiles[0].path;
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    
    // Split into lines and reverse to get most recent first
    let logLines = logContent.split('\n').filter(line => line.trim().length > 0);
    logLines.reverse();

    // Apply filters
    if (levelFilter) {
      logLines = logLines.filter(line => 
        line.toLowerCase().includes(`[${levelFilter}]`) || 
        line.toLowerCase().includes(`"level":"${levelFilter}"`)
      );
    }

    if (searchTerm) {
      logLines = logLines.filter(line => 
        line.toLowerCase().includes(searchTerm)
      );
    }

    // Limit to requested number of lines
    logLines = logLines.slice(0, lines);

    // Parse log entries if they're JSON
    const parsedLogs = logLines.map(line => {
      try {
        // Try to parse as JSON first
        return JSON.parse(line);
      } catch {
        // If not JSON, return as plain text
        return { message: line };
      }
    });

    res.json({
      success: true,
      data: {
        logs: parsedLogs,
        count: parsedLogs.length,
        totalLines: logContent.split('\n').length,
        logFile: logFiles[0].name,
        filters: {
          lines,
          level: levelFilter || 'all',
          search: searchTerm || 'none'
        }
      }
    });
  } catch (error) {
    logger.error('Error retrieving logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/logs/files
 * List available log files
 */
router.get('/files', async (req, res) => {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    try {
      const files = await fs.readdir(logsDir);
      const logFiles = [];

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          logFiles.push({
            name: file,
            size: stats.size,
            modified: stats.mtime,
            sizeFormatted: formatBytes(stats.size)
          });
        }
      }

      // Sort by modified date, most recent first
      logFiles.sort((a, b) => b.modified - a.modified);

      res.json({
        success: true,
        data: {
          files: logFiles,
          count: logFiles.length
        }
      });
    } catch (err) {
      return res.json({
        success: true,
        data: {
          files: [],
          count: 0,
          message: 'No log files found'
        }
      });
    }
  } catch (error) {
    logger.error('Error listing log files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list log files',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/logs/stream
 * Stream logs in real-time (SSE - Server-Sent Events)
 */
router.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Log stream connected' })}\n\n`);

  const logsDir = path.join(process.cwd(), 'logs');
  let lastPosition = 0;

  // Stream logs every 2 seconds
  const intervalId = setInterval(async () => {
    try {
      const files = await fs.readdir(logsDir);
      const logFiles = files
        .filter(f => (f.startsWith('combined') || f === 'combined.log') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f)
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      if (logFiles.length > 0) {
        const logFilePath = logFiles[0].path;
        const stats = await fs.stat(logFilePath);

        if (stats.size > lastPosition) {
          const stream = require('fs').createReadStream(logFilePath, {
            start: lastPosition,
            encoding: 'utf-8'
          });

          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            lines.forEach(line => {
              if (line.trim()) {
                try {
                  const logEntry = JSON.parse(line);
                  res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
                } catch {
                  res.write(`data: ${JSON.stringify({ message: line })}\n\n`);
                }
              }
            });
          });

          stream.on('end', () => {
            lastPosition = stats.size;
          });
        }
      }
    } catch (error) {
      logger.error('Error streaming logs:', error);
    }
  }, 2000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    logger.info('Log stream client disconnected');
  });
});

/**
 * GET /api/v1/logs/orders
 * Get logs specifically related to order operations
 * Useful for debugging POS /api/v1/orders payloads
 */
router.get('/orders', async (req, res) => {
  try {
    const lines = Math.min(parseInt(req.query.lines) || 100, 1000);
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Get the most recent log file
    let logFiles = [];
    try {
      const files = await fs.readdir(logsDir);
      logFiles = files
        .filter(f => (f.startsWith('combined') || f === 'combined.log') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          time: f
        }))
        .sort((a, b) => b.time.localeCompare(a.time));
    } catch (err) {
      return res.json({
        success: true,
        data: {
          logs: [],
          count: 0,
          message: 'No log files found'
        }
      });
    }

    if (logFiles.length === 0) {
      return res.json({
        success: true,
        data: {
          logs: [],
          count: 0,
          message: 'No log files found'
        }
      });
    }

    // Read the most recent log file
    const logFilePath = logFiles[0].path;
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    
    // Split into lines and reverse to get most recent first
    let logLines = logContent.split('\n').filter(line => line.trim().length > 0);
    logLines.reverse();

    // Filter for order-related logs
    logLines = logLines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('/api/v1/orders') || 
             lower.includes('order creation') ||
             lower.includes('processing order') ||
             lower.includes('createorder') ||
             lower.includes('raw order data') ||
             lower.includes('order analysis');
    });

    // Limit to requested number of lines
    logLines = logLines.slice(0, lines);

    // Parse log entries
    const parsedLogs = logLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line };
      }
    });

    res.json({
      success: true,
      data: {
        logs: parsedLogs,
        count: parsedLogs.length,
        logFile: logFiles[0].name,
        filters: {
          type: 'orders',
          lines
        }
      }
    });
  } catch (error) {
    logger.error('Error retrieving order logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve order logs',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/logs/payloads
 * Extract and analyze order payloads from logs
 * Perfect for inspecting what POS systems are sending
 */
router.get('/payloads', async (req, res) => {
  try {
    const lines = Math.min(parseInt(req.query.lines) || 50, 500);
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Read both combined and debug-payloads logs
    let allPayloads = [];
    
    try {
      const files = await fs.readdir(logsDir);
      const logFiles = files
        .filter(f => ((f.startsWith('combined') || f.startsWith('debug-payloads') || f === 'combined.log' || f === 'debug-payloads.log') && f.endsWith('.log')))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          time: f
        }))
        .sort((a, b) => b.time.localeCompare(a.time));

      // Read top 3 most recent log files
      for (const logFile of logFiles.slice(0, 3)) {
        const logContent = await fs.readFile(logFile.path, 'utf-8');
        const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
        
        // Extract lines with payload information
        const payloadLines = logLines.filter(line => {
          const lower = line.toLowerCase();
          return lower.includes('raw order data') ||
                 lower.includes('payload debug') ||
                 lower.includes('inspect-payload') ||
                 lower.includes('webhook') ||
                 lower.includes('"body":');
        });

        allPayloads.push(...payloadLines);
      }
    } catch (err) {
      logger.error('Error reading payload logs:', err);
    }

    // Reverse to get most recent first
    allPayloads.reverse();
    allPayloads = allPayloads.slice(0, lines);

    // Parse and extract payload data
    const extractedPayloads = [];
    
    for (const line of allPayloads) {
      try {
        const logEntry = JSON.parse(line);
        
        // Extract payload from different log formats
        let payload = null;
        let metadata = {
          timestamp: logEntry.timestamp,
          level: logEntry.level,
          message: logEntry.message
        };

        // Check for body field (error logs often contain full request body)
        if (logEntry.body) {
          payload = logEntry.body;
          metadata.source = 'error-log';
          metadata.method = logEntry.method;
          metadata.path = logEntry.path;
          metadata.ip = logEntry.ip;
          metadata.userAgent = logEntry.userAgent;
        }
        
        // Check for payload field (debug logs)
        else if (logEntry.payload) {
          payload = typeof logEntry.payload === 'string' ? JSON.parse(logEntry.payload) : logEntry.payload;
          metadata.source = 'debug-log';
        }

        // Check for nested data structures
        else if (logEntry.message && typeof logEntry.message === 'object') {
          payload = logEntry.message;
          metadata.source = 'nested-message';
        }

        if (payload) {
          extractedPayloads.push({
            payload,
            metadata,
            analysis: analyzePayloadStructure(payload)
          });
        }
      } catch (err) {
        // Skip lines that can't be parsed
        logger.debug('Could not parse payload line:', err.message);
      }
    }

    res.json({
      success: true,
      data: {
        payloads: extractedPayloads,
        count: extractedPayloads.length,
        totalLinesScanned: allPayloads.length,
        hint: 'Use this endpoint to see exactly what payloads POS systems are sending to /api/v1/orders'
      }
    });
  } catch (error) {
    logger.error('Error extracting payloads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract payloads',
      message: error.message
    });
  }
});

/**
 * Helper function to analyze payload structure
 */
function analyzePayloadStructure(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'Not an object' };
  }

  const analysis = {
    valid: true,
    fields: Object.keys(payload),
    fieldCount: Object.keys(payload).length,
    hasOrderId: !!(payload.orderId || payload.order_id || payload.id),
    hasCustomer: !!payload.customer,
    hasItems: !!(payload.items && Array.isArray(payload.items)),
    itemCount: payload.items ? payload.items.length : 0,
    hasTotals: !!(payload.totals || payload.total),
    totalAmount: payload.totals?.total || payload.total || null,
    hasPayment: !!payload.payment,
    customerFields: payload.customer ? Object.keys(payload.customer) : [],
    missingFields: []
  };

  // Check for required fields
  const requiredFields = ['orderId', 'customer', 'items', 'totals'];
  for (const field of requiredFields) {
    const variants = [field, field.replace(/([A-Z])/g, '_$1').toLowerCase()];
    const hasField = variants.some(v => payload[v]);
    if (!hasField) {
      analysis.missingFields.push(field);
    }
  }

  analysis.isComplete = analysis.missingFields.length === 0;
  analysis.completeness = Math.round(((requiredFields.length - analysis.missingFields.length) / requiredFields.length) * 100);

  return analysis;
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;
