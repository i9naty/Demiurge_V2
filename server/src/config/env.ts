import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function requireEnv(key: string, defaultValue?: string): string {
  const val = process.env[key] || defaultValue;
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
}

const portRaw = parseInt(process.env.PORT || '3001', 10);
const isDev = process.env.NODE_ENV !== 'production';
const devSecret = randomBytes(32).toString('hex');

export const env = {
  PORT: isNaN(portRaw) ? 3001 : portRaw,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: isDev
    ? (process.env.JWT_SECRET || devSecret)
    : requireEnv('JWT_SECRET'),
  SESSION_SECRET: isDev
    ? (process.env.SESSION_SECRET || randomBytes(32).toString('hex'))
    : requireEnv('SESSION_SECRET'),
  DATABASE_URL: requireEnv('DATABASE_URL', 'postgresql://demiurge:demiurge_pass@localhost:5432/demiurge'),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  ROUTERAI_API_KEY: process.env.ROUTERAI_API_KEY || '',
  ROUTERAI_BASE_URL: process.env.ROUTERAI_BASE_URL || 'https://api.routerai.com/v1',
  YUKASSA_SHOP_ID: process.env.YUKASSA_SHOP_ID || '',
  YUKASSA_SECRET_KEY: process.env.YUKASSA_SECRET_KEY || '',
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'],
};
