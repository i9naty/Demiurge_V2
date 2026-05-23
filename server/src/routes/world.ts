import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { generateWorld } from '../services/ai';

export const worldRouter = Router();

async function requireParticipant(userId: string, roomId: string): Promise<boolean> {
  const r = await query('SELECT 1 FROM room_participants WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
  return r.rows.length > 0;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Сгенерировать мир через AI
worldRouter.post('/:roomId/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireParticipant(req.user!.userId, (req.params.roomId as string))) {
      res.status(403).json({ error: 'Вы не участник этой комнаты' }); return;
    }
    const { width = 50, height = 50, biome = 'mixed', density = 'medium', difficulty = 'normal', prompt = '' } = req.body;
    const ws = await query('SELECT * FROM world_states WHERE room_id = $1', [(req.params.roomId as string)]);
    if (ws.rows.length === 0) { res.status(404).json({ error: 'Мир не найден' }); return; }
    const seed = ws.rows[0].seed;
    const w = Math.min(width, 80), h = Math.min(height, 80);
    const worldData = await generateWorld({ seed, width: w, height: h, biome, density, difficulty, prompt });
    const roomId = req.params.roomId as string;
    const BATCH_SIZE = 500;

    // Save tiles — batch insert via unnest
    if (worldData.tiles && worldData.tiles.length > 0) {
      const chunks = chunkArray(worldData.tiles, BATCH_SIZE);
      for (const chunk of chunks) {
        const xs = chunk.map((t: any) => t.x);
        const ys = chunk.map((t: any) => t.y);
        const terrains = chunk.map((t: any) => t.terrain);
        const elevs = chunk.map((t: any) => t.elevation || 0);
        const rtypes = chunk.map((t: any) => t.resource_type || null);
        const ramounts = chunk.map((t: any) => t.resource_amount || 0);
        await query(
          `INSERT INTO world_tiles (room_id, x, y, terrain, elevation, resource_type, resource_amount)
           SELECT $1::uuid, t.x, t.y, t.terrain, t.elevation, t.resource_type, t.resource_amount
           FROM unnest($2::int[], $3::int[], $4::text[], $5::float[], $6::text[], $7::int[])
           AS t(x, y, terrain, elevation, resource_type, resource_amount)
           ON CONFLICT (room_id, x, y) DO UPDATE SET
             terrain=EXCLUDED.terrain, elevation=EXCLUDED.elevation,
             resource_type=EXCLUDED.resource_type, resource_amount=EXCLUDED.resource_amount`,
          [roomId, xs, ys, terrains, elevs, rtypes, ramounts]
        );
      }
    }

    // Save buildings — batch VALUES
    if (worldData.buildings && worldData.buildings.length > 0) {
      const chunks = chunkArray(worldData.buildings, BATCH_SIZE);
      for (const chunk of chunks) {
        const values: string[] = [];
        const params: unknown[] = [roomId];
        chunk.forEach((b: any, _i: number) => {
          const base = params.length;
          params.push(b.tile_x, b.tile_y, b.building_type, b.name);
          values.push(`($1, $${base}, $${base + 1}, $${base + 2}, $${base + 3})`);
        });
        await query(
          `INSERT INTO buildings (room_id, tile_x, tile_y, building_type, name) VALUES ${values.join(',')} ON CONFLICT (room_id, tile_x, tile_y) DO NOTHING`,
          params
        );
      }
    }

    // Save NPCs — batch VALUES
    if (worldData.npcs && worldData.npcs.length > 0) {
      const chunks = chunkArray(worldData.npcs, BATCH_SIZE);
      for (const chunk of chunks) {
        const values: string[] = [];
        const params: unknown[] = [roomId];
        chunk.forEach((n: any, _i: number) => {
          const base = params.length;
          params.push(n.name, n.personality || 'нейтральный', n.type || 'крестьянин', n.x, n.y, n.is_unique || false);
          values.push(`($1, $${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
        });
        await query(
          `INSERT INTO npcs (room_id, name, personality, type, x, y, is_unique) VALUES ${values.join(',')}`,
          params
        );
      }
    }

    // Save factions — batch VALUES
    if (worldData.factions && worldData.factions.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [roomId];
      worldData.factions.forEach((f: any, _i: number) => {
        const base = params.length;
        params.push(f.name, f.reputation || 50, f.color || '#3b82f6', f.wealth || 1000);
        values.push(`($1, $${base}, $${base + 1}, $${base + 2}, $${base + 3})`);
      });
      await query(
        `INSERT INTO factions (room_id, name, reputation, color, wealth) VALUES ${values.join(',')} ON CONFLICT (room_id, name) DO NOTHING`,
        params
      );
    }

    // Save quests — batch VALUES
    if (worldData.quests && worldData.quests.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [roomId];
      worldData.quests.forEach((q: any, _i: number) => {
        const base = params.length;
        params.push(q.title, q.description || '', q.objectiveType || 'explore', JSON.stringify(q.reward || {}));
        values.push(`($1, $${base}, $${base + 1}, $${base + 2}, $${base + 3})`);
      });
      await query(
        `INSERT INTO quests (room_id, title, description, objective_type, reward) VALUES ${values.join(',')}`,
        params
      );
    }

    await query('UPDATE world_states SET width=$1, height=$2 WHERE room_id=$3', [w, h, roomId]);
    res.json({ success: true, stats: { tiles: worldData.tiles?.length || 0, buildings: worldData.buildings?.length || 0, npcs: worldData.npcs?.length || 0, factions: worldData.factions?.length || 0, quests: worldData.quests?.length || 0 } });
  } catch (err: any) {
    console.error('World generation error:', err.message);
    res.status(500).json({ success: false, error: { code: 'GENERATION_ERROR', message: 'Ошибка генерации мира' } });
  }
});

// Получить состояние мира
worldRouter.get('/:roomId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireParticipant(req.user!.userId, (req.params.roomId as string))) {
      res.status(403).json({ error: 'Вы не участник этой комнаты' }); return;
    }
    const result = await query(
      'SELECT * FROM world_states WHERE room_id = $1',
      [(req.params.roomId as string)]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Мир не найден' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('World state error:', err.message);
    res.status(500).json({ error: 'Ошибка получения мира' });
  }
});

// Получить тайлы мира
worldRouter.get('/:roomId/tiles', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { x1, y1, x2, y2 } = req.query;
    let sql = 'SELECT * FROM world_tiles WHERE room_id = $1';
    const params: any[] = [(req.params.roomId as string)];

    if (typeof x1 === 'string' && typeof y1 === 'string' && typeof x2 === 'string' && typeof y2 === 'string') {
      params.push(parseInt(x1), parseInt(y1), parseInt(x2), parseInt(y2));
      sql += ` AND x >= $2 AND y >= $3 AND x <= $4 AND y <= $5`;
    }

    sql += ' ORDER BY y, x';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения тайлов' });
  }
});

// Изменить тайл
worldRouter.patch('/:roomId/tiles/:x/:y', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireParticipant(req.user!.userId, (req.params.roomId as string))) {
      res.status(403).json({ error: 'Нет доступа' }); return;
    }
    const { terrain, resourceAmount } = req.body;
    const { roomId } = req.params;

    await query(
      `UPDATE world_tiles
       SET terrain = COALESCE($1, terrain),
           resource_amount = COALESCE($2, resource_amount),
           modified_by = $3,
           modified_at = NOW()
       WHERE room_id = $4 AND x = $5 AND y = $6`,
      [terrain, resourceAmount, req.user!.userId, roomId, parseInt((req.params.x as string) as string), parseInt((req.params.y as string) as string)]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка изменения тайла' });
  }
});

// Получить NPC мира
worldRouter.get('/:roomId/npcs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM npcs WHERE room_id = $1 AND is_alive = true ORDER BY is_unique DESC',
      [(req.params.roomId as string)]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения NPC' });
  }
});

// Получить здания мира
worldRouter.get('/:roomId/buildings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM buildings WHERE room_id = $1 ORDER BY built_at DESC',
      [(req.params.roomId as string)]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения зданий' });
  }
});

// Построить здание
worldRouter.post('/:roomId/buildings', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireParticipant(req.user!.userId, (req.params.roomId as string))) {
      res.status(403).json({ error: 'Нет доступа' }); return;
    }
    const { tileX, tileY, buildingType, name } = req.body;

    const result = await query(
      `INSERT INTO buildings (room_id, tile_x, tile_y, building_type, name, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (room_id, tile_x, tile_y) DO NOTHING
       RETURNING *`,
      [(req.params.roomId as string), tileX, tileY, buildingType, name || buildingType, req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(409).json({ error: 'На этом тайле уже есть постройка' });
      return;
    }

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Build error:', err.message);
    res.status(500).json({ error: 'Ошибка строительства' });
  }
});

// Получить инвентарь игрока в мире
worldRouter.get('/:roomId/inventory', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM player_inventory WHERE user_id = $1 AND room_id = $2 ORDER BY slot',
      [req.user!.userId, (req.params.roomId as string)]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения инвентаря' });
  }
});

// Получить квесты мира
worldRouter.get('/:roomId/quests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM quests
       WHERE room_id = $1 AND (assigned_to = $2 OR assigned_to IS NULL)
       AND status IN ('available', 'active')
       ORDER BY created_at DESC`,
      [(req.params.roomId as string), req.user!.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения квестов' });
  }
});

// Получить торговые предложения
worldRouter.get('/:roomId/trades', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT t.*, u.username as seller_name
       FROM trade_offers t
       JOIN users u ON t.seller_id = u.id
       WHERE t.room_id = $1 AND t.status = 'active'
       ORDER BY t.created_at DESC`,
      [(req.params.roomId as string)]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения предложений' });
  }
});

// Получить фракции
worldRouter.get('/:roomId/factions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM factions WHERE room_id = $1',
      [(req.params.roomId as string)]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения фракций' });
  }
});
