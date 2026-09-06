@echo off
echo [CutGuard AI] Starting Next.js Incident Control Center Dashboard on port 3000...
cd /d "%~dp0dashboard"
call npm.cmd run dev
pause
