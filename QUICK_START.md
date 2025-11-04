QUICK START GUIDE - Order Gateway API
=====================================

Hey! Here's how to get the API running on your machine in about 5 minutes.

WHAT YOU NEED
-------------
- Node.js (version 16 or later)
- Any text editor
- Command prompt or PowerShell

SETUP STEPS
-----------
1. Extract the API.zip file
2. Open command prompt in the API folder
3. Run: npm install
4. Run: npm run db:migrate
5. Run: npm start

That's it! The API will be running at http://localhost:3000

PRODUCTION API: https://ordergatewayapi.onrender.com

QUICK TEST
----------
Local development:
http://localhost:3000/health

Production:
https://ordergatewayapi.onrender.com/health

You should see: {"status": "ok", "database": "connected"}

API ENDPOINTS
=============

Base URL: 
- Development: http://localhost:3000/api/v1
- Production: https://ordergatewayapi.onrender.com/api/v1

Authentication: Add header "X-API-Key: pos-mobile-app-key" to all requests

CREATE ORDER (POST /orders)
---------------------------
curl -X POST http://localhost:3000/api/v1/orders \
-H "Content-Type: application/json" \
-H "X-API-Key: pos-mobile-app-key" \
-H "X-Idempotency-Key: test-123" \
-d @tests/sample-order.json

GET ORDER (GET /orders/{orderId})
--------------------------------
curl -H "X-API-Key: pos-mobile-app-key" \
http://localhost:3000/api/v1/orders/ORD-20241008-001

ORDER STATUS (GET /orders/{orderId}/status)
-------------------------------------------
curl -H "X-API-Key: pos-mobile-app-key" \
http://localhost:3000/api/v1/orders/ORD-20241008-001/status

UPDATE ORDER STATUS (PUT /orders/{orderId})
-------------------------------------------
curl -X PUT http://localhost:3000/api/v1/orders/ORD-20241008-001 \
-H "Content-Type: application/json" \
-H "X-API-Key: sync-agent-key" \
-d '{"status": "preparing", "estimatedTime": "2024-10-08T15:00:00Z"}'

GET MENU (GET /menu)
-------------------
curl -H "X-API-Key: pos-mobile-app-key" \
http://localhost:3000/api/v1/menu?restaurantId=NYC-DELI-001

API KEYS
========
- pos-mobile-app-key: For mobile apps (create orders, read data)
- pos-website-key: For websites (same permissions as mobile)
- pos-admin-key: Full admin access (list all orders)
- sync-agent-key: For POS integration (update order status)

TESTING WITH POSTMAN
====================
1. Import the collection from tests/postman-collection.json
2. Set environment variable "baseUrl" to http://localhost:3000
3. Run the "Create Order" request first
4. Then try "Get Order Status" and other requests

SAMPLE ORDER DATA
=================
Check tests/sample-order.json for a complete order example.
You can modify the customer info, items, and prices as needed.

ORDER STATUS FLOW
==================
received → preparing → ready → completed
You can also cancel orders at any point before completion.

TROUBLESHOOTING
===============

API won't start?
- Check if port 3000 is free: netstat -an | findstr :3000
- Make sure you ran "npm install" first

Database errors?
- Run: npm run db:migrate
- Check if database/ folder exists

Can't create orders?
- Verify you're using the correct API key header
- Check JSON format in your request body
- Make sure Content-Type is application/json

Getting 429 errors?
- You're hitting rate limits (15 requests per minute)
- Wait a minute and try again

WINDOWS BATCH FILES
===================
For convenience, you can use:
- start-api.bat: Starts the API server
- demo-api.ps1: PowerShell demo script

CONFIGURATION
=============
The API uses SQLite by default (no setup needed).
For production, switch to PostgreSQL by editing src/config/database.js

Environment variables (optional):
- PORT: Server port (default: 3000)
- NODE_ENV: Environment (development/production)

LOGS
====
Check logs/ folder for:
- combined.log: All API activity
- error.log: Error details

That's all you need to get started! The API is designed to be simple and straightforward.

Questions? Check the README.md or contact the dev team.