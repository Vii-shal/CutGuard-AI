/**
 * CutGuard AI - Mock Video Transcoder Service
 * Simulates an FFmpeg distributed cloud transcoding worker.
 */

const express = require('express');

// Standard transcoding presets supported by the pipeline
const DEFAULT_PRESETS = {
  '1080p_pro': { targetBitrate: '8000k', resolution: '1920x1080', audioBitrate: '320k' },
  '720p_auto': { targetBitrate: '4500k', resolution: '1280x720', audioBitrate: '192k' },
  '480p_mobile': { targetBitrate: '1800k', resolution: '854x480', audioBitrate: '128k' }
};

/**
 * Process a single video chunk through FFmpeg pipeline simulation.
 * 
 * @param {Object} chunk Video chunk metadata
 * @param {string} chunk.chunkId Unique chunk identifier
 * @param {number} chunk.videoLengthSec Duration in seconds
 * @param {string} [chunk.codec] Target codec (e.g. 'h264', 'hevc', 'av1')
 * @param {Object} [chunk.bitrateProfile] Target bitrate profile
 */
function processVideoChunk(chunk) {
  if (!chunk || !chunk.chunkId) {
    throw new Error("INVALID_CHUNK_PAYLOAD: Missing chunk identifier.");
  }

  const codec = chunk.codec || 'h264';
  const duration = chunk.videoLengthSec || 10;

  const profile = chunk.bitrateProfile || DEFAULT_PRESETS['720p_auto'];
  const targetBitrate = profile.targetBitrate || DEFAULT_PRESETS['720p_auto'].targetBitrate;
  const resolution = profile.resolution || '1280x720';

  return {
    status: 'completed',
    chunkId: chunk.chunkId,
    codec,
    targetBitrate,
    resolution,
    duration,
    fps: 60,
    framesRendered: duration * 60,
    timestamp: new Date().toISOString()
  };
}

// Set up Express worker service if executed directly
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ffmpeg-transcoder',
    uptime: process.uptime(),
    version: '2.4.0'
  });
});

app.post('/transcode', (req, res) => {
  try {
    const result = processVideoChunk(req.body);
    res.json(result);
  } catch (err) {
    console.error(`[Worker Error] ${err.message}`);
    res.status(500).json({
      error: err.message,
      exitCode: 137,
      service: 'ffmpeg-transcoder'
    });
  }
});

app.post('/simulate-crash', (req, res) => {
  const faultyChunk = {
    chunkId: `chunk-fail-${Date.now()}`,
    videoLengthSec: 15,
    codec: 'hevc',
    // Deliberately missing bitrateProfile
  };

  try {
    processVideoChunk(faultyChunk);
    res.json({ status: 'success', message: 'No crash occurred (Worker is patched!)' });
  } catch (err) {
    console.error(`[CRASH LOG] ${err.message}`);
    res.status(500).json({
      status: 'crashed',
      error: err.message,
      exitCode: 137,
      trace: err.stack
    });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 4001;
  app.listen(PORT, () => {
    console.log(`[FFmpeg Transcoder Worker] Listening on port ${PORT}`);
  });
}

module.exports = {
  processVideoChunk,
  DEFAULT_PRESETS,
  app
};
