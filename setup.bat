@echo off
echo =========================================
echo Setting up Winky Playwright Scraper
echo =========================================
echo.

echo [1/2] Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error installing dependencies.
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo [2/2] Installing Playwright Chromium browser...
call npx playwright install chromium
if %ERRORLEVEL% NEQ 0 (
    echo Error installing Playwright browsers.
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo =========================================
echo Setup completed successfully!
echo You can now run the scraper using: npm run dev
echo =========================================
pause
