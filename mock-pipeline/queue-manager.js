/**
 * CutGuard AI - Video Queue Orchestrator
 * Downstream consumer service that dispatches render chunks to worker.js
 */

const { processVideoChunk } = require('./worker');

class QueueManager {
  constructor() {
    this.activeJobs = new Map();
  }

  async dispatchChunk(jobId, chunkPayload) {
    console.log(`[QueueManager] Dispatching chunk for job ${jobId}`);
    try {
      const output = processVideoChunk(chunkPayload);
      this.activeJobs.set(jobId, output);
      return output;
    } catch (err) {
      console.error(`[QueueManager] Transcoder worker crashed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = { QueueManager };
