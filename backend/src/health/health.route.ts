import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDatabaseStatus } from '../database/connection';

const healthRouter = Router();

/**
 * GET /health
 *
 * Returns the overall service health, including the
 * current MongoDB connection status.
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  const database = getDatabaseStatus();
  const isHealthy = database === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'unhealthy',
    database,
  });
});

export { healthRouter };
