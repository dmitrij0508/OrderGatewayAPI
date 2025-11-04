# API Proxy Trust Configuration Fix

## Problem: X-Forwarded-For Header Error

**Error Message:**
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false (default). 
This could indicate a misconfiguration which would prevent express-rate-limit from accurately identifying users.
```

## Root Cause
This error occurs when:
1. The API is deployed behind a proxy (Render.com, Heroku, Railway, etc.)
2. The proxy adds `X-Forwarded-For` headers to identify the real client IP
3. Express.js is not configured to trust these proxy headers
4. The `express-rate-limit` middleware can't reliably identify client IPs

## ✅ SOLUTION IMPLEMENTED

### 1. **Proxy Trust Configuration Added**
```javascript
// Configure Express to trust proxy headers when deployed behind a proxy
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1); // Trust first proxy
  logger.info('🔒 Proxy trust enabled for production deployment');
} else if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
  logger.info(`🔒 Proxy trust configured: ${process.env.TRUST_PROXY}`);
}
```

### 2. **Enhanced Rate Limiter Configuration**
```javascript
const limiter = rateLimit({
  // ... existing config ...
  skip: (req) => {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
      return true;
    }
    return false;
  },
  keyGenerator: (req) => {
    try {
      return req.ip || req.connection?.remoteAddress || 'unknown';
    } catch (error) {
      logger.warn('Rate limiter key generation failed, using fallback', { error: error.message });
      return 'fallback-key';
    }
  }
});
```

### 3. **Enhanced Request Logging**
- Added detailed proxy header logging
- IP address debugging information
- Proxy configuration verification

## 🔧 Environment Configuration

Add these variables to your `.env` file:

### **For Production Deployment (Render, Heroku, etc.):**
```bash
TRUST_PROXY=true
NODE_ENV=production
```

### **For Local Development:**
```bash
TRUST_PROXY=false
NODE_ENV=development
DEBUG_PROXY=true  # Optional: enables detailed proxy debugging
```

### **For Development with Rate Limit Bypass:**
```bash
SKIP_RATE_LIMIT=true
NODE_ENV=development
```

## 🌐 Platform-Specific Configurations

### **Render.com**
```bash
TRUST_PROXY=true
NODE_ENV=production
```

### **Heroku**
```bash
TRUST_PROXY=true
NODE_ENV=production
```

### **Railway**
```bash
TRUST_PROXY=true
NODE_ENV=production
```

### **Local Development with Nginx Proxy**
```bash
TRUST_PROXY=1
DEBUG_PROXY=true
```

## 🔍 Debugging Proxy Issues

Enable detailed proxy debugging:
```bash
DEBUG_PROXY=true
LOG_LEVEL=debug
```

This will log:
- Trust proxy configuration
- All proxy headers (X-Forwarded-For, X-Real-IP, etc.)
- IP address resolution details
- Rate limiter key generation

## 📋 Testing the Fix

### 1. **Check Trust Proxy Status**
Look for this log message on startup:
```
🔒 Proxy trust enabled for production deployment
```

### 2. **Verify IP Detection**
Make a request and check logs for:
```json
{
  "ip": "1.2.3.4",
  "ips": ["1.2.3.4", "10.0.0.1"],
  "xForwardedFor": "1.2.3.4, 10.0.0.1"
}
```

### 3. **Test Rate Limiting**
The error should no longer occur, and rate limiting should work correctly.

## 🚨 Troubleshooting

### **If Error Persists:**

1. **Verify Environment Variables:**
   ```bash
   echo $TRUST_PROXY
   echo $NODE_ENV
   ```

2. **Check Express Trust Proxy Setting:**
   - Look for the log message: `🔒 Proxy trust enabled`
   - If not present, the environment variable isn't being read

3. **Enable Debug Logging:**
   ```bash
   DEBUG_PROXY=true
   LOG_LEVEL=debug
   ```

4. **Bypass Rate Limiting Temporarily:**
   ```bash
   SKIP_RATE_LIMIT=true
   ```

### **Alternative Trust Proxy Configurations:**

```javascript
// Trust all proxies (not recommended for production)
app.set('trust proxy', true);

// Trust specific proxy IP
app.set('trust proxy', '127.0.0.1');

// Trust proxy subnet
app.set('trust proxy', 'loopback, 10.0.0.0/8');

// Custom function
app.set('trust proxy', (ip) => {
  return ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
});
```

## ✅ Status: FIXED

The API now properly handles proxy deployments and should no longer throw the `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` error when creating orders.

**Files Modified:**
- `server.js` - Added proxy trust configuration
- `.env.example` - Updated with proxy configuration options

**Environment Variables Added:**
- `TRUST_PROXY` - Controls proxy trust behavior
- `SKIP_RATE_LIMIT` - Bypass rate limiting in development
- `DEBUG_PROXY` - Enable detailed proxy debugging