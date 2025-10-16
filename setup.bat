@echo off
echo ==============================
echo API Setup Verification
echo ==============================
echo.

echo Checking Node.js installation...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)
echo ✓ Node.js found
echo.

echo Checking npm...
npm --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm not found!
    pause
    exit /b 1
)
echo ✓ npm found
echo.

echo Checking package.json...
if not exist "package.json" (
    echo ERROR: package.json not found! Make sure you're in the API folder.
    pause
    exit /b 1
)
echo ✓ package.json found
echo.

echo Installing dependencies...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo Setting up database...
npm run db:migrate
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Database setup failed!
    pause
    exit /b 1
)
echo ✓ Database ready
echo.

echo ==============================
echo Setup complete!
echo You can now run: npm start
echo ==============================
pause