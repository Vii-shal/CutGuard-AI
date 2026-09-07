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
chaosRouter.post('/inject', async (req: Request, res: Response) => {
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
      stderrLog = `[ERROR] [FFMPEG_ENCODE] [${randomJobId}] Fatal error: Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139).`;
      break;

    case 'FFMPEG_OOM':
      errorSignature = "Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)";
      exitCode = 137;
      signal = 'SIGABRT';
      failingFile = PIPELINE_CONFIG.DEFAULT_CULPRIT_FILE;
      stderrLog = `[FATAL] [FFMPEG_ENCODE] [${randomJobId}] CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)`;
      break;

    case 'SEGMENT_CORRUPTION':
      errorSignature = "Non-monotonic DTS at muxer boundary. Segment packet header corrupted (Exit 1)";
      exitCode = 1;
      signal = 'SIGTERM';
      failingFile = PIPELINE_CONFIG.DEFAULT_CULPRIT_FILE;
      stderrLog = `[ERROR] [MUXER] [${randomJobId}] Fatal error: Non-monotonic DTS in input stream. Video muxing aborted.`;
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
        if (content.includes("DEFAULT_PRESETS['720p_auto']")) {
          const bugLines = "  const targetBitrate = chunk.bitrateProfile.targetBitrate;\n  const resolution = chunk.bitrateProfile.resolution || '1280x720';";
          content = content.replace(
            /\s*\/\/ Fallback to 720p_auto profile when bitrateProfile is omitted[\s\S]*?const resolution = profile\.resolution \|\| '1280x720';/,
            "\n" + bugLines
          );
          fs.writeFileSync(cp, content, 'utf-8');
          break;
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

  // Requirement 2: Automatically emit structured error logs into the in-memory log buffer (/api/logs)
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

  // Requirement 2: Immediately dispatch an incident webhook notification to CutGuard SRE Agent:
  // POST http://localhost:8000/api/incident/trigger with incident_id, errorSignature, and target file (mock-pipeline/worker.js)
  let agentDispatched = false;
  try {
    const agentUrl = PIPELINE_CONFIG.AGENT_URL;
    const webhookRes = await fetch(`${agentUrl}/api/incident/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: incidentId,
        errorSignature,
        failingFile,
        target_file: failingFile,
        service_name: PIPELINE_CONFIG.SERVICE_NAME,
        custom_log: stderrLog,
        scenario
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
});

/**
 * @openapi
 * /api/chaos/reset:
 *   post:
 *     summary: Reset chaos injection state
 *     description: Clears failure injection, restores worker pool health, and normalizes telemetry streams.
 *     tags: [Chaos Engineering]
 *     responses:
 *       200:
 *         description: Pipeline restored to healthy state
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
 *                 message:
 *                   type: string
 *                   example: Pipeline restored to normal operating state.
 */
chaosRouter.post('/reset', (_req: Request, res: Response) => {
  resetChaosState();
  logPipelineEvent({
    level: 'info',
    stage: '[CHAOS]',
    message: 'Chaos simulation reset. Video pipeline normalized to healthy mode.'
  });

  return res.json({
    status: 'HEALTHY',
    isCrashed: false,
    activeScenario: 'NONE',
    isFailureArmed: false,
    activeIncident: null,
    message: 'Pipeline restored to normal operating state.'
  });
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
