/**
 * CutGuard AI - Interactive Video Stream Visualizer Route
 * Serves GET /player with a lightweight, dark-themed HTML/JS video stream player.
 */

import { Router, Request, Response } from 'express';
import { getActiveChaosScenario, getActiveIncident } from './chaos';

export const playerRouter = Router();

/**
 * @openapi
 * /player:
 *   get:
 *     summary: Interactive Video Stream Visualizer
 *     description: Real-time dark-themed player displaying simulated transcode chunk progress, healthy 60 FPS animation, or degraded static fuzz with FFmpeg crash alert banner.
 *     tags: [Core Pipeline]
 *     responses:
 *       200:
 *         description: Interactive HTML video visualizer page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
playerRouter.get('/player', (req: Request, res: Response) => {
  const activeScenario = getActiveChaosScenario();
  const activeIncident = getActiveIncident();
  const isCrashed = activeScenario !== 'NONE';
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CutGuard AI — Cinema Stream Player (Port 4001)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background-color: #030712;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .scanlines {
      background: linear-gradient(
        rgba(18, 16, 16, 0) 50%, 
        rgba(0, 0, 0, 0.4) 50%
      ), linear-gradient(
        90deg,
        rgba(255, 0, 0, 0.05),
        rgba(0, 255, 0, 0.02),
        rgba(0, 0, 255, 0.05)
      );
      background-size: 100% 4px, 6px 100%;
      pointer-events: none;
    }
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 0.3; }
    }
    .glow-alert {
      animation: pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  </style>
</head>
<body class="text-slate-200 min-h-screen p-4 md:p-8 flex flex-col justify-between">
  
  <div class="max-w-6xl w-full mx-auto space-y-6">
    
    <!-- Top Nav Header -->
    <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-cyan-500/20">
          ▶
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-xl font-black tracking-tight text-white flex items-center gap-2">
              CUTGUARD AI <span class="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">STREAM PLAYER</span>
            </h1>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              PORT 4001
            </span>
          </div>
          <p class="text-xs text-slate-400 font-medium">Production Cloud FFmpeg Transcoder Simulation Visualizer</p>
        </div>
      </div>

      <div class="flex items-center flex-wrap gap-2.5">
        <a href="${dashboardUrl}" target="_blank" class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25 flex items-center gap-1.5">
          <span>Mission Control Dashboard</span>
          <span>&nearr;</span>
        </a>
        <a href="/docs" target="_blank" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5">
          <span>OpenAPI / Swagger</span>
          <span>&nearr;</span>
        </a>
        <a href="/health" target="_blank" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono transition border border-slate-800">
          /health
        </a>
      </div>
    </header>

    <!-- Main Player Canvas Section -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Video Player Container (8 cols) -->
      <div class="lg:col-span-8 space-y-3">
        <div class="relative aspect-video w-full rounded-2xl bg-black border border-slate-800 shadow-2xl overflow-hidden group">
          
          <!-- Live Canvas Surface -->
          <canvas id="playerCanvas" width="960" height="540" class="w-full h-full object-cover block"></canvas>
          
          <!-- Scanline overlay for CRT cinema feel -->
          <div class="scanlines absolute inset-0"></div>

          <!-- Top Status Bar Overlay inside Player -->
          <div class="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            <div id="statusBadge" class="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-md transition-colors ${
              isCrashed 
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-950'
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950'
            }">
              <span id="statusDot" class="w-2 h-2 rounded-full ${isCrashed ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}"></span>
              <span id="statusText">${isCrashed ? 'PIPELINE CRASHED: 0 FPS' : 'ENCODING NOMINAL: 60 FPS'}</span>
            </div>

            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-950/80 border border-slate-800 text-slate-300 backdrop-blur-md">
                1080p60 • libx264
              </span>
              <span id="bitrateBadge" class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-950/80 border border-slate-800 text-cyan-400 backdrop-blur-md">
                ${isCrashed ? '0 kbps' : '8,450 kbps'}
              </span>
            </div>
          </div>

          <!-- Degraded / Crashed Alert Banner Overlay -->
          <div id="crashedOverlay" class="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-sm transition-all duration-300 ${isCrashed ? 'flex' : 'hidden'}">
            <div class="max-w-md w-full bg-slate-950/95 border border-rose-500/60 rounded-xl p-6 shadow-2xl text-center space-y-4 glow-alert">
              <div class="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center text-2xl font-bold shadow-lg shadow-rose-950">
                ⚠
              </div>

              <div class="space-y-1.5">
                <span class="text-[10px] font-mono font-bold tracking-widest text-rose-400 uppercase bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                  CRITICAL WORKER PROCESS CRASH
                </span>
                <h2 id="crashTitle" class="text-lg font-bold text-white tracking-tight">
                  Fatal FFmpeg Process Error (Exit Code 139 - SIGSEGV)
                </h2>
                <p id="crashDetail" class="text-xs text-slate-300 font-mono leading-relaxed max-w-sm mx-auto">
                  Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139).
                </p>
              </div>

              <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span class="text-slate-400 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  CutGuard SRE Agent Dispatched
                </span>
                <a href="${dashboardUrl}" target="_blank" class="text-cyan-400 hover:text-cyan-300 font-bold underline">
                  View Triage on Dashboard &rarr;
                </a>
              </div>
            </div>
          </div>

          <!-- Bottom Timecode Overlay -->
          <div class="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-400 pointer-events-none">
            <span id="timecodeDisplay">TC 00:04:12:30</span>
            <span id="bufferDisplay">BUFFER: ${isCrashed ? 'STARVED (0.0s)' : 'OPTIMAL (12.4s)'}</span>
          </div>

        </div>

        <!-- Quick Platform Control Action Bar -->
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center space-x-2">
            <!-- Requirement 1 Quick-action button: Simulate Corrupt Stream Payload -->
            <button 
              id="btnInjectChaos" 
              onclick="injectCorruptPayload()" 
              class="px-4 py-2.5 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-rose-600/25 active:scale-95 transition"
            >
              <span class="text-base">⚡</span>
              <span>Simulate Corrupt Stream Payload</span>
            </button>

            <!-- Reset Button -->
            <button 
              id="btnResetChaos" 
              onclick="resetToHealthy()" 
              class="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
            >
              <span>↺</span>
              <span>Reset Stream</span>
            </button>
          </div>

          <div id="actionStatusMsg" class="text-xs font-mono text-slate-400">
            Platform Ready • Stream healthy
          </div>
        </div>

      </div>

      <!-- Live Transcode Chunk Feed (4 cols) -->
      <div class="lg:col-span-4 space-y-3">
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span class="text-xs font-bold text-white uppercase tracking-wider">HLS Transcode Chunks</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Segment Size: 2.0s</span>
        </div>

        <div class="h-[460px] rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-xs overflow-y-auto flex flex-col space-y-2 shadow-inner" id="chunkLogs">
          <!-- Populated dynamically via JS -->
        </div>
      </div>

    </div>

  </div>

  <!-- Footer -->
  <footer class="max-w-6xl w-full mx-auto border-t border-slate-900 pt-4 mt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
    <div>
      CutGuard AI Media Transcoding Service • Port 4001
    </div>
    <div class="flex items-center space-x-4">
      <span>GKE Worker Node Pool</span>
      <span>•</span>
      <span>FFmpeg 6.1.1</span>
      <span>•</span>
      <span>Active Autonomous Healing</span>
    </div>
  </footer>

  <script>
    // Visualizer State
    let isCrashed = ${isCrashed};
    let chunkCounter = 1;
    let frameNumber = 0;
    let audioBars = new Array(24).fill(10);
    const canvas = document.getElementById('playerCanvas');
    const ctx = canvas.getContext('2d');

    const statusBadge = document.getElementById('statusBadge');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const bitrateBadge = document.getElementById('bitrateBadge');
    const crashedOverlay = document.getElementById('crashedOverlay');
    const crashTitle = document.getElementById('crashTitle');
    const crashDetail = document.getElementById('crashDetail');
    const timecodeDisplay = document.getElementById('timecodeDisplay');
    const bufferDisplay = document.getElementById('bufferDisplay');
    const chunkLogs = document.getElementById('chunkLogs');
    const actionStatusMsg = document.getElementById('actionStatusMsg');

    // Add initial chunk logs
    function addChunkLog(msg, type = 'ok') {
      const line = document.createElement('div');
      const time = new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0');
      line.className = 'p-2 rounded border text-[11px] leading-relaxed transition-all ' + (
        type === 'error'
          ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          : type === 'warn'
          ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
          : type === 'healed'
          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
          : 'bg-slate-900/60 border-slate-800 text-slate-300'
      );
      line.innerHTML = '<span class="text-slate-500">[' + time + ']</span> ' + msg;
      chunkLogs.prepend(line);

      // Cap at 30 items
      if (chunkLogs.children.length > 30) {
        chunkLogs.removeChild(chunkLogs.lastChild);
      }
    }

    // Pre-populate some history
    for (let i = 1; i <= 4; i++) {
      addChunkLog('Chunk 1080p_00' + i + '.ts OK (60 frames, 4.1 MB, 18ms)');
      chunkCounter = 5;
    }

    // Draw Healthy Visualizer Animation
    function drawHealthyScene() {
      frameNumber++;
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dynamic animated radiant backdrop gradient
      const time = Date.now() * 0.001;
      const grad = ctx.createRadialGradient(
        canvas.width / 2 + Math.cos(time) * 120,
        canvas.height / 2 + Math.sin(time) * 80,
        40,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 1.5
      );
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render stylized audio spectrum analyzer
      const barCount = 28;
      const barWidth = 14;
      const gap = 12;
      const totalWidth = (barWidth + gap) * barCount;
      const startX = (canvas.width - totalWidth) / 2;
      const baseY = canvas.height - 100;

      for (let i = 0; i < barCount; i++) {
        // Compute procedural height
        const target = Math.sin(time * 3 + i * 0.4) * 45 + Math.cos(time * 2 - i * 0.2) * 35 + 85;
        const currentH = Math.max(12, target);

        // Bar gradient
        const barGrad = ctx.createLinearGradient(0, baseY, 0, baseY - currentH);
        barGrad.addColorStop(0, '#06b6d4');
        barGrad.addColorStop(0.7, '#6366f1');
        barGrad.addColorStop(1, '#a855f7');

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(startX + i * (barWidth + gap), baseY - currentH, barWidth, currentH, [4, 4, 0, 0]);
        ctx.fill();
      }

      // Render cinema stream title in center
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('CUTGUARD CINEMA MASTER ENCODE', canvas.width / 2, 180);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('SOURCE: 4K PRORES 422 HQ ➔ TARGET: 1080p60 H.264 HIGH PROFILE', canvas.width / 2, 210);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('FRAME: #' + (frameNumber * 2) + '  |  COLOR: YUV420P  |  60.00 FPS', canvas.width / 2, 235);

      // Timecode
      const sec = Math.floor(frameNumber / 30);
      const frames = frameNumber % 30;
      const tc = 'TC 00:' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0') + ':' + String(frames).padStart(2, '0');
      timecodeDisplay.innerText = tc;
      bufferDisplay.innerText = 'BUFFER: OPTIMAL (12.4s)';
    }

    // Draw Degraded / Crashed TV Noise Static Fuzz
    function drawCrashedStatic() {
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);
      const buffer = new Uint32Array(imgData.data.buffer);
      const len = buffer.length;

      for (let i = 0; i < len; i++) {
        // High-contrast TV static fuzz
        const shade = Math.random() < 0.5 ? (Math.random() * 80) : (Math.random() * 210);
        buffer[i] = (255 << 24) | (shade << 16) | (shade << 8) | shade;
      }
      ctx.putImageData(imgData, 0, 0);

      // Draw subtle horizontal glitch bands
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      const glitchY = Math.random() * h;
      ctx.fillRect(0, glitchY, w, 20 + Math.random() * 40);

      timecodeDisplay.innerText = 'TC --:--:--:-- [FROZEN]';
      bufferDisplay.innerText = 'BUFFER: STARVED (0.0s)';
    }

    // Main 60 FPS Render Loop
    function renderLoop() {
      if (isCrashed) {
        drawCrashedStatic();
      } else {
        drawHealthyScene();
      }
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

    // Periodic chunk generator when healthy
    setInterval(() => {
      if (!isCrashed) {
        const idStr = String(chunkCounter++).padStart(3, '0');
        const sizeMb = (4.0 + Math.random() * 0.4).toFixed(1);
        const lat = Math.floor(15 + Math.random() * 6);
        addChunkLog('Chunk 1080p_' + idStr + '.ts OK (60 frames, ' + sizeMb + ' MB, ' + lat + 'ms)');
      }
    }, 1600);

    // Synchronize UI elements with current crash state
    function updatePlayerState(crashed, incidentData) {
      const wasCrashed = isCrashed;
      isCrashed = crashed;

      if (isCrashed) {
        crashedOverlay.classList.remove('hidden');
        crashedOverlay.classList.add('flex');
        statusBadge.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-md transition-colors bg-rose-950/80 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-950';
        statusDot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-ping';
        statusText.innerText = 'PIPELINE CRASHED: 0 FPS';
        bitrateBadge.innerText = '0 kbps';
        bitrateBadge.className = 'px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-950/80 border border-slate-800 text-rose-400 backdrop-blur-md';

        if (incidentData) {
          crashTitle.innerText = 'Fatal FFmpeg Process Error (Exit Code ' + (incidentData.exitCode || 139) + ' - ' + (incidentData.signal || 'SIGSEGV') + ')';
          crashDetail.innerText = incidentData.errorSignature || "Process killed with SIGSEGV. Invalid pixel format 'yuv422p10le' for libx264.";
        }

        if (!wasCrashed) {
          const idStr = String(chunkCounter).padStart(3, '0');
          addChunkLog('Chunk 1080p_' + idStr + '.ts [FATAL ERROR]: FFmpeg killed with SIGSEGV (Exit 139)', 'error');
          addChunkLog('Telemetry webhook dispatched to CutGuard SRE Agent (:8000)...', 'warn');
          addChunkLog('Master playlist stalled. Transcoder buffer starved.', 'error');
        }
      } else {
        crashedOverlay.classList.add('hidden');
        crashedOverlay.classList.remove('flex');
        statusBadge.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-md transition-colors bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950';
        statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        statusText.innerText = 'ENCODING NOMINAL: 60 FPS';
        bitrateBadge.innerText = '8,450 kbps';
        bitrateBadge.className = 'px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-950/80 border border-slate-800 text-cyan-400 backdrop-blur-md';

        if (wasCrashed) {
          addChunkLog('Autonomous Patch Applied! Pipeline normalized to HEALTHY.', 'healed');
          addChunkLog('Zero-regression hot-reload verified (100% test pass). Resuming transcode stream...', 'healed');
        }
      }
    }

    // Requirement 1 & 2: Quick-action button: Simulate Corrupt Stream Payload
    async function injectCorruptPayload() {
      actionStatusMsg.innerText = 'Injecting corrupt stream payload...';
      try {
        const res = await fetch('/api/chaos/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            scenario: 'UNSUPPORTED_PIXEL_FORMAT',
            targetWorker: 'worker-transcode-04',
            severity: 'CRITICAL'
          })
        });
        const data = await res.json();
        actionStatusMsg.innerText = 'Corrupt payload injected! Webhook dispatched to CutGuard SRE (:8000)';
        updatePlayerState(true, data.activeIncident);
      } catch (err) {
        actionStatusMsg.innerText = 'Error injecting chaos: ' + err.message;
      }
    }

    // Reset to healthy stream
    async function resetToHealthy() {
      actionStatusMsg.innerText = 'Resetting video stream...';
      try {
        const res = await fetch('/api/chaos/reset', { method: 'POST' });
        const data = await res.json();
        actionStatusMsg.innerText = 'Stream reset to nominal.';
        updatePlayerState(false, null);
      } catch (err) {
        actionStatusMsg.innerText = 'Error resetting: ' + err.message;
      }
    }

    // Periodic poller: Synchronize status with /api/chaos/status
    // This allows the player to automatically heal when SRE approves fix on Port 3000!
    setInterval(async () => {
      try {
        const res = await fetch('/api/chaos/status', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const serverCrashed = data.isCrashed || (data.status === 'CRASHED');
          if (serverCrashed !== isCrashed) {
            updatePlayerState(serverCrashed, data.activeIncident);
          }
        }
      } catch (e) {
        // Pipeline might be briefly reloading
      }
    }, 1000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});
