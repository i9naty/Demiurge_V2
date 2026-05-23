import { Socket } from 'socket.io';
import { generateNPCResponse } from '../services/ai';
import { requireAuth } from './shared';

export function registerAiHandlers(socket: Socket, _userId: string): void {
  socket.on('ai:master_help', async (data: { roomId: string; prompt: string; type: string }) => {
    if (!requireAuth(socket)) return;
    try { const response = await generateNPCResponse(data.prompt, data.type); socket.emit('ai:master_response', { response, type: data.type }); }
    catch { socket.emit('ai:master_response', { response: '🤖 ИИ-помощник временно недоступен.', type: data.type }); }
  });
}
