import { Server, Socket } from 'socket.io';
import { query } from '../config/database';
import { generateWorldEvents } from '../services/ai';
import { requireAuth } from './shared';
import { logger } from '../config/logger';

export function registerWorldHandlers(socket: Socket, io: Server, userId: string, username: string): void {
  socket.on('world:move', (data: { roomId: string; x: number; y: number }) => {
    if (!requireAuth(socket)) return;
    socket.to(data.roomId).emit('world:player_moved', { userId, username, x: data.x, y: data.y });
  });
  socket.on('world:gather', async (data: { roomId: string; tileX: number; tileY: number }) => {
    if (!requireAuth(socket)) return;
    try {
      const tile = await query('SELECT * FROM world_tiles WHERE room_id = $1 AND x = $2 AND y = $3', [data.roomId, data.tileX, data.tileY]);
      if (tile.rows.length === 0) return;
      const t = tile.rows[0];
      if (!t.resource_type || t.resource_amount <= 0) return;
      const updated = await query('UPDATE world_tiles SET resource_amount = resource_amount - 1 WHERE id = $1 AND resource_amount > 0 RETURNING resource_amount', [t.id]);
      if (updated.rows.length === 0) return;
      const existing = await query('SELECT * FROM player_inventory WHERE user_id = $1 AND room_id = $2 AND item_type = $3', [userId, data.roomId, t.resource_type]);
      if (existing.rows.length > 0) await query('UPDATE player_inventory SET quantity = quantity + 1 WHERE id = $1', [existing.rows[0].id]);
      else await query('INSERT INTO player_inventory (user_id, room_id, item_type, quantity, slot) SELECT $1,$2,$3,1,COALESCE(MAX(slot),-1)+1 FROM player_inventory WHERE user_id=$1 AND room_id=$2', [userId, data.roomId, t.resource_type]);
      io.to(data.roomId).emit('world:resource_gathered', { userId, username, tileX: data.tileX, tileY: data.tileY, resourceType: t.resource_type });
    } catch (err) { logger.error({ err }, 'World gather error'); }
  });
  socket.on('world:request_events', async (data: { roomId: string }) => {
    if (!requireAuth(socket)) return;
    try { const events = await generateWorldEvents(data.roomId); if (events) io.to(data.roomId).emit('world:event', events); } catch (err) { logger.error({ err }, 'World events error'); }
  });
}
