/**
 * CutGuard AI - Chaos Injection & Failure Simulation Routes
 * Simulates real-world video transcoding pipeline crashes.
 */

import { Router, Request, Response } from 'express';
import { logPipelineEvent } from '../logger';

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

export function resetChaosState(): void {
  activeScenario = 'NONE';
  activeIncident = null;
}

export const chaosRouter = Router();

/**
 * @openapi
 * /api/chaos/inject:
 *   post:
 *     summary: Inject a video pipeline chaos scenario
 *     description: Forces the media worker into a crash state and emits realistic FFmpeg crash telemetry into cluster streams.
 *     tags: [Chaos Engineering]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChaosInjectRequest'
 *     responses:
 *       200:
 *         description: Chaos scenario successfully activated and telemetry emitted
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
 *                   example: Chaos scenario 'UNSUPPORTED_PIXEL_FORMAT' triggered. Pipeline is now primed for autonomous triage.
 *                 activeIncident:
 *                   $ref: '#/components/schemas/ChaosInjectRequest'
 *       400:
 *         description: Invalid or unsupported chaos scenario specified
 */
chaosRouter.post('/inject', (req: Request, res: Response) => {
  const { 
    scenario, 
    targetWorker = 'worker-transcode-04', 
    severity = 'CRITICAL' 
  } = req.body as { 
    scenario?: ChaosScenario;
    targetWorker?: string;
    severity?: string;
  };

  if (!scenario || !['FFMPEG_OOM', 'UNSUPPORTED_PIXEL_FORMAT', 'SEGMENT_CORRUPTION'].includes(scenario)) {
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
  let failingFile = 'mock-pipeline/worker.js';
  let exitCode = 1;
  let signal = 'SIGABRT';
  let stderrLog = '';

  switch (scenario) {
    case 'UNSUPPORTED_PIXEL_FORMAT':
      errorSignature = "Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139)";
      exitCode = 139;
      signal = 'SIGSEGV';
      failingFile = 'mock-pipeline/worker.js';
      stderrLog = `[ERROR] [FFMPEG_ENCODE] [${randomJobId}] Fatal error: Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139).`;
      break;

    case 'FFMPEG_OOM':
      errorSignature = "Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)";
      exitCode = 137;
      signal = 'SIGABRT';
      failingFile = 'mock-pipeline/worker.js';
      stderrLog = `[FATAL] [FFMPEG_ENCODE] [${randomJobId}] CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)`;
      break;

    case 'SEGMENT_CORRUPTION':
      errorSignature = "Non-monotonic DTS at muxer boundary. Segment packet header corrupted (Exit 1)";
      exitCode = 1;
      signal = 'SIGTERM';
      failingFile = 'mock-pipeline/worker.js';
      stderrLog = `[ERROR] [MUXER] [${randomJobId}] Fatal error: Non-monotonic DTS in input stream. Video muxing aborted.`;
      break;
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

  // Emit realistic stderr trace to logger
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

  return res.json({
    status: 'CHAOS_INJECTED',
    message: `Chaos scenario '${scenario}' triggered. Pipeline is now primed for autonomous triage.`,
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
 *               $ref: '#/components/schemas/ChaosResetResponse'
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
