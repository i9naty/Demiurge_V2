import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { Crown, Sparkles, Check, Shield, Zap } from 'lucide-react';

export function PaymentsPage() {
  const { user } = useStore();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const plans = [
    {
      id: 'free',
      name: 'Свободный',
      price: '0 ₽',
      color: 'text-demiurge-muted',
      border: 'border-demiurge-border',
      features: ['Базовый VTT', '1 комната мира', 'Чат', 'Гостевой режим'],
    },
    {
      id: 'plus',
      name: 'Плюс',
      price: '299 ₽/мес',
      color: 'text-violet-400',
      border: 'border-purple-500/30',
      features: ['Всё из Free', '3 комнаты мира', 'Расширенная память NPC', 'Доступ к скинам'],
      popular: false,
    },
    {
      id: 'premium',
      name: 'Премиум',
      price: '799 ₽/мес',
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      features: ['Всё из Plus', '10 комнат мира', 'Полная память ИИ', 'Приоритетная очередь', 'Голосовые чаты'],
      popular: true,
    },
    {
      id: 'legend',
      name: 'Легенда',
      price: '1 999 ₽/мес',
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      features: ['Всё из Premium', 'Безлимитные комнаты', 'Эксклюзивные скины', 'Бета-функции', 'Персональный мир'],
    },
  ];

  const handleSubscribe = async (tier: string) => {
    if (tier === 'free') {
      setMessage('ℹ️ Свободный тариф уже активен');
      return;
    }
    setMessage('');
    setLoadingTier(tier);
    try {
      const t = useStore.getState().token;
      if (!t) { setMessage('⚠️ Войдите в аккаунт'); setLoadingTier(null); return; }
      const res = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.paymentUrl) {

        window.location.href = data.paymentUrl;
        setMessage('Перенаправляем на страницу оплаты...');
      } else if (data.success) {
        setMessage(`✅ Тариф ${tier.toUpperCase()} активирован`);
        const cu = useStore.getState().user;
        if (cu) useStore.setState({ user: { ...cu, subscriptionTier: tier } });
      } else {
        setMessage(`❌ ${data.error || 'Ошибка оплаты'}`);
      }
    } catch {
      setMessage('❌ Ошибка соединения');
    }
    setLoadingTier(null);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 mb-4">
              <Crown size={14} className="text-amber-400" />
              <span className="font-mono text-xs text-amber-400">Подписка Demiurge</span>
            </div>
            <h1 className="text-3xl font-mono font-bold text-demiurge-text mb-3">
              Выберите свой уровень
            </h1>
            <p className="font-mono text-sm text-demiurge-muted max-w-md mx-auto">
              Поддержите развитие проекта и получите доступ к расширенным возможностям
            </p>
          </motion.div>
        </div>

        {message && (
          <div className="mb-6 p-3 rounded-lg bg-#a855f7/10 border border-#a855f7/30 text-#a855f7 font-mono text-xs text-center">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`card p-6 relative ${
                plan.popular ? 'ring-2 ring-purple-500/50 scale-105' : ''
              } ${plan.border} border`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-mono">
                  Популярный
                </div>
              )}

              <div className="text-center">
                <h3 className={`font-mono font-bold text-sm ${plan.color}`}>{plan.name}</h3>
                <p className="font-mono text-2xl font-bold text-demiurge-text mt-3">{plan.price}</p>
              </div>

              <ul className="mt-5 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span className="font-mono text-xs text-demiurge-muted">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingTier === plan.id || plan.id === 'free'}
                className={`w-full mt-6 py-2.5 rounded-lg font-mono text-xs font-bold transition-all ${
                  plan.id === 'free'
                    ? 'bg-demiurge-border/30 text-demiurge-muted cursor-default'
                    : plan.popular
                    ? 'bg-gradient-to-r from-purple-600 to-purple-600 text-white hover:opacity-90'
                    : 'bg-#a855f7/20 text-#a855f7 hover:bg-#a855f7/30'
                } disabled:opacity-50`}
              >
                {loadingTier === plan.id
                  ? 'Обработка...'
                  : plan.id === 'free'
                  ? user?.subscriptionTier === 'free'
                    ? 'Текущий'
                    : 'Бесплатно'
                  : 'Выбрать'}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Преимущества */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5 text-center">
            <Zap size={24} className="text-#a855f7 mx-auto mb-3" />
            <h3 className="font-mono text-sm text-demiurge-text mb-2">Быстрее всех</h3>
            <p className="font-mono text-xs text-demiurge-muted">
              Приоритетная обработка на серверах
            </p>
          </div>
          <div className="card p-5 text-center">
            <Shield size={24} className="text-#a855f7 mx-auto mb-3" />
            <h3 className="font-mono text-sm text-demiurge-text mb-2">Без рекламы</h3>
            <p className="font-mono text-xs text-demiurge-muted">
              Никакой рекламы в платных тарифах
            </p>
          </div>
          <div className="card p-5 text-center">
            <Sparkles size={24} className="text-#a855f7 mx-auto mb-3" />
            <h3 className="font-mono text-sm text-demiurge-text mb-2">Эксклюзивный контент</h3>
            <p className="font-mono text-xs text-demiurge-muted">
              Скины, эффекты и особые возможности
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
