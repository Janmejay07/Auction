import pino from 'pino';

/**
 * Structured application logger.
 *
 * Sensitive paths are redacted so that passwords, tokens,
 * secrets, and credentials never appear in log output.
 *
 * In test mode the log level is set to `silent` to keep
 * test output clean.
 */
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',

  redact: {
    paths: [
      'password',
      'newPassword',
      'oldPassword',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'jwt',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },

  // In development you can pipe output through pino-pretty:
  //   npm run dev | npx pino-pretty
  timestamp: pino.stdTimeFunctions.isoTime,
});
