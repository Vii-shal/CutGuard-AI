/**
 * CutGuard AI - Chaos Injection & Failure Simulation Routes
 * Simulates real-world video transcoding pipeline crashes.
 */

import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { logPipelineEvent } from '../logger';
import { 
  PIPELINE_CONFIG, 
  ChaosInjectRequestBody, 
  ChaosInjectResponse, 
  ChaosStatusResponse 
} from '../config';

export type ChaosScenario = 'FFMPEG_OOM' | 'UNSUPPORTED_PIXEL_FORMAT' | 'SEGMENT_CORRUPTION' | 'NONE';

export interface IncidentState {
  incidentId: string;
  scenario: ChaosScenario;
  targetWorker?: string;
  severity?: string;
  errorSignature: string;
  timestamp: string;
  failingFile: string;
  affectedPipelineStage: string;
  exitCode: number;
  signal: string;
  status: 'ACTIVE_CRASH' | 'INVESTIGATING' | 'REMEDIATED';
  rawStderr: string;
}

let activeScenario: ChaosScenario = 'NONE';
let activeIncident: IncidentState | null = null;

export function getActiveChaosScenario(): ChaosScenario {
  return activeScenario;
}

export function getActiveIncident(): IncidentState | null {
  return activeIncident;
}

const sseClients: Response[] = [];

export function broadcastChaosSSE(): void {
  const payload = JSON.stringify({
    event: 'chaos_status',
    isCrashed: activeScenario !== 'NONE',
    scenario: activeScenario,
    activeIncident,
    timestamp: new Date().toISOString()
  });

  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

export function resetChaosState(): void {
  activeScenario = 'NONE';
  activeIncident = null;
  broadcastChaosSSE();
}

export const chaosRouter = Router();

/**
 * @openapi
 * /api/chaos/events:
 *   get:
 *     summary: Real-Time Chaos Server-Sent Events (SSE) Stream
 *     description: Streams real-time pipeline crash and recovery events to listening dashboards with zero polling latency.
 *     tags: [Chaos Engineering]
 */
chaosRouter.get('/events', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send current state immediately upon connecting
  res.write(`data: ${JSON.stringify({
    event: 'chaos_status',
    isCrashed: activeScenario !== 'NONE',
    scenario: activeScenario,
    activeIncident,
    timestamp: new Date().toISOString()
  })}\n\n`);

  sseClients.push(res);

  _req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

/**
 * @openapi
 * /api/chaos/inject:
 *   post:
 *     summary: Simulate Corrupt Stream Payload / Chaos Failure
 *     description: Forces the media worker into a crash state, emits structured FFmpeg crash telemetry into cluster streams (/api/logs), and immediately dispatches an incident webhook notification to CutGuard SRE Agent (:8000).
 *     tags: [Chaos Engineering]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenario:
 *                 type: string
 *                 enum: [UNSUPPORTED_PIXEL_FORMAT, FFMPEG_OOM, SEGMENT_CORRUPTION]
 *                 default: UNSUPPORTED_PIXEL_FORMAT
 *                 example: UNSUPPORTED_PIXEL_FORMAT
 *                 description: Simulated failure scenario (defaults to corrupt stream payload UNSUPPORTED_PIXEL_FORMAT)
 *               targetWorker:
 *                 type: string
 *                 default: worker-transcode-04
 *                 example: worker-transcode-04
 *                 description: Identifier of the target transcoder pod
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM]
 *                 default: CRITICAL
 *                 example: CRITICAL
 *                 description: Failure severity level classification
 *     responses:
 *       200:
 *         description: Chaos scenario successfully activated, telemetry logged, and SRE webhook dispatched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: CHAOS_INJECTED
 *                 message:
 *                   type: string
 *                   example: Chaos scenario 'UNSUPPORTED_PIXEL_FORMAT' triggered. Telemetry emitted and SRE Agent webhook dispatched.
 *                 agentDispatched:
 *                   type: boolean
 *                   example: true
 *                 activeIncident:
 *                   type: object
 *       400:
 *         description: Invalid or unsupported chaos scenario specified
 */
let isResetting = false;
let resetLockTimestamp = 0;

/**
 * Restores worker.js from pristine worker.baseline.js and purges Node require cache.
 * Bulletproof against Windows EBUSY file locks with retry loop.
 */
function restoreWorkerFromBaseline(): { success: boolean; error?: string } {
  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), 'mock-pipeline'),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..')
  ];

  let baselinePath = '';
  let targetPath = '';

  for (const dir of candidateDirs) {
    const candidateB = path.resolve(dir, 'worker.baseline.js');
    if (fs.existsSync(candidateB)) {
      baselinePath = candidateB;
      break;
    }
  }

  for (const dir of candidateDirs) {
    const candidateW = path.resolve(dir, 'worker.js');
    if (fs.existsSync(candidateW)) {
      targetPath = candidateW;
      break;
    }
  }

  if (!baselinePath) {
    // If worker.baseline.js not found, attempt to locate in directory of worker.js
    if (targetPath) {
      baselinePath = path.resolve(path.dirname(targetPath), 'worker.baseline.js');
    }
  }

  if (!baselinePath || !fs.existsSync(baselinePath)) {
    return { success: false, error: "worker.baseline.js not found on filesystem." };
  }

  if (!targetPath) {
    targetPath = path.resolve(path.dirname(baselinePath), 'worker.js');
  }

  // 1. Invalidate Node require.cache BEFORE writing to prevent Windows EBUSY file locking
  try {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('worker.js') || key.includes('worker')) {
        delete require.cache[key];
      }
    });
  } catch (_e) {}

  // 2. Synchronous copy with retry loop for Windows file lock resilience
  const maxRetries = 3;
  let copyErr: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const baselineContent = fs.readFileSync(baselinePath, 'utf-8');
      fs.writeFileSync(targetPath, baselineContent, 'utf-8');
      copyErr = null;
      break;
    } catch (err: any) {
      copyErr = err;
      if (attempt < maxRetries) {
        // Synchronous spin-wait (40ms) before retry
        const start = Date.now();
        while (Date.now() - start < 40) {}
      }
    }
  }

  if (copyErr) {
    return { success: false, error: copyErr?.message || String(copyErr) };
  }

  // 3. Purge require.cache again so runtime immediately picks up reverted module
  try {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('worker.js') || key.includes('worker')) {
        delete require.cache[key];
      }
    });
  } catch (_e) {}

  return { success: true };
}

/**
 * Reusable chaos injection handler supporting both /inject and /trigger
 */
async function handleChaosInject(req: Request, res: Response) {
  const reqBody = (req.body && typeof req.body === 'object') ? (req.body as ChaosInjectRequestBody) : {};
  const scenario: ChaosScenario = (reqBody.scenario as ChaosScenario) || (PIPELINE_CONFIG.DEFAULT_CHAOS_SCENARIO as ChaosScenario);
  const targetWorker: string = reqBody.targetWorker || PIPELINE_CONFIG.DEFAULT_TARGET_WORKER;
  const severity: string = reqBody.severity || PIPELINE_CONFIG.DEFAULT_SEVERITY;

  if (!['FFMPEG_OOM', 'UNSUPPORTED_PIXEL_FORMAT', 'SEGMENT_CORRUPTION'].includes(scenario)) {
    return res.status(400).json({
      error: "INVALID_SCENARIO",
      message: "Supported scenarios: 'FFMPEG_OOM', 'UNSUPPORTED_PIXEL_FORMAT', 'SEGMENT_CORRUPTION'"
    });
  }

  activeScenario = scenario;
  const timestamp = new Date().toISOString();
  const randomJobId = `Job-${Math.floor(10000 + Math.random() * 90000)}`;
  const incidentId = `inc-chaos-${Math.floor(10000 + Math.random() * 90000)}`;

  let errorSignature = '';
  let failingFile = PIPELINE_CONFIG.DEFAULT_CULPRIT_FILE;
  let exitCode = 1;
  let signal = 'SIGABRT';
  let stderrLog = '';

  switch (scenario) {
    case 'UNSUPPORTED_PIXEL_FORMAT':
      errorSignature = "Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139)";
      exitCode = 139;
      signal = 'SIGSEGV';
      failingFile = PIPELINE_CONFIG.DEFAULT_CULPRIT_FILE;
      stderrLog = `[ERROR] [FFMPEG_ENCODE] [${randomJobId}] Fatal error: Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139).\n    at processVideoChunk (mock-pipeline/worker.js:35:11)\n    at QueueManager.dispatchChunk (mock-pipeline/queue-manager.js:15:22)`;
      break;

    case 'FFMPEG_OOM':
      errorSignature = "Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)";
      exitCode = 137;
      signal = 'SIGABRT';
      failingFile = PIPELINE_CONFIG.DEFAULT_CULPRIT_FILE;
      stderrLog = `[FATAL] [FFMPEG_ENCODE] [${randomJobId}] CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)\n    at processVideoChunk (mock-pipeline/worker.js:35:11)`;
      break;

    case 'SEGMENT_CORRUPTION':
      errorSignature = "Non-monotonic DTS at muxer boundary. Segment packet header corrupted (Exit 1)";
      exitCode = 1;
      signal = 'SIGTERM';
      failingFile = PIPELINE_CONFIG.DEFAULT_CULPRIT_FILE;
      stderrLog = `[ERROR] [MUXER] [${randomJobId}] Fatal error: Non-monotonic DTS in input stream. Video muxing aborted.\n    at StreamStitcher.stitchStream (mock-pipeline/stream-stitcher.js:12:15)`;
      break;
  }

  // Prime worker.js with unpatched failure state for continuous demo reproducibility
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'worker.js'),
      path.resolve(process.cwd(), 'mock-pipeline', 'worker.js'),
      path.resolve(__dirname, '..', '..', 'worker.js')
    ];
    for (const cp of candidatePaths) {
      if (fs.existsSync(cp)) {
        let content = fs.readFileSync(cp, 'utf-8');
        if (content.includes("DEFAULT_PRESETS['720p_auto']") || content.includes("bitrateProfile")) {
          const bugLines = "  // BUG: Direct property access on undefined chunk.bitrateProfile causes TypeError / SIGABRT 137\n  const targetBitrate = chunk.bitrateProfile.targetBitrate;\n  const resolution = chunk.bitrateProfile.resolution || '1280x720';";
          const replaced = content.replace(
            /\s*(?:\/\/\s*Fallback to 720p_auto profile[^\n]*|const\s+(?:bitrateProfile|profile)\s*=)[\s\S]*?const resolution = [^\n]+;/,
            "\n" + bugLines
          );
          if (replaced !== content) {
            fs.writeFileSync(cp, replaced, 'utf-8');
            break;
          }
        }
      }
    }
  } catch (_e) {
    // Non-fatal
  }

  activeIncident = {
    incidentId,
    scenario,
    targetWorker,
    severity,
    errorSignature,
    timestamp,
    failingFile,
    affectedPipelineStage: scenario === 'SEGMENT_CORRUPTION' ? 'MUXER' : 'FFMPEG_ENCODE',
    exitCode,
    signal,
    status: 'ACTIVE_CRASH',
    rawStderr: stderrLog
  };

  // Automatically emit structured error logs into the in-memory log buffer (/api/logs)
  logPipelineEvent({
    level: scenario === 'FFMPEG_OOM' ? 'fatal' : 'error',
    stage: scenario === 'SEGMENT_CORRUPTION' ? '[MUXER]' : '[FFMPEG_ENCODE]',
    jobId: randomJobId,
    message: stderrLog,
    metadata: {
      incidentId,
      scenario,
      targetWorker,
      severity,
      exitCode,
      signal,
      failingFile
    }
  });

  // Autonomous telemetry webhook: strictly send raw runtime telemetry
  let agentDispatched = false;
  try {
    const agentUrl = PIPELINE_CONFIG.AGENT_URL;
    const webhookRes = await fetch(`${agentUrl}/api/incident/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: incidentId,
        service_name: PIPELINE_CONFIG.SERVICE_NAME,
        timestamp,
        raw_logs: stderrLog
      })
    });
    agentDispatched = webhookRes.ok;
    if (agentDispatched) {
      logPipelineEvent({
        level: 'info',
        stage: '[WEBHOOK]',
        message: `Dispatched incident webhook to CutGuard SRE Agent (${agentUrl}) for ${incidentId}`,
        metadata: { incidentId, agentStatus: webhookRes.status }
      });
    }
  } catch (err: any) {
    console.warn(`[Chaos] Telemetry webhook to SRE Agent notice: ${err?.message || err}`);
  }

  broadcastChaosSSE();

  return res.json({
    status: 'CHAOS_INJECTED',
    message: `Chaos scenario '${scenario}' triggered. Telemetry emitted and SRE Agent webhook dispatched.`,
    agentDispatched,
    activeIncident
  });
}

/**
 * @openapi
 * /api/chaos/inject:
 *   post:
 *     summary: Trigger targeted chaos fault injection
 *     tags: [Chaos Engineering]
 */
chaosRouter.post('/inject', handleChaosInject);

/**
 * @openapi
 * /api/chaos/trigger:
 *   post:
 *     summary: Trigger targeted chaos fault injection (alias)
 *     tags: [Chaos Engineering]
 */
chaosRouter.post('/trigger', handleChaosInject);

/**
 * @openapi
 * /api/chaos/reset:
 *   post:
 *     summary: Reset chaos injection state and revert worker to pristine baseline
 *     description: Clears failure injection, restores worker pool health, and restores worker.js from worker.baseline.js.
 *     tags: [Chaos Engineering]
 *     responses:
 *       200:
 *         description: Pipeline restored to healthy baseline
 *       429:
 *         description: Reset already in progress
 */
chaosRouter.post('/reset', (_req: Request, res: Response) => {
  // Concurrency lock guard: block overlapping calls (auto-expires after 3.5s)
  if (isResetting && Date.now() - resetLockTimestamp < 3500) {
    return res.status(429).json({
      status: "LOCKED",
      error: "RESET_IN_PROGRESS",
      message: "A reset operation is currently executing. Please wait a moment."
    });
  }

  isResetting = true;
  resetLockTimestamp = Date.now();

  try {
    // 1. Revert worker.js to pristine baseline and purge require.cache
    const restoreResult = restoreWorkerFromBaseline();

    // 2. Reset global in-memory chaos state
    resetChaosState();

    // 3. Emit structured observability log
    logPipelineEvent({
      level: 'info',
      stage: '[CHAOS]',
      message: 'Chaos state reset. Baseline worker.js restored and cache purged.'
    });

    // 4. Broadcast normalized status to SSE subscribers
    broadcastChaosSSE();

    return res.json({
      status: "RESET_COMPLETE",
      pipelineStatus: "HEALTHY",
      isCrashed: false,
      activeScenario: "NONE",
      isFailureArmed: false,
      activeIncident: null,
      message: "Worker reverted to clean baseline. Cluster nominal.",
      workerRestored: restoreResult.success,
      details: restoreResult.error || null
    });
  } catch (err: any) {
    console.error(`[Chaos Reset Error] ${err?.message || err}`);
    return res.status(500).json({
      status: "ERROR",
      error: "RESET_FAILED",
      message: err?.message || "Failed to reset worker baseline."
    });
  } finally {
    isResetting = false;
  }
});

/**
 * @openapi
 * /api/chaos/status:
 *   get:
 *     summary: Retrieve chaos and failure status
 *     description: Returns whether failure is currently armed, active scenario, and active incident details.
 *     tags: [Chaos Engineering]
 *     responses:
 *       200:
 *         description: Current chaos state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: HEALTHY
 *                 isCrashed:
 *                   type: boolean
 *                   example: false
 *                 activeScenario:
 *                   type: string
 *                   example: NONE
 *                 isFailureArmed:
 *                   type: boolean
 *                   example: false
 *                 activeIncident:
 *                   type: object
 *                   nullable: true
 */
chaosRouter.get('/status', (_req: Request, res: Response) => {
  const isCrashed = activeScenario !== 'NONE' && activeIncident !== null;
  return res.json({
    status: isCrashed ? 'CRASHED' : 'HEALTHY',
    isCrashed,
    activeScenario,
    isFailureArmed: isCrashed,
    activeIncident
  });
});
