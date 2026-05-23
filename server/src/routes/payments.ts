import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { ok, fail } from '../middleware/response';
import { env } from '../config/env';

export const paymentsRouter = Router();

// Получить доступные подписки
paymentsRouter.get('/plans', (_req: Request, res: Response) => {
  ok(res, [
    {
      id: 'free',
      name: 'Свободный',
      price: 0,
      features: ['Базовый VTT', '1 комната мира', 'Чат', 'Гостевой режим'],
    },
    {
      id: 'plus',
      name: 'Плюс',
      price: 299,
      features: ['Всё из Free', '3 комнаты мира', 'Расширенная память NPC', 'Скины'],
    },
    {
      id: 'premium',
      name: 'Премиум',
      price: 799,
      features: ['Всё из Plus', '10 комнат мира', 'Полная память ИИ', 'Приоритетная очередь', 'Голосовые чаты'],
    },
    {
      id: 'legend',
      name: 'Легенда',
      price: 1999,
      features: ['Всё из Premium', 'Безлимитные комнаты', 'Эксклюзивные скины', 'Доступ к бета-функциям', 'Персональный мир'],
    },
  ]);
});

// Создать платёж (ЮKassa)
paymentsRouter.post('/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tier } = req.body;

    if (!tier || !['plus', 'premium', 'legend'].includes(tier)) {
      fail(res, 'INVALID_INPUT', 'Неверный тариф', 400);
      return;
    }

    // Интеграция с ЮKassa
    if (env.YUKASSA_SHOP_ID && env.YUKASSA_SECRET_KEY) {
      const prices: Record<string, { amount: number; description: string }> = {
        plus: { amount: 299, description: 'Demiurge Plus' },
        premium: { amount: 799, description: 'Demiurge Premium' },
        legend: { amount: 1999, description: 'Demiurge Legend' },
      };

      const { amount, description } = prices[tier] ?? { amount: 0, description: 'Unknown' };

      const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${env.YUKASSA_SHOP_ID}:${env.YUKASSA_SECRET_KEY}`).toString('base64')}`,
          'Idempotence-Key': `${req.user!.userId}-${Date.now()}`,
        },
        body: JSON.stringify({
          amount: { value: `${amount}.00`, currency: 'RUB' },
          capture: true,
          confirmation: { type: 'redirect', return_url: `${req.headers.origin || 'http://localhost:5173'}/payment/success` },
          description,
          metadata: { userId: req.user!.userId, tier },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('YooKassa API error:', response.status, errText);
        fail(res, 'SERVER_ERROR', 'Ошибка платёжного шлюза', 502);
        return;
      }

      const payment: any = await response.json();

      if (!payment.confirmation?.confirmation_url) {
        fail(res, 'SERVER_ERROR', 'Не удалось получить ссылку на оплату', 502);
        return;
      }

      ok(res, { paymentUrl: payment.confirmation.confirmation_url, paymentId: payment.id });
    } else {
      // Демо-режим — сразу активируем подписку
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await query(
        `INSERT INTO subscriptions (user_id, tier, amount, status, expires_at)
         VALUES ($1, $2, 0, 'active', $3)`,
        [req.user!.userId, tier, expiresAt]
      );

      await query(
        'UPDATE users SET subscription_tier = $1, subscription_expires_at = $2 WHERE id = $3',
        [tier, expiresAt, req.user!.userId]
      );

      ok(res, { tier, message: 'Подписка активирована (демо-режим)' });
    }
  } catch (err: any) {
    console.error('Payment error:', err.message);
    fail(res, 'SERVER_ERROR', 'Ошибка создания платежа', 500);
  }
});

// Получить скины
paymentsRouter.get('/skins', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM skins ORDER BY rarity, price');
    ok(res, result.rows);
  } catch {
    // Стартовые скины
    ok(res, [
      { id: 'skin-neon', name: 'Неоновый', type: 'ui_theme', price: 99, rarity: 'common' },
      { id: 'skin-shadow', name: 'Теневой', type: 'ui_theme', price: 199, rarity: 'rare' },
      { id: 'skin-dragon', name: 'Драконий', type: 'character', price: 499, rarity: 'epic' },
      { id: 'skin-cosmic', name: 'Космический', type: 'ui_theme', price: 999, rarity: 'legendary' },
    ]);
  }
});

// Купить скин
paymentsRouter.post('/skins/:skinId/buy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const skin = await query('SELECT * FROM skins WHERE id = $1', [req.params.skinId]);
    if (skin.rows.length === 0) {
      fail(res, 'NOT_FOUND', 'Скин не найден', 404);
      return;
    }

    await query(
      'INSERT INTO user_skins (user_id, skin_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user!.userId, req.params.skinId]
    );

    ok(res, {});
  } catch (err: any) {
    fail(res, 'SERVER_ERROR', 'Ошибка покупки скина', 500);
  }
});
