import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { logger } from './logger/index.js';
import { connectDatabase, disconnectDatabase } from './database/index.js';
import { connectRedis, disconnectRedis } from './redis/index.js';
import { workerPool } from './workers/worker-pool.js';
import { initializeSocket } from './socket/socket.js';
import { redisSubscriberService } from './services/redisSubscriber.service.js';

let server;

async function startServer() {
  try {
    // 1. Establish database connection
    await connectDatabase();

    // 2. Establish Redis connection
    connectRedis();

    // 3. Initialize WorkerPool
    workerPool.initialize();

    // 4. Create HTTP Server
    server = http.createServer(app);

    // 5. Initialize Socket.io Server (attaches to HTTP listener)
    initializeSocket(server);

    // 6. Initialize Redis Subscriber (subscribes to telemetry events channel)
    redisSubscriberService.initialize();

    // 7. Start listening
    server.listen(config.port, () => {
      logger.info(
        `🚀 FleetDash Backend listening on port ${config.port} in ${config.nodeEnv} mode`,
      );
    });

    // 8. Setup signal interceptors for graceful shutdowns
    const handleShutdown = async (signal) => {
      logger.warn(`Received ${signal}. Starting graceful shutdown...`);

      // Close Express Server first to stop accepting new requests
      if (server) {
        server.close(async (err) => {
          if (err) {
            logger.error('Error closing HTTP server:', err);
          } else {
            logger.info('HTTP server closed successfully');
          }

          try {
            // Disconnect subscriber, shutdown pool, and close DB links
            await redisSubscriberService.shutdown();
            await workerPool.shutdown();
            await disconnectDatabase();
            await disconnectRedis();
            logger.info('Graceful shutdown completed. Exiting process.');
            process.exit(0);
          } catch (dbError) {
            logger.error('Error during database disconnects:', dbError);
            process.exit(1);
          }
        });

        // Set a timeout to force exit if server takes too long to close
        setTimeout(() => {
          logger.error('Graceful shutdown timed out. Forcing process exit.');
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.error('FATAL: Failed to start FleetDash application server:', error);
    process.exit(1);
  }
}

// Global unhandled promise rejection trap
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection caught:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception caught:', error);
  process.exit(1);
});

// Boot the application
startServer();
