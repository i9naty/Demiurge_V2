import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { connectedUsers } from './shared';
import { logger } from '../config/logger';

export function registerChatHandlers(socket: Socket, io: Server, userId: string, username: string): void {
  socket.on('chat:message', async (data: { roomId: string; content: string; type?: string }) => {
    const { roomId, content, type = 'chat' } = data;
    if (!content) return;
    if (content.length > 5000) return;
    let processedContent = content, messageType = type, metadata: Record<string, unknown> | null = null;
    if (content.startsWith('/roll')) {
      messageType = 'roll';
      const diceMatch = content.match(/\/roll\s+(\d+)?d(\d+)([+-]\d+)?/i);
      if (diceMatch) {
        const count = Math.min(parseInt(diceMatch[1] || '1'), 100);
        const sides = Math.min(parseInt(diceMatch[2]!), 1000);
        const modifier = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
        const rolls: number[] = [];
        for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
        const total = rolls.reduce((a, b) => a + b, 0) + modifier;
        processedContent = `🎲 ${count}d${sides}${diceMatch[3] || ''}: [${rolls.join(', ')}] = ${total}`;
        metadata = { rolls, total, dice: `${count}d${sides}${modifier ? diceMatch[3] : ''}` };
      }
    }
    const msgId = uuid();
    try { await query('INSERT INTO messages (id, room_id, user_id, content, type, metadata) VALUES ($1,$2,$3,$4,$5,$6)', [msgId, roomId, userId, processedContent, messageType, metadata ? JSON.stringify(metadata) : '{}']); } catch (err) { logger.error({ err }, 'Save chat message error'); }
    io.to(roomId).emit('chat:message', { id: msgId, roomId, userId, username, content: processedContent, type: messageType, metadata, createdAt: new Date().toISOString() });

    if (processedContent.startsWith('/w ') || processedContent.startsWith('/whisper ')) {
      const parts = processedContent.slice(processedContent.startsWith('/w ') ? 3 : 9).match(/^@?(\S+)\s(.+)/s);
      if (parts) {
        const targetName = parts[1]!, whisperMsg = parts[2]!;
        const targetSockets = (await io.fetchSockets()).filter(s => {
          const su = connectedUsers.get(s.id);
          return su?.username === targetName || su?.userId?.startsWith(targetName);
        });
        targetSockets.forEach(s => s.emit('chat:whisper', { from: username, content: whisperMsg, roomId }));
        socket.emit('chat:whisper', { from: username, to: targetName, content: whisperMsg, roomId });
      }
    }
  });
}
