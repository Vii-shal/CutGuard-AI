/**
 * CutGuard AI - Stream Stitcher Service
 * Downstream consumer service that aggregates transcoded segments
 */

const { processVideoChunk, DEFAULT_PRESETS } = require('./worker');

function stitchStream(chunks) {
  console.log(`[StreamStitcher] Preparing to stitch ${chunks.length} chunks`);
  return chunks.map(chunk => processVideoChunk(chunk));
}

module.exports = { stitchStream };
