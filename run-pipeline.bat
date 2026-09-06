@echo off
echo [CutGuard AI] Starting Production-Grade Video Transcoder Service (TypeScript + tsx watch) on port 4001...
cd /d "%~dp0mock-pipeline"
call npm.cmd run dev
pause
