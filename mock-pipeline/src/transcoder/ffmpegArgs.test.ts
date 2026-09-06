/**
 * Unit Test Suite for FFmpeg CLI Argument Builder & Pipeline Simulation
 */

import { buildFFmpegArgs, executeTranscodeSimulation, TranscodeOptions } from './ffmpegArgs';
import { getRecentLogs, clearLogBuffer } from '../logger';

describe('FFmpeg Argument Builder & Transcode Execution', () => {
  beforeEach(() => {
    clearLogBuffer();
  });

  test('successfully generates valid FFmpeg args for 1080p h264 transcode', () => {
    const options: TranscodeOptions = {
      jobId: 'job-test-101',
      videoUrl: 'https://storage.googleapis.com/test-bucket/clip.mov',
      targetResolution: '1080p',
      codec: 'h264',
      profile: 'high',
      pixelFormat: 'yuv420p'
    };

    const args = buildFFmpegArgs(options);
    expect(args).toContain('-c:v');
    expect(args).toContain('libx264');
    expect(args).toContain('-b:v');
    expect(args).toContain('8000k');
    expect(args).toContain('scale=1920:1080');
    expect(args).toContain('yuv420p');
  });

  test('throws deliberate fatal error when invalid pixel format yuv422p10le is paired with baseline profile', () => {
    const faultyOptions: TranscodeOptions = {
      jobId: 'job-fail-102',
      videoUrl: 'https://storage.googleapis.com/test-bucket/hdr-10bit.mov',
      targetResolution: '1080p',
      codec: 'h264',
      profile: 'baseline',
      pixelFormat: 'yuv422p10le'
    };

    expect(() => buildFFmpegArgs(faultyOptions)).toThrow(
      "Fatal error: Invalid pixel format 'yuv422p10le' for codec 'libx264' with profile 'baseline'"
    );
  });

  test('throws OOM crash when FFMPEG_OOM scenario is activated', () => {
    const oomOptions: TranscodeOptions = {
      jobId: 'job-oom-103',
      videoUrl: 'https://storage.googleapis.com/test-bucket/clip.mov',
      targetResolution: '4k',
      codec: 'hevc',
      scenarioOverride: 'FFMPEG_OOM'
    };

    expect(() => buildFFmpegArgs(oomOptions)).toThrow(
      "CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)"
    );
  });

  test('executes end-to-end transcode simulation and populates in-memory log buffer', async () => {
    const options: TranscodeOptions = {
      jobId: 'job-success-104',
      videoUrl: 'https://storage.googleapis.com/test-bucket/clip.mov',
      targetResolution: '720p',
      codec: 'h264',
      profile: 'high',
      pixelFormat: 'yuv420p'
    };

    const result = await executeTranscodeSimulation(options, 'trace-unit-test');
    expect(result.status).toBe('COMPLETED');
    expect(result.outputManifestUrl).toContain('master.m3u8');

    const recentLogs = getRecentLogs(10);
    expect(recentLogs.length).toBeGreaterThanOrEqual(4);

    const stages = recentLogs.map(l => l.stage);
    expect(stages).toContain('[INGEST]');
    expect(stages).toContain('[FFMPEG_ENCODE]');
    expect(stages).toContain('[MUXER]');
    expect(stages).toContain('[S3_UPLOAD]');
  });
});
