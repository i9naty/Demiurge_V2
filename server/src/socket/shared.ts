import { Socket } from 'socket.io';

export interface SocketUser {
  userId: string;
  username: string;
  isGuest: boolean;
  roomId: string | null;
  sessionId: string | null;
}

export const connectedUsers = new Map<string, SocketUser>();

export function requireAuth(socket: Socket, callback?: (err?: string) => void): boolean {
  const user = connectedUsers.get(socket.id);
  if (!user || user.isGuest) { callback?.('Требуется авторизация'); return false; }
  return true;
}
