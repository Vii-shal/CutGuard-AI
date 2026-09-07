/**
 * CutGuard AI - Media Pipeline Routes
 * Provides health checks, transcode job initiation, job tracking, and structured log streaming.
 */

import { Router, Request, Response } from 'express';
import { logPipelineEvent, getRecentLogs } from '../logger';
import { 
  executeTranscodeSimulation, 
  TranscodeOptions, 
  TargetResolution, 
  Codec, 
  PixelFormat 
} from '../transcoder/ffmpegArgs';
import { getActiveChaosScenario, getActiveIncident } from './chaos';
import { PIPELINE_CONFIG, HealthResponse } from '../config';

export interface TranscodeJob {
  jobId: string;
  videoUrl: string;
  targetResolution: TargetResolution;
  codec: Codec;
  pixelFormat?: PixelFormat;
  status: 'QUEUED' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  progress: number;
  outputManifestUrl?: string;
  error?: string;
  exitCode?: number;
  createdAt: string;
  updatedAt: string;
}

const jobsStore = new Map<string, TranscodeJob>();
const startTime = Date.now();

export const pipelineRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Transcoding Service Health Check
 *     description: Returns worker pool capacity, system uptime, and FFmpeg build metadata.
 *     tags: [Core Pipeline]
 *     responses:
 *       200:
 *         description: Healthy worker status
 */
pipelineRouter.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  const activeScenario = getActiveChaosScenario();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const responsePayload: HealthResponse = {
    status: activeScenario === 'NONE' ? 'healthy' : 'degraded',
    service: PIPELINE_CONFIG.SERVICE_NAME,
    uptimeSeconds,
    workerPool: {
      activeWorkers: activeScenario === 'NONE'
        ? PIPELINE_CONFIG.WORKER_NOMINAL_ACTIVE
        : PIPELINE_CONFIG.WORKER_DEGRADED_ACTIVE,
      totalCapacity: PIPELINE_CONFIG.WORKER_TOTAL_CAPACITY,
      cluster: PIPELINE_CONFIG.CLUSTER_NAME,
      nodeGroup: PIPELINE_CONFIG.NODE_GROUP
    },
    ffmpegVersion: PIPELINE_CONFIG.FFMPEG_VERSION,
    codecsSupported: PIPELINE_CONFIG.SUPPORTED_CODECS,
    chaosState: {
      scenario: activeScenario,
      activeIncidentId: getActiveIncident()?.incidentId || null
    }
  };

  return res.json(responsePayload);
});

/**
 * @openapi
 * /api/transcode:
 *   post:
 *     summary: Initiate a video chunk transcoding job
 *     description: Dispatches a video encoding task across the pipeline stages with structured observability.
 *     tags: [Core Pipeline]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoId
 *               - resolution
 *               - codec
 *               - sourceUrl
 *             properties:
 *               videoId:
 *                 type: string
 *                 example: vid-cinema-94021
 *                 description: Unique video asset identifier
 *               resolution:
 *                 type: string
 *                 enum: [1080p, 4k, 720p, 480p]
 *                 example: 1080p
 *                 description: Target render resolution
 *               codec:
 *                 type: string
 *                 enum: [h264, hevc, av1]
 *                 example: h264
 *                 description: Target video codec
 *               sourceUrl:
 *                 type: string
 *                 example: gs://raw-cinema-assets/scene-04-take-02.mov
 *                 description: Cloud storage input master media URI
 *               pixelFormat:
 *                 type: string
 *                 enum: [yuv420p, yuv422p10le, yuv444p]
 *                 example: yuv420p
 *                 description: Pixel format and chroma profile
 *     responses:
 *       200:
 *         description: Transcode completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: COMPLETED
 *                 jobId:
 *                   type: string
 *                   example: job-84920
 *                 videoId:
 *                   type: string
 *                   example: vid-cinema-94021
 *                 resolution:
 *                   type: string
 *                   example: 1080p
 *                 codec:
 *                   type: string
 *                   example: h264
 *                 progress:
 *                   type: integer
 *                   example: 100
 *                 outputManifestUrl:
 *                   type: string
 *                   example: https://storage.googleapis.com/cutguard-processed-stream/job-84920/master.m3u8
 *       500:
 *         description: Transcoder process crash (SIGSEGV or SIGABRT)
 */
pipelineRouter.post('/transcode', async (req: Request, res: Response) => {
  const {
    jobId = req.body.videoId || `job-${Math.floor(10000 + Math.random() * 90000)}`,
    videoId = req.body.jobId || `vid-${Math.floor(10000 + Math.random() * 90000)}`,
    videoUrl = req.body.sourceUrl || 'gs://raw-cinema-assets/scene-04-take-02.mov',
    sourceUrl = req.body.videoUrl || 'gs://raw-cinema-assets/scene-04-take-02.mov',
    targetResolution = req.body.resolution || '1080p',
    resolution = req.body.targetResolution || '1080p',
    codec = 'h264',
    pixelFormat
  } = req.body;

  const traceId = `trace-${Math.random().toString(36).substring(2, 9)}`;
  const activeScenario = getActiveChaosScenario();

  // Create or update initial job record
  const jobRecord: TranscodeJob = {
    jobId,
    videoUrl: sourceUrl,
    targetResolution: resolution as TargetResolution,
    codec: codec as Codec,
    pixelFormat: pixelFormat as PixelFormat,
    status: 'PROCESSING',
    progress: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  jobsStore.set(jobId, jobRecord);

  try {
    const options: TranscodeOptions = {
      jobId,
      videoUrl: sourceUrl,
      targetResolution: resolution as TargetResolution,
      codec: codec as Codec,
      pixelFormat: (activeScenario === 'UNSUPPORTED_PIXEL_FORMAT' && !pixelFormat) ? 'yuv422p10le' : (pixelFormat || 'yuv420p'),
      scenarioOverride: activeScenario
    };

    const result = await executeTranscodeSimulation(options, traceId);

    jobRecord.status = 'COMPLETED';
    jobRecord.progress = 100;
    jobRecord.outputManifestUrl = result.outputManifestUrl;
    jobRecord.updatedAt = new Date().toISOString();
    jobsStore.set(jobId, jobRecord);

    return res.json({
      status: 'COMPLETED',
      jobId,
      traceId,
      result
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const exitCode = activeScenario === 'FFMPEG_OOM' ? 137 : 139;

    jobRecord.status = 'FAILED';
    jobRecord.progress = 45;
    jobRecord.error = errorMsg;
    jobRecord.exitCode = exitCode;
    jobRecord.updatedAt = new Date().toISOString();
    jobsStore.set(jobId, jobRecord);

    return res.status(500).json({
      status: 'FAILED',
      jobId,
      traceId,
      exitCode,
      error: errorMsg,
      failingStage: 'FFMPEG_ENCODE',
      failingFile: 'src/transcoder/ffmpegArgs.ts'
    });
  }
});

/**
 * @openapi
 * /api/jobs/{id}:
 *   get:
 *     summary: Query state of a specific transcoding job
 *     tags: [Core Pipeline]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job details
 *       404:
 *         description: Job not found
 */
pipelineRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = jobsStore.get(id);

  if (!job) {
    return res.status(404).json({ error: "JOB_NOT_FOUND", message: `No transcoding job found with ID: ${id}` });
  }

  return res.json(job);
});

/**
 * @openapi
 * /api/jobs:
 *   get:
 *     summary: List recent transcoding jobs
 *     tags: [Core Pipeline]
 *     responses:
 *       200:
 *         description: List of jobs
 */
pipelineRouter.get('/jobs', (_req: Request, res: Response) => {
  const list = Array.from(jobsStore.values()).reverse();
  return res.json({ total: list.length, jobs: list });
});

/**
 * @openapi
 * /api/logs:
 *   get:
 *     summary: Retrieve recent structured pipeline logs
 *     description: Returns in-memory ring buffer of logs formatted for Grafana Loki scraping and dashboard synchronization.
 *     tags: [Observability]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 500
 *         description: Maximum number of recent log events to retrieve (max 500)
 *         example: 50
 *     responses:
 *       200:
 *         description: Structured telemetry log array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 50
 *                 limit:
 *                   type: integer
 *                   example: 50
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 */
pipelineRouter.get('/logs', (req: Request, res: Response) => {
  const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 500);
  const logs = getRecentLogs(limit);
  return res.json({
    total: logs.length,
    limit,
    logs
  });
});
