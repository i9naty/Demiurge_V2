import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

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

    redis.on('connect', () => logger.info('Redis подключён'));
    redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));

    redis.connect().catch((err: Error) => {
      logger.warn({ err }, 'Redis недоступен');
      redis = null;
    });

    return redis;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    logger.warn({ err: message }, 'Redis недоступен — работаем без кэша');
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
    logger.error({ err }, 'cacheGet error');
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.error({ err }, 'cacheSet error');
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch (err) {
    logger.error({ err }, 'cacheDel error');
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
    logger.error({ err }, 'cacheInvalidate error');
  }
}

export async function redisDisconnect(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
  }
}
