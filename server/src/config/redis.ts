import Redis from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => console.log('🔴 Redis подключён'));
    redis.on('error', (err: Error) => console.error('🔴 Redis error:', err.message));

    redis.connect().catch((err: Error) => {
      console.warn('⚠️ Redis недоступен:', err.message);
      redis = null;
    });

    return redis;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.warn('⚠️ Redis недоступен — работаем без кэша:', message);
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const val = await r.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('cacheGet error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('cacheSet error:', err instanceof Error ? err.message : err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch (err) {
    console.error('cacheDel error:', err instanceof Error ? err.message : err);
  }
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await r.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('cacheInvalidate error:', err instanceof Error ? err.message : err);
  }
}

export async function redisDisconnect(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
  }
}
