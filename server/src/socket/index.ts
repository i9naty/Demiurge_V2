import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { env } from '../config/env';
import { generateWorldEvents, generateNPCResponse } from '../services/ai';
import { getAssetIdList } from '../services/assetScanner';
import { generateWorld, generateFallbackWorld, processGameAction, smartFallback } from '../services/storyAI';
import { incrementStat } from '../routes/achievements';
import { authPayloadSchema } from '../validators';

const BCRYPT_ROUNDS = 12;

interface SocketUser {
  userId: string;
  username: string;
  isGuest: boolean;
  roomId: string | null;
  sessionId: string | null;
}

const connectedUsers = new Map<string, SocketUser>();

function requireAuth(socket: Socket, callback?: (err?: string) => void): boolean {
  const user = connectedUsers.get(socket.id);
  if (!user || user.isGuest) { callback?.('Требуется авторизация'); return false; }
  return true;
}

export function setupSocket(io: Server) {
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
        console.error('Guest socket auth error:', err instanceof Error ? err.message : err);
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

  io.on('connection', (socket: Socket) => {
    const user = connectedUsers.get(socket.id);
    if (!user) { socket.disconnect(true); return; }
    const { userId, username } = user;
    console.log(`🔌 ${username} подключился`);

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

    // ─── ЧАТ ───
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
      try { await query('INSERT INTO messages (id, room_id, user_id, content, type, metadata) VALUES ($1,$2,$3,$4,$5,$6)', [msgId, roomId, userId, processedContent, messageType, metadata ? JSON.stringify(metadata) : '{}']); } catch {}
      io.to(roomId).emit('chat:message', { id: msgId, roomId, userId, username, content: processedContent, type: messageType, metadata, createdAt: new Date().toISOString() });

      // Handle whisper: /w @username message
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

    // ─── ТОКЕНЫ VTT ───
    socket.on('token:create', async (data: { roomId: string; name: string; imageUrl?: string; x: number; y: number; width?: number; height?: number }) => {
      if (!requireAuth(socket)) return;
      if (data.name && data.name.length > 128) return;
      const w = Math.min(data.width || 64, 500);
      const h = Math.min(data.height || 64, 500);
      const tokenId = uuid();
      try { await query('INSERT INTO tokens (id, room_id, name, image_url, x, y, width, height, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [tokenId, data.roomId, data.name, data.imageUrl || null, data.x, data.y, w, h, userId]); } catch {}
      io.to(data.roomId).emit('token:created', { id: tokenId, roomId: data.roomId, name: data.name, imageUrl: data.imageUrl || null, x: data.x, y: data.y, width: w, height: h, createdBy: userId });
    });
    socket.on('token:move', (data: { roomId: string; tokenId: string; x: number; y: number }) => {
      if (!requireAuth(socket)) return;
      try { query('UPDATE tokens SET x = $1, y = $2 WHERE id = $3', [data.x, data.y, data.tokenId]); } catch {}
      io.to(data.roomId).emit('token:moved', { tokenId: data.tokenId, x: data.x, y: data.y, movedBy: userId });
    });
    socket.on('token:delete', async (data: { roomId: string; tokenId: string }) => {
      if (!requireAuth(socket)) return;
      try { await query('DELETE FROM tokens WHERE id = $1', [data.tokenId]); } catch {}
      io.to(data.roomId).emit('token:deleted', { tokenId: data.tokenId });
    });
    socket.on('fog:update', (data: { roomId: string; fogData: any }) => {
      if (!requireAuth(socket)) return;
      socket.to(data.roomId).emit('fog:updated', { fogData: data.fogData, updatedBy: userId });
    });

    // ─── РЕЖИМ 3: МИР ───
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
      } catch {}
    });
    socket.on('world:request_events', async (data: { roomId: string }) => {
      if (!requireAuth(socket)) return;
      try { const events = await generateWorldEvents(data.roomId); if (events) io.to(data.roomId).emit('world:event', events); } catch {}
    });

    // ─── AI ПОМОЩНИК ───
    socket.on('ai:master_help', async (data: { roomId: string; prompt: string; type: string }) => {
      if (!requireAuth(socket)) return;
      try { const response = await generateNPCResponse(data.prompt, data.type); socket.emit('ai:master_response', { response, type: data.type }); }
      catch { socket.emit('ai:master_response', { response: '🤖 ИИ-помощник временно недоступен.', type: data.type }); }
    });

    // ─── ЛИЧНЫЕ СООБЩЕНИЯ ───
    socket.on('dm:send', async (data: { to: string; content: string }) => {
      if (!data.content?.trim()) return;
      const msgId = uuid();
      try { await query('INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4)', [msgId, userId, data.to, data.content]); } catch {}
      const payload = { id: msgId, sender_id: userId, sender_name: username, receiver_id: data.to, content: data.content, created_at: new Date().toISOString() };
      socket.emit('dm:message', payload);
      (await io.fetchSockets()).forEach(s => { if (connectedUsers.get(s.id)?.userId === data.to) s.emit('dm:message', payload); });
    });

    // ─── DISCORD ───
    socket.on('discord:join_server', (serverId: string) => { socket.join(`discord:${serverId}`); });
    socket.on('discord:leave_server', (serverId: string) => { socket.leave(`discord:${serverId}`); });
    socket.on('discord:join_channel', (data: { serverId: string; channelId: string }) => {
      socket.rooms.forEach(r => { if (r.startsWith('dch:')) socket.leave(r); });
      socket.join(`dch:${data.channelId}`);
    });
    socket.on('discord:message', async (data: { channelId: string; content: string }) => {
      if (!data.content?.trim()) return;
      const msgId = uuid();
      try { await query('INSERT INTO discord_messages (id, channel_id, user_id, content) VALUES ($1,$2,$3,$4)', [msgId, data.channelId, userId, data.content]); } catch {}
      io.to(`dch:${data.channelId}`).emit('discord:message', { id: msgId, channel_id: data.channelId, user_id: userId, username, content: data.content, created_at: new Date().toISOString() });
    });

    // ─── DISCORD VOICE ───
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
    socket.on('voice:signal', (data: { to: string; signal: any }) => {
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
    socket.on('voice:offer', (data: { to: string; offer: any; userId: string }) => { io.to(data.to).emit('voice:offer', { from: socket.id, offer: data.offer, userId: data.userId }); });
    socket.on('voice:answer', (data: { to: string; answer: any }) => { io.to(data.to).emit('voice:answer', { from: socket.id, answer: data.answer }); });
    socket.on('voice:ice', (data: { to: string; candidate: any }) => { io.to(data.to).emit('voice:ice', { from: socket.id, candidate: data.candidate }); });
    socket.on('typing:start', (data: { channelId: string }) => { socket.to(`dch:${data.channelId}`).emit('typing:start', { userId, username, channelId: data.channelId }); });
    socket.on('typing:stop', (data: { channelId: string }) => { socket.to(`dch:${data.channelId}`).emit('typing:stop', { userId, channelId: data.channelId }); });
    socket.on('presence:online', () => { socket.broadcast.emit('presence:online', { userId, username }); });

    // ═══════════════════════════════════════════
    // РЕЖИМ 2: ЖИВАЯ ИСТОРИЯ — ЛОББИ И ИГРА
    // ═══════════════════════════════════════════

    socket.on('lobby:join', async (sessionId: string) => {
      socket.join(`game:${sessionId}`);
      const user = connectedUsers.get(socket.id); if (user) user.sessionId = sessionId;
      try {
        await query('UPDATE lobby_participants SET is_online = true WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
      } catch {}
      const participants = await query(
        'SELECT lp.*, u.username, u.avatar_url FROM lobby_participants lp JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1',
        [sessionId]
      );
      io.to(`game:${sessionId}`).emit('lobby:participants', participants.rows);
    });

    socket.on('lobby:leave', async (sessionId: string) => {
      socket.leave(`game:${sessionId}`);
      const user = connectedUsers.get(socket.id); if (user) user.sessionId = null;
      try {
        await query('UPDATE lobby_participants SET is_online = false WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
      } catch {}
      const participants = await query(
        'SELECT lp.*, u.username, u.avatar_url FROM lobby_participants lp JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1',
        [sessionId]
      );
      io.to(`game:${sessionId}`).emit('lobby:participants', participants.rows);
    });

    socket.on('lobby:update', async (data: { sessionId: string; characterData?: any; role?: string }) => {
      if (data.characterData) {
        try {
          await query('UPDATE lobby_participants SET character_data = $1 WHERE session_id = $2 AND user_id = $3',
            [JSON.stringify(data.characterData), data.sessionId, userId]);
        } catch {}
      }
      if (data.role) {
        try {
          await query('UPDATE lobby_participants SET role = $1 WHERE session_id = $2 AND user_id = $3',
            [data.role, data.sessionId, userId]);
        } catch {}
      }
      const participants = await query(
        'SELECT lp.*, u.username, u.avatar_url FROM lobby_participants lp JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1',
        [data.sessionId]
      );
      io.to(`game:${data.sessionId}`).emit('lobby:participants', participants.rows);
    });

    socket.on('game:start', async (data: { sessionId: string }) => {
      if (!requireAuth(socket)) return;
      const sRes = await query('SELECT * FROM game_sessions WHERE id = $1', [data.sessionId]);
      if (sRes.rows.length === 0) return;
      const s = sRes.rows[0];
      const settings = s.settings || {};
      const participants = await query(
        'SELECT lp.*, u.username FROM lobby_participants lp JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1 AND lp.role IN (\'owner\',\'player\')',
        [data.sessionId]
      );

      // Notify all clients that generation started
      const gameRoom = `game:${data.sessionId}`;
      await query('UPDATE game_sessions SET status = $1, updated_at = NOW() WHERE id = $2', ['loading', data.sessionId]);
      io.to(gameRoom).emit('game:generating', { step: 0, message: 'Сканирование ассетов...' });

      const playerNames = participants.rows.map((p: any) => (p.character_data || {}).name || p.username);
      const playerPrompts = participants.rows.map((p: any) => (p.character_data || {}).prompt || '');

      // Try AI generation first
      let worldData: any = null;
      io.to(gameRoom).emit('game:generating', { step: 1, message: 'Нейросеть создаёт мир...' });

      try {
        worldData = await generateWorld({
          genre: settings.genre || 'fantasy',
          setting: settings.setting || 'forest',
          difficulty: settings.difficulty || 'normal',
          nsfw: settings.nsfw || false,
          storyPrompt: settings.storyPrompt || '',
          playerCount: participants.rows.filter((p: any) => p.role !== 'observer').length,
          playerNames,
          playerPrompts,
          playTime: settings.playTime || 60,
        });
      } catch (e) {
        console.warn('AI world gen failed, using fallback');
      }

      if (!worldData) {
        io.to(gameRoom).emit('game:generating', { step: 2, message: 'Генерация процедурной карты...' });
        const fallback = generateFallbackWorld(getAssetIdList(), settings);
        worldData = {
          intro: fallback.story_intro,
          map: fallback.map,
          objects: fallback.objects,
          npcs: fallback.npcs,
          playerStart: fallback.player_start,
          timeOfDay: (settings.setting === 'dungeon' || settings.setting === 'castle') ? 'night' : 'day',
        };
      }

      io.to(gameRoom).emit('game:generating', { step: 3, message: 'Расстановка NPC...' });

      const startPos = worldData.playerStart || { x: 20, y: 20 };
      const tokens: any[] = participants.rows.map((p: any, i: number) => ({
        id: p.user_id, name: (p.character_data || {}).name || p.username, type: 'player',
        x: startPos.x + i * 2, y: startPos.y, hp: 20, maxHp: 20,
        charData: p.character_data || {},
      }));

      if (worldData.npcs && Array.isArray(worldData.npcs)) {
        worldData.npcs.forEach((npc: any, i: number) => {
          tokens.push({
            id: `npc_${i}_${Date.now()}`, name: npc.name || 'NPC', type: npc.type || 'npc',
            x: npc.x || 10, y: npc.y || 10, hp: npc.hp || 15, maxHp: npc.maxHp || 15,
            dialog: npc.dialog || '...', charData: {},
          });
        });
      }

      io.to(gameRoom).emit('game:generating', { step: 4, message: 'Подготовка сюжета...' });

      await query(
        'UPDATE game_sessions SET world_state = $1, story_state = $2, status = $3, updated_at = NOW() WHERE id = $4',
        [JSON.stringify({ map: worldData.map, objects: worldData.objects || [], tokens }),
         JSON.stringify({ intro: worldData.intro || '', history: [] }),
         'active', data.sessionId]
      );

      setTimeout(() => {
        io.to(gameRoom).emit('game:started', {
          map: worldData.map, objects: worldData.objects || [], tokens,
          intro: worldData.intro || 'Приключение начинается...',
          timeOfDay: worldData.timeOfDay || 'day',
        });
        incrementStat(userId, 'game_count').then(r => { if (r.length) socket.emit('achievements:earned', r); });
      }, 1500);
    });

    socket.on('game:action', async (data: { sessionId: string; action: string }) => {
      if (!requireAuth(socket)) return;
      const sRes = await query('SELECT * FROM game_sessions WHERE id = $1', [data.sessionId]);
      if (sRes.rows.length === 0) return;
      const s = sRes.rows[0];
      const ws = s.world_state || {};
      const ss = s.story_state || {};
      const settings = s.settings || {};
      const curTokens: any[] = ws.tokens || [];
      const curObjects: any[] = ws.objects || [];
      const history: string[] = (ss.history || []).map((h: any) => h.user ? `${h.user}: ${h.action}` : h.text || '');
      const player = curTokens.find((t: any) => t.id === userId);
      const playerHp = player?.hp ?? 20, playerMaxHp = player?.maxHp ?? 20;

      // Get player character data
      let playerPrompt = '';
      try {
        const pRes = await query('SELECT character_data FROM lobby_participants WHERE session_id = $1 AND user_id = $2', [data.sessionId, userId]);
        if (pRes.rows.length > 0) playerPrompt = (pRes.rows[0].character_data || {}).prompt || '';
      } catch {}

      // Try AI first
      let response: any = null;
      try {
        response = await processGameAction({
          genre: settings.genre || 'fantasy',
          setting: settings.setting || 'forest',
          difficulty: settings.difficulty || 'normal',
          nsfw: settings.nsfw || false,
          storyPrompt: settings.storyPrompt || '',
          playerCount: curTokens.filter((t: any) => t.type === 'player').length || 1,
          action: data.action,
          playerName: player?.name || username,
          playerPrompt,
          history,
          tokens: curTokens,
          objects: curObjects,
          playerHp,
          playerMaxHp,
          inventory: [],
        });
      } catch {}

      if (!response || !response.description) {
        response = smartFallback({ action: data.action, curTokens, curObjects, ws, userId });
      }

      if (!response.options?.length) response.options = ['Осмотреться вокруг', 'Идти дальше', 'Поговорить с NPC'];

      // Process token changes
      let updatedTokens = [...curTokens];
      if (response.changes?.tokens) {
        for (const tc of response.changes.tokens) {
          if (tc.remove) { updatedTokens = updatedTokens.filter((t: any) => t.id !== tc.id && t.id !== tc.ref && (tc.id ? !t.id.startsWith(tc.id.slice(0, 8)) : true)); continue; }
          let idx = updatedTokens.findIndex((t: any) => t.id === tc.id || t.id === tc.ref || (tc.ref && t.id.startsWith(tc.ref)));
          if (idx === -1 && tc.id) idx = updatedTokens.findIndex((t: any) => (t.name || '').toLowerCase() === (tc.id || '').toLowerCase());
          if (idx >= 0) updatedTokens[idx] = { ...updatedTokens[idx], ...tc, id: updatedTokens[idx].id };
        }
      }

      // Handle HP changes
      let newPlayerHp = playerHp;
      if (response.playerHp !== null && response.playerHp !== undefined) newPlayerHp = response.playerHp;
      else if (response.changes?.player_hp !== null && response.changes?.player_hp !== undefined) newPlayerHp = response.changes.player_hp;

      if (newPlayerHp !== playerHp && player) {
        const idx = updatedTokens.findIndex((t: any) => t.id === player.id);
        if (idx >= 0) updatedTokens[idx] = { ...updatedTokens[idx], hp: newPlayerHp };
      }

      const newHistory = [...(ss.history || []),
        { user: username, action: data.action },
        { text: response.description }
      ].slice(-40);

      const newWs = { ...ws, tokens: updatedTokens, objects: curObjects };
      const newSs = { ...ss, history: newHistory };

      try {
        await query('UPDATE game_sessions SET world_state=$1, story_state=$2, updated_at=NOW() WHERE id=$3',
          [JSON.stringify(newWs), JSON.stringify(newSs), data.sessionId]);
      } catch {}

      io.to(`game:${data.sessionId}`).emit('game:state', {
        description: response.description, options: response.options,
        tokens: updatedTokens, objects: curObjects,
        player_hp: newPlayerHp,
        inventory: response.changes?.inventory || response.inventory,
        end_session: response.changes?.end_session || response.sessionEnd || false,
        epilogue: response.epilogue || null,
      });
    });

    // ─── СОХРАНЕНИЕ ИГРЫ ───
    socket.on('game:save', async (data: { sessionId: string; name?: string }) => {
      if (!requireAuth(socket)) return;
      try {
        const sRes = await query('SELECT * FROM game_sessions WHERE id = $1', [data.sessionId]);
        if (sRes.rows.length === 0) { socket.emit('game:save_result', { error: 'Игра не найдена' }); return; }
        const s = sRes.rows[0];
        await query(
          'INSERT INTO saved_games (user_id, session_id, save_name, world_state, story_state, settings) VALUES ($1,$2,$3,$4,$5,$6)',
          [userId, s.id, data.name || 'Сохранение', JSON.stringify(s.world_state || {}), JSON.stringify(s.story_state || {}), JSON.stringify(s.settings || {})]
        );
        socket.emit('game:save_result', { success: true });
      } catch (err: any) {
        socket.emit('game:save_result', { error: err.message });
      }
    });

    // ─── GM TOOLS ───
    socket.on('room:kick', async (data: { roomId: string; userId: string }) => {
      if (!requireAuth(socket)) return;
      const room = await query('SELECT owner_id FROM rooms WHERE id = $1', [data.roomId]);
      if (room.rows.length === 0 || room.rows[0].owner_id !== userId) return; // Only owner can kick
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

    // ─── ДИСКОННЕКТ ───
    socket.on('disconnect', async () => {
      console.log(`🔌 ${username} отключился`);
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
        } catch {}
      }
      connectedUsers.delete(socket.id);
    });
  });
}
