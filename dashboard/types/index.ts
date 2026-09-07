/**
 * CutGuard AI - Enterprise SRE Types & Configurable Fallback Defaults
 */

// Centralized runtime configuration with environment overrides
export const CONFIG = {
  PIPELINE_URL: process.env.NEXT_PUBLIC_PIPELINE_URL || process.env.PIPELINE_URL || 'http://localhost:4001',
  AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL || 'http://localhost:8000',
  CLUSTER_NAME: process.env.NEXT_PUBLIC_CLUSTER_NAME || 'gke-us-central1-cinema-render',
  NODE_GROUP: process.env.NEXT_PUBLIC_NODE_GROUP || 'n2-highmem-16',
  DEFAULT_SERVICE: process.env.NEXT_PUBLIC_SERVICE_NAME || 'ffmpeg-transcoder',
  DEFAULT_CULPRIT_FILE: process.env.NEXT_PUBLIC_CULPRIT_FILE || '',
  DEFAULT_CULPRIT_COMMIT: process.env.NEXT_PUBLIC_CULPRIT_COMMIT || 'HEAD~1',
  WORKER_TOTAL_CAPACITY: Number(process.env.NEXT_PUBLIC_WORKER_CAPACITY) || 16,
  WORKER_NOMINAL_ACTIVE: Number(process.env.NEXT_PUBLIC_WORKER_NOMINAL_ACTIVE) || 4,
  WORKER_DEGRADED_ACTIVE: Number(process.env.NEXT_PUBLIC_WORKER_DEGRADED_ACTIVE) || 1,
  NOMINAL_POLL_INTERVAL_MS: Number(process.env.NEXT_PUBLIC_NOMINAL_POLL_MS) || 2500,
  ACTIVE_POLL_INTERVAL_MS: Number(process.env.NEXT_PUBLIC_ACTIVE_POLL_MS) || 1000,
} as const;

export type IncidentStatus = 
  | 'IDLE'
  | 'INITIALIZING'
  | 'SYNCING'
  | 'ANALYZING'
  | 'TRIAGING'
  | 'TRIAGED'
  | 'BLAST_ASSESSED'
  | 'SANDBOXED'
  | 'SANDBOX_TESTED'
  | 'NEEDS_APPROVAL'
  | 'WAITING_FOR_HUMAN'
  | 'DEPLOYING'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'ERROR';

export interface AffectedFile {
  file: string;
  lines_of_code: number;
  symbols_imported: string[];
}

export interface BlastDetails {
  blast_score?: number;
  threat_level?: string;
  culprit_file?: string;
  downstream_dependent_count?: number;
  affected_files?: AffectedFile[];
  affected_symbols?: string[];
  affected_endpoints?: string[];
  blast_description?: string;
  [key: string]: unknown;
}

export interface Incident {
  incident_id: string;
  service: string;
  status: IncidentStatus;
  raw_log: string;
  culprit_file: string;
  culprit_commit: string;
  blast_score: number;
  blast_details: BlastDetails;
  generated_diff: string;
  test_passed: boolean;
  test_output: string;
  retry_count: number;
  human_approved: boolean | null;
  post_mortem: string;
  created_at: string;
  interrupt_payload?: unknown;
}

export interface ChaosIncidentTelemetry {
  incidentId?: string;
  scenario?: string;
  targetWorker?: string;
  severity?: string;
  errorSignature?: string;
  timestamp?: string;
  failingFile?: string;
  affectedPipelineStage?: string;
  exitCode?: number;
  signal?: string;
  status?: string;
  rawStderr?: string;
}

export interface ChaosStatusResponse {
  status: string;
  isCrashed: boolean;
  activeScenario: string | null;
  isFailureArmed: boolean;
  activeIncident: ChaosIncidentTelemetry | null;
}

export interface AgentLatestResponse {
  incident: Incident | null;
}

export interface WorkerPoolHealth {
  activeWorkers: number;
  totalCapacity: number;
  cluster?: string;
  nodeGroup?: string;
}

export interface WorkerChaosState {
  scenario?: string;
  activeIncidentId?: string | null;
}

export interface WorkerHealthResponse {
  status: 'healthy' | 'degraded' | string;
  service?: string;
  uptimeSeconds?: number;
  workerPool?: WorkerPoolHealth;
  ffmpegVersion?: string;
  codecsSupported?: string[];
  chaosState?: WorkerChaosState;
}

// Strongly-typed results for async cluster & incident fetchers
export interface ClusterStateResult {
  isPipelineOk: boolean;
  chaosData: ChaosStatusResponse | null;
  healthData: WorkerHealthResponse | null;
  isDegraded: boolean;
}

export interface IncidentStateResult {
  incident: Incident | null;
  isAgentOk: boolean;
}

// ==========================================
// Comprehensive Typed Fallback Defaults
// ==========================================

export const DEFAULT_BLAST_DETAILS: BlastDetails = {
  blast_score: 0,
  threat_level: 'NOMINAL',
  culprit_file: CONFIG.DEFAULT_CULPRIT_FILE,
  downstream_dependent_count: 0,
  affected_files: [],
  affected_symbols: [],
  affected_endpoints: [],
  blast_description: 'All downstream cinema services nominal.'
};

export const DEFAULT_INCIDENT_FALLBACK: Incident = {
  incident_id: '',
  service: CONFIG.DEFAULT_SERVICE,
  status: 'IDLE',
  raw_log: '',
  culprit_file: CONFIG.DEFAULT_CULPRIT_FILE,
  culprit_commit: CONFIG.DEFAULT_CULPRIT_COMMIT,
  blast_score: 0,
  blast_details: DEFAULT_BLAST_DETAILS,
  generated_diff: '',
  test_passed: false,
  test_output: '',
  retry_count: 0,
  human_approved: null,
  post_mortem: '',
  created_at: new Date().toISOString()
};

export const DEFAULT_WORKER_HEALTH: WorkerHealthResponse = {
  status: 'healthy',
  service: CONFIG.DEFAULT_SERVICE,
  uptimeSeconds: 0,
  workerPool: {
    activeWorkers: CONFIG.WORKER_NOMINAL_ACTIVE,
    totalCapacity: CONFIG.WORKER_TOTAL_CAPACITY,
    cluster: CONFIG.CLUSTER_NAME,
    nodeGroup: CONFIG.NODE_GROUP
  },
  chaosState: {
    scenario: 'NONE',
    activeIncidentId: null
  }
};

export const DEFAULT_CHAOS_STATUS: ChaosStatusResponse = {
  status: 'NOMINAL',
  isCrashed: false,
  activeScenario: 'NONE',
  isFailureArmed: false,
  activeIncident: null
};

export const DEFAULT_CLUSTER_STATE_RESULT: ClusterStateResult = {
  isPipelineOk: false,
  chaosData: null,
  healthData: null,
  isDegraded: false
};

export const DEFAULT_INCIDENT_STATE_RESULT: IncidentStateResult = {
  incident: null,
  isAgentOk: false
};
