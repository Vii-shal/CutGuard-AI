/**
 * CutGuard AI - FFmpeg CLI Argument Generator & Transcoding Simulation
 * 
 * TARGET FILE FOR SRE AGENT INCIDENT REMEDIATION:
 * Contains the core command builder for video chunk encoding.
 */

import { logPipelineEvent } from '../logger';

export type TargetResolution = '1080p' | '4k' | '720p';
export type Codec = 'h264' | 'hevc' | 'av1';
export type PixelFormat = 'yuv420p' | 'yuv422p10le' | 'yuv444p' | 'auto';

export interface BitrateProfile {
  targetBitrate: string;
  resolution: string;
  maxRate?: string;
  bufSize?: string;
}

export interface TranscodeOptions {
  jobId: string;
  videoUrl: string;
  targetResolution: TargetResolution;
  codec: Codec;
  pixelFormat?: PixelFormat;
  profile?: string;
  bitrateProfile?: BitrateProfile;
  scenarioOverride?: 'FFMPEG_OOM' | 'UNSUPPORTED_PIXEL_FORMAT' | 'SEGMENT_CORRUPTION' | 'NONE';
}

export interface TranscodeResult {
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  targetResolution: TargetResolution;
  codec: Codec;
  outputManifestUrl: string;
  durationSec: number;
  framesRendered: number;
  ffmpegCommand: string;
}

export const DEFAULT_BITRATE_PRESETS: Record<TargetResolution, BitrateProfile> = {
  '1080p': { targetBitrate: '8000k', resolution: '1920x1080', maxRate: '8500k', bufSize: '16000k' },
  '4k': { targetBitrate: '22000k', resolution: '3840x2160', maxRate: '25000k', bufSize: '44000k' },
  '720p': { targetBitrate: '4500k', resolution: '1280x720', maxRate: '5000k', bufSize: '9000k' }
};

/**
 * Builds standard FFmpeg command line arguments for the media worker.
 * 
 * @throws Error if unhandled parameter combinations cause an encoder crash
 */
export function buildFFmpegArgs(options: TranscodeOptions): string[] {
  const codecName = options.codec === 'hevc' ? 'libx265' : options.codec === 'av1' ? 'libsvtav1' : 'libx264';
  const profile = options.profile || 'baseline';
  const pixelFormat = options.pixelFormat || 'yuv420p';

  // =========================================================================
  // CRITICAL FAILURE POINT 1: FFMPEG_OOM / MISSING BITRATE PROFILE
  // When manifests omit bitrateProfile under OOM conditions, throws Exit 137
  // =========================================================================
  if (options.scenarioOverride === 'FFMPEG_OOM') {
    throw new Error(
      "CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)"
    );
  }

  // =========================================================================
  // CRITICAL FAILURE POINT 2: UNSUPPORTED PIXEL FORMAT IN H.264 BASELINE PROFILE
  // Line 48: 10-bit 'yuv422p10le' is forbidden in H.264 baseline profile.
  // In unpatched code, passing 10-bit to libx264 baseline triggers SIGSEGV (139).
  // =========================================================================
  if (pixelFormat === 'yuv422p10le' && profile === 'baseline') {
    throw new Error(
      `Fatal error: Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'. Transcoding process killed with SIGSEGV (exit code 139).`
    );
  }

  // =========================================================================
  // CRITICAL FAILURE POINT 3: SEGMENT CORRUPTION
  // =========================================================================
  if (options.scenarioOverride === 'SEGMENT_CORRUPTION') {
    throw new Error(
      "Fatal error: Segment corruption detected at muxer boundary. Non-monotonic DTS in input stream (Exit 1)."
    );
  }

  // Resolve bitrate profile with fallback safety
  const resolvedProfile = options.bitrateProfile || DEFAULT_BITRATE_PRESETS[options.targetResolution] || DEFAULT_BITRATE_PRESETS['1080p'];
  const scale = options.targetResolution === '4k' ? 'scale=3840:2160' : options.targetResolution === '720p' ? 'scale=1280:720' : 'scale=1920:1080';

  return [
    '-y',
    '-i', options.videoUrl,
    '-c:v', codecName,
    '-profile:v', profile,
    '-pix_fmt', pixelFormat,
    '-b:v', resolvedProfile.targetBitrate,
    '-maxrate', resolvedProfile.maxRate || resolvedProfile.targetBitrate,
    '-bufsize', resolvedProfile.bufSize || '16000k',
    '-vf', scale,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_playlist_type', 'vod',
    `/tmp/transcode/${options.jobId}/master.m3u8`
  ];
}

/**
 * Simulates end-to-end execution of the FFmpeg transcoding job.
 */
export async function executeTranscodeSimulation(
  options: TranscodeOptions,
  traceId?: string
): Promise<TranscodeResult> {
  const jobId = options.jobId;

  // Stage 1: INGEST
  logPipelineEvent({
    level: 'info',
    stage: '[INGEST]',
    jobId,
    traceId,
    message: `Ingesting video asset from ${options.videoUrl} (Target: ${options.targetResolution}, Codec: ${options.codec})`,
    metadata: { videoUrl: options.videoUrl, targetResolution: options.targetResolution }
  });

  // Stage 2: FFMPEG_ENCODE (Command generation & process spawn)
  logPipelineEvent({
    level: 'info',
    stage: '[FFMPEG_ENCODE]',
    jobId,
    traceId,
    message: `Validating encoding parameters and building FFmpeg args...`
  });

  let ffmpegArgs: string[];
  try {
    ffmpegArgs = buildFFmpegArgs(options);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logPipelineEvent({
      level: 'error',
      stage: '[FFMPEG_ENCODE]',
      jobId,
      traceId,
      message: errorMsg,
      metadata: { failingFile: 'src/transcoder/ffmpegArgs.ts', exitCode: 139, signal: 'SIGSEGV' }
    });
    throw err;
  }

  const ffmpegCmdStr = `ffmpeg ${ffmpegArgs.join(' ')}`;
  logPipelineEvent({
    level: 'info',
    stage: '[FFMPEG_ENCODE]',
    jobId,
    traceId,
    message: `Worker child process spawned: ${ffmpegCmdStr.substring(0, 120)}...`
  });

  // Stage 3: MUXER
  logPipelineEvent({
    level: 'info',
    stage: '[MUXER]',
    jobId,
    traceId,
    message: `Packaging HLS multi-bitrate segment playlist (/tmp/transcode/${jobId}/master.m3u8)`
  });

  // Stage 4: S3_UPLOAD
  const manifestUrl = `https://storage.googleapis.com/cutguard-cinema-rendered/${jobId}/master.m3u8`;
  logPipelineEvent({
    level: 'info',
    stage: '[S3_UPLOAD]',
    jobId,
    traceId,
    message: `Stream segments successfully synced to Cloud Storage CDN: ${manifestUrl}`
  });

  return {
    jobId,
    status: 'COMPLETED',
    targetResolution: options.targetResolution,
    codec: options.codec,
    outputManifestUrl: manifestUrl,
    durationSec: 30,
    framesRendered: 1800,
    ffmpegCommand: ffmpegCmdStr
  };
}
