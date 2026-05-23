import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { testConnection, runMigrations, disconnect as dbDisconnect, pool } from './config/database';
import { getRedis, redisDisconnect } from './config/redis';
import { scanAssets, getAssetIndex } from './services/assetScanner';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { worldRouter } from './routes/world';
import { socialRouter } from './routes/social';
import { dmRouter } from './routes/dm';
import { paymentsRouter } from './routes/payments';
import { achievementsRouter, seedAchievements } from './routes/achievements';
import { followsRouter } from './routes/follows';
import { sessionsRouter } from './routes/sessions';
import { discordRouter } from './routes/discord';
import { storyRouter } from './routes/story';
import { gameRouter } from './routes/game';
import { compendiumRouter, seedCompendium } from './routes/compendium';
import { characterRouter } from './routes/characters';
import { setupSocket } from './socket';
import { errorHandler, requestIdMiddleware, notFoundHandler } from './middleware/errorHandler';

const isDev = env.NODE_ENV === 'development';
const app = express();
const httpServer = createServer(app);

const SHUTDOWN_TIMEOUT = 30_000;

// Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isDev ? '*' : env.CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      mediaSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: isDev ? true : env.CORS_ORIGINS, credentials: true }));

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: isDev ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Слишком много запросов, попробуйте позже' } },
});

const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: isDev ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Слишком много попыток, попробуйте позже' } },
});

app.use(morgan(isDev ? 'dev' : 'combined'));
app.use(requestIdMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Статика для аватаров и карт
app.use('/uploads', express.static('uploads'));

// В dev: раздача production-сборки клиента
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist, { maxAge: '1h' }));

// Роуты API
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/rooms', apiLimiter, roomsRouter);
app.use('/api/world', apiLimiter, worldRouter);
app.use('/api/social', apiLimiter, socialRouter);
app.use('/api/dm', apiLimiter, dmRouter);
app.use('/api/payments', apiLimiter, paymentsRouter);
app.use('/api/achievements', apiLimiter, achievementsRouter);
app.use('/api/follows', apiLimiter, followsRouter);
app.use('/api/sessions', apiLimiter, sessionsRouter);
app.use('/api/discord', apiLimiter, discordRouter);
app.use('/api/story', apiLimiter, storyRouter);
app.use('/api/game', apiLimiter, gameRouter);
app.use('/api/compendium', apiLimiter, compendiumRouter);
app.use('/api/characters', apiLimiter, characterRouter);

// Здоровье сервера
app.get('/api/health', async (_req, res) => {
  const status: Record<string, string> = { server: 'ok' };

  try {
    const r = getRedis();
    if (r) {
      await r.ping();
      status.redis = 'ok';
    } else {
      status.redis = 'not_connected';
    }
  } catch {
    status.redis = 'error';
  }

  try {
    await pool.query('SELECT 1');
    status.database = 'ok';
  } catch {
    status.database = 'error';
  }

  const allOk = Object.values(status).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    components: status,
    timestamp: new Date().toISOString(),
  });
});

// API для ассетов
app.get('/api/assets', (_req, res) => {
  res.json(getAssetIndex());
});

// 404 для несуществующих API маршрутов
app.use('/api/*', notFoundHandler);

// SPA fallback — всё что не API, отдаём index.html
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(clientDist, 'index.html'));
});

// Глобальный обработчик ошибок
app.use(errorHandler);

// Сокеты
setupSocket(io);

// Graceful shutdown
function setupShutdown() {
  const cleanup = async (signal: string) => {
    console.log(`\n🛑 Получен сигнал ${signal}, начинаем graceful shutdown...`);

    let forceExit = setTimeout(() => {
      console.error('❌ Принудительное завершение по таймауту');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
    forceExit.unref();

    try {
      // 1. Закрываем HTTP сервер (перестаём принимать новые запросы)
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });

      // 2. Закрываем WebSocket соединения
      await io.close();

      // 3. Отключаем БД
      await dbDisconnect();

      // 4. Отключаем Redis
      await redisDisconnect();

      clearTimeout(forceExit);
      console.log('✅ Graceful shutdown завершён');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExit);
      console.error('❌ Ошибка при shutdown:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => cleanup('SIGTERM'));
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGQUIT', () => cleanup('SIGQUIT'));

  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught exception:', err);
    cleanup('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled rejection:', reason);
  });
}

// Старт
async function start() {
  setupShutdown();

  await testConnection();
  await runMigrations();
  await seedAchievements();
  await seedCompendium();
  scanAssets(path.resolve(__dirname, '../../client/public/assets'));

  httpServer.listen(env.PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║        🔮 DEMIURGE PLATFORM             ║
║        Портал в бесконечные миры        ║
╠══════════════════════════════════════════╣
║  Режим: ${env.NODE_ENV.padEnd(32)}║
║  Порт:  ${String(env.PORT).padEnd(32)}║
║  API:   http://localhost:${env.PORT}/api       ║
╚══════════════════════════════════════════╝
    `);
  });
}

start();
