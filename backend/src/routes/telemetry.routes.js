import { Router } from 'express';
import { telemetryController } from '../controllers/telemetry.controller.js';

const router = Router();

// Route for telemetry ingestion
// Binds endpoint POST /telemetry
router.post('/telemetry', telemetryController.ingest.bind(telemetryController));

export default router;
