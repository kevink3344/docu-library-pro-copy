@echo off
echo ============================================
echo  Docu-Library Pro - Starting Dev Environment
echo ============================================
echo.

:: Kill any existing processes on ports 3001 and 5173
echo [1/3] Cleaning up stale processes on ports 3001 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo  Done.

:: Start both backend and frontend
echo [2/3] Starting backend (port 3001) and frontend (port 5173)...
echo.
npm run dev