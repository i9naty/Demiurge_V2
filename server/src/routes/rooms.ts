import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware, optionalAuth } from '../middleware/auth';

export const roomsRouter = Router();

// Создать комнату
roomsRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, mode = 'vtt', isPublic = false, maxPlayers = 8, gameType = 'D&D 5e', password: _password, expiresIn } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Название обязательно' }); return; }
    if (!['vtt', 'world'].includes(mode)) { res.status(400).json({ error: 'vtt или world' }); return; }
    if (maxPlayers < 1 || maxPlayers > 50) { res.status(400).json({ error: 'Игроки: 1-50' }); return; }

    const roomId = uuid();
    const inviteCode = uuid().slice(0, 8).toUpperCase();
    const expiresAt = expiresIn ? new Date(Date.now() + parseInt(expiresIn) * 3600000).toISOString() : null;

    await query(
      `INSERT INTO rooms (id, name, description, owner_id, mode, is_public, invite_code, max_players, game_type, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [roomId, name, description || '', req.user!.userId, mode, isPublic, inviteCode, maxPlayers, gameType, expiresAt]
    );

    await query(
      'INSERT INTO room_participants (room_id, user_id, role) VALUES ($1, $2, $3)',
      [roomId, req.user!.userId, 'owner']
    );

    if (mode === 'world') {
      const seed = Math.floor(Math.random() * 2147483647);
      const personalities = ['kind', 'evil', 'chaotic', 'neutral', 'wise', 'mad'];
      const personality = personalities[Math.floor(Math.random() * personalities.length)];

      await query(
        'INSERT INTO world_states (room_id, seed, width, height, ai_god_personality) VALUES ($1, $2, 50, 50, $3)',
        [roomId, seed, personality]
      );
    }

    const result = await query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Create room error:', err.message);
    res.status(500).json({ error: 'Ошибка создания комнаты' });
  }
});

// Список публичных комнат
roomsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { mode } = req.query;
    let sql = `
      SELECT r.*, u.username as owner_name, u.avatar_url as owner_avatar,
        COALESCE(pc.cnt, 0)::int as player_count
      FROM rooms r JOIN users u ON r.owner_id = u.id
      LEFT JOIN (SELECT room_id, COUNT(*) as cnt FROM room_participants GROUP BY room_id) pc ON pc.room_id = r.id
      WHERE r.is_public = true
    `;
    const params: any[] = [];

    if (mode) {
      params.push(mode);
      sql += ` AND r.mode = $${params.length}`;
    }

    sql += ' ORDER BY r.created_at DESC LIMIT 30';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('List rooms error:', err.message);
    res.status(500).json({ error: 'Ошибка получения списка комнат' });
  }
});

// Комнаты пользователя
roomsRouter.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, rp.role,
        COALESCE(pc.cnt, 0)::int as player_count
       FROM rooms r JOIN room_participants rp ON r.id = rp.room_id
       LEFT JOIN (SELECT room_id, COUNT(*) as cnt FROM room_participants GROUP BY room_id) pc ON pc.room_id = r.id
       WHERE rp.user_id = $1 ORDER BY r.updated_at DESC`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('My rooms error:', err.message);
    res.status(500).json({ error: 'Ошибка получения комнат' });
  }
});

// Получить комнату по ID
roomsRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, u.username as owner_name,
        COALESCE(pc.cnt, 0)::int as player_count
       FROM rooms r JOIN users u ON r.owner_id = u.id
       LEFT JOIN (SELECT room_id, COUNT(*) as cnt FROM room_participants GROUP BY room_id) pc ON pc.room_id = r.id
       WHERE r.id = $1`,
      [(req.params.id as string)]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Комната не найдена' }); return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Get room error:', err.message);
    res.status(500).json({ error: 'Ошибка получения комнаты' });
  }
});

// Войти в комнату по инвайт-коду
roomsRouter.post('/join/:code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const room = await query('SELECT * FROM rooms WHERE invite_code = $1', [(req.params.code as string)]);

    if (room.rows.length === 0) { res.status(404).json({ error: 'Комната не найдена' }); return; }

    const r = room.rows[0];

    // Password check
    if (r.password_hash) {
      const { password } = req.body;
      if (!password) { res.status(403).json({ error: 'Требуется пароль', needPassword: true }); return; }
      const bcrypt = require('bcryptjs');
      const valid = await bcrypt.compare(password, r.password_hash);
      if (!valid) { res.status(403).json({ error: 'Неверный пароль' }); return; }
    }

    if (r.expires_at && new Date(r.expires_at) < new Date()) {
      res.status(410).json({ error: 'Комната истекла' }); return;
    }
    const existing = await query(
      'SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [r.id, req.user!.userId]
    );

    if (existing.rows.length === 0) {
      const count = await query('SELECT COUNT(*) FROM room_participants WHERE room_id = $1', [r.id]);
      if (parseInt(count.rows[0].count) >= r.max_players) {
        res.status(403).json({ error: 'Комната заполнена' }); return;
      }

      await query(
        'INSERT INTO room_participants (room_id, user_id, role) VALUES ($1, $2, $3)',
        [r.id, req.user!.userId, 'player']
      );
    }

    await query('UPDATE rooms SET updated_at = NOW() WHERE id = $1', [r.id]);
    res.json(r);
  } catch (err: any) {
    console.error('Join room error:', err.message);
    res.status(500).json({ error: 'Ошибка входа в комнату' });
  }
});

// Удалить комнату
roomsRouter.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const room = await query('SELECT * FROM rooms WHERE id = $1 AND owner_id = $2', [
      (req.params.id as string), req.user!.userId,
    ]);

    if (room.rows.length === 0) {
      res.status(403).json({ error: 'Нет прав на удаление' }); return;
    }

    await query('DELETE FROM rooms WHERE id = $1', [(req.params.id as string)]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete room error:', err.message);
    res.status(500).json({ error: 'Ошибка удаления комнаты' });
  }
});

// Получить токены комнаты
roomsRouter.get('/:id/tokens', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM tokens WHERE room_id = $1 ORDER BY layer, created_at', [(req.params.id as string)]);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Tokens error:', err.message);
    res.status(500).json({ error: 'Ошибка получения токенов' });
  }
});

// СЦЕНЫ
roomsRouter.get('/:id/scenes', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rid = req.params.id as string;
    const result = await query('SELECT * FROM scenes WHERE room_id = $1 ORDER BY sort_order, created_at', [rid]);
    if (result.rows.length === 0) {
      const id = uuid();
      await query("INSERT INTO scenes (id, room_id, name, sort_order) VALUES ($1,$2,'Сцена 1',0)", [id, rid]);
      const s = await query('SELECT * FROM scenes WHERE id = $1', [id]);
      res.json(s.rows);
      return;
    }
    res.json(result.rows);
  } catch (err: any) {
    console.error('Scenes error:', err.message);
    res.status(500).json({ error: 'Ошибка загрузки сцен' });
  }
});

roomsRouter.post('/:id/scenes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const rid = req.params.id as string;
    const id = uuid();
    const max = await query('SELECT COALESCE(MAX(sort_order),0)+1 as n FROM scenes WHERE room_id = $1', [rid]);
    await query('INSERT INTO scenes (id, room_id, name, sort_order) VALUES ($1,$2,$3,$4)', [id, rid, name || 'Новая сцена', max.rows[0].n]);
    const result = await query('SELECT * FROM scenes WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Create scene error:', err.message);
    res.status(500).json({ error: 'Ошибка создания сцены' });
  }
});

roomsRouter.patch('/:id/scenes/:sceneId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, mapUrl, gridType, gridSize, gridVisible, gridOffsetX, gridOffsetY } = req.body;
    await query(
      `UPDATE scenes SET name=COALESCE($1,name), map_url=COALESCE($2,map_url), grid_type=COALESCE($3,grid_type),
       grid_size=COALESCE($4,grid_size), grid_visible=COALESCE($5,grid_visible),
       grid_offset_x=COALESCE($6,grid_offset_x), grid_offset_y=COALESCE($7,grid_offset_y)
       WHERE id=$8 AND room_id=$9`,
      [name, mapUrl, gridType, gridSize, gridVisible, gridOffsetX, gridOffsetY, (req.params.sceneId as string), (req.params.id as string)]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Patch scene error:', err.message);
    res.status(500).json({ error: 'Ошибка обновления сцены' });
  }
});

roomsRouter.delete('/:id/scenes/:sceneId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM scenes WHERE id=$1 AND room_id=$2', [(req.params.sceneId as string), (req.params.id as string)]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete scene error:', err.message);
    res.status(500).json({ error: 'Ошибка удаления сцены' });
  }
});

roomsRouter.get('/:id/messages', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const result = await query(
      `SELECT m.*, u.username, u.avatar_url as avatar_url
       FROM messages m JOIN users u ON m.user_id = u.id
       WHERE m.room_id = $1 ORDER BY m.created_at DESC LIMIT $2`,
      [(req.params.id as string), limit]
    );
    res.json(result.rows.reverse());
  } catch (err: any) {
    console.error('Messages error:', err.message);
    res.status(500).json({ error: 'Ошибка получения сообщений' });
  }
});
