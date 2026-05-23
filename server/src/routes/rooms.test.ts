import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-key-32chars!!!!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-key-32chars!!!!';
process.env.JWT_GUEST_SECRET = 'test-guest-key-32chars!!!!!';
process.env.SESSION_SECRET = 'test-session';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'test://';
process.env.REDIS_URL = 'redis://';
process.env.REDIS_PASSWORD = 'test';
process.env.DB_PASSWORD = 'test';

vi.mock('../config/env', () => ({
  env: {
    PORT: 3001, NODE_ENV: 'test', JWT_SECRET: 'test-secret-key-32chars!!!!!',
    JWT_REFRESH_SECRET: 'test-refresh-key-32chars!!!!', JWT_GUEST_SECRET: 'test-guest-key-32chars!!!!!',
    SESSION_SECRET: 'test-session', DATABASE_URL: 'test://', REDIS_URL: 'redis://',
    REDIS_PASSWORD: 'test', DB_USER: 'test', DB_PASSWORD: 'test',
    DB_NAME: 'test', DB_PORT: 5432, ROUTERAI_API_KEY: '', ROUTERAI_BASE_URL: '',
    YUKASSA_SHOP_ID: '', YUKASSA_SECRET_KEY: '', CORS_ORIGINS: ['http://localhost:5173'],
  },
}));

vi.mock('../config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  runMigrations: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
}));

import jwt from 'jsonwebtoken';
import { roomsRouter } from '../routes/rooms';
import { query } from '../config/database';
const mockQuery = query as ReturnType<typeof vi.fn>;

function authHeader(userId: string, username: string): string {
  return `Bearer ${jwt.sign({ userId, username, role: 'player' }, 'test-secret-key-32chars!!!!!', { expiresIn: '1h' })}`;
}

describe('Rooms API', () => {
  let app: express.Express;
  const token = authHeader('owner-1', 'GM');
  const roomId = 'room-uuid-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/rooms', roomsRouter);
  });

  describe('POST /api/rooms', () => {
    it('creates a new room', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert
      mockQuery.mockResolvedValueOnce({ rows: [] }); // participant
      mockQuery.mockResolvedValueOnce({ rows: [] }); // world state

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({ name: 'Test Room', mode: 'vtt' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Room');
      expect(res.body.data.inviteCode).toBeTruthy();
    });

    it('rejects room with empty name', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({ name: '', mode: 'vtt' });

      expect(res.status).toBe(400);
    });

    it('requires auth', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ name: 'Test', mode: 'vtt' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/rooms/public', () => {
    it('returns public rooms', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: roomId, name: 'Public', mode: 'vtt' }] });

      const res = await request(app).get('/api/rooms/public');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('handles server errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      const res = await request(app).get('/api/rooms/public');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('returns room details', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: roomId, name: 'My Room', mode: 'vtt', owner_id: 'owner-1' }],
      });

      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('My Room');
    });

    it('returns 404 for missing room', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/rooms/nonexistent`)
        .set('Authorization', token);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/rooms/:id/join', () => {
    it('joins a room', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room exists
      mockQuery.mockResolvedValueOnce({ rows: [] }); // check participant
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert participant
      mockQuery.mockResolvedValueOnce({ rows: [] }); // initPlayerInventory

      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('requires auth', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`);

      expect(res.status).toBe(401);
    });
  });
});
