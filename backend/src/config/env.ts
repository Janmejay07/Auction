import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables against the schema.
 *
 * @param values – object to validate (defaults to `process.env`)
 * @returns validated and typed configuration
 * @throws Error when validation fails
 */
export function validateEnv(
  values: Record<string, unknown> = process.env,
): Env {
  const result = envSchema.safeParse(values);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(fieldErrors)
      .map(([field, errors]) => `  ${field}: ${(errors ?? []).join(', ')}`)
      .join('\n');

    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
}
