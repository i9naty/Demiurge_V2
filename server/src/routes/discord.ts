import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';

export const discordRouter = Router();

type P = Record<string, string>;

async function requireMember(userId: string, serverId: string): Promise<boolean> {
  const r = await query('SELECT 1 FROM discord_server_members WHERE server_id = $1 AND user_id = $2', [serverId, userId]);
  return r.rows.length > 0;
}

async function getChannelServer(channelId: string): Promise<string | null> {
  const r = await query('SELECT server_id FROM discord_channels WHERE id = $1', [channelId]);
  return r.rows.length > 0 ? r.rows[0].server_id : null;
}

// Get all servers user is member of
discordRouter.get('/servers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ds.*, (SELECT COUNT(*) FROM discord_server_members WHERE server_id = ds.id) as member_count
       FROM discord_servers ds JOIN discord_server_members dsm ON ds.id = dsm.server_id
       WHERE dsm.user_id = $1 ORDER BY ds.created_at`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Discord servers error:', err.message);
    res.status(500).json({ error: 'Ошибка загрузки серверов' });
  }
});

// Create server
discordRouter.post('/servers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Название обязательно' }); return; }
    const id = uuid();
    const code = uuid().slice(0, 8).toUpperCase();
    await query('INSERT INTO discord_servers (id, name, owner_id, invite_code) VALUES ($1,$2,$3,$4)', [id, name, req.user!.userId, code]);
    await query('INSERT INTO discord_server_members (server_id, user_id) VALUES ($1,$2)', [id, req.user!.userId]);
    await query("INSERT INTO discord_channels (server_id, name, type, position) VALUES ($1,'общий','text',0),($1,'голосовой','voice',1)", [id]);
    const result = await query('SELECT * FROM discord_servers WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Discord create server:', err.message);
    res.status(500).json({ error: 'Ошибка создания сервера' });
  }
});

// Join server by invite
discordRouter.post('/servers/join/:code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const srv = await query('SELECT * FROM discord_servers WHERE invite_code = $1', [req.params.code]);
    if (srv.rows.length === 0) { res.status(404).json({ error: 'Сервер не найден' }); return; }
    await query('INSERT INTO discord_server_members (server_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [srv.rows[0].id, req.user!.userId]);
    res.json(srv.rows[0]);
  } catch (err: any) {
    console.error('Discord join:', err.message);
    res.status(500).json({ error: 'Ошибка входа на сервер' });
  }
});

// Update server (owner only)
discordRouter.patch('/servers/:serverId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    await query('UPDATE discord_servers SET name = COALESCE($1, name) WHERE id = $2 AND owner_id = $3', [name, (req.params.serverId as string), req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) { console.error('Discord patch server:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Delete server (owner only)
discordRouter.delete('/servers/:serverId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM discord_servers WHERE id = $1 AND owner_id = $2', [(req.params.serverId as string), req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) { console.error('Discord delete server:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Get channels for a server
discordRouter.get('/servers/:serverId/channels', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM discord_channels WHERE server_id = $1 ORDER BY position, created_at',
      [(req.params.serverId as string)]
    );
    res.json(result.rows);
  } catch (err: any) { console.error('Channels error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Create channel (must be member)
discordRouter.post('/servers/:serverId/channels', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireMember(req.user!.userId, (req.params.serverId as string))) {
      res.status(403).json({ error: 'Вы не участник сервера' }); return;
    }
    const { name, type = 'text' } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Название обязательно' }); return; }
    const id = uuid();
    await query('INSERT INTO discord_channels (id, server_id, name, type) VALUES ($1,$2,$3,$4)', [id, (req.params.serverId as string), name, type]);
    const result = await query('SELECT * FROM discord_channels WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) { console.error('Create channel error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Get messages for a channel
discordRouter.get('/channels/:channelId/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT dm.*, u.username, u.avatar_url FROM discord_messages dm
       JOIN users u ON dm.user_id = u.id
       WHERE dm.channel_id = $1 ORDER BY dm.created_at ASC LIMIT 100`,
      [(req.params.channelId as string)]
    );
    res.json(result.rows);
  } catch (err: any) { console.error('Messages error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Update channel (member only)
discordRouter.patch('/channels/:channelId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const serverId = await getChannelServer((req.params.channelId as string));
    if (!serverId || !await requireMember(req.user!.userId, serverId)) {
      res.status(403).json({ error: 'Нет доступа' }); return;
    }
    const { name, position } = req.body;
    await query('UPDATE discord_channels SET name = COALESCE($1, name), position = COALESCE($2, position) WHERE id = $3',
      [name, position, (req.params.channelId as string)]);
    res.json({ success: true });
  } catch (err: any) { console.error('Patch channel error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Delete channel (member only)
discordRouter.delete('/channels/:channelId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const serverId = await getChannelServer((req.params.channelId as string));
    if (!serverId || !await requireMember(req.user!.userId, serverId)) {
      res.status(403).json({ error: 'Нет доступа' }); return;
    }
    await query('DELETE FROM discord_channels WHERE id = $1', [(req.params.channelId as string)]);
    res.json({ success: true });
  } catch (err: any) { console.error('Delete channel error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Get server members
discordRouter.get('/servers/:serverId/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url
       FROM discord_server_members dsm JOIN users u ON dsm.user_id = u.id
       WHERE dsm.server_id = $1`,
      [(req.params.serverId as string)]
    );
    res.json(result.rows);
  } catch (err: any) { console.error('Members error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Delete message (own only)
discordRouter.delete('/messages/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM discord_messages WHERE id = $1 AND user_id = $2', [(req.params.messageId as string), req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) { console.error('Delete msg error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Edit message (own only)
discordRouter.patch('/messages/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: 'Сообщение не может быть пустым' }); return; }
    await query('UPDATE discord_messages SET content = $1 WHERE id = $2 AND user_id = $3',
      [content, (req.params.messageId as string), req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) { console.error('Edit msg error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Add reaction
discordRouter.post('/messages/:messageId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { emoji } = req.body;
    if (!emoji) { res.status(400).json({ error: 'Эмодзи обязателен' }); return; }
    await query('INSERT INTO discord_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (message_id, user_id, emoji) DO NOTHING',
      [(req.params.messageId as string), req.user!.userId, emoji]);
    const count = await query('SELECT emoji, COUNT(*) as cnt FROM discord_reactions WHERE message_id = $1 GROUP BY emoji', [(req.params.messageId as string)]);
    res.json({ reactions: count.rows });
  } catch (err: any) { console.error('Reaction error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Remove reaction
discordRouter.delete('/messages/:messageId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { emoji } = req.body;
    await query('DELETE FROM discord_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [(req.params.messageId as string), req.user!.userId, emoji]);
    const count = await query('SELECT emoji, COUNT(*) as cnt FROM discord_reactions WHERE message_id = $1 GROUP BY emoji', [(req.params.messageId as string)]);
    res.json({ reactions: count.rows });
  } catch (err: any) { console.error('Remove reaction error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Get reactions
discordRouter.get('/messages/:messageId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT emoji, COUNT(*) as cnt FROM discord_reactions WHERE message_id = $1 GROUP BY emoji', [(req.params.messageId as string)]);
    res.json(result.rows);
  } catch (err: any) { console.error('Get reactions error:', err.message); res.json([]); }
});

// Create category
discordRouter.post('/servers/:serverId/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireMember(req.user!.userId, (req.params.serverId as string))) { res.status(403).json({ error: 'Нет доступа' }); return; }
    const { name } = req.body;
    const id = uuid();
    const max = await query('SELECT COALESCE(MAX(position),0)+1 as n FROM discord_channels WHERE server_id = $1', [(req.params.serverId as string)]);
    await query("INSERT INTO discord_channels (id, server_id, name, type, position) VALUES ($1,$2,$3,'category',$4)", [id, (req.params.serverId as string), name, max.rows[0].n]);
    const result = await query('SELECT * FROM discord_channels WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) { console.error('Category error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Get server roles
discordRouter.get('/servers/:serverId/roles', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM discord_roles WHERE server_id = $1 ORDER BY position', [(req.params.serverId as string)]);
    res.json(result.rows);
  } catch (err: any) { console.error('Roles error:', err.message); res.json([]); }
});

// Create role
discordRouter.post('/servers/:serverId/roles', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireMember(req.user!.userId, (req.params.serverId as string))) { res.status(403).json({ error: 'Нет доступа' }); return; }
    const { name, color = '#8e9297' } = req.body;
    const max = await query('SELECT COALESCE(MAX(position),0)+1 as n FROM discord_roles WHERE server_id = $1', [(req.params.serverId as string)]);
    const id = uuid();
    await query('INSERT INTO discord_roles (id, server_id, name, color, position) VALUES ($1,$2,$3,$4,$5)', [id, (req.params.serverId as string), name, color, max.rows[0].n]);
    const result = await query('SELECT * FROM discord_roles WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) { console.error('Create role error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});

// Delete role
discordRouter.delete('/servers/:serverId/roles/:roleId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!await requireMember(req.user!.userId, (req.params.serverId as string))) { res.status(403).json({ error: 'Нет доступа' }); return; }
    await query('DELETE FROM discord_roles WHERE id = $1 AND server_id = $2', [req.params.roleId, (req.params.serverId as string)]);
    res.json({ success: true });
  } catch (err: any) { console.error('Delete role error:', err.message); res.status(500).json({ error: 'Ошибка' }); }
});
