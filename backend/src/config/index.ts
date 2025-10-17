import dotenv from 'dotenv';

// Load .env before validation
dotenv.config();

export { envSchema, validateEnv } from './env';
export type { Env } from './env';

import { validateEnv } from './env';

/**
 * Validated application configuration.
 *
 * Importing this module triggers dotenv + Zod validation.
 * If any required variable is missing the process will crash
 * early with a descriptive error.
 */
export const config = validateEnv();
