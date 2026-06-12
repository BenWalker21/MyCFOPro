@echo off
title MyCFOPro
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
)

if not exist "collections\app\index.html" (
  echo.
  echo *** CashQueue files are missing ***
  echo Run this in the project folder:  git pull origin main
  echo.
  echo MyCFOPro homepage may still work, but /collections/app/ will not.
  echo.
  pause
)

echo.
echo Checking server code...
node --check server.mjs
if errorlevel 1 (
  echo.
  echo Server failed syntax check. Run Check-MyCFOPro.bat for details.
  pause
  exit /b 1
)

echo.
echo Starting server...
echo   Homepage:  http://127.0.0.1:3000/
echo   CashQueue: http://127.0.0.1:3000/collections/app/
echo.
echo KEEP THIS WINDOW OPEN. Close it to stop the server.
echo If the browser shows "connection reset", read the messages below.
echo.

set OPEN_BROWSER=0
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:3000/collections/app/"

npm start
if errorlevel 1 (
  echo.
  echo Server exited with an error. Common fixes:
  echo   1. Port 3000 in use — close other MyCFOPro windows
  echo   2. Missing files — run: git pull origin main
  echo   3. Run Check-MyCFOPro.bat for full diagnostics
  echo.
)

pause
