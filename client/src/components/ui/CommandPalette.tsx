import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Home, MessageCircle, Swords, Scroll, Users, Globe, Sparkles, Volume2, Zap } from 'lucide-react';

interface Command {
  id: string; label: string; desc: string; icon: any; action: () => void; category: string;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const allCommands: Command[] = [
    { id: 'home', label: 'Главная', desc: 'Домашняя страница', icon: Home, action: () => navigate('/'), category: 'Страницы' },
    { id: 'tavern', label: 'Таверна', desc: 'Сервера и голосовые чаты', icon: Volume2, action: () => navigate('/discord'), category: 'Страницы' },
    { id: 'story', label: 'Живая история', desc: 'Приключение с ИИ-мастером', icon: Scroll, action: () => navigate('/story'), category: 'Страницы' },
    { id: 'finder', label: 'Поиск игр', desc: 'Найти D&D сессию', icon: Swords, action: () => { navigate('/discord'); setTimeout(() => window.dispatchEvent(new CustomEvent('tavern:open_finder')), 100); }, category: 'Страницы' },
    { id: 'social', label: 'Лента', desc: 'Социальная лента', icon: MessageCircle, action: () => navigate('/social'), category: 'Страницы' },
    { id: 'sessions', label: 'Сессии', desc: 'Планирование D&D', icon: Globe, action: () => navigate('/discord'), category: 'Страницы' },
    { id: 'payments', label: 'Pro', desc: 'Подписки и скины', icon: Sparkles, action: () => navigate('/payments'), category: 'Страницы' },
    { id: 'profile', label: 'Профиль', desc: 'Мой профиль', icon: Users, action: () => { const u = (window as any).__demiurge_username; if (u) navigate(`/profile/${u}`); }, category: 'Страницы' },
    { id: 'create_world', label: 'Создать мир', desc: 'Новый живой мир', icon: Globe, action: () => { navigate('/'); setTimeout(() => window.dispatchEvent(new Event('tavern:create_world')), 300); }, category: 'Действия' },
    { id: 'create_server', label: 'Создать сервер', desc: 'Новый сервер в Таверне', icon: Volume2, action: () => { navigate('/discord'); setTimeout(() => window.dispatchEvent(new CustomEvent('tavern:create_server')), 300); }, category: 'Действия' },
    { id: 'create_story', label: 'Новая история', desc: 'Начать приключение', icon: Scroll, action: () => navigate('/story'), category: 'Действия' },
  ];

  const filtered = query
    ? allCommands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase()))
    : allCommands;

  const grouped: Record<string, Command[]> = {};
  filtered.forEach(c => { if (!grouped[c.category]) grouped[c.category] = []; grouped[c.category].push(c); });

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={onClose}>
          <motion.div initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }}
            className="w-full max-w-xl bg-[#0f0f16] border border-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a2e]">
              <Search size={16} className="text-zinc-500" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Поиск команд... (Esc для выхода)"
                className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-zinc-200 placeholder:text-zinc-600" />
              <span className="text-[9px] font-mono text-zinc-600 bg-[#1a1a2e] px-1.5 py-0.5 rounded">Ctrl+K</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2">
              {Object.entries(grouped).map(([cat, cmds]) => (
                <div key={cat} className="mb-2">
                  <p className="text-[9px] font-mono text-zinc-600 uppercase px-3 py-1">{cat}</p>
                  {cmds.map(c => (
                    <button key={c.id} onClick={() => { c.action(); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors text-left group">
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                        <c.icon size={14} className="text-violet-400" />
                      </div>
                      <div>
                        <p className="font-mono text-xs text-zinc-300">{c.label}</p>
                        <p className="font-mono text-[9px] text-zinc-600">{c.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center font-mono text-xs text-zinc-600 py-8">Ничего не найдено</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
