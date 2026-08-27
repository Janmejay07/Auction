import type { Request, Response } from 'express';
import { NotFoundError } from '../errors';

/**
 * Catch-all 404 handler.
 *
 * Mounted after all other routes so that unmatched requests
 * receive a consistent error response.
 */
export function notFoundHandler(_req: Request, _res: Response): void {
  throw new NotFoundError('The requested resource was not found');
}
