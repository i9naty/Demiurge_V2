import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { ToastContainer } from '../components/ui/Toast';
import { CommandPalette, useCommandPalette } from '../components/ui/CommandPalette';
import {
  Sparkles, Swords, Globe, Users, Scroll, Zap, Star,
  TrendingUp, MessageCircle, ArrowRight, Play, Plus,
  Gamepad2, Eye, Loader2, Clock, Map, Shield,
} from 'lucide-react';

const features = [
  { icon: Swords, title: 'D&D Стол', desc: 'Виртуальный стол с картой, токенами, туманом войны и кубиками', color: '#f59e0b', action: () => window.dispatchEvent(new CustomEvent('open:create_modal')) },
  { icon: Scroll, title: 'Живая История', desc: 'Приключение с нейросетевым Дедушкой-рассказчиком', color: '#a855f7', path: '/story' },
  { icon: Globe, title: 'Живой Мир', desc: 'Процедурная генерация миров с ИИ-богом', color: '#a855f7', action: () => window.dispatchEvent(new CustomEvent('open:create_modal')) },
  { icon: MessageCircle, title: 'Сообщество', desc: 'Сервера, чаты, голосовые каналы, друзья', color: '#10b981', path: '/discord' },
  { icon: Users, title: 'Соцсеть', desc: 'Лента, профили, подписки, достижения', color: '#ec4899', path: '/social' },
  { icon: TrendingUp, title: 'Сессии', desc: 'Планирование D&D-сессий, поиск игроков', color: '#06b6d4', path: '/sessions' },
];

interface PublicGame {
  id: string; lobby_code: string; owner_name: string;
  settings: any; status: string; player_count: number;
  updated_at: string;
}

export function HomePage() {
  const { user, token } = useStore();
  const navigate = useNavigate();
  const { open, setOpen } = useCommandPalette();
  const [greeting, setGreeting] = useState('');
  const [publicGames, setPublicGames] = useState<PublicGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер');
  }, []);

  useEffect(() => {
    setLoadingGames(true);
    fetch('/api/game/public')
      .then(r => r.json())
      .then((data: PublicGame[]) => setPublicGames(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingGames(false));
  }, []);

  const cardClass = "bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:border-white/[0.08] transition-all duration-300";

  return (
    <div className="h-full overflow-y-auto bg-[#06060c]">
      <ToastContainer />
      <CommandPalette open={open} onClose={() => setOpen(false)} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="text-center mb-14 pt-4">
          {/* Icon */}
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block mb-6">
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-700 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <Sparkles size={36} className="text-white" />
              {/* Orbiting ring */}
              <div className="absolute inset-0 rounded-2xl border border-purple-400/20 animate-pulse" />
            </div>
          </motion.div>

          <h1 className="font-mono text-5xl md:text-6xl font-bold mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-purple-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Demiurge
            </span>
          </h1>

          <p className="font-sans text-zinc-400 text-lg mb-2 max-w-xl mx-auto leading-relaxed">
            Виртуальный стол, живой мир и социальная платформа для настольных ролевых игр
          </p>

          <p className="font-mono text-[11px] text-zinc-600 mt-3">Ctrl+K — командная палитра</p>

          {user ? (
            <div className="mt-8 space-y-3">
              <p className="font-mono text-sm text-zinc-400">
                {greeting}, <span className="text-purple-400 font-bold">{user.displayName || user.username}</span>
              </p>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => window.dispatchEvent(new CustomEvent('open:create_modal'))}
                  className="px-6 py-3 rounded-xl font-mono text-sm font-bold bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2">
                  <Plus size={16} /> Создать
                </button>
                <Link to="/story"
                  className="px-6 py-3 rounded-xl font-mono text-sm font-bold border border-purple-500/20 text-purple-300 hover:bg-purple-500/[0.06] transition-all flex items-center gap-2">
                  <Play size={16} /> Играть
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Link to="/login"
                className="px-8 py-3.5 rounded-xl font-mono text-sm font-bold bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/25">
                Войти
              </Link>
              <Link to="/register"
                className="px-8 py-3.5 rounded-xl font-mono text-sm font-bold border border-white/[0.08] text-zinc-300 hover:bg-white/[0.03] transition-all">
                Регистрация
              </Link>
            </div>
          )}
        </motion.div>

        {/* Active Games - NEW */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono text-lg font-bold text-zinc-200 flex items-center gap-2">
                <Gamepad2 size={18} className="text-emerald-400" />
                Активные игры
              </h2>
              <Link to="/story" className="font-mono text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                Создать игру <ArrowRight size={10} />
              </Link>
            </div>

            {loadingGames ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-zinc-600" />
              </div>
            ) : publicGames.length === 0 ? (
              <div className={`${cardClass} p-8 text-center`}>
                <Eye size={24} className="text-zinc-600 mx-auto mb-2" />
                <p className="font-mono text-xs text-zinc-500">Нет активных публичных игр</p>
                <p className="font-mono text-[9px] text-zinc-600 mt-1">Создайте свою и станьте первым!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {publicGames.map((g, i) => (
                  <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                    className={`${cardClass} p-4 group`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/[0.1] flex items-center justify-center">
                          <Scroll size={12} className="text-purple-400" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-zinc-200">
                            {(g.settings?.genre || 'Фэнтези') === 'fantasy' ? 'Фэнтези' : g.settings?.genre || 'Фэнтези'}
                          </p>
                          <p className="font-mono text-[8px] text-zinc-500">
                            {g.settings?.setting === 'forest' ? '🌲 Древний лес' :
                             g.settings?.setting === 'dungeon' ? '💀 Подземелье' :
                             g.settings?.setting === 'castle' ? '🏰 Замок' :
                             g.settings?.setting === 'mountains' ? '⛰️ Горы' : g.settings?.setting || 'Лес'}
                          </p>
                        </div>
                      </div>
                      <div className={`text-[8px] font-mono px-2 py-0.5 rounded-lg ${
                        g.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {g.status === 'active' ? 'Игра идёт' : 'Лобби'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-mono mt-2">
                      <span className="flex items-center gap-1"><Users size={9} /> {g.player_count || 1}</span>
                      <span className="flex items-center gap-1"><Map size={9} /> {g.settings?.difficulty === 'easy' ? 'Лёгкая' : g.settings?.difficulty === 'hard' ? 'Опасность' : 'Нормальная'}</span>
                      {g.settings?.nsfw && <span className="text-red-400 text-[8px]">🔞 NSFW</span>}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
                      <p className="font-mono text-[8px] text-zinc-600">Автор: {g.owner_name}</p>
                      {g.status === 'active' ? (
                        <button onClick={() => navigate(`/story/${g.id}`)}
                          className="font-mono text-[9px] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.1] transition-all flex items-center gap-1 group-hover:border-purple-500/20">
                          <Eye size={10} /> Смотреть
                        </button>
                      ) : (
                        <button onClick={() => navigate(`/story?join=${g.lobby_code}`)}
                          className="font-mono text-[9px] px-3 py-1.5 rounded-lg bg-purple-500/[0.08] border border-purple-500/20 text-purple-400 hover:bg-purple-500/[0.15] transition-all flex items-center gap-1">
                          <Play size={10} /> Играть
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Features */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mb-14">
          <h2 className="font-mono text-xl font-bold text-zinc-200 text-center mb-8 flex items-center justify-center gap-2">
            <Zap size={18} className="text-amber-400" />
            Возможности
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.06 }}>
                {f.path ? (
                  <Link to={f.path} className={`block ${cardClass} p-6 h-full group`}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                      style={{ backgroundColor: f.color + '12', border: `1px solid ${f.color}20` }}>
                      <f.icon size={20} style={{ color: f.color }} />
                    </div>
                    <h3 className="font-mono font-bold text-zinc-200 mb-2 text-sm flex items-center gap-2">
                      {f.title}
                      <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-zinc-500" />
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-500 leading-relaxed">{f.desc}</p>
                  </Link>
                ) : (
                  <button onClick={f.action} className={`block w-full text-left ${cardClass} p-6 h-full group`}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                      style={{ backgroundColor: f.color + '12', border: `1px solid ${f.color}20` }}>
                      <f.icon size={20} style={{ color: f.color }} />
                    </div>
                    <h3 className="font-mono font-bold text-zinc-200 mb-2 text-sm flex items-center gap-2">
                      {f.title}
                      <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-zinc-500" />
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-500 leading-relaxed">{f.desc}</p>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA for logged out */}
        {!user && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
            className="text-center bg-gradient-to-r from-purple-600/[0.06] via-violet-600/[0.06] to-fuchsia-600/[0.06] border border-purple-500/[0.08] rounded-3xl p-12 mb-8">
            <Star size={32} className="text-amber-400 mx-auto mb-4" />
            <h2 className="font-mono text-2xl font-bold text-zinc-100 mb-3">Готовы к приключениям?</h2>
            <p className="font-sans text-sm text-zinc-400 mb-6 max-w-md mx-auto leading-relaxed">
              Присоединяйтесь к Demiurge и откройте бесконечные миры, созданные нейросетью. Играйте с друзьями, создавайте истории.
            </p>
            <Link to="/register"
              className="inline-flex items-center gap-2 px-10 py-3.5 rounded-xl font-mono text-sm font-bold bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-500/25 transition-all">
              <Sparkles size={16} /> Начать бесплатно
            </Link>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center pb-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent mb-6" />
          <p className="font-mono text-[10px] text-zinc-700">
            Ctrl+K — палитра команд · Сделано с любовью к RPG
          </p>
        </div>
      </div>
    </div>
  );
}
