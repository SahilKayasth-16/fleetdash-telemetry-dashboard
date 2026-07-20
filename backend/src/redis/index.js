import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

let redisClient = null;
let isConnected = false;

export function connectRedis() {
  if (redisClient) {
    return redisClient;
  }

  logger.info('Initializing Redis client...');
  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 2000);
      logger.warn(`Redis connection retry attempt ${times} after ${delay}ms`);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  redisClient.on('ready', () => {
    isConnected = true;
    logger.info('Redis client connected and ready');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });

  redisClient.on('end', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });

  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
}

export function isRedisConnected() {
  return isConnected && redisClient !== null && redisClient.status === 'ready';
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
  }
}
