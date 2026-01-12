@echo off
REM Start Lee's Archives Extension Server
REM This script starts the Vite dev server in a minimized window

cd /d "%~dp0"
start /min "Lee's Archives Extension" cmd /c "npm run dev"

echo Extension server started!
echo Access at: http://localhost:5173/manifest.json
timeout /t 3
