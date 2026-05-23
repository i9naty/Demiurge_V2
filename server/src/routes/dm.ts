import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';

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
    res.json(result.rows);
  } catch (err: any) {
    console.error('DM search error:', err.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// Unread count — MUST be before /:userId
dmRouter.get('/unread/count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM direct_messages WHERE receiver_id = $1 AND is_read = false',
      [req.user!.userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err: any) {
    console.error('DM unread error:', err.message);
    res.json({ count: 0 });
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
    res.json(result.rows);
  } catch (err: any) {
    console.error('DM conversations error:', err.message);
    res.status(500).json({ error: 'Ошибка загрузки диалогов' });
  }
});

// Get messages with a specific user — MUST be last
dmRouter.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetId = req.params.userId as string;
    if (targetId === 'search' || targetId.startsWith('unread')) {
      res.status(400).json({ error: 'Некорректный ID пользователя' });
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
    res.json(result.rows);
  } catch (err: any) {
    console.error('DM messages error:', err.message);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// Send DM
dmRouter.post('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Сообщение не может быть пустым' });
      return;
    }
    if (content.length > 5000) {
      res.status(400).json({ error: 'Сообщение слишком длинное' });
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

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('DM send error:', err.message);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});
