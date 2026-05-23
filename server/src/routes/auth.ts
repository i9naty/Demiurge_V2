import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware, generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { env } from '../config/env';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validators';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

// Регистрация
authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    const existing = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Пользователь или email уже занят' } });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = uuid();

    await query(
      `INSERT INTO users (id, username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, username, email, passwordHash, username]
    );

    const token = generateToken({ userId, username, role: 'player' });
    const refreshToken = generateRefreshToken({ userId, username, role: 'player' });

    res.status(201).json({
      success: true,
      data: {
        user: { id: userId, username, email, role: 'player', displayName: username, avatarUrl: null },
        token,
        refreshToken,
      },
    });
  } catch (err) {
    console.error('Register error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при регистрации' } });
  }
});

// Логин
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    let result = await query(
      'SELECT id, username, email, password_hash, role, avatar_url, display_name FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      result = await query(
        'SELECT id, username, email, password_hash, role, avatar_url, display_name FROM users WHERE username = $1',
        [email]
      );
    }

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' } });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' } });
      return;
    }

    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({ userId: user.id, username: user.username, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, username: user.username, role: user.role });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatar_url,
          displayName: user.display_name,
        },
        token,
        refreshToken,
      },
    });
  } catch (err) {
    console.error('Login error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при входе' } });
  }
});

// Гостевой вход
authRouter.post('/guest', async (_req: Request, res: Response) => {
  try {
    const guestId = uuid();
    const guestName = `Гость_${guestId.slice(0, 6)}`;
    const passwordHash = await bcrypt.hash(guestId, BCRYPT_ROUNDS);

    await query(
      `INSERT INTO users (id, username, email, password_hash, display_name, is_guest)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [guestId, guestName, `${guestId}@guest.demiurge`, passwordHash, guestName]
    );

    const token = generateToken({ userId: guestId, username: guestName, role: 'player', isGuest: true });
    const refreshToken = generateRefreshToken({ userId: guestId, username: guestName, role: 'player' });

    res.status(201).json({
      success: true,
      data: {
        user: { id: guestId, username: guestName, email: '', role: 'player', isGuest: true },
        token,
        refreshToken,
      },
    });
  } catch (err) {
    console.error('Guest login error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка при гостевом входе' } });
  }
});

// Профиль текущего пользователя
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, username, email, avatar_url, display_name, bio, role, subscription_tier, is_guest, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });
      return;
    }

    const u = result.rows[0];
    res.json({
      success: true,
      data: {
        id: u.id,
        username: u.username,
        email: u.email,
        avatarUrl: u.avatar_url,
        displayName: u.display_name,
        bio: u.bio,
        role: u.role,
        subscriptionTier: u.subscription_tier,
        isGuest: u.is_guest,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    console.error('Get me error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка получения профиля' } });
  }
});

// Обновление профиля
authRouter.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { displayName, bio } = req.body;
    await query(
      'UPDATE users SET display_name = COALESCE($1, display_name), bio = COALESCE($2, bio), updated_at = NOW() WHERE id = $3',
      [displayName, bio, req.user!.userId]
    );
    res.json({ success: true, data: {} });
  } catch (err) {
    console.error('Update profile error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка обновления профиля' } });
  }
});

// Загрузка аватарки
authRouter.post('/avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body;
    if (!imageData || !imageData.startsWith('data:image/')) {
      res.status(400).json({ success: false, error: { code: 'INVALID_FORMAT', message: 'Пришлите изображение в base64 (data:image/...)' } });
      return;
    }
    const ext = imageData.match(/data:image\/(\w+)/)?.[1] || 'png';
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
    if (buf.length > MAX_AVATAR_SIZE) {
      res.status(400).json({ success: false, error: { code: 'TOO_LARGE', message: 'Максимальный размер: 5MB' } });
      return;
    }
    const filename = `avatar-${req.user!.userId}.${ext}`;
    const fs = await import('fs/promises');
    await fs.default.mkdir('uploads/avatars', { recursive: true });
    await fs.default.writeFile(`uploads/avatars/${filename}`, buf);
    const url = `/uploads/avatars/${filename}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, req.user!.userId]);
    res.json({ success: true, data: { avatarUrl: url } });
  } catch (err) {
    console.error('Avatar upload error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка загрузки аватарки' } });
  }
});

// Обновление токена
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'refreshToken обязателен' } });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);

    const result = await query(
      'SELECT username, role, is_guest FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' } });
      return;
    }

    const user = result.rows[0];

    const newToken = generateToken({
      userId: payload.userId,
      username: user.username,
      role: user.role,
      isGuest: user.is_guest,
    });
    const newRefresh = generateRefreshToken({
      userId: payload.userId,
      username: user.username,
      role: user.role,
    });

    res.json({ success: true, data: { token: newToken, refreshToken: newRefresh } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('Refresh error:', message);
    res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH', message: 'Недействительный refresh-токен' } });
  }
});
