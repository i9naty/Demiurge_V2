import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware, generateToken, generateRefreshToken } from '../middleware/auth';
import { env } from '../config/env';

export const authRouter = Router();

// Регистрация
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email и password обязательны' });
      return;
    }

    if (username.length < 3 || username.length > 32) {
      res.status(400).json({ error: 'Имя пользователя от 3 до 32 символов' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Пароль минимум 8 символов' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Пользователь или email уже занят' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuid();

    await query(
      `INSERT INTO users (id, username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, username, email, passwordHash, username]
    );

    const token = generateToken({ userId, username, role: 'player' });
    const refreshToken = generateRefreshToken({ userId, username, role: 'player' });

    res.status(201).json({
      user: { id: userId, username, email, role: 'player', displayName: username, avatarUrl: null },
      token,
      refreshToken,
    });
  } catch (err: any) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Логин
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'username и password обязательны' });
      return;
    }

    let result = await query(
      'SELECT id, username, email, password_hash, role, avatar_url, display_name FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      result = await query(
        'SELECT id, username, email, password_hash, role, avatar_url, display_name FROM users WHERE email = $1',
        [username]
      );
    }

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({ userId: user.id, username: user.username, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, username: user.username, role: user.role });

    res.json({
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
    });
  } catch (err: any) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Гостевой вход
authRouter.post('/guest', async (_req: Request, res: Response) => {
  try {
    const guestId = uuid();
    const guestName = `Гость_${guestId.slice(0, 6)}`;
    const passwordHash = await bcrypt.hash(guestId, 4);

    await query(
      `INSERT INTO users (id, username, email, password_hash, display_name, is_guest)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [guestId, guestName, `${guestId}@guest.demiurge`, passwordHash, guestName]
    );

    const token = generateToken({ userId: guestId, username: guestName, role: 'player' });
    const refreshToken = generateRefreshToken({ userId: guestId, username: guestName, role: 'player' });

    res.status(201).json({
      user: { id: guestId, username: guestName, email: '', role: 'player', isGuest: true },
      token,
      refreshToken,
    });
  } catch (err: any) {
    console.error('Guest login error:', err.message);
    res.status(500).json({ error: 'Ошибка при гостевом входе' });
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
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const u = result.rows[0];
    res.json({
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
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения профиля' });
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
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Загрузка аватарки
authRouter.post('/avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body;
    if (!imageData || !imageData.startsWith('data:image/')) {
      res.status(400).json({ error: 'Пришлите изображение в base64 (data:image/...)' });
      return;
    }
    const ext = imageData.match(/data:image\/(\w+)/)?.[1] || 'png';
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    if (buf.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Максимальный размер: 5MB' });
      return;
    }
    const filename = `avatar-${req.user!.userId}.${ext}`;
    const fs = await import('fs/promises');
    await fs.default.mkdir('uploads/avatars', { recursive: true });
    await fs.default.writeFile(`uploads/avatars/${filename}`, buf);
    const url = `/uploads/avatars/${filename}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, req.user!.userId]);
    res.json({ avatarUrl: url });
  } catch (err: any) {
    console.error('Avatar upload error:', err.message);
    res.status(500).json({ error: 'Ошибка загрузки аватарки' });
  }
});

// Обновление токена
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken обязателен' });
      return;
    }

    const payload = jwt.verify(refreshToken, env.JWT_SECRET) as any;

    const newToken = generateToken({ userId: payload.userId, username: payload.username, role: payload.role });
    const newRefresh = generateRefreshToken({ userId: payload.userId, username: payload.username, role: payload.role });

    res.json({ token: newToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Недействительный refresh-токен' });
  }
});
