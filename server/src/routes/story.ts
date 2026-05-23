import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { ok, fail } from '../middleware/response';
import { logger } from '../config/logger';

export const storyRouter = Router();

storyRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { genre = 'fantasy', setting = 'forest', difficulty = 'normal' } = req.body;
    const sessionId = uuid();
    const inviteCode = uuid().slice(0, 8).toUpperCase();

    await query(
      `INSERT INTO story_sessions (id, owner_id, genre, setting, difficulty, player_count, invite_code, status)
       VALUES ($1, $2, $3, $4, $5, 1, $6, 'active')`,
      [sessionId, req.user!.userId, genre, setting, difficulty, inviteCode]
    );

    await query(
      'INSERT INTO story_players (session_id, user_id, character_name) VALUES ($1, $2, $3)',
      [sessionId, req.user!.userId, req.user!.username]
    );

    await query(
      `INSERT INTO story_state (session_id, map_data, tokens, narrative, action_history)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, JSON.stringify({ tiles: [], width: 20, height: 20 }),
       JSON.stringify([]),
       'Приключение начинается...',
       JSON.stringify([{ role: 'system', content: 'Приключение начинается...' }])]
    );

    await query(
      `INSERT INTO story_memory (session_id, event_type, description, importance)
       VALUES ($1, 'session_start', $2, 5)`,
      [sessionId, `Начало истории: ${genre}, ${setting}`]
    );

    const result = await query(
      `SELECT ss.*, sst.map_data, sst.tokens, sst.narrative, sst.action_history
       FROM story_sessions ss JOIN story_state sst ON ss.id = sst.session_id WHERE ss.id = $1`,
      [sessionId]
    );

    ok(res, { ...result.rows[0], initialNarration: 'Приключение начинается...' }, 201);
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка создания истории', 500);
  }
});

storyRouter.post('/join-by-code/:code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await query('SELECT * FROM story_sessions WHERE invite_code = $1', [req.params.code]);
    if (session.rows.length === 0) { fail(res, 'NOT_FOUND', 'Сессия не найдена', 404); return; }

    await query(
      'INSERT INTO story_players (session_id, user_id, character_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [session.rows[0].id, req.user!.userId, req.user!.username]
    );

    const count = await query('SELECT COUNT(*) as c FROM story_players WHERE session_id = $1', [session.rows[0].id]);
    await query('UPDATE story_sessions SET player_count = $1, updated_at = NOW() WHERE id = $2',
      [parseInt(count.rows[0].c), session.rows[0].id]);

    ok(res, { sessionId: session.rows[0].id });
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка входа в сессию', 500);
  }
});

storyRouter.post('/:id/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await query('SELECT * FROM story_sessions WHERE id = $1', [req.params.id]);
    if (session.rows.length === 0) { fail(res, 'NOT_FOUND', 'Сессия не найдена', 404); return; }

    await query(
      'INSERT INTO story_players (session_id, user_id, character_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, req.user!.userId, req.user!.username]
    );

    await query(
      'UPDATE story_sessions SET player_count = (SELECT COUNT(*) FROM story_players WHERE session_id = $1), updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    const players = await query(
      `SELECT u.username, u.avatar_url, sp.character_name, sp.hp, sp.max_hp, sp.ac
       FROM story_players sp JOIN users u ON sp.user_id = u.id WHERE sp.session_id = $1`,
      [req.params.id]
    );

    ok(res, { players: players.rows });
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка входа в сессию', 500);
  }
});

storyRouter.get('/:id/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ss.*, sst.map_data, sst.tokens, sst.narrative, sst.action_history, sst.ai_notes
       FROM story_sessions ss JOIN story_state sst ON ss.id = sst.session_id WHERE ss.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) { fail(res, 'NOT_FOUND', 'Сессия не найдена', 404); return; }

    const players = await query(
      `SELECT u.id, u.username, u.avatar_url, sp.character_name, sp.hp, sp.max_hp, sp.ac, sp.inventory
       FROM story_players sp JOIN users u ON sp.user_id = u.id WHERE sp.session_id = $1`,
      [req.params.id]
    );

    ok(res, { ...result.rows[0], players: players.rows });
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки состояния', 500);
  }
});

storyRouter.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ss.*, u.username as owner_name,
        (SELECT COUNT(*) FROM story_players WHERE session_id = ss.id) as player_count
       FROM story_sessions ss JOIN users u ON ss.owner_id = u.id
       WHERE ss.owner_id = $1 OR ss.id IN (SELECT session_id FROM story_players WHERE user_id = $1)
       ORDER BY ss.updated_at DESC LIMIT 20`,
       [req.user!.userId]
    );
    ok(res, result.rows);
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки историй', 500);
  }
});

storyRouter.get('/public', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ss.*, u.username as owner_name,
        (SELECT COUNT(*) FROM story_players WHERE session_id = ss.id) as player_count
       FROM story_sessions ss JOIN users u ON ss.owner_id = u.id
       WHERE ss.status IN ('active', 'lobby') ORDER BY ss.created_at DESC LIMIT 10`
    );
    ok(res, result.rows);
  } catch (err) { logger.error({ err }, 'Public stories error'); fail(res, 'SERVER_ERROR', 'Ошибка загрузки историй', 500); }
});

storyRouter.post('/:id/end', authMiddleware, async (req: Request, res: Response) => {
  try {
    const state = await query('SELECT * FROM story_state WHERE session_id = $1', [req.params.id]);
    if (state.rows.length === 0) { fail(res, 'NOT_FOUND', 'Сессия не найдена', 404); return; }

    const epilogue = 'Так завершилось это приключение. Герои вернулись домой с воспоминаниями о пережитых испытаниях.';

    await query(
      'UPDATE story_sessions SET status = $1, act = 4, ended_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['completed', req.params.id]
    );

    await query(
      'INSERT INTO story_memory (session_id, event_type, description, importance) VALUES ($1, $2, $3, 10)',
      [req.params.id, 'session_end', epilogue]
    );

    ok(res, { epilogue });
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка завершения истории', 500);
  }
});
