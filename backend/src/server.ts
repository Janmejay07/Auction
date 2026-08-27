import http from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './common/logger';
import { connectDatabase, disconnectDatabase } from './database/connection';
import { createSocketServer } from './websocket';
import { PlayerRepository } from './players/player.repository';

const playerRepository = new PlayerRepository();

async function bootstrap(): Promise<void> {
  // ---- MongoDB ----
  await connectDatabase(config.MONGODB_URI);
  await playerRepository.seedDefaultsIfEmpty();

  // ---- HTTP + Socket.IO ----
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer, config.CORS_ORIGIN);

  // ---- Start listening ----
  httpServer.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV },
      'Server is running',
    );
  });

  // ---- Graceful shutdown ----
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    // Stop accepting new connections
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Socket.IO connections
    io.close(() => {
      logger.info('Socket.IO server closed');
    });

    // Close MongoDB connection
    await disconnectDatabase();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Log unhandled rejections instead of silently swallowing them
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception – shutting down');
    process.exit(1);
  });
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
