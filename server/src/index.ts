import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { testConnection, runMigrations } from './config/database';
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
import { setupSocket } from './socket';

const isDev = env.NODE_ENV === 'development';
const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isDev ? '*' : env.CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов, попробуйте позже' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток, попробуйте позже' },
});

app.use(morgan('dev'));
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

// Здоровье сервера
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API для ассетов
app.get('/api/assets', (_req, res) => {
  res.json(getAssetIndex());
});

// SPA fallback — всё что не API, отдаём index.html
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(clientDist, 'index.html'));
});

// Сокеты
setupSocket(io);

// Старт
async function start() {
  await testConnection();
  await runMigrations();
  await seedAchievements();
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

start().catch(console.error);

export { io };
