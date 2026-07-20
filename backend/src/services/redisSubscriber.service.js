import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import { getSocketIO } from '../socket/socket.js';
import { broadcastTelemetryUpdate } from '../socket/socketEvents.js';

export class RedisSubscriberService {
  constructor() {
    this.channelName = 'telemetry:ingested';
    this.subscriberClient = null;
  }

  /**
   * Spawns a dedicated Redis connection to listen on channels.
   */
  initialize() {
    logger.info(`⚙️ Initializing Redis Subscriber for channel: "${this.channelName}"...`);

    this.subscriberClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 2000);
        logger.warn(`Redis Subscriber connection retry attempt ${times} after ${delay}ms`);
        return delay;
      },
    });

    this.subscriberClient.on('connect', () => {
      logger.info('Redis Subscriber client connecting...');
    });

    this.subscriberClient.on('ready', async () => {
      logger.info('Redis Subscriber connection established. Subscribing to channel...');
      try {
        await this.subscriberClient.subscribe(this.channelName);
        logger.info(`Redis subscribe success: Listening on channel "${this.channelName}"`);
      } catch (err) {
        logger.error(`Failed to subscribe to channel "${this.channelName}":`, err);
      }
    });

    // Listen to messages emitted by publisher
    this.subscriberClient.on('message', (channel, message) => {
      if (channel === this.channelName) {
        this.handleMessage(message);
      }
    });

    this.subscriberClient.on('error', (err) => {
      logger.error('Redis Subscriber connection error:', err);
    });

    this.subscriberClient.on('end', () => {
      logger.warn('Redis Subscriber connection ended.');
    });
  }

  /**
   * Handles messages received from Redis Pub/Sub.
   * Parses JSON payload and triggers Socket.io binary broadcast.
   *
   * @param {string} message - JSON string payload.
   */
  handleMessage(message) {
    try {
      logger.debug('Redis subscriber received message event, processing...');
      const telemetryData = JSON.parse(message);

      // Fetch the active Socket.io instance
      const io = getSocketIO();

      // Broadcast payload to all connected clients in binary format
      broadcastTelemetryUpdate(io, telemetryData);
    } catch (error) {
      logger.error('Redis subscriber failed to parse message packet:', error);
    }
  }

  /**
   * Graceful disconnect of subscriber.
   */
  async shutdown() {
    if (this.subscriberClient) {
      logger.warn('Disconnecting Redis Subscriber...');
      try {
        await this.subscriberClient.quit();
        logger.info('Redis Subscriber disconnected cleanly.');
      } catch (err) {
        logger.error('Error closing Redis Subscriber:', err);
      }
      this.subscriberClient = null;
    }
  }
}

// Export singleton instance of RedisSubscriberService
export const redisSubscriberService = new RedisSubscriberService();
export default redisSubscriberService;
