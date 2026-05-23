import { Server, Socket } from 'socket.io';
import { query } from '../config/database';
import { getAssetIdList } from '../services/assetScanner';
import { generateWorld, generateFallbackWorld, processGameAction, smartFallback } from '../services/storyAI';
import { incrementStat } from '../routes/achievements';
import { connectedUsers, requireAuth } from './shared';

export function registerGameHandlers(socket: Socket, io: Server, userId: string, username: string): void {
  socket.on('lobby:join', async (sessionId: string) => {
    socket.join(`game:${sessionId}`);
    const user = connectedUsers.get(socket.id); if (user) user.sessionId = sessionId;
    try {
      await query('UPDATE lobby_participants SET is_online = true WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
    } catch (err) { console.error('Lobby join error:', err instanceof Error ? err.message : err); }
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
    } catch (err) { console.error('Lobby leave error:', err instanceof Error ? err.message : err); }
    const participants = await query(
      'SELECT lp.*, u.username, u.avatar_url FROM lobby_participants lp JOIN users u ON lp.user_id = u.id WHERE lp.session_id = $1',
      [sessionId]
    );
    io.to(`game:${sessionId}`).emit('lobby:participants', participants.rows);
  });

  socket.on('lobby:update', async (data: { sessionId: string; characterData?: unknown; role?: string }) => {
    if (data.characterData) {
      try {
        await query('UPDATE lobby_participants SET character_data = $1 WHERE session_id = $2 AND user_id = $3',
          [JSON.stringify(data.characterData), data.sessionId, userId]);
      } catch (err) { console.error('Lobby update character error:', err instanceof Error ? err.message : err); }
    }
    if (data.role) {
      try {
        await query('UPDATE lobby_participants SET role = $1 WHERE session_id = $2 AND user_id = $3',
          [data.role, data.sessionId, userId]);
      } catch (err) { console.error('Lobby update role error:', err instanceof Error ? err.message : err); }
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

    const gameRoom = `game:${data.sessionId}`;
    await query('UPDATE game_sessions SET status = $1, updated_at = NOW() WHERE id = $2', ['loading', data.sessionId]);
    io.to(gameRoom).emit('game:generating', { step: 0, message: 'Сканирование ассетов...' });

    const playerNames = participants.rows.map((p: any) => (p.character_data || {}).name || p.username);
    const playerPrompts = participants.rows.map((p: any) => (p.character_data || {}).prompt || '');

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

    let playerPrompt = '';
    try {
      const pRes = await query('SELECT character_data FROM lobby_participants WHERE session_id = $1 AND user_id = $2', [data.sessionId, userId]);
      if (pRes.rows.length > 0) playerPrompt = (pRes.rows[0].character_data || {}).prompt || '';
    } catch (err) { console.error('Game action character data error:', err instanceof Error ? err.message : err); }

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
    } catch (err) { console.error('Game action error:', err instanceof Error ? err.message : err); }

    if (!response || !response.description) {
      response = smartFallback({ action: data.action, curTokens, curObjects, ws, userId });
    }

    if (!response.options?.length) response.options = ['Осмотреться вокруг', 'Идти дальше', 'Поговорить с NPC'];

    let updatedTokens = [...curTokens];
    if (response.changes?.tokens) {
      for (const tc of response.changes.tokens) {
        if (tc.remove) { updatedTokens = updatedTokens.filter((t: any) => t.id !== tc.id && t.id !== tc.ref && (tc.id ? !t.id.startsWith(tc.id.slice(0, 8)) : true)); continue; }
        let idx = updatedTokens.findIndex((t: any) => t.id === tc.id || t.id === tc.ref || (tc.ref && t.id.startsWith(tc.ref)));
        if (idx === -1 && tc.id) idx = updatedTokens.findIndex((t: any) => (t.name || '').toLowerCase() === (tc.id || '').toLowerCase());
        if (idx >= 0) updatedTokens[idx] = { ...updatedTokens[idx], ...tc, id: updatedTokens[idx].id };
      }
    }

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
    } catch (err) { console.error('Save game error:', err instanceof Error ? err.message : err); }

    io.to(`game:${data.sessionId}`).emit('game:state', {
      description: response.description, options: response.options,
      tokens: updatedTokens, objects: curObjects,
      player_hp: newPlayerHp,
      inventory: response.changes?.inventory || response.inventory,
      end_session: response.changes?.end_session || response.sessionEnd || false,
      epilogue: response.epilogue || null,
    });
  });

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
}
