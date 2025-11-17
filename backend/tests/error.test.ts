import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../src/common/errors';

describe('Error response format', () => {
  it('should return 404 with structured error for unknown routes', async () => {
    const response = await request(app).get('/api/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  it('should include success: false in every error response', async () => {
    const response = await request(app).delete('/does-not-exist');

    expect(response.body.success).toBe(false);
  });

  it('should include code and message in the error object', async () => {
    const response = await request(app).get('/nope');

    expect(response.body.error).toBeDefined();
    expect(typeof response.body.error.code).toBe('string');
    expect(typeof response.body.error.message).toBe('string');
  });
});

describe('Error classes', () => {
  it('AppError should have correct properties', () => {
    const error = new AppError('test', 400, 'TEST_ERROR');
    expect(error.message).toBe('test');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('ValidationError should default to 400', () => {
    const error = new ValidationError();
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('AuthenticationError should default to 401', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('AuthorizationError should default to 403', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('NotFoundError should default to 404', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('ConflictError should default to 409', () => {
    const error = new ConflictError();
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('should allow custom messages', () => {
    const error = new NotFoundError('Player not found');
    expect(error.message).toBe('Player not found');
  });

  it('should preserve prototype chain for instanceof checks', () => {
    const error = new ValidationError('bad input');
    expect(error instanceof ValidationError).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
