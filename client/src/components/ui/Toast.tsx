import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react';

interface ToastData {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info' | 'achievement';
  duration?: number;
}

let toastListeners: ((t: ToastData) => void)[] = [];
export function showToast(title: string, message?: string, type: ToastData['type'] = 'info', duration = 4000) {
  const id = Math.random().toString(36).slice(2);
  const t: ToastData = { id, title, message, type, duration };
  toastListeners.forEach(fn => fn(t));
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  useEffect(() => {
    const handler = (t: ToastData) => {
      setToasts(prev => [...prev, t]);
      if (t.duration) setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), t.duration);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter(h => h !== handler); };
  }, []);
  const remove = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, remove };
}

const icons = { success: CheckCircle, error: AlertCircle, info: Info, achievement: Zap };
const colors = { success: 'border-emerald-500/30 bg-emerald-500/10', error: 'border-red-500/30 bg-red-500/10', info: 'border-purple-500/30 bg-purple-500/10', achievement: 'border-amber-500/30 bg-amber-500/10' };
const iconColors = { success: 'text-emerald-400', error: 'text-red-400', info: 'text-violet-400', achievement: 'text-amber-400' };

export function ToastContainer() {
  const { toasts, remove } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <motion.div key={t.id} initial={{ opacity: 0, x: 300, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 300, scale: 0.95 }}
              className={`pointer-events-auto ${colors[t.type]} border backdrop-blur-xl rounded-2xl p-3 pr-10 min-w-[300px] max-w-[420px] relative shadow-2xl cursor-pointer`}
              onClick={() => remove(t.id)}>
              <button onClick={e => { e.stopPropagation(); remove(t.id); }} className="absolute top-2 right-2 p-0.5 rounded text-zinc-500 hover:text-zinc-300"><X size={12} /></button>
              <div className="flex items-start gap-3">
                <Icon size={18} className={`${iconColors[t.type]} shrink-0 mt-0.5`} />
                <div>
                  <p className="font-mono text-xs font-bold text-zinc-200">{t.title}</p>
                  {t.message && <p className="font-mono text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{t.message}</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
