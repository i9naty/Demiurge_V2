import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;

vi.mock('../config/env', () => ({
  env: {
    PORT: 3001,
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-32chars-minimum!!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32chars-min!',
    JWT_GUEST_SECRET: 'test-guest-secret-32chars-min!',
    SESSION_SECRET: 'test-session-secret',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    REDIS_PASSWORD: 'test',
    DB_USER: 'test',
    DB_PASSWORD: 'test',
    DB_NAME: 'demiurge_test',
    DB_PORT: 5432,
    ROUTERAI_API_KEY: '',
    ROUTERAI_BASE_URL: 'https://test.com',
    YUKASSA_SHOP_ID: '',
    YUKASSA_SECRET_KEY: '',
    CORS_ORIGINS: ['http://localhost:5173'],
  },
}));

vi.mock('../config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  runMigrations: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
}));

vi.mock('../config/redis', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
  redisDisconnect: vi.fn().mockResolvedValue(undefined),
}));

import { authRouter } from '../routes/auth';
import { query } from '../config/database';
const mockQuery = query as ReturnType<typeof vi.fn>;

describe('Auth API', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'NewPlayer', email: 'new@test.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('NewPlayer');
      expect(res.body.data.token).toBeTruthy();
    });

    it('rejects duplicate username', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'x' }] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'Player1', email: 'p1@test.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', email: 'not-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-1', username: 'Player1', email: 'p1@test.com',
          password_hash: passwordHash, role: 'player',
          avatar_url: null, display_name: 'Player1',
        }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'p1@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
    });

    it('rejects invalid credentials', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('refreshes a valid token', async () => {
      const refreshPayload = { userId: '550e8400-e29b-41d4-a716-446655440000', username: 'Player1' };
      const refreshToken = jwt.sign(refreshPayload, 'test-refresh-secret-32chars-min!', { expiresIn: '30d' });

      mockQuery.mockResolvedValueOnce({
        rows: [{ username: 'Player1', role: 'player', is_guest: false }],
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();
    });

    it('rejects invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
