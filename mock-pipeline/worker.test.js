const { processVideoChunk, DEFAULT_PRESETS } = require('./worker');

describe('FFmpeg Video Transcoding Pipeline - Chunk Processing', () => {
  test('processes video chunk successfully with valid explicit bitrateProfile', () => {
    const validChunk = {
      chunkId: 'chk-standard-001',
      videoLengthSec: 10,
      codec: 'h264',
      bitrateProfile: {
        targetBitrate: '8000k',
        resolution: '1920x1080'
      }
    };

    const result = processVideoChunk(validChunk);
    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.targetBitrate).toBe('8000k');
    expect(result.resolution).toBe('1920x1080');
    expect(result.framesRendered).toBe(600);
  });

  test('properly handles missing bitrateProfile by falling back to 720p_auto without crashing', () => {
    const unprofiledChunk = {
      chunkId: 'chk-fallback-002',
      videoLengthSec: 15,
      codec: 'hevc'
      // Missing bitrateProfile
    };

    // Before patch: this throws CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32...
    // After patch: this should gracefully complete with fallback 720p_auto (4500k bitrate, 1280x720 resolution)
    let result;
    expect(() => {
      result = processVideoChunk(unprofiledChunk);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.targetBitrate).toBe('4500k');
    expect(result.resolution).toBe('1280x720');
  });

  test('throws descriptive error on invalid null chunk payload', () => {
    expect(() => {
      processVideoChunk(null);
    }).toThrow('INVALID_CHUNK_PAYLOAD');
  });
});
