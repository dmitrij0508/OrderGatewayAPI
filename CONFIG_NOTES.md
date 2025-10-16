API CONFIGURATION NOTES
========================

DATABASE SETUP
---------------
The API uses SQLite by default - no configuration needed.
Database file will be created automatically at: database/pos_gateway.db

ENVIRONMENT VARIABLES
--------------------
Create a .env file in the API root folder if you want to customize:

PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pos_gateway
DB_USER=pos_user
DB_PASSWORD=your_password

API KEYS
--------
Built-in API keys (no configuration needed):
- pos-mobile-app-key: Mobile app access
- pos-website-key: Website access  
- pos-admin-key: Admin access
- sync-agent-key: POS system integration

RATE LIMITING
-------------
Default: 15 requests per minute per IP
Adjust in server.js if needed for testing

CORS SETTINGS
-------------
Default: Allows localhost origins
For production, update ALLOWED_ORIGINS environment variable

LOGGING
-------
Logs are written to:
- logs/combined.log: All requests
- logs/error.log: Errors only

PRODUCTION DEPLOYMENT
--------------------
1. Set NODE_ENV=production
2. Configure PostgreSQL connection
3. Set secure CORS origins
4. Use PM2 or similar for process management
5. Set up reverse proxy (nginx)

TESTING ENDPOINTS
-----------------
Health check: GET /health
API info: GET /api
Orders: GET /api/v1/orders (requires API key)
Menu: GET /api/v1/menu (requires API key)

COMMON ISSUES
-------------
1. Port 3000 in use: Change PORT in .env file
2. Database errors: Run "npm run db:migrate"
3. CORS errors: Add your domain to ALLOWED_ORIGINS
4. Rate limit errors: Wait or adjust limits for testing

The API is configured to work out-of-the-box for development and testing.