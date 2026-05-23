import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware, optionalAuth } from '../middleware/auth';

export const socialRouter = Router();

// Создать пост
socialRouter.post('/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, imageUrl, roomId } = req.body;
    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Контент поста обязателен' }); return;
    }
    if (content.length > 10000) {
      res.status(400).json({ error: 'Пост слишком длинный' }); return;
    }

    const postId = uuid();
    await query(
      'INSERT INTO posts (id, user_id, content, image_url, room_id) VALUES ($1, $2, $3, $4, $5)',
      [postId, req.user!.userId, content, imageUrl || null, roomId || null]
    );

    const result = await query(
      `SELECT p.*, u.username, u.avatar_url, u.display_name,
        COALESCE(pl.cnt, 0)::int as likes_count,
        COALESCE(pc.cnt, 0)::int as comments_count
       FROM posts p JOIN users u ON p.user_id = u.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_likes GROUP BY post_id) pl ON pl.post_id = p.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_comments GROUP BY post_id) pc ON pc.post_id = p.id
       WHERE p.id = $1`,
      [postId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Social create post:', err.message);
    res.status(500).json({ error: 'Ошибка создания поста' });
  }
});

// Лента постов
socialRouter.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const result = await query(
      `SELECT p.*, u.username, u.avatar_url, u.display_name,
        COALESCE(pl.cnt, 0)::int as likes_count,
        COALESCE(pc.cnt, 0)::int as comments_count
       FROM posts p JOIN users u ON p.user_id = u.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_likes GROUP BY post_id) pl ON pl.post_id = p.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_comments GROUP BY post_id) pc ON pc.post_id = p.id
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error('Social feed:', err.message);
    res.status(500).json({ error: 'Ошибка получения ленты' });
  }
});

// Популярные посты
socialRouter.get('/posts/popular', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const result = await query(
      `SELECT p.*, u.username, u.avatar_url, u.display_name,
        COALESCE(pl.cnt, 0)::int as likes_count,
        COALESCE(pc.cnt, 0)::int as comments_count
       FROM posts p JOIN users u ON p.user_id = u.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_likes GROUP BY post_id) pl ON pl.post_id = p.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_comments GROUP BY post_id) pc ON pc.post_id = p.id
       ORDER BY likes_count DESC, p.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Social popular:', err.message);
    res.status(500).json({ error: 'Ошибка получения популярного' });
  }
});

// Лайк поста
socialRouter.post('/posts/:postId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    await query(
      'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [(req.params.postId as string), req.user!.userId]
    );
    const count = await query('SELECT COUNT(*) FROM post_likes WHERE post_id = $1', [(req.params.postId as string)]);
    res.json({ likesCount: parseInt(count.rows[0].count) });
  } catch (err: any) {
    console.error('Social like:', err.message);
    res.status(500).json({ error: 'Ошибка лайка' });
  }
});

// Убрать лайк
socialRouter.delete('/posts/:postId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    await query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [(req.params.postId as string), req.user!.userId]
    );
    const count = await query('SELECT COUNT(*) FROM post_likes WHERE post_id = $1', [(req.params.postId as string)]);
    res.json({ likesCount: parseInt(count.rows[0].count) });
  } catch (err: any) {
    console.error('Social unlike:', err.message);
    res.status(500).json({ error: 'Ошибка удаления лайка' });
  }
});

// Комментарии к посту
socialRouter.get('/posts/:postId/comments', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT pc.*, u.username, u.avatar_url
       FROM post_comments pc JOIN users u ON pc.user_id = u.id
       WHERE pc.post_id = $1 ORDER BY pc.created_at ASC`,
      [(req.params.postId as string)]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Social comments:', err.message);
    res.status(500).json({ error: 'Ошибка получения комментариев' });
  }
});

// Добавить комментарий
socialRouter.post('/posts/:postId/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Комментарий не может быть пустым' }); return;
    }
    if (content.length > 5000) {
      res.status(400).json({ error: 'Комментарий слишком длинный' }); return;
    }

    const id = uuid();
    await query(
      'INSERT INTO post_comments (id, post_id, user_id, content) VALUES ($1, $2, $3, $4)',
      [id, (req.params.postId as string), req.user!.userId, content]
    );

    const result = await query(
      `SELECT pc.*, u.username, u.avatar_url
       FROM post_comments pc JOIN users u ON pc.user_id = u.id WHERE pc.id = $1`,
      [id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Social comment:', err.message);
    res.status(500).json({ error: 'Ошибка создания комментария' });
  }
});

// Профиль пользователя
socialRouter.get('/profile/:username', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.role,
              u.created_at, u.subscription_tier,
        COALESCE(pc.cnt, 0)::int as posts_count
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM posts GROUP BY user_id) pc ON pc.user_id = u.id
       WHERE u.username = $1`,
      [(req.params.username as string)]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' }); return;
    }

    const profile = result.rows[0];

    const posts = await query(
      `SELECT p.*,
        COALESCE(pl.cnt, 0)::int as likes_count,
        COALESCE(pcc.cnt, 0)::int as comments_count
       FROM posts p
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_likes GROUP BY post_id) pl ON pl.post_id = p.id
       LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM post_comments GROUP BY post_id) pcc ON pcc.post_id = p.id
       WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 10`,
      [profile.id]
    );

    res.json({ profile, posts: posts.rows });
  } catch (err: any) {
    console.error('Social profile:', err.message);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});
