@echo off
echo [CutGuard AI] Starting Mock FFmpeg Transcoding Worker on port 4001...
cd /d "%~dp0mock-pipeline"
node worker.js
pause
