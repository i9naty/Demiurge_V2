import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { connectedUsers } from './shared';
import { logger } from '../config/logger';

export function registerDiscordHandlers(socket: Socket, io: Server, userId: string, username: string): void {
  socket.on('discord:join_server', (serverId: string) => { socket.join(`discord:${serverId}`); });
  socket.on('discord:leave_server', (serverId: string) => { socket.leave(`discord:${serverId}`); });
  socket.on('discord:join_channel', (data: { serverId: string; channelId: string }) => {
    socket.rooms.forEach(r => { if (r.startsWith('dch:')) socket.leave(r); });
    socket.join(`dch:${data.channelId}`);
  });
  socket.on('discord:message', async (data: { channelId: string; content: string }) => {
    if (!data.content?.trim()) return;
    const msgId = uuid();
    try { await query('INSERT INTO discord_messages (id, channel_id, user_id, content) VALUES ($1,$2,$3,$4)', [msgId, data.channelId, userId, data.content]); } catch (err) { logger.error({ err }, 'Discord message error'); }
    io.to(`dch:${data.channelId}`).emit('discord:message', { id: msgId, channel_id: data.channelId, user_id: userId, username, content: data.content, created_at: new Date().toISOString() });
  });

  // ─── VOICE ───
  socket.on('voice:join', async (data: { channelId: string; serverId: string }) => {
    socket.join(`voice:${data.channelId}`);
    socket.to(`voice:${data.channelId}`).emit('voice:user_joined', { userId, username, peerId: socket.id });
    const sockets = await io.in(`voice:${data.channelId}`).fetchSockets();
    io.to(`voice:${data.channelId}`).emit('voice:participants', sockets.map(s => {
      const su = connectedUsers.get(s.id);
      return { userId: su?.userId, username: su?.username, peerId: s.id };
    }));
  });
  socket.on('voice:leave', (channelId: string) => { socket.leave(`voice:${channelId}`); socket.to(`voice:${channelId}`).emit('voice:user_left', { userId, username }); });
  socket.on('voice:signal', (data: { to: string; signal: unknown }) => {
    const targetSocket = io.of('/').sockets.get(data.to);
    if (!targetSocket) return;
    const senderRoom = [...socket.rooms].find(r => r.startsWith('voice:'));
    const targetRoom = [...targetSocket.rooms].find(r => r.startsWith('voice:'));
    if (!senderRoom || senderRoom !== targetRoom) return;
    io.to(data.to).emit('voice:signal', { from: socket.id, signal: data.signal, userId, username });
  });
  socket.on('voice:speaking', (data: { userId: string; speaking: boolean }) => {
    const user = connectedUsers.get(socket.id);
    if (user?.roomId) socket.to(user.roomId).emit('voice:speaking', data);
    const vr = [...socket.rooms].find(r => r.startsWith('voice:')); if (vr) socket.to(vr).emit('voice:speaking', data);
  });
  socket.on('voice:offer', (data: { to: string; offer: unknown; userId: string }) => { io.to(data.to).emit('voice:offer', { from: socket.id, offer: data.offer, userId: data.userId }); });
  socket.on('voice:answer', (data: { to: string; answer: unknown }) => { io.to(data.to).emit('voice:answer', { from: socket.id, answer: data.answer }); });
  socket.on('voice:ice', (data: { to: string; candidate: unknown }) => { io.to(data.to).emit('voice:ice', { from: socket.id, candidate: data.candidate }); });
  socket.on('typing:start', (data: { channelId: string }) => { socket.to(`dch:${data.channelId}`).emit('typing:start', { userId, username, channelId: data.channelId }); });
  socket.on('typing:stop', (data: { channelId: string }) => { socket.to(`dch:${data.channelId}`).emit('typing:stop', { userId, channelId: data.channelId }); });
  socket.on('presence:online', () => { socket.broadcast.emit('presence:online', { userId, username }); });
}
