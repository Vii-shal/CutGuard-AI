@echo off
echo ================================================================
echo           CUTGUARD AI — SRE INCIDENT REMEDIATION SYSTEM
echo ================================================================
echo.
echo Launching services concurrently in separate terminal windows:
echo   1. Mock Media Pipeline Worker (Port 4001)
echo   2. Python SRE Agent & LangGraph API (Port 8000)
echo   3. Next.js Incident Control Center Dashboard (Port 3000)
echo.

start "CutGuard - Mock Pipeline (4001)" cmd /k "%~dp0run-pipeline.bat"
timeout /t 2 >nul
start "CutGuard - SRE Agent (8000)" cmd /k "%~dp0run-agent.bat"
timeout /t 2 >nul
start "CutGuard - Dashboard (3000)" cmd /k "%~dp0run-dashboard.bat"

echo.
echo All CutGuard AI services launched!
echo Open dashboard in your browser: http://localhost:3000
echo.
pause
