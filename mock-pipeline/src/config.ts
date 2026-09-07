/**
 * CutGuard AI - Mock Pipeline Configuration & Typed Fallbacks
 * Centralizes all cluster parameters, worker pool specifications, and network configurations.
 */

export const PIPELINE_CONFIG = {
  PORT: Number(process.env.PORT) || 4001,
  AGENT_PORT: Number(process.env.AGENT_PORT) || 8000,
  AGENT_URL: process.env.AGENT_URL || `http://localhost:${Number(process.env.AGENT_PORT) || 8000}`,
  CLUSTER_NAME: process.env.CLUSTER_NAME || 'gke-us-central1-cinema-render',
  NODE_GROUP: process.env.NODE_GROUP || 'n2-highmem-16',
  SERVICE_NAME: process.env.SERVICE_NAME || 'cutguard-mock-transcoder',
  DEFAULT_TARGET_WORKER: process.env.DEFAULT_TARGET_WORKER || 'worker-transcode-04',
  DEFAULT_CULPRIT_FILE: process.env.DEFAULT_CULPRIT_FILE || 'mock-pipeline/worker.js',
  WORKER_TOTAL_CAPACITY: Number(process.env.WORKER_TOTAL_CAPACITY) || 16,
  WORKER_NOMINAL_ACTIVE: Number(process.env.WORKER_NOMINAL_ACTIVE) || 4,
  WORKER_DEGRADED_ACTIVE: Number(process.env.WORKER_DEGRADED_ACTIVE) || 1,
  FFMPEG_VERSION: process.env.FFMPEG_VERSION || 'ffmpeg version 6.1.1-cutguard-custom-gke (c) 2000-2023 the FFmpeg developers',
  SUPPORTED_CODECS: ['libx264', 'libx265', 'libsvtav1'] as const,
  DEFAULT_SEVERITY: process.env.DEFAULT_SEVERITY || 'CRITICAL',
  DEFAULT_CHAOS_SCENARIO: process.env.DEFAULT_CHAOS_SCENARIO || 'UNSUPPORTED_PIXEL_FORMAT',
} as const;

export interface WorkerPoolHealth {
  activeWorkers: number;
  totalCapacity: number;
  cluster: string;
  nodeGroup: string;
}

export interface WorkerChaosState {
  scenario: string;
  activeIncidentId: string | null;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  service: string;
  uptimeSeconds: number;
  workerPool: WorkerPoolHealth;
  ffmpegVersion: string;
  codecsSupported: readonly string[];
  chaosState: WorkerChaosState;
}

export interface ChaosInjectRequestBody {
  scenario?: string;
  targetWorker?: string;
  severity?: string;
}

export interface ChaosInjectResponse {
  status: string;
  message: string;
  agentDispatched: boolean;
  activeIncident: unknown;
}

export interface ChaosStatusResponse {
  status: string;
  isCrashed: boolean;
  activeScenario: string | null;
  isFailureArmed: boolean;
  activeIncident: unknown;
}

export const DEFAULT_WORKER_POOL: WorkerPoolHealth = {
  activeWorkers: PIPELINE_CONFIG.WORKER_NOMINAL_ACTIVE,
  totalCapacity: PIPELINE_CONFIG.WORKER_TOTAL_CAPACITY,
  cluster: PIPELINE_CONFIG.CLUSTER_NAME,
  nodeGroup: PIPELINE_CONFIG.NODE_GROUP,
};

export const DEFAULT_HEALTH_RESPONSE: HealthResponse = {
  status: 'healthy',
  service: PIPELINE_CONFIG.SERVICE_NAME,
  uptimeSeconds: 0,
  workerPool: DEFAULT_WORKER_POOL,
  ffmpegVersion: PIPELINE_CONFIG.FFMPEG_VERSION,
  codecsSupported: PIPELINE_CONFIG.SUPPORTED_CODECS,
  chaosState: {
    scenario: 'NONE',
    activeIncidentId: null,
  },
};
