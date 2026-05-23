import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';

export const gameRouter = Router();

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create lobby
gameRouter.post('/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const code = generateCode();
    const settings = {
      genre: req.body.genre || 'fantasy',
      setting: req.body.setting || 'forest',
      difficulty: req.body.difficulty || 'normal',
      playTime: req.body.playTime || 60,
      nsfw: req.body.nsfw || false,
      storyPrompt: req.body.storyPrompt || '',
      isPublic: req.body.isPublic || false,
    };

    await query(
      'INSERT INTO game_sessions (id, lobby_code, owner_id, settings, status) VALUES ($1,$2,$3,$4,$5)',
      [id, code, req.user!.userId, JSON.stringify(settings), 'lobby']
    );

    await query(
      'INSERT INTO lobby_participants (session_id, user_id, character_data, role) VALUES ($1,$2,$3,$4)',
      [id, req.user!.userId, JSON.stringify({ name: req.user!.username, race: 'human', class: 'warrior', prompt: '' }), 'owner']
    );

    res.status(201).json({ id, code, settings });
  } catch (err: any) {
    console.error('Game create error:', err.message);
    res.status(500).json({ error: 'Ошибка создания лобби' });
  }
});

// Join by code
gameRouter.post('/join/:code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await query('SELECT * FROM game_sessions WHERE lobby_code = $1', [req.params.code]);
    if (session.rows.length === 0) { res.status(404).json({ error: 'Лобби не найдено' }); return; }

    const s = session.rows[0];
    await query(
      'INSERT INTO lobby_participants (session_id, user_id, character_data) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [s.id, req.user!.userId, JSON.stringify({ name: req.user!.username, race: 'human', class: 'warrior', prompt: '' })]
    );

    await query('UPDATE game_sessions SET updated_at = NOW() WHERE id = $1', [s.id]);
    res.json({ id: s.id, settings: s.settings });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка входа в лобби' });
  }
});

// Get lobby state
gameRouter.get('/:id/lobby', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
    if (session.rows.length === 0) { res.status(404).json({ error: 'Не найдено' }); return; }

    const participants = await query(
      `SELECT lp.*, u.username, u.avatar_url FROM lobby_participants lp
       JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1`,
      [req.params.id]
    );

    res.json({ ...session.rows[0], participants: participants.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка загрузки лобби' });
  }
});

// Update character/role
gameRouter.patch('/:id/character', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { characterData, role } = req.body;
    await query(
      'UPDATE lobby_participants SET character_data = COALESCE($1, character_data), role = COALESCE($2, role) WHERE session_id = $3 AND user_id = $4',
      [characterData ? JSON.stringify(characterData) : null, role, req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка обновления персонажа' });
  }
});

// Update settings (owner only)
gameRouter.patch('/:id/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await query('SELECT * FROM game_sessions WHERE id = $1 AND owner_id = $2', [req.params.id, req.user!.userId]);
    if (session.rows.length === 0) { res.status(403).json({ error: 'Только владелец' }); return; }

    const updates: any = {};
    if (req.body.genre !== undefined) updates.genre = req.body.genre;
    if (req.body.setting !== undefined) updates.setting = req.body.setting;
    if (req.body.difficulty !== undefined) updates.difficulty = req.body.difficulty;
    if (req.body.playTime !== undefined) updates.playTime = req.body.playTime;
    if (req.body.nsfw !== undefined) updates.nsfw = req.body.nsfw;
    if (req.body.storyPrompt !== undefined) updates.storyPrompt = req.body.storyPrompt;
    if (req.body.isPublic !== undefined) updates.isPublic = req.body.isPublic;

    const currentSettings = session.rows[0].settings || {};
    const newSettings = { ...currentSettings, ...updates };

    await query('UPDATE game_sessions SET settings = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(newSettings), req.params.id]);
    res.json({ settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка обновления настроек' });
  }
});

// Get public games
gameRouter.get('/public', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT gs.*, u.username as owner_name,
        (SELECT COUNT(*) FROM lobby_participants WHERE session_id = gs.id) as player_count
       FROM game_sessions gs JOIN users u ON gs.owner_id = u.id
       WHERE gs.settings->>'isPublic' = 'true' AND gs.status IN ('lobby', 'active')
       ORDER BY gs.updated_at DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch { res.json([]); }
});

// Save game
gameRouter.post('/:id/save', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
    if (session.rows.length === 0) { res.status(404).json({ error: 'Не найдено' }); return; }

    const s = session.rows[0];
    await query(
      'INSERT INTO saved_games (user_id, session_id, save_name, world_state, story_state, settings) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user!.userId, s.id, req.body.name || 'Сохранение', JSON.stringify(s.world_state || {}), JSON.stringify(s.story_state || {}), JSON.stringify(s.settings || {})]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// Load game
gameRouter.post('/load', authMiddleware, async (req: Request, res: Response) => {
  try {
    const save = await query('SELECT * FROM saved_games WHERE id = $1 AND user_id = $2', [req.body.saveId, req.user!.userId]);
    if (save.rows.length === 0) { res.status(404).json({ error: 'Сохранение не найдено' }); return; }

    const s = save.rows[0];
    const newId = uuid();
    const newCode = generateCode();

    await query(
      'INSERT INTO game_sessions (id, lobby_code, owner_id, settings, world_state, story_state, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [newId, newCode, req.user!.userId,
       JSON.stringify(s.settings || {}),
       JSON.stringify(s.world_state || {}),
       JSON.stringify(s.story_state || {}),
       'active']
    );

    await query(
      'INSERT INTO lobby_participants (session_id, user_id, character_data, role) VALUES ($1,$2,$3,$4)',
      [newId, req.user!.userId, JSON.stringify({ name: req.user!.username, race: 'human', class: 'warrior', prompt: '' }), 'owner']
    );

    res.json({ sessionId: newId, code: newCode });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

// Get saves
gameRouter.get('/saves', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM saved_games WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch { res.json([]); }
});
