import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import {
  requestLogger,
  notFoundHandler,
  errorHandler,
  restRateLimit,
} from './common/middleware';
import { healthRouter } from './health/health.route';
import { authRouter } from './auth/auth.route';
import { roomRouter } from './rooms/room.route';
import { playerRouter } from './players/player.route';
import { squadRouter } from './squads/squad.route';

const app = express();

// --------------- Security ---------------
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// --------------- Body parsing ---------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', restRateLimit);

// --------------- Request logging ---------------
app.use(requestLogger);

// --------------- Routes ---------------
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Football Auction API',
    status: 'ok',
    health: '/health',
  });
});
app.use(healthRouter);
app.use('/api', authRouter);
app.use('/api', roomRouter);
app.use('/api', playerRouter);
app.use('/api', squadRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', roomRouter);
app.use('/api/v1', playerRouter);
app.use('/api/v1', squadRouter);

// --------------- Error handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
