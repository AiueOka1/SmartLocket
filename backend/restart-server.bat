@echo off
echo ==========================================
echo   RESTARTING NFCCHAIN BACKEND SERVER
echo ==========================================
echo.

REM Kill any existing Node.js processes running server.js
echo Stopping existing server...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting backend server...
cd /d "%~dp0"
start "NFCchain Backend" cmd /k "node server.js"

echo.
echo ==========================================
echo   Backend server restarted!
echo   Running on http://localhost:3000
echo ==========================================
echo.
echo Press any key to close this window...
pause >nul
