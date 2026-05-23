import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { ok, fail } from '../middleware/response';

export const dmRouter = Router();

// Search users for DM — MUST be before /:userId to avoid route collision
dmRouter.get('/search/:query', authMiddleware, async (req: Request, res: Response) => {
  try {
    const q = `%${req.params.query}%`;
    const result = await query(
      `SELECT id, username, display_name, avatar_url
       FROM users WHERE (username ILIKE $1 OR display_name ILIKE $1) AND id != $2
       LIMIT 10`,
      [q, req.user!.userId]
    );
    ok(res, result.rows);
  } catch (err: any) {
    console.error('DM search error:', err.message);
    fail(res, 'SERVER_ERROR', 'Ошибка поиска', 500);
  }
});

// Unread count — MUST be before /:userId
dmRouter.get('/unread/count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM direct_messages WHERE receiver_id = $1 AND is_read = false',
      [req.user!.userId]
    );
    ok(res, { count: parseInt(result.rows[0].count) });
  } catch (err: any) {
    console.error('DM unread error:', err.message);
    ok(res, { count: 0 });
  }
});

// Get DM conversations list
dmRouter.get('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (u.id) u.id, u.username, u.display_name, u.avatar_url,
        (SELECT content FROM direct_messages
         WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM direct_messages
         WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id)
         ORDER BY created_at DESC LIMIT 1) as last_at,
        (SELECT COUNT(*) FROM direct_messages
         WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false) as unread
       FROM users u
       WHERE u.id IN (
         SELECT sender_id FROM direct_messages WHERE receiver_id = $1
         UNION SELECT receiver_id FROM direct_messages WHERE sender_id = $1
       )
       ORDER BY u.id, last_at DESC`,
      [req.user!.userId]
    );
    ok(res, result.rows);
  } catch (err: any) {
    console.error('DM conversations error:', err.message);
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки диалогов', 500);
  }
});

// Get messages with a specific user — MUST be last
dmRouter.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetId = req.params.userId as string;
    if (targetId === 'search' || targetId.startsWith('unread')) {
      fail(res, 'INVALID_INPUT', 'Некорректный ID пользователя', 400);
      return;
    }

    await query(
      `UPDATE direct_messages SET is_read = true
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`,
      [targetId, req.user!.userId]
    );

    const result = await query(
      `SELECT dm.*, s.username as sender_name, s.avatar_url as sender_avatar
       FROM direct_messages dm JOIN users s ON dm.sender_id = s.id
       WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
          OR (dm.sender_id = $2 AND dm.receiver_id = $1)
       ORDER BY dm.created_at ASC LIMIT 100`,
      [req.user!.userId, targetId]
    );
    ok(res, result.rows);
  } catch (err: any) {
    console.error('DM messages error:', err.message);
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки сообщений', 500);
  }
});

// Send DM
dmRouter.post('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      fail(res, 'INVALID_INPUT', 'Сообщение не может быть пустым', 400);
      return;
    }
    if (content.length > 5000) {
      fail(res, 'INVALID_INPUT', 'Сообщение слишком длинное', 400);
      return;
    }

    const id = uuid();
    await query(
      'INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4)',
      [id, req.user!.userId, req.params.userId, content]
    );

    const result = await query(
      `SELECT dm.*, s.username as sender_name
       FROM direct_messages dm JOIN users s ON dm.sender_id = s.id WHERE dm.id = $1`,
      [id]
    );

    ok(res, result.rows[0], 201);
  } catch (err: any) {
    console.error('DM send error:', err.message);
    fail(res, 'SERVER_ERROR', 'Ошибка отправки сообщения', 500);
  }
});
