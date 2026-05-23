import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';

describe('auth middleware', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const username = 'testuser';

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-32chars-minimum';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-min';
    process.env.JWT_GUEST_SECRET = 'test-guest-secret-32chars-min';
    process.env.NODE_ENV = 'production';
  });

  describe('generateToken', () => {
    it('generates a JWT token', () => {
      const token = generateToken({ userId, username, role: 'player' });
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('generates different tokens for different users', () => {
      const t1 = generateToken({ userId, username, role: 'player' });
      const t2 = generateToken({ userId: 'other-id-1111-1111-1111-111111111111', username: 'other', role: 'player' });
      expect(t1).not.toBe(t2);
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a refresh token', () => {
      const token = generateRefreshToken({ userId, username, role: 'player' });
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies a valid refresh token', () => {
      const token = generateRefreshToken({ userId, username, role: 'player' });
      const payload = verifyRefreshToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload.username).toBe(username);
    });

    it('throws on invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });

    it('throws on access token used as refresh', () => {
      const accessToken = generateToken({ userId, username, role: 'player' });
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
