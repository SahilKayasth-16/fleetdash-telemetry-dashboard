import dotenv from 'dotenv';
import { z } from 'zod';
import os from 'os';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().url({ message: 'MONGODB_URI must be a valid connection URL' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection URL' }),
  CORS_ORIGIN: z.string().default('*'),
  WORKER_POOL_SIZE: z.coerce.number().optional(),
  QUEUE_LIMIT: z.coerce.number().default(10000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

// Dynamically compute default worker pool size based on CPU cores
const defaultPoolSize = Math.max(1, os.cpus().length - 1);

export const config = {
  port: parsedEnv.data.PORT,
  nodeEnv: parsedEnv.data.NODE_ENV,
  mongodbUri: parsedEnv.data.MONGODB_URI,
  redisUrl: parsedEnv.data.REDIS_URL,
  corsOrigin: parsedEnv.data.CORS_ORIGIN,
  workerPoolSize: parsedEnv.data.WORKER_POOL_SIZE ?? defaultPoolSize,
  queueLimit: parsedEnv.data.QUEUE_LIMIT,
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isTest: parsedEnv.data.NODE_ENV === 'test',
};

export default config;
