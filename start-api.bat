@echo off
echo Starting Order Gateway API...
echo ================================

echo Checking Node.js version...
node --version

echo.
echo Starting server on port 3000...
echo Access API at: http://localhost:3000/api
echo Health check at: http://localhost:3000/health
echo.

node server.js

pause