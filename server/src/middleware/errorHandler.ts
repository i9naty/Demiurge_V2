import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

const isDev = env.NODE_ENV === 'development';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  console.error(`[${requestId}] ${req.method} ${req.path}:`, err.message);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'Внутренняя ошибка сервера',
      ...(isDev && { stack: err.stack }),
      requestId,
    },
  });
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', id);
  next();
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Маршрут не найден' },
  });
}
