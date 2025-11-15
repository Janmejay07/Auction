import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';

const BASE = '/api/v1';

describe('Authentication', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  // ─── Registration ─────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registers a new user and returns user + token (201)', async () => {
      const res = await request(app).post(`${BASE}/auth/register`).send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret1234',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user.name).toBe('Alice');
      // passwordHash must never be returned
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects duplicate email (409)', async () => {
      const payload = {
        name: 'Bob',
        email: 'bob@example.com',
        password: 'secret1234',
      };
      await request(app).post(`${BASE}/auth/register`).send(payload);

      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects short passwords (400)', async () => {
      const res = await request(app).post(`${BASE}/auth/register`).send({
        name: 'Carol',
        email: 'carol@example.com',
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing name (400)', async () => {
      const res = await request(app).post(`${BASE}/auth/register`).send({
        email: 'noname@example.com',
        password: 'secret1234',
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('logs in with correct credentials and returns token (200)', async () => {
      await request(app).post(`${BASE}/auth/register`).send({
        name: 'Dave',
        email: 'dave@example.com',
        password: 'mypassword99',
      });

      const res = await request(app).post(`${BASE}/auth/login`).send({
        email: 'dave@example.com',
        password: 'mypassword99',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('dave@example.com');
    });

    it('rejects wrong password (401)', async () => {
      await request(app).post(`${BASE}/auth/register`).send({
        name: 'Eve',
        email: 'eve@example.com',
        password: 'correct_pass',
      });

      const res = await request(app).post(`${BASE}/auth/login`).send({
        email: 'eve@example.com',
        password: 'wrong_pass',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects non-existent email (401)', async () => {
      const res = await request(app).post(`${BASE}/auth/login`).send({
        email: 'ghost@example.com',
        password: 'anypassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('error message is identical for wrong password and unknown email (timing-safe)', async () => {
      await request(app).post(`${BASE}/auth/register`).send({
        name: 'Frank',
        email: 'frank@example.com',
        password: 'correct_pass',
      });

      const wrongPass = await request(app).post(`${BASE}/auth/login`).send({
        email: 'frank@example.com',
        password: 'wrong',
      });
      const unknownEmail = await request(app).post(`${BASE}/auth/login`).send({
        email: 'noone@example.com',
        password: 'whatever',
      });

      expect(wrongPass.body.error.message).toBe(
        unknownEmail.body.error.message,
      );
    });
  });

  // ─── Me ───────────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns the authenticated user (200)', async () => {
      const reg = await request(app).post(`${BASE}/auth/register`).send({
        name: 'Grace',
        email: 'grace@example.com',
        password: 'password99',
      });
      const { token } = reg.body.data;

      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Grace');
      expect(res.body.data.user.email).toBe('grace@example.com');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects request without token (401)', async () => {
      const res = await request(app).get(`${BASE}/auth/me`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid / tampered JWT (401)', async () => {
      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects an expired JWT (401)', async () => {
      const jwt = await import('jsonwebtoken');
      const { config } = await import('../src/config');
      const expiredToken = jwt.default.sign(
        { userId: '64faabcd1234567890abcdef' },
        config.JWT_SECRET,
        { expiresIn: -10 },
      );

      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('JWT payload contains only userId and standard claims, never game state', async () => {
      const jwt = await import('jsonwebtoken');
      const reg = await request(app).post(`${BASE}/auth/register`).send({
        name: 'Henry',
        email: 'henry@example.com',
        password: 'password99',
      });
      const { token } = reg.body.data;
      const decoded = jwt.default.decode(token) as Record<string, unknown>;

      expect(decoded.userId).toBeDefined();
      expect(decoded.participantId).toBeUndefined();
      expect(decoded.purse).toBeUndefined();
      expect(decoded.bid).toBeUndefined();
      expect(decoded.auctionState).toBeUndefined();
      expect(decoded.team).toBeUndefined();
    });
  });
});
