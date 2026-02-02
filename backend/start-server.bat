@echo off
cd /d "%~dp0"
echo Starting NFCchain Backend Server...
echo Current directory: %cd%
echo.
echo Server will run on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
node server.js
