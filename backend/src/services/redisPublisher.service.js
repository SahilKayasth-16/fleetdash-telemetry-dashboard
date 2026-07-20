import { getRedisClient } from '../redis/index.js';
import { logger } from '../logger/index.js';

export class RedisPublisherService {
  constructor() {
    this.channelName = 'telemetry:ingested';
  }

  /**
   * Publishes processed telemetry JSON payload to Redis pub/sub channel.
   *
   * @param {Object} processedTelemetry - Processed telemetry object.
   * @returns {Promise<number>} Number of subscribers that received the message.
   */
  async publishTelemetry(processedTelemetry) {
    try {
      const client = getRedisClient();
      const message = JSON.stringify(processedTelemetry);

      logger.debug(
        `Publishing telemetry event for vehicle ${processedTelemetry.vehicleId} to Redis...`,
      );
      const receiverCount = await client.publish(this.channelName, message);

      logger.info(
        `Redis pub success: ${processedTelemetry.vehicleId} on channel "${this.channelName}". Receivers: ${receiverCount}`,
      );
      return receiverCount;
    } catch (error) {
      logger.error(
        `Redis publish failure on channel "${this.channelName}" for vehicle ${processedTelemetry.vehicleId}:`,
        error,
      );
      // Suppress crash as per rules: "Do not crash the backend"
      return 0;
    }
  }
}

// Export singleton instance of RedisPublisherService
export const redisPublisherService = new RedisPublisherService();
export default redisPublisherService;
