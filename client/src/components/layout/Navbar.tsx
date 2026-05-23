import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import {
  Menu, X, Home, Users, MessageCircle, Search, Plus,
  Crown, LogOut, User, Sparkles, DoorOpen, Volume2
} from 'lucide-react';

export function Navbar() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/discord', label: 'Таверна', icon: Volume2 },
    { to: '/social', label: 'Лента', icon: MessageCircle },
  ];

  if (user) {
    links.push({ to: `/profile/${user.username}?tab=rooms`, label: 'Комнаты', icon: DoorOpen });
    links.push({ to: '/payments', label: 'Pro', icon: Crown });
  }

  return (
    <nav className="h-14 bg-demiurge-surface/90 backdrop-blur-xl border-b border-demiurge-border flex items-center px-4 z-50 shrink-0">
      {/* Логотип */}
      <Link to="/" className="flex items-center gap-2 mr-8 group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-#a855f7 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Sparkles size={16} className="text-white" />
        </div>
        <span className="font-mono font-bold text-lg text-#a855f7 tracking-wider">
          DEMIURGE
        </span>
      </Link>

      {/* Десктопная навигация */}
      <div className="hidden md:flex items-center gap-1 flex-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all
              ${location.pathname === to
                ? 'bg-#a855f7/20 text-#a855f7'
                : 'text-demiurge-muted hover:text-demiurge-text hover:bg-demiurge-border/30'
              }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
        {/* Create button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open:create_modal'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs bg-gradient-to-r from-purple-600 to-purple-600 text-white hover:from-purple-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/20 ml-2"
        >
          <Plus size={14} />
          Создать
        </button>
      </div>

      {/* Пользователь */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <button
              onClick={() => navigate(`/profile/${user.username}`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-demiurge-border/30 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-#a855f7/30 border border-#a855f7/50 flex items-center justify-center">
                <User size={14} className="text-#a855f7" />
              </div>
              <span className="font-mono text-xs text-demiurge-text hidden sm:block">
                {user.displayName || user.username}
              </span>
              {user.subscriptionTier && user.subscriptionTier !== 'free' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                  {user.subscriptionTier.toUpperCase()}
                </span>
              )}
            </button>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="p-2 rounded-lg hover:bg-red-500/20 text-demiurge-muted hover:text-red-400 transition-all"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary text-xs py-1.5">Войти</Link>
          <Link to="/register" className="btn-primary text-xs py-1.5">Регистрация</Link>
        </div>
      )}

      {/* Ctrl+K hint */}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }))}
        className="hidden md:flex items-center gap-1.5 ml-3 px-2 py-1 rounded-lg bg-[#1a1a2e] border border-[#252540] text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-all"
      >
        <Search size={12} />
        <span className="font-mono text-[10px]">Ctrl+K</span>
      </button>

        {/* Мобильное меню */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-demiurge-border/30 text-demiurge-muted"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {/* Мобильная навигация */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-14 left-0 right-0 bg-[#0a0a12]/95 backdrop-blur-xl border-b border-white/[0.05] p-4 md:hidden z-50"
          >
          <div className="flex flex-col gap-1">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-lg font-mono text-sm text-demiurge-muted hover:text-demiurge-text hover:bg-demiurge-border/30"
              >
                {label}
              </Link>
            ))}
            <button
              onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('open:create_modal')); }}
              className="px-3 py-2 rounded-lg font-mono text-sm bg-gradient-to-r from-purple-600 to-purple-600 text-white text-center"
            >
              ✦ Создать
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </nav>
  );
}
