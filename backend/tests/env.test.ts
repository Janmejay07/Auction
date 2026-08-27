import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env';

describe('Environment validation', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3000',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '7d',
    CORS_ORIGIN: 'http://localhost:5173',
  };

  it('should accept a fully valid environment', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('should return typed configuration object', () => {
    const result = validateEnv(validEnv);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000); // coerced to number
    expect(result.MONGODB_URI).toBe('mongodb://localhost:27017/test');
    expect(result.JWT_SECRET).toBe('test-secret-key');
    expect(result.JWT_EXPIRES_IN).toBe('7d');
    expect(result.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('should apply defaults for optional fields', () => {
    const minimal = {
      MONGODB_URI: 'mongodb://localhost:27017/test',
      JWT_SECRET: 'my-secret',
    };
    const result = validateEnv(minimal);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.JWT_EXPIRES_IN).toBe('7d');
    expect(result.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('should throw when MONGODB_URI is missing', () => {
    const invalid = { ...validEnv, MONGODB_URI: '' };
    expect(() => validateEnv(invalid)).toThrow('Invalid environment variables');
  });

  it('should throw when JWT_SECRET is missing', () => {
    const invalid = { ...validEnv, JWT_SECRET: '' };
    expect(() => validateEnv(invalid)).toThrow('Invalid environment variables');
  });

  it('should reject an invalid NODE_ENV value', () => {
    const invalid = { ...validEnv, NODE_ENV: 'staging' };
    expect(() => validateEnv(invalid)).toThrow('Invalid environment variables');
  });

  it('should coerce PORT from string to number', () => {
    const env = { ...validEnv, PORT: '8080' };
    const result = validateEnv(env);
    expect(result.PORT).toBe(8080);
    expect(typeof result.PORT).toBe('number');
  });

  it('should reject a negative PORT', () => {
    const invalid = { ...validEnv, PORT: '-1' };
    expect(() => validateEnv(invalid)).toThrow('Invalid environment variables');
  });
});
