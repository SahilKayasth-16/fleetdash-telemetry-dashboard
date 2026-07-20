import { Server } from 'socket.io';
import { logger } from '../logger/index.js';
import { registerSocketEvents } from './socketEvents.js';

let ioInstance = null;

/**
 * Initializes Socket.io Server instance.
 *
 * @param {Object} httpServer - HTTP Server instance.
 * @returns {Server} Socket.io Server instance.
 */
export function initializeSocket(httpServer) {
  if (ioInstance) {
    return ioInstance;
  }

  logger.info('Initializing Socket.io server...');

  // Set up socket server with web sockets transport configuration
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*', // Allow dashboard connection checks
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'],
  });

  registerSocketEvents(ioInstance);

  return ioInstance;
}

/**
 * Returns the active Socket.io Server instance.
 *
 * @returns {Server|null} Socket.io Server instance.
 */
export function getSocketIO() {
  return ioInstance;
}

export default { initializeSocket, getSocketIO };
