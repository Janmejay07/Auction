import mongoose from 'mongoose';
import { logger } from '../common/logger';

/**
 * Connect to MongoDB.
 *
 * Registers listeners for connection lifecycle events so
 * problems are surfaced through structured logging.
 */
export async function connectDatabase(uri: string): Promise<void> {
  mongoose.connection.on('error', (error: unknown) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  await mongoose.connect(uri);
  logger.info('MongoDB connected successfully');
}

/**
 * Gracefully close the MongoDB connection.
 */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}

/**
 * Return a human-readable database connection status.
 */
export function getDatabaseStatus(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] ?? 'unknown';
}
