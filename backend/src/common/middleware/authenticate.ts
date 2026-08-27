import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors';

/**
 * Express middleware that validates the Bearer JWT in the
 * Authorization header and attaches `userId` and `user` to the request.
 *
 * Routes that require authentication must use this middleware.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.user = {
      id: payload.userId,
      userId: payload.userId,
    };
    next();
  } catch (err) {
    next(err);
  }
}
