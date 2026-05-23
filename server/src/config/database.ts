import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { env } from './env';

const isDev = env.NODE_ENV === 'development';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
  console.error('🐘 PostgreSQL pool error:', err.message);
});

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    console.log('🐘 PostgreSQL подключена');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    if (isDev) {
      console.warn('⚠️ PostgreSQL недоступна — работаем без БД');
      return false;
    }
    console.error('❌ PostgreSQL недоступна:', message);
    process.exit(1);
  }
}

export async function runMigrations(): Promise<void> {
  try {
    const schemaPath = path.resolve(__dirname, '../db/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.warn('⚠️ schema.sql не найден, пропускаем миграции');
      return;
    }

    const sql = fs.readFileSync(schemaPath, 'utf-8');

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await query(stmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        if (!message.includes('already exists') && !message.includes('duplicate')) {
          console.warn('⚠️ Миграция:', message.slice(0, 80));
        }
      }
    }

    console.log('📦 Миграции выполнены');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.warn('⚠️ Ошибка миграций:', message.slice(0, 100));
  }
}

export async function disconnect(): Promise<void> {
  await pool.end();
}
