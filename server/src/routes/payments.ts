import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';

export const paymentsRouter = Router();

// Получить доступные подписки
paymentsRouter.get('/plans', (_req: Request, res: Response) => {
  res.json([
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
      res.status(400).json({ error: 'Неверный тариф' });
      return;
    }

    // Интеграция с ЮKassa
    if (env.YUKASSA_SHOP_ID && env.YUKASSA_SECRET_KEY) {
      const prices: Record<string, { amount: number; description: string }> = {
        plus: { amount: 299, description: 'Demiurge Plus' },
        premium: { amount: 799, description: 'Demiurge Premium' },
        legend: { amount: 1999, description: 'Demiurge Legend' },
      };

      const { amount, description } = prices[tier];

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
        res.status(502).json({ error: 'Ошибка платёжного шлюза' });
        return;
      }

      const payment: any = await response.json();

      if (!payment.confirmation?.confirmation_url) {
        res.status(502).json({ error: 'Не удалось получить ссылку на оплату' });
        return;
      }

      res.json({ paymentUrl: payment.confirmation.confirmation_url, paymentId: payment.id });
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

      res.json({ success: true, tier, message: 'Подписка активирована (демо-режим)' });
    }
  } catch (err: any) {
    console.error('Payment error:', err.message);
    res.status(500).json({ error: 'Ошибка создания платежа' });
  }
});

// Получить скины
paymentsRouter.get('/skins', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM skins ORDER BY rarity, price');
    res.json(result.rows);
  } catch {
    // Стартовые скины
    res.json([
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
      res.status(404).json({ error: 'Скин не найден' });
      return;
    }

    await query(
      'INSERT INTO user_skins (user_id, skin_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user!.userId, req.params.skinId]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка покупки скина' });
  }
});
