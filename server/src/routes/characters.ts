import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { ok, fail } from '../middleware/response';

export const characterRouter = Router();

// List my characters
characterRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const roomId = req.query.roomId as string | undefined;
    let sql = 'SELECT * FROM character_sheets WHERE user_id = $1';
    const params: unknown[] = [req.user!.userId];
    if (roomId) { params.push(roomId); sql += ` AND room_id = $${params.length}`; }
    sql += ' ORDER BY updated_at DESC LIMIT 50';
    const result = await query(sql, params);
    ok(res, result.rows);
  } catch (err) {
    console.error('List characters error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки персонажей', 500);
  }
});

// Get one character
characterRouter.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM character_sheets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId]
    );
    if (result.rows.length === 0) { fail(res, 'NOT_FOUND', 'Персонаж не найден', 404); return; }
    ok(res, result.rows[0]);
  } catch (err) {
    console.error('Get character error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка загрузки персонажа', 500);
  }
});

// Create character
characterRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, race = 'human', class: cls = 'fighter', level = 1, stats = {}, roomId, spells = [], inventory = [] } = req.body;
    if (!name?.trim()) { fail(res, 'INVALID_INPUT', 'Имя обязательно', 400); return; }

    const id = uuid();
    const defaultStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, hp: 10, maxHp: 10, ac: 10, initiative: 0, speed: 30 };
    const merged = { ...defaultStats, ...stats };

    await query(
      `INSERT INTO character_sheets (id, user_id, name, race, class, level, stats, spells, inventory, room_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, req.user!.userId, name.trim(), race, cls, level, JSON.stringify(merged), JSON.stringify(spells), JSON.stringify(inventory), roomId || null]
    );
    const result = await query('SELECT * FROM character_sheets WHERE id = $1', [id]);
    ok(res, result.rows[0], 201);
  } catch (err) {
    console.error('Create character error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка создания персонажа', 500);
  }
});

// Update character
characterRouter.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const existing = await query(
      'SELECT * FROM character_sheets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId]
    );
    if (existing.rows.length === 0) { fail(res, 'NOT_FOUND', 'Персонаж не найден', 404); return; }

    const c = existing.rows[0];
    const { name, race, class: cls, level, stats, spells, inventory } = req.body;

    await query(
      `UPDATE character_sheets SET
        name = $1, race = $2, class = $3, level = $4,
        stats = $5, spells = $6, inventory = $7, updated_at = NOW()
       WHERE id = $8`,
      [
        name ?? c.name, race ?? c.race, cls ?? c.class, level ?? c.level,
        stats ? JSON.stringify({ ...c.stats, ...stats }) : JSON.stringify(c.stats),
        spells ? JSON.stringify(spells) : JSON.stringify(c.spells),
        inventory ? JSON.stringify(inventory) : JSON.stringify(c.inventory),
        req.params.id,
      ]
    );
    const result = await query('SELECT * FROM character_sheets WHERE id = $1', [req.params.id]);
    ok(res, result.rows[0]);
  } catch (err) {
    console.error('Update character error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка обновления персонажа', 500);
  }
});

// Delete character
characterRouter.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM character_sheets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.userId]
    );
    if (result.rows.length === 0) { fail(res, 'NOT_FOUND', 'Персонаж не найден', 404); return; }
    ok(res, { deleted: true });
  } catch (err) {
    console.error('Delete character error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка удаления персонажа', 500);
  }
});
