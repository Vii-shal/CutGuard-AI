@echo off
echo [CutGuard AI] Starting FastAPI SRE Agent & LangGraph Server on port 8000...
cd /d "%~dp0sre-agent"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" server.py
) else (
    python server.py
)
pause
