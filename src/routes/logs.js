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
        .filter(f => f.startsWith('combined-') && f.endsWith('.log'))
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
