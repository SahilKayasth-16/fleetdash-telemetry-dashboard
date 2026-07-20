import { workerPool } from '../workers/worker-pool.js';

export class TelemetryService {
  /**
   * Delegates incoming raw telemetry processing to the worker pool.
   * Awaits worker response and returns the processed, validated telemetry.
   */
  async ingestTelemetry(payload) {
    return await workerPool.execute(payload);
  }
}

// Export singleton instance of TelemetryService
export const telemetryService = new TelemetryService();
export default telemetryService;
