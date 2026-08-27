import pinoHttp from 'pino-http';
import { logger } from '../logger';

/**
 * HTTP request logging middleware powered by pino-http.
 *
 * Health-check requests are excluded from automatic logging
 * to avoid noise.
 */
export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
});
