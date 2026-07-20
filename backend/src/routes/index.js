import { Router } from 'express';
import healthRouter from './health.routes.js';
import telemetryRouter from './telemetry.routes.js';

const router = Router();

// Mount routes
router.use('/', healthRouter);
router.use('/', telemetryRouter);

export default router;
