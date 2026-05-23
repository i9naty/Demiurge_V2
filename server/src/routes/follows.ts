import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, optionalAuth } from '../middleware/auth';

export const followsRouter = Router();

followsRouter.post('/:username', authMiddleware, async (req: Request, res: Response) => {
  try {
    const target = await query('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (target.rows.length === 0) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    const targetId = target.rows[0].id;
    if (targetId === req.user!.userId) {
      res.status(400).json({ error: 'Нельзя подписаться на себя' });
      return;
    }
    await query(
      'INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user!.userId, targetId]
    );
    const count = await query('SELECT COUNT(*) FROM user_follows WHERE following_id = $1', [targetId]);
    res.json({ following: true, followersCount: parseInt(count.rows[0].count) });
  } catch (err: any) {
    console.error('Follow error:', err.message);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
});

followsRouter.delete('/:username', authMiddleware, async (req: Request, res: Response) => {
  try {
    const target = await query('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (target.rows.length === 0) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    const targetId = target.rows[0].id;
    await query(
      'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [req.user!.userId, targetId]
    );
    const count = await query('SELECT COUNT(*) FROM user_follows WHERE following_id = $1', [targetId]);
    res.json({ following: false, followersCount: parseInt(count.rows[0].count) });
  } catch (err: any) {
    console.error('Unfollow error:', err.message);
    res.status(500).json({ error: 'Ошибка отписки' });
  }
});

followsRouter.get('/:username/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const target = await query('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (target.rows.length === 0) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    const targetId = target.rows[0].id;
    const following = await query(
      'SELECT COUNT(*) as count FROM user_follows WHERE following_id = $1',
      [targetId]
    );
    const followers = await query(
      'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1',
      [targetId]
    );
    let isFollowing = false;
    if (req.user) {
      const f = await query(
        'SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2',
        [req.user.userId, targetId]
      );
      isFollowing = f.rows.length > 0;
    }
    res.json({
      followingCount: parseInt(following.rows[0].count),
      followersCount: parseInt(followers.rows[0].count),
      isFollowing,
    });
  } catch (err: any) {
    console.error('Follow status error:', err.message);
    res.status(500).json({ error: 'Ошибка статуса подписки' });
  }
});

// Feed from followed users
followsRouter.get('/feed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT p.*, u.username, u.avatar_url, u.display_name,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $1)
       ORDER BY p.created_at DESC LIMIT 30`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка ленты подписок' });
  }
});
