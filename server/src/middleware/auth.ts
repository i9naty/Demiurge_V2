import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { authPayloadSchema } from '../validators';

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
  isGuest?: boolean;
}

export interface RefreshPayload {
  userId: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function verifyAndParse(token: string, secret: string): AuthPayload {
  const raw = jwt.verify(token, secret);
  const parsed = authPayloadSchema.parse(raw);
  return parsed;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Требуется авторизация' } });
    return;
  }

  const token = header.slice(7);

  try {
    req.user = verifyAndParse(token, env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Недействительный токен' } });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      req.user = verifyAndParse(token, env.JWT_SECRET);
    } catch {
      // гость — без авторизации
    }
  }

  next();
}

export function generateToken(payload: AuthPayload): string {
  const { isGuest, ...cleanPayload } = payload;
  const secret = isGuest ? env.JWT_GUEST_SECRET : env.JWT_SECRET;
  return jwt.sign(cleanPayload, secret, { expiresIn: '1h' });
}

export function generateRefreshToken(payload: AuthPayload): string {
  const { userId, username } = payload;
  return jwt.sign({ userId, username }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const raw = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid token payload');
  }
  const payload = raw as Record<string, unknown>;
  if (typeof payload.userId !== 'string' || typeof payload.username !== 'string') {
    throw new Error('Invalid token structure');
  }
  return { userId: payload.userId, username: payload.username };
}
