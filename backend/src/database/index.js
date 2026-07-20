import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

export async function connectDatabase() {
  try {
    mongoose.connection.on('connecting', () => {
      logger.info('Connecting to MongoDB...');
    });

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection lost/disconnected');
    });

    await mongoose.connect(config.mongodbUri);
  } catch (error) {
    logger.error('Failed to establish initial MongoDB connection:', error);
    throw error;
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
