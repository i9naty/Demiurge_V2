import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import {
  Swords, Globe, Scroll, Sparkles, X, Loader2, Users, Map, MessageCircle,
} from 'lucide-react';

const MODES = [
  {
    id: 'vtt',
    title: 'D&D Стол',
    icon: Swords,
    desc: 'Виртуальный стол с картой, токенами, туманом войны, кубиками и чатом',
    color: '#f59e0b',
    gradient: 'from-amber-600 to-orange-600',
    createLabel: 'Создать комнату',
    createDesc: 'Придумайте название',
  },
  {
    id: 'world',
    title: 'Живой Мир',
    icon: Globe,
    desc: 'Открытый мир с ИИ-богом, экономикой, NPC, фракциями и строительством',
    color: '#a855f7',
    gradient: 'from-purple-600 to-cyan-600',
    createLabel: 'Создать мир',
    createDesc: 'Название вашего мира',
  },
  {
    id: 'story',
    title: 'Живая История',
    icon: Scroll,
    desc: 'Приключение с ИИ-мастером на 2-4 часа. Выберите жанр и начните играть',
    color: '#8b5cf6',
    gradient: 'from-purple-600 to-pink-600',
    createLabel: 'Создать историю',
    createDesc: '',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateModal({ open, onClose }: Props) {
  const { token } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'create'>('select');
  const [mode, setMode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const hdrs = { Authorization: `Bearer ${token || ''}` };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Введите название'); return; }
    if (!token) { navigate('/login'); onClose(); return; }
    setCreating(true); setError('');

    try {
      if (mode === 'vtt') {
        const r = await fetch('/api/rooms', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...hdrs },
          body: JSON.stringify({ name: name.trim(), mode: 'vtt', isPublic: false }),
        });
        if (r.ok) { const data = await r.json(); onClose(); navigate(`/room/${data.id}`); }
        else { const e = await r.json(); setError(e.error || 'Ошибка'); }
      } else if (mode === 'world') {
        const r = await fetch('/api/rooms', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...hdrs },
          body: JSON.stringify({ name: name.trim(), mode: 'world', isPublic: true }),
        });
        if (r.ok) { const data = await r.json(); onClose(); navigate(`/world/${data.id}`); }
        else { const e = await r.json(); setError(e.error || 'Ошибка'); }
      } else if (mode === 'story') {
        onClose();
        navigate('/story');
      }
    } catch { setError('Ошибка соединения'); }
    setCreating(false);
  };

  const selectedMode = MODES.find(m => m.id === mode);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={() => { onClose(); setStep('select'); setMode(''); setName(''); }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            className="bg-[#0f0f16] border border-[#1a1a2e] rounded-3xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-600 flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-mono text-lg font-bold text-zinc-200">
                    {step === 'select' ? 'Создать' : selectedMode?.title}
                  </h2>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {step === 'select' ? 'Выберите режим игры' : selectedMode?.createDesc}
                  </p>
                </div>
              </div>
              <button onClick={() => { onClose(); setStep('select'); setMode(''); setName(''); }}
                className="p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                {step === 'select' ? (
                  <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 gap-3">
                    {MODES.map((m, i) => (
                      <motion.button
                        key={m.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => {
                          if (m.id === 'story') { onClose(); navigate('/story'); return; }
                          setMode(m.id); setStep('create'); setName('');
                        }}
                        className="flex items-start gap-4 p-5 rounded-2xl border border-[#1a1a2e] hover:border-zinc-600 text-left transition-all group"
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}
                          style={{ backgroundColor: m.color + '15', border: `1px solid ${m.color}30` }}>
                          <m.icon size={26} style={{ color: m.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-mono font-bold text-zinc-200 text-sm">{m.title}</h3>
                          <p className="font-mono text-[10px] text-zinc-500 mt-1 leading-relaxed">{m.desc}</p>
                        </div>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 self-center transition-colors`}
                          style={{ borderColor: m.color + '40' }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color + '60' }} />
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="space-y-4">
                    <div>
                      <label className="font-mono text-[10px] text-zinc-500 uppercase block mb-2">Название</label>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        placeholder={mode === 'vtt' ? 'Напр. Подземелье дракона' : 'Напр. Эльфийский лес'}
                        className="w-full bg-[#1a1a2e] border border-[#252540] rounded-2xl px-4 py-3 text-sm font-mono text-zinc-200 outline-none focus:border-purple-500/50 transition-colors"
                        autoFocus
                      />
                    </div>
                    {error && <p className="font-mono text-[10px] text-red-400">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setStep('select'); setMode(''); setError(''); }}
                        className="btn-secondary text-xs py-2.5 px-5 flex-1">
                        Назад
                      </button>
                      <button onClick={handleCreate} disabled={creating || !name.trim()}
                        className={`flex-1 py-2.5 rounded-2xl font-mono text-xs font-bold text-white bg-gradient-to-r ${selectedMode?.gradient} hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2`}>
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {creating ? 'Создаём...' : selectedMode?.createLabel}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
