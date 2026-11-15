@echo off
title ServFlow Launcher
echo ==================================================
echo           ServFlow Platform Launcher
echo ==================================================
echo 1. Starting PostgreSQL on port 5434...
start "ServFlow PostgreSQL" "C:\Program Files\PostgreSQL\16\bin\postgres.exe" -D "%~dp0pgdata"
ping 127.0.0.1 -n 3 >nul

echo 2. Starting FastAPI Backend on port 8000...
start "ServFlow Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
ping 127.0.0.1 -n 3 >nul

echo 3. Starting Vite Dev Server on port 5173...
start "ServFlow Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo All services launched!
echo URL: http://localhost:5173
echo.

