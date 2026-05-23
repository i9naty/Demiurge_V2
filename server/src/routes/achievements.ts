import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';

export const achievementsRouter = Router();

// Seed built-in achievements (idempotent)
export async function seedAchievements() {
  const builtins = [
    { id: 'first-login', name: 'Первое приключение', description: 'Войти в Demiurge первый раз', icon: '🌟', category: 'beginner', condition_type: 'login_count', condition_value: 1 },
    { id: 'first-post', name: 'Глас народа', description: 'Опубликовать первый пост', icon: '📝', category: 'social', condition_type: 'post_count', condition_value: 1 },
    { id: 'first-comment', name: 'Слово за слово', description: 'Оставить первый комментарий', icon: '💬', category: 'social', condition_type: 'comment_count', condition_value: 1 },
    { id: 'first-room', name: 'Строитель миров', description: 'Создать первую комнату', icon: '🏗️', category: 'world', condition_type: 'room_count', condition_value: 1 },
    { id: 'first-story', name: 'Сказитель', description: 'Начать первую живую историю', icon: '📖', category: 'story', condition_type: 'story_count', condition_value: 1 },
    { id: 'first-game', name: 'Игрок', description: 'Сыграть в первую игру', icon: '🎮', category: 'story', condition_type: 'game_count', condition_value: 1 },
    { id: 'ten-logins', name: 'Завсегдатай', description: 'Зайти 10 раз', icon: '🏠', category: 'beginner', condition_type: 'login_count', condition_value: 10 },
    { id: 'five-posts', name: 'Блогер', description: 'Опубликовать 5 постов', icon: '📰', category: 'social', condition_type: 'post_count', condition_value: 5 },
    { id: 'five-rooms', name: 'Архитектор', description: 'Создать 5 комнат', icon: '🏰', category: 'world', condition_type: 'room_count', condition_value: 5 },
    { id: 'dm-first', name: 'Шёпот', description: 'Отправить первое личное сообщение', icon: '✉️', category: 'social', condition_type: 'dm_sent_count', condition_value: 1 },
    { id: 'follow-first', name: 'Последователь', description: 'Подписаться на первого автора', icon: '👥', category: 'social', condition_type: 'follow_count', condition_value: 1 },
    { id: 'first-lobby', name: 'Гостеприимный', description: 'Создать первое лобби', icon: '🚪', category: 'story', condition_type: 'lobby_count', condition_value: 1 },
  ];

  for (const a of builtins) {
    try {
      await query(
        `INSERT INTO achievements (id, name, description, icon, category, condition_type, condition_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=$2, description=$3, icon=$4`,
        [a.id, a.name, a.description, a.icon, a.category, a.condition_type, a.condition_value]
      );
        } catch (err) {
          console.error('Insert user achievement error:', err instanceof Error ? err.message : err);
        }
  }
}

// Get achievements with earned status
achievementsRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    await seedAchievements();

    const result = await query(
      `SELECT a.*, ua.earned_at IS NOT NULL as earned, ua.earned_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       ORDER BY ua.earned_at DESC NULLS LAST, a.category`,
      [req.user!.userId]
    );

    const stats = await query('SELECT * FROM player_stats WHERE user_id = $1', [req.user!.userId]);
    res.json({ achievements: result.rows, stats: stats.rows[0] || {} });
  } catch (err: any) {
    console.error('Achievements error:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Ошибка загрузки достижений' } });
  }
});

// Check and award achievements based on player stats
export async function checkAchievements(userId: string) {
  try {
    await seedAchievements();

    const stats = await query('SELECT * FROM player_stats WHERE user_id = $1', [userId]);
    if (stats.rows.length === 0) return [];

    const s = stats.rows[0];
    const statsMap: Record<string, number> = {
      login_count: s.login_count || 0,
      post_count: s.post_count || 0,
      comment_count: s.comment_count || 0,
      room_count: s.room_count || 0,
      story_count: s.story_count || 0,
      game_count: s.games_started || 0,
      dm_sent_count: s.dms_sent || 0,
      follow_count: s.follows_count || 0,
      lobby_count: s.lobbies_created || 0,
      total_play_minutes: s.total_play_minutes || 0,
    };

    const achievements = await query('SELECT * FROM achievements');
    const earned = await query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]);
    const earnedIds = new Set(earned.rows.map((r: any) => r.achievement_id));

    const newlyEarned: string[] = [];

    for (const a of achievements.rows) {
      if (earnedIds.has(a.id)) continue;
      const current = statsMap[a.condition_type] || 0;
      if (current >= a.condition_value) {
        try {
          await query(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, a.id]
          );
          newlyEarned.push(a.name);
    } catch (err) {
      console.error('Seed achievement error:', err instanceof Error ? err.message : err);
    }
      }
    }

    return newlyEarned;
  } catch {
    return [];
  }
}

// Increment stat and check achievements
export async function incrementStat(userId: string, stat: string, amount = 1): Promise<string[]> {
  try {
    const cols: Record<string, string> = {
      login_count: 'login_count',
      post_count: 'post_count',
      comment_count: 'comment_count',
      room_count: 'room_count',
      story_count: 'story_count',
      game_count: 'games_started',
      dm_sent_count: 'dms_sent',
      follow_count: 'follows_count',
      lobby_count: 'lobbies_created',
    };

    const col = cols[stat];
    if (!col) return [];

    await query(
      `INSERT INTO player_stats (user_id, ${col}) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET ${col} = player_stats.${col} + $2`,
      [userId, amount]
    );

    return await checkAchievements(userId);
  } catch {
    return [];
  }
}
