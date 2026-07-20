import { Router } from 'express';
import { isDatabaseConnected } from '../database/index.js';
import { isRedisConnected } from '../redis/index.js';

const router = Router();

router.get('/health', (_req, res, next) => {
  try {
    const mongoStatus = isDatabaseConnected() ? 'connected' : 'disconnected';
    const redisStatus = isRedisConnected() ? 'connected' : 'disconnected';

    res.json({
      status: 'OK',
      mongodb: mongoStatus,
      redis: redisStatus,
      uptime: process.uptime(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
