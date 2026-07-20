import { logger } from '../logger/index.js';
import { serializeTelemetry } from '../utils/binarySerializer.js';

let activeConnections = 0;

/**
 * Registers events on Socket.io Server.
 *
 * @param {import('socket.io').Server} io - Socket.io Server instance.
 */
export function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    activeConnections++;
    logger.info(
      `Socket client connected. ID: ${socket.id}. Total active connections: ${activeConnections}`,
    );

    // Push initial gateway status
    socket.emit('server:status', {
      status: 'OK',
      connectedClients: activeConnections,
      timestamp: new Date().toISOString(),
    });

    // Handle heartbeat polls
    socket.on('heartbeat', (data) => {
      socket.emit('heartbeat:ack', {
        receivedAt: new Date().toISOString(),
        clientTime: data?.time,
      });
    });

    // Handle disconnects
    socket.on('disconnect', (reason) => {
      activeConnections = Math.max(0, activeConnections - 1);
      logger.info(
        `Socket client disconnected. ID: ${socket.id}. Reason: ${reason}. Total active connections: ${activeConnections}`,
      );
    });
  });
}

/**
 * Serializes telemetry payload to binary Buffer and broadcasts it to all connected sockets.
 *
 * @param {import('socket.io').Server} io - Socket.io Server instance.
 * @param {Object} telemetryData - Raw telemetry JSON object.
 */
export function broadcastTelemetryUpdate(io, telemetryData) {
  if (!io) {
    logger.warn('Socket.io server instance is not initialized. Skipping broadcast.');
    return;
  }

  try {
    // 1. Convert JSON to binary payload
    const binaryBuffer = serializeTelemetry(telemetryData);

    // 2. Broadcast binary buffer
    io.emit('telemetry:update', binaryBuffer);

    logger.info(
      `Socket broadcast success: ${telemetryData.vehicleId} emitted in binary (${binaryBuffer.length} bytes) to ${activeConnections} active clients.`,
    );
  } catch (error) {
    logger.error(
      `Socket broadcast serialization error for vehicle ${telemetryData?.vehicleId}:`,
      error,
    );
  }
}

export function getActiveConnectionsCount() {
  return activeConnections;
}

export default { registerSocketEvents, broadcastTelemetryUpdate, getActiveConnectionsCount };
