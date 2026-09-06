/**
 * CutGuard AI - Structured Observability & Pino Logger
 * Outputs structured JSON logs suitable for OpenTelemetry scraping / Grafana Loki ingestion.
 * Maintains an in-memory ring buffer for low-latency dashboard streaming.
 */

import pino from 'pino';

export type PipelineStage = '[INGEST]' | '[FFMPEG_ENCODE]' | '[MUXER]' | '[S3_UPLOAD]' | '[CHAOS]' | '[SYSTEM]';
export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  stage: PipelineStage;
  jobId?: string;
  traceId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// In-memory ring buffer of the most recent 500 log events
const MAX_LOG_BUFFER_SIZE = 500;
const logBuffer: LogEntry[] = [];

// Base Pino logger instance
export const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/**
 * Emits a structured log event, records it in the ring buffer,
 * and outputs to standard out/err via Pino.
 */
export function logPipelineEvent(params: {
  level: LogLevel;
  stage: PipelineStage;
  message: string;
  jobId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}): LogEntry {
  const timestamp = new Date().toISOString();
  const traceId = params.traceId || `trace-${Math.random().toString(36).substring(2, 10)}`;
  const jobId = params.jobId || 'N/A';

  const entry: LogEntry = {
    timestamp,
    level: params.level,
    stage: params.stage,
    jobId: params.jobId,
    traceId,
    message: params.message,
    metadata: params.metadata,
  };

  // Add to in-memory buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Format line for standard logs & Loki parsing:
  // e.g.: 2026-09-06T08:58:20.124Z [ERROR] [FFMPEG_ENCODE] [Job-84920] [trace-d7a8] ...
  const formattedMsg = `${params.stage} [${jobId}] [${traceId}] ${params.message}`;

  switch (params.level) {
    case 'fatal':
      baseLogger.fatal({ ...params.metadata, stage: params.stage, jobId, traceId }, formattedMsg);
      break;
    case 'error':
      baseLogger.error({ ...params.metadata, stage: params.stage, jobId, traceId }, formattedMsg);
      break;
    case 'warn':
      baseLogger.warn({ ...params.metadata, stage: params.stage, jobId, traceId }, formattedMsg);
      break;
    case 'info':
    default:
      baseLogger.info({ ...params.metadata, stage: params.stage, jobId, traceId }, formattedMsg);
      break;
  }

  return entry;
}

/**
 * Retrieves recent logs with optional limit.
 */
export function getRecentLogs(limit = 50): LogEntry[] {
  const count = Math.min(Math.max(limit, 1), logBuffer.length);
  return logBuffer.slice(-count).reverse();
}

/**
 * Clears the log buffer (e.g. for testing / reset).
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}
