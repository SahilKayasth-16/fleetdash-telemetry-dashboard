import { parentPort, isMainThread } from 'worker_threads';
import { rawTelemetrySchema } from '../utils/validation.js';

// Prevent executing directly in the main thread
if (isMainThread) {
  // eslint-disable-next-line no-console
  console.error('❌ Telemetry worker script cannot be executed on the main thread directly.');
  process.exit(1);
}

if (!parentPort) {
  // eslint-disable-next-line no-console
  console.error('❌ parentPort is not available.');
  process.exit(1);
}

// Listen for messages from the parent thread
parentPort.on('message', (message) => {
  const { taskId, payload } = message;

  try {
    // 1. Perform strict schema validation using Zod
    const validationResult = rawTelemetrySchema.safeParse(payload);

    if (!validationResult.success) {
      // Return structured validation errors
      const formattedErrors = validationResult.error.flatten().fieldErrors;
      parentPort.postMessage({
        taskId,
        success: false,
        type: 'VALIDATION_ERROR',
        errors: formattedErrors,
      });
      return;
    }

    const validatedData = validationResult.data;

    // 2. Perform normalization and parsing
    const processedTelemetry = {
      vehicleId: validatedData.vehicleId,
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
      speed: Number(validatedData.speed.toFixed(2)),
      heading: validatedData.heading,
      timestamp: new Date(validatedData.timestamp),
      ingestedAt: new Date(),
    };

    // 3. Return the processed payload to the main thread
    parentPort.postMessage({
      taskId,
      success: true,
      data: processedTelemetry,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown processing error';
    parentPort.postMessage({
      taskId,
      success: false,
      type: 'PROCESSING_ERROR',
      message: errMsg,
    });
  }
});
