import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { connectedUsers, requireAuth } from './shared';
import { logger } from '../config/logger';

export function registerRoomHandlers(socket: Socket, io: Server, userId: string, username: string): void {
  // ─── КОМНАТЫ ───
  socket.on('room:join', async (roomId: string) => {
    socket.join(roomId);
    const u = connectedUsers.get(socket.id); if (u) u.roomId = roomId;
    io.to(roomId).emit('room:user_joined', { userId, username, timestamp: Date.now() });
    const sockets = await io.in(roomId).fetchSockets();
    io.to(roomId).emit('room:participants', sockets.map(s => {
      const su = connectedUsers.get(s.id);
      return { userId: su?.userId, username: su?.username };
    }));
  });
  socket.on('room:leave', (roomId: string) => {
    socket.leave(roomId);
    const user = connectedUsers.get(socket.id); if (user) user.roomId = null;
    io.to(roomId).emit('room:user_left', { userId, username, timestamp: Date.now() });
  });

  // ─── ТОКЕНЫ VTT ───
  socket.on('token:create', async (data: { roomId: string; name: string; imageUrl?: string; x: number; y: number; width?: number; height?: number }) => {
    if (!requireAuth(socket)) return;
    if (data.name && data.name.length > 128) return;
    const w = Math.min(data.width || 64, 500);
    const h = Math.min(data.height || 64, 500);
    const tokenId = uuid();
    try { await query('INSERT INTO tokens (id, room_id, name, image_url, x, y, width, height, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [tokenId, data.roomId, data.name, data.imageUrl || null, data.x, data.y, w, h, userId]); } catch (err) { logger.error({ err }, 'Save token error'); }
    io.to(data.roomId).emit('token:created', { id: tokenId, roomId: data.roomId, name: data.name, imageUrl: data.imageUrl || null, x: data.x, y: data.y, width: w, height: h, createdBy: userId });
  });
  socket.on('token:move', (data: { roomId: string; tokenId: string; x: number; y: number }) => {
    if (!requireAuth(socket)) return;
    try { query('UPDATE tokens SET x = $1, y = $2 WHERE id = $3', [data.x, data.y, data.tokenId]); } catch (err) { logger.error({ err }, 'Save token move error'); }
    io.to(data.roomId).emit('token:moved', { tokenId: data.tokenId, x: data.x, y: data.y, movedBy: userId });
  });
  socket.on('token:delete', async (data: { roomId: string; tokenId: string }) => {
    if (!requireAuth(socket)) return;
    try { await query('DELETE FROM tokens WHERE id = $1', [data.tokenId]); } catch (err) { logger.error({ err }, 'Delete token error'); }
    io.to(data.roomId).emit('token:deleted', { tokenId: data.tokenId });
  });
  socket.on('fog:update', (data: { roomId: string; fogData: unknown }) => {
    if (!requireAuth(socket)) return;
    socket.to(data.roomId).emit('fog:updated', { fogData: data.fogData, updatedBy: userId });
  });

  // ─── GM TOOLS ───
  socket.on('room:kick', async (data: { roomId: string; userId: string }) => {
    if (!requireAuth(socket)) return;
    const room = await query('SELECT owner_id FROM rooms WHERE id = $1', [data.roomId]);
    if (room.rows.length === 0 || room.rows[0].owner_id !== userId) return;
    const targetSockets = (await io.fetchSockets()).filter(s => connectedUsers.get(s.id)?.userId === data.userId);
    targetSockets.forEach(s => {
      s.emit('room:kicked', { roomId: data.roomId });
      s.leave(data.roomId);
      s.leave(`game:${data.roomId}`);
    });
    io.to(data.roomId).emit('room:user_kicked', { userId: data.userId });
  });

  // ─── SOUNDPAD ───
  socket.on('soundpad:play', (data: { roomId: string; url: string; time: number; volume: number }) => {
    socket.to(`game:${data.roomId}`).emit('soundpad:play', data);
    const room = connectedUsers.get(socket.id)?.roomId;
    if (room) socket.to(room).emit('soundpad:play', data);
  });
  socket.on('soundpad:pause', (data: { roomId: string }) => {
    socket.to(`game:${data.roomId}`).emit('soundpad:pause', {});
    const room = connectedUsers.get(socket.id)?.roomId;
    if (room) socket.to(room).emit('soundpad:pause', {});
  });
  socket.on('soundpad:stop', (data: { roomId: string }) => {
    socket.to(`game:${data.roomId}`).emit('soundpad:stop', {});
    const room = connectedUsers.get(socket.id)?.roomId;
    if (room) socket.to(room).emit('soundpad:stop', {});
  });
  socket.on('soundpad:volume', (data: { roomId: string; volume: number }) => {
    socket.to(`game:${data.roomId}`).emit('soundpad:volume', data.volume);
    const room = connectedUsers.get(socket.id)?.roomId;
    if (room) socket.to(room).emit('soundpad:volume', data.volume);
  });
}
