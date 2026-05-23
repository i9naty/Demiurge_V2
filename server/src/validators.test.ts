import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  usernameSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  authPayloadSchema,
  contentSchema,
  createRoomSchema,
} from './validators';

describe('validators', () => {
  describe('emailSchema', () => {
    it('accepts valid emails', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow();
    });
    it('rejects invalid emails', () => {
      expect(() => emailSchema.parse('not-email')).toThrow();
    });
    it('rejects empty email', () => {
      expect(() => emailSchema.parse('')).toThrow();
    });
    it('rejects emails > 255 chars', () => {
      expect(() => emailSchema.parse('a'.repeat(250) + '@b.c')).toThrow();
    });
  });

  describe('usernameSchema', () => {
    it('accepts valid usernames', () => {
      expect(() => usernameSchema.parse('Player123')).not.toThrow();
      expect(() => usernameSchema.parse('Мастер_Игры')).not.toThrow();
    });
    it('rejects short usernames', () => {
      expect(() => usernameSchema.parse('ab')).toThrow();
    });
    it('rejects usernames > 32 chars', () => {
      expect(() => usernameSchema.parse('a'.repeat(33))).toThrow();
    });
    it('rejects usernames with special chars', () => {
      expect(() => usernameSchema.parse('test<script>')).toThrow();
      expect(() => usernameSchema.parse('test@user')).toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('accepts valid passwords', () => {
      expect(() => passwordSchema.parse('12345678')).not.toThrow();
    });
    it('rejects passwords < 8 chars', () => {
      expect(() => passwordSchema.parse('1234567')).toThrow();
    });
    it('rejects passwords > 128 chars', () => {
      expect(() => passwordSchema.parse('a'.repeat(129))).toThrow();
    });
  });

  describe('registerSchema', () => {
    it('accepts valid registration data', () => {
      const data = { username: 'Player1', email: 'p1@test.com', password: '12345678' };
      expect(() => registerSchema.parse(data)).not.toThrow();
    });
    it('rejects missing fields', () => {
      expect(() => registerSchema.parse({ username: 'p1' })).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      expect(() => loginSchema.parse({ email: 'a@test.com', password: '12345678' })).not.toThrow();
    });
    it('rejects empty password', () => {
      expect(() => loginSchema.parse({ email: 'a@b.c', password: '' })).toThrow();
    });
  });

  describe('authPayloadSchema', () => {
    it('accepts valid payload', () => {
      expect(() => authPayloadSchema.parse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'player1',
      })).not.toThrow();
    });
    it('defaults role to player', () => {
      const result = authPayloadSchema.parse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'player1',
      });
      expect(result.role).toBe('player');
    });
    it('rejects invalid uuid', () => {
      expect(() => authPayloadSchema.parse({
        userId: 'not-uuid',
        username: 'player1',
      })).toThrow();
    });
  });

  describe('contentSchema', () => {
    it('accepts valid content', () => {
      expect(() => contentSchema.parse('Hello world')).not.toThrow();
    });
    it('rejects empty content', () => {
      expect(() => contentSchema.parse('')).toThrow();
    });
    it('rejects content > 10000 chars', () => {
      expect(() => contentSchema.parse('a'.repeat(10001))).toThrow();
    });
  });

  describe('createRoomSchema', () => {
    it('accepts valid room', () => {
      expect(() => createRoomSchema.parse({ name: 'Test', mode: 'vtt' })).not.toThrow();
    });
    it('rejects invalid mode', () => {
      expect(() => createRoomSchema.parse({ name: 'Test', mode: 'invalid' })).toThrow();
    });
    it('rejects empty name', () => {
      expect(() => createRoomSchema.parse({ name: '', mode: 'vtt' })).toThrow();
    });
  });
});
