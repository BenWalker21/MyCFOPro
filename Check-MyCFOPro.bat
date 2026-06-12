@echo off
title MyCFOPro Diagnostics
cd /d "%~dp0"

echo.
echo === MyCFOPro / CashQueue diagnostics ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [FAIL] Node.js not installed. Get it from https://nodejs.org
  pause
  exit /b 1
)

echo [OK] Node:
node -v
echo.

if not exist "collections\app\index.html" (
  echo [FAIL] CashQueue app missing: collections\app\index.html
  echo        Run: git pull origin main
  echo.
  set MISSING=1
) else (
  echo [OK] collections\app\index.html
)

if not exist "cashqueue\routes.mjs" (
  echo [FAIL] CashQueue server code missing: cashqueue\routes.mjs
  echo        Run: git pull origin main
  echo.
  set MISSING=1
) else (
  echo [OK] cashqueue\routes.mjs
)

echo.
echo --- Syntax check ---
node --check server.mjs
if errorlevel 1 (
  echo [FAIL] server.mjs has errors
  pause
  exit /b 1
)
echo [OK] server.mjs syntax

echo.
echo --- Port 3000 ---
netstat -ano | findstr :3000
if errorlevel 1 (
  echo [INFO] Nothing listening on port 3000 — server is NOT running.
  echo        Double-click Open MyCFOPro.bat to start it.
) else (
  echo [INFO] Something is using port 3000 ^(see above^).
  echo        If the app fails, close ALL MyCFOPro windows and try again.
)

echo.
echo --- HTTP test ^(only works if server is running^) ---
node scripts/doctor.mjs 2>nul
if errorlevel 1 (
  echo Run: node scripts/doctor.mjs
)

echo.
echo CashQueue URL: http://127.0.0.1:3000/collections/app/
echo.
pause
