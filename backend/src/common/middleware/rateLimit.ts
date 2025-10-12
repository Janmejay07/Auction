import type { Request, Response, NextFunction } from 'express';
import { ConflictError } from '../errors';

const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 300;

export function restRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const recent = (requests.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    return next(new ConflictError('Too many requests; please retry shortly', 'RATE_LIMITED'));
  }
  recent.push(now);
  requests.set(key, recent);
  next();
}