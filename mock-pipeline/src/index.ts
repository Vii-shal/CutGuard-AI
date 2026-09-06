/**
 * CutGuard AI - Mock Video Transcoder Service Entrypoint
 * TypeScript + Express application with Swagger OpenAPI docs and interactive console.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';

import { baseLogger, logPipelineEvent } from './logger';
import { pipelineRouter } from './routes/pipeline';
import { chaosRouter, getActiveChaosScenario, getActiveIncident } from './routes/chaos';
import { rcaRouter } from './routes/rca';
import { playerRouter } from './routes/player';
import { setupSwagger } from './swagger';

const app = express();
const PORT = process.env.PORT || 4001;

// Middlewares
app.use(cors());
app.use(express.json());

// Enterprise Swagger UI & Raw Spec Mount
setupSwagger(app);

// Mount API route modules
app.use('/api', pipelineRouter);
app.use('/', pipelineRouter); // Also mount /health directly
app.use('/api/chaos', chaosRouter);
app.use('/api', rcaRouter);
app.use('/', playerRouter); // Mount GET /player visualizer

// Interactive Landing Page UI at GET /
app.get('/', (req: Request, res: Response) => {
  // If request specifically asks for JSON, respond with styled JSON
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      service: 'CutGuard AI Mock Video Transcoder Worker',
      version: '2.0.0',
      status: 'ONLINE',
      port: PORT,
      docsUrl: `http://localhost:${PORT}/docs`,
      playerUrl: `http://localhost:${PORT}/player`,
      endpoints: {
        playerVisualizer: `GET /player`,
        health: `GET /health`,
        transcode: `POST /api/transcode`,
        jobs: `GET /api/jobs`,
        logs: `GET /api/logs?limit=50`,
        chaosInject: `POST /api/chaos/inject`,
        chaosReset: `POST /api/chaos/reset`,
        chaosStatus: `GET /api/chaos/status`,
        enterpriseRCA: `GET /api/enterprise/rca/:incidentId`,
        patchApply: `POST /api/patch/apply`
      },
      chaosState: {
        activeScenario: getActiveChaosScenario(),
        activeIncident: getActiveIncident()
      }
    });
  }

  // Interactive HTML Console UI
  const currentScenario = getActiveChaosScenario();
  const activeInc = getActiveIncident();

  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CutGuard AI — Mock Transcoding Service</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #030712; font-family: ui-sans-serif, system-ui, sans-serif; }
  </style>
</head>
<body class="text-slate-200 min-h-screen p-6 md:p-12">
  <div class="max-w-5xl mx-auto space-y-8">
    
    <!-- Top Header -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-cyan-500/20">
            CG
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              CUTGUARD AI <span class="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">MOCK PIPELINE v2.0</span>
            </h1>
            <p class="text-xs text-slate-400 font-medium">Distributed Cloud FFmpeg Transcoding Worker Service (Port ${PORT})</p>
          </div>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <a href="/player" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-600/20 flex items-center gap-1.5">
          <span>▶ Watch Stream Player</span>
          <span>&nearr;</span>
        </a>
        <a href="/docs" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5">
          <span>Explore OpenAPI / Swagger</span>
          <span>&rarr;</span>
        </a>
      </div>
    </div>

    <!-- Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Worker Status</span>
        <div class="flex items-center space-x-2 mt-1">
          <span class="w-2.5 h-2.5 rounded-full ${currentScenario === 'NONE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'}"></span>
          <span class="text-base font-bold text-white">${currentScenario === 'NONE' ? 'HEALTHY (16 Cores)' : 'CRASHED / DEGRADED'}</span>
        </div>
        <p class="text-xs text-slate-400 mt-2 font-mono">Cluster: gke-us-central1-cinema</p>
      </div>

      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Chaos Injection State</span>
        <div class="text-base font-bold ${currentScenario === 'NONE' ? 'text-slate-300' : 'text-rose-400'} mt-1 font-mono">
          ${currentScenario}
        </div>
        <p class="text-xs text-slate-400 mt-2 font-mono">Target: ${activeInc?.failingFile || 'src/transcoder/ffmpegArgs.ts'}</p>
      </div>

      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Telemetry Ingestion</span>
        <div class="text-base font-bold text-cyan-400 mt-1 font-mono">
          Pino + Loki Ready
        </div>
        <p class="text-xs text-slate-400 mt-2">Buffer: In-memory 500 lines</p>
      </div>
    </div>

    <!-- Interactive Chaos Triggers -->
    <div class="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
      <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
        <span class="text-rose-400">&bull;</span> Interactive Chaos & Scenario Simulator
      </h2>
      <p class="text-xs text-slate-400 leading-relaxed">
        Trigger deliberate FFmpeg encoder failures to test CutGuard AI's autonomous incident triage, blast-radius calculation, and self-healing sandbox patching.
      </p>

      <div class="flex flex-wrap gap-3 pt-2">
        <button onclick="injectChaos('UNSUPPORTED_PIXEL_FORMAT')" class="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20">
          Inject: Unsupported Pixel Format (SIGSEGV 139)
        </button>
        <button onclick="injectChaos('FFMPEG_OOM')" class="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/20">
          Inject: OutOfMemory Bitrate Crash (SIGABRT 137)
        </button>
        <button onclick="injectChaos('SEGMENT_CORRUPTION')" class="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/20">
          Inject: Muxer Segment Corruption
        </button>
        <button onclick="resetChaos()" class="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20">
          Reset to Healthy Mode
        </button>
      </div>

      <div id="chaosFeedback" class="text-xs font-mono text-cyan-300 hidden p-3 rounded-lg bg-slate-950 border border-slate-800"></div>
    </div>

    <!-- Quick API Reference -->
    <div class="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
      <h2 class="text-sm font-bold text-white uppercase tracking-wider">
        Quick Endpoints Reference
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span class="text-emerald-400 font-bold">GET /health</span>
          <a href="/health" target="_blank" class="text-slate-400 hover:text-white underline">Test &nearr;</a>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span class="text-emerald-400 font-bold">GET /api/logs?limit=25</span>
          <a href="/api/logs?limit=25" target="_blank" class="text-slate-400 hover:text-white underline">Test &nearr;</a>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span class="text-emerald-400 font-bold">GET /api/chaos/status</span>
          <a href="/api/chaos/status" target="_blank" class="text-slate-400 hover:text-white underline">Test &nearr;</a>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span class="text-emerald-400 font-bold">GET /docs</span>
          <a href="/docs" class="text-slate-400 hover:text-white underline">Swagger UI &nearr;</a>
        </div>
      </div>
    </div>

  </div>

  <script>
    async function injectChaos(scenario) {
      const fb = document.getElementById('chaosFeedback');
      fb.classList.remove('hidden');
      fb.innerText = 'Triggering ' + scenario + '...';
      try {
        const res = await fetch('/api/chaos/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario })
        });
        const data = await res.json();
        fb.innerText = JSON.stringify(data, null, 2);
        setTimeout(() => location.reload(), 1200);
      } catch (e) {
        fb.innerText = 'Error: ' + e.message;
      }
    }

    async function resetChaos() {
      const fb = document.getElementById('chaosFeedback');
      fb.classList.remove('hidden');
      fb.innerText = 'Resetting pipeline...';
      try {
        const res = await fetch('/api/chaos/reset', { method: 'POST' });
        const data = await res.json();
        fb.innerText = JSON.stringify(data, null, 2);
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        fb.innerText = 'Error: ' + e.message;
      }
    }
  </script>
</body>
</html>`;

  return res.send(html);
});

// Start Express server
if (require.main === module || process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logPipelineEvent({
      level: 'info',
      stage: '[SYSTEM]',
      message: `CutGuard Mock Transcoder Worker running on http://localhost:${PORT} (Swagger: http://localhost:${PORT}/docs)`
    });
  });
}

export default app;
