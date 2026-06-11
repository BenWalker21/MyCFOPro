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

echo.
echo Starting MyCFOPro — your browser will open to http://localhost:3000
echo Keep this window open while you use the app. Close it to stop the server.
echo.

npm start
