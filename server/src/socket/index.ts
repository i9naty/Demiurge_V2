import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { env } from '../config/env';
import { authPayloadSchema } from '../validators';
import { connectedUsers } from './shared';
import { logger } from '../config/logger';

export { connectedUsers, SocketUser } from './shared';
export { requireAuth } from './shared';

export const BCRYPT_ROUNDS = 12;

function setupAuth(io: Server): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      const guestId = uuid();
      const guestName = `Гость_${guestId.slice(0, 6)}`;
      try {
        const passwordHash = await bcrypt.hash(guestId, BCRYPT_ROUNDS);
        await query(
          `INSERT INTO users (id, username, email, password_hash, display_name, is_guest)
           VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT (username) DO UPDATE SET last_seen_at = NOW()`,
          [guestId, guestName, `${guestId}@guest.demiurge`, passwordHash, guestName]
        );
      } catch (err) {
        logger.error({ err }, 'Guest socket auth error');
      }
      connectedUsers.set(socket.id, { userId: guestId, username: guestName, isGuest: true, roomId: null, sessionId: null });
      return next();
    }
    try {
      const raw = jwt.verify(token, env.JWT_SECRET);
      const payload = authPayloadSchema.parse(raw);
      connectedUsers.set(socket.id, {
        userId: payload.userId,
        username: payload.username,
        isGuest: payload.isGuest ?? false,
        roomId: null,
        sessionId: null,
      });
      next();
    } catch {
      next(new Error('Недействительный токен'));
    }
  });
}

import { registerChatHandlers } from './chat';
import { registerRoomHandlers } from './rooms';
import { registerWorldHandlers } from './world';
import { registerGameHandlers } from './game';
import { registerDiscordHandlers } from './discord';
import { registerDmHandlers } from './dm';
import { registerAiHandlers } from './ai';

export function setupSocket(io: Server) {
  setupAuth(io);

  io.on('connection', (socket: Socket) => {
    const user = connectedUsers.get(socket.id);
    if (!user) { socket.disconnect(true); return; }
    const { userId, username } = user;
    logger.info(`${username} connected`);

    registerRoomHandlers(socket, io, userId, username);
    registerChatHandlers(socket, io, userId, username);
    registerWorldHandlers(socket, io, userId, username);
    registerGameHandlers(socket, io, userId, username);
    registerDiscordHandlers(socket, io, userId, username);
    registerDmHandlers(socket, io, userId, username);
    registerAiHandlers(socket, userId);

    // ─── ДИСКОННЕКТ ───
    socket.on('disconnect', async () => {
      logger.info(`${username} disconnected`);
      const user = connectedUsers.get(socket.id);
      if (user?.roomId) {
        io.to(user.roomId).emit('room:user_left', { userId, username, timestamp: Date.now() });
      }
      if (user?.sessionId) {
        try {
          await query('UPDATE lobby_participants SET is_online = false WHERE session_id = $1 AND user_id = $2', [user.sessionId, userId]);
          const participants = await query(
            'SELECT lp.*, u.username, u.avatar_url FROM lobby_participants lp JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1',
            [user.sessionId]
          );
          io.to(`game:${user.sessionId}`).emit('lobby:participants', participants.rows);
        } catch (err) { logger.error({ err }, 'Disconnect cleanup error'); }
      }
      connectedUsers.delete(socket.id);
    });
  });
}
