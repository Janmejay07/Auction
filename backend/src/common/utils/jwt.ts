import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError } from '../errors';

/** Minimal JWT payload – never include mutable game state. */
export interface JwtPayload {
  userId: string;
}

/**
 * Sign a JWT token containing only the userId.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify and decode a JWT token.
 *
 * @throws UnauthorizedError when the token is invalid or expired
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
