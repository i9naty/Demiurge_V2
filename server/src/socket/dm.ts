import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { connectedUsers } from './shared';
import { logger } from '../config/logger';

export function registerDmHandlers(socket: Socket, io: Server, userId: string, username: string): void {
  socket.on('dm:send', async (data: { to: string; content: string }) => {
    if (!data.content?.trim()) return;
    const msgId = uuid();
    try { await query('INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4)', [msgId, userId, data.to, data.content]); } catch (err) { logger.error({ err }, 'DM insert error'); }
    const payload = { id: msgId, sender_id: userId, sender_name: username, receiver_id: data.to, content: data.content, created_at: new Date().toISOString() };
    socket.emit('dm:message', payload);
    (await io.fetchSockets()).forEach(s => { if (connectedUsers.get(s.id)?.userId === data.to) s.emit('dm:message', payload); });
  });
}
