import { telemetryService } from '../services/telemetry.service.js';

export class TelemetryController {
  /**
   * HTTP Handler for ingesting telemetry.
   * Receives request, passes it down to the worker pool, and returns processed response.
   */
  async ingest(req, res, _next) {
    try {
      const payload = req.body;

      // Basic structure validation to reject empty payloads early
      if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
        res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Empty or invalid telemetry payload received',
        });
        return;
      }

      // Delegate CPU-intensive validation and processing to worker pool
      const processedTelemetry = await telemetryService.ingestTelemetry(payload);

      // Return processed telemetry with 201 Created status
      res.status(201).json({
        status: 'success',
        statusCode: 201,
        data: processedTelemetry,
      });
    } catch (error) {
      // Safely read properties
      const err = error || {};
      const message = err.message || 'Internal telemetry processing error';
      let statusCode = err.statusCode || 500;

      // 1. Check for Validation errors returned from worker thread
      if (err.errors) {
        statusCode = 400;
        res.status(statusCode).json({
          status: 'error',
          statusCode,
          message: 'Validation failed',
          errors: err.errors,
        });
        return;
      }

      // 2. Map known WorkerPool error messages to correct HTTP status codes
      if (message.includes('timed out')) {
        statusCode = 504; // Gateway Timeout
      } else if (
        message.includes('capacity reached') ||
        message.includes('shutting down') ||
        message.includes('terminated')
      ) {
        statusCode = 503; // Service Unavailable
      }

      res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
      });
    }
  }
}

// Export singleton instance of TelemetryController
export const telemetryController = new TelemetryController();
export default telemetryController;
