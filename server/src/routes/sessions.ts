import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, query } from '../config/database';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { ok, fail } from '../middleware/response';
import { logger } from '../config/logger';

export const sessionsRouter = Router();

// List open sessions
sessionsRouter.get('/', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT s.*, u.username as master_name, u.avatar_url as master_avatar,
        COALESCE(ac.cnt, 0)::int as accepted_count,
        COALESCE(pc.cnt, 0)::int as pending_count
       FROM sessions_planned s JOIN users u ON s.master_id = u.id
       LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_applications WHERE status = 'accepted' GROUP BY session_id) ac ON ac.session_id = s.id
       LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_applications WHERE status = 'pending' GROUP BY session_id) pc ON pc.session_id = s.id
       WHERE s.status = 'open' AND s.scheduled_at > NOW()
       ORDER BY s.scheduled_at ASC LIMIT 20`,
    );
    ok(res, result.rows);
  } catch (err: any) {
    logger.error({ err }, 'Sessions list');
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки сессий', 500);
  }
});

// Create session (transactional)
sessionsRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { title, description, scheduledAt, maxPlayers = 4, system = 'D&D 5e' } = req.body;
    if (!title || !scheduledAt) {
      fail(res, 'INVALID_INPUT', 'Название и дата обязательны', 400); return;
    }
    if (maxPlayers < 1 || maxPlayers > 20) {
      fail(res, 'INVALID_INPUT', 'Максимум игроков: 1-20', 400); return;
    }

    const id = uuid();
    const serverId = uuid();
    const inviteCode = uuid().slice(0, 8).toUpperCase();

    await client.query('BEGIN');

    await client.query(
      'INSERT INTO discord_servers (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)',
      [serverId, `🎲 ${title}`, req.user!.userId, inviteCode]
    );
    await client.query(
      'INSERT INTO discord_server_members (server_id, user_id) VALUES ($1, $2)',
      [serverId, req.user!.userId]
    );

    await client.query(
      `INSERT INTO sessions_planned (id, master_id, title, description, scheduled_at, max_players, system, discord_server_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, req.user!.userId, title, description || '', scheduledAt, maxPlayers, system, serverId]
    );

    await client.query(
      "INSERT INTO discord_channels (server_id, name, type, position) VALUES ($1, '📋-инфо', 'text', 0), ($1, '💬-чат', 'text', 1), ($1, '🎲-броски', 'text', 2), ($1, '🔊-голосовой', 'voice', 3)",
      [serverId]
    );

    const dateStr = new Date(scheduledAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const infoMsgId = uuid();
    await client.query(
      `INSERT INTO discord_messages (id, channel_id, user_id, content)
       SELECT $1, id, $2, $3 FROM discord_channels WHERE server_id = $4 AND name = '📋-инфо' LIMIT 1`,
      [infoMsgId, req.user!.userId, `🎯 **${title}**\n📅 ${dateStr}\n🎲 Система: ${system}\n👥 Игроки: 0/${maxPlayers}\n👑 Мастер: ${req.user!.username}\n\n${description || 'Приключение ждёт!'}`, serverId]
    );

    await client.query(
      "INSERT INTO discord_roles (server_id, name, color, permissions, position) VALUES ($1, '👑 Мастер', '#f59e0b', 8, 1), ($1, '⚔️ Игрок', '#3b82f6', 1, 2)",
      [serverId]
    );

    const masterRole = await client.query("SELECT id FROM discord_roles WHERE server_id = $1 AND name = '👑 Мастер'", [serverId]);
    if (masterRole.rows.length > 0) {
      await client.query('INSERT INTO discord_member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3)',
        [serverId, req.user!.userId, masterRole.rows[0].id]);
    }

    await client.query('COMMIT');

    const result = await query('SELECT * FROM sessions_planned WHERE id = $1', [id]);
    ok(res, result.rows[0], 201);
  } catch (err: any) {
    await client.query('ROLLBACK').catch((rollbackErr) => { logger.error({ err: rollbackErr }, 'Rollback error'); });
    logger.error({ err }, 'Session create error');
    fail(res, 'SERVER_ERROR', 'Ошибка создания сессии', 500);
  } finally {
    client.release();
  }
});

// Apply to session
sessionsRouter.post('/:id/apply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const sid = req.params.id as string;
    const session = await query('SELECT * FROM sessions_planned WHERE id = $1', [sid]);
    if (session.rows.length === 0) { fail(res, 'NOT_FOUND', 'Сессия не найдена', 404); return; }
    if (session.rows[0].status !== 'open') { fail(res, 'INVALID_INPUT', 'Сессия недоступна', 400); return; }

    await query(
      'INSERT INTO session_applications (session_id, user_id, message) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [sid, req.user!.userId, message || '']
    );
    ok(res, {});
  } catch (err: any) {
    if (err.code === '23505') ok(res, { message: 'Вы уже подали заявку' });
    else { logger.error({ err }, 'Apply error'); fail(res, 'SERVER_ERROR', 'Ошибка подачи заявки', 500); }
  }
});

// Master: accept/reject application
sessionsRouter.patch('/:id/applications/:appId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      fail(res, 'INVALID_INPUT', 'Статус: accepted или rejected', 400); return;
    }
    const sid = req.params.id as string;
    const session = await query('SELECT * FROM sessions_planned WHERE id = $1 AND master_id = $2', [sid, req.user!.userId]);
    if (session.rows.length === 0) { fail(res, 'FORBIDDEN', 'Только мастер может принимать заявки', 403); return; }

    await query('UPDATE session_applications SET status = $1 WHERE id = $2 AND session_id = $3',
      [status, req.params.appId as string, sid]);

    if (status === 'accepted') {
      const app = await query('SELECT * FROM session_applications WHERE id = $1', [req.params.appId as string]);
      const s = session.rows[0];

      if (s.discord_server_id && app.rows.length > 0) {
        const userId = app.rows[0].user_id;
        await query('INSERT INTO discord_server_members (server_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [s.discord_server_id, userId]);
        const playerRole = await query("SELECT id FROM discord_roles WHERE server_id = $1 AND name = '⚔️ Игрок'", [s.discord_server_id]);
        if (playerRole.rows.length > 0) {
          await query('INSERT INTO discord_member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [s.discord_server_id, userId, playerRole.rows[0].id]);
        }

        const count = await query("SELECT COUNT(*) FROM session_applications WHERE session_id = $1 AND status = 'accepted'", [sid]);
        if (parseInt(count.rows[0].count) >= s.max_players) {
          await query("UPDATE sessions_planned SET status = 'full' WHERE id = $1", [sid]);
        }
      }
    }
    ok(res, {});
  } catch (err: any) {
    logger.error({ err }, 'App patch error');
    fail(res, 'SERVER_ERROR', 'Ошибка обновления заявки', 500);
  }
});

// My sessions
sessionsRouter.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT s.*, u.username as master_name,
        COALESCE(ac.cnt, 0)::int as accepted_count
       FROM sessions_planned s JOIN users u ON s.master_id = u.id
       LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_applications WHERE status = 'accepted' GROUP BY session_id) ac ON ac.session_id = s.id
       LEFT JOIN session_applications sa ON s.id = sa.session_id
       WHERE s.master_id = $1 OR sa.user_id = $1
       ORDER BY s.scheduled_at DESC LIMIT 20`,
      [req.user!.userId]
    );
    ok(res, result.rows);
  } catch (err: any) {
    logger.error({ err }, 'Sessions my');
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки сессий', 500);
  }
});

// Applications for a session (master only)
sessionsRouter.get('/:id/applications', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sid = req.params.id as string;
    const session = await query('SELECT * FROM sessions_planned WHERE id = $1 AND master_id = $2', [sid, req.user!.userId]);
    if (session.rows.length === 0) { fail(res, 'FORBIDDEN', 'Только мастер может видеть заявки', 403); return; }
    const result = await query(
      'SELECT sa.*, u.username, u.avatar_url FROM session_applications sa JOIN users u ON sa.user_id = u.id WHERE sa.session_id = $1 ORDER BY sa.created_at DESC',
      [sid]
    );
    ok(res, result.rows);
  } catch (err: any) {
    logger.error({ err }, 'Applications error');
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки заявок', 500);
  }
});

sessionsRouter.get('/:id/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT sc.*, u.username FROM session_chats sc JOIN users u ON sc.user_id = u.id WHERE sc.session_id = $1 ORDER BY sc.created_at ASC LIMIT 100',
      [req.params.id as string]
    );
    ok(res, result.rows);
  } catch (err: any) {
    logger.error({ err }, 'Session chat error');
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки чата', 500);
  }
});

sessionsRouter.post('/:id/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { fail(res, 'INVALID_INPUT', 'Сообщение не может быть пустым', 400); return; }
    const id = uuid();
    await query(
      'INSERT INTO session_chats (id, session_id, user_id, content) VALUES ($1, $2, $3, $4)',
      [id, req.params.id as string, req.user!.userId, content]
    );
    const result = await query(
      'SELECT sc.*, u.username FROM session_chats sc JOIN users u ON sc.user_id = u.id WHERE sc.id = $1',
      [id]
    );
    ok(res, result.rows[0], 201);
  } catch (err: any) {
    logger.error({ err }, 'Session chat send');
    fail(res, 'SERVER_ERROR', 'Ошибка отправки сообщения', 500);
  }
});
