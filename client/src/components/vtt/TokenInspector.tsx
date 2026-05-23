import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Shield, Move, Eye, EyeOff, Trash2, Copy, Plus, Minus, Lock, Unlock } from 'lucide-react';

interface TokenData {
  id: string; name: string; x: number; y: number; width: number; height: number;
  hp?: number; maxHp?: number; ac?: number; size?: string;
  hidden?: boolean; locked?: boolean; conditions?: string[]; ownerId?: string;
  imageUrl?: string | null;
}

interface Props {
  token: TokenData | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<TokenData>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddToInitiative: (id: string) => void;
  isGM: boolean;
}

const SIZES = [
  { label: 'Крошечный', value: 'tiny', cells: 0.5 },
  { label: 'Маленький', value: 'small', cells: 1 },
  { label: 'Средний', value: 'medium', cells: 1 },
  { label: 'Большой', value: 'large', cells: 2 },
  { label: 'Огромный', value: 'huge', cells: 3 },
  { label: 'Громадный', value: 'gargantuan', cells: 4 },
];

const CONDITIONS_QUICK = [
  { id: 'blinded', emoji: '👁️‍🗨️' }, { id: 'charmed', emoji: '💫' },
  { id: 'poisoned', emoji: '☠️' }, { id: 'stunned', emoji: '⚡' },
  { id: 'prone', emoji: '📉' }, { id: 'invisible', emoji: '👻' },
  { id: 'unconscious', emoji: '💤' }, { id: 'paralyzed', emoji: '🧊' },
  { id: 'frightened', emoji: '😨' }, { id: 'concentration', emoji: '🧠' },
];

export function TokenInspector({ token, onClose, onUpdate, onDelete, onDuplicate, onAddToInitiative, isGM }: Props) {
  if (!token) return null;

  const [name, setName] = useState(token.name);
  const [hp, setHp] = useState(token.hp ?? token.maxHp ?? 20);
  const [maxHp, setMaxHp] = useState(token.maxHp ?? 20);
  const [ac, setAc] = useState(token.ac ?? 10);
  const [size, setSize] = useState(token.size || 'medium');
  const [locked, setLocked] = useState(token.locked ?? false);
  const [hidden, setHidden] = useState(token.hidden ?? false);
  const [conditions, setConditions] = useState<string[]>(token.conditions || []);

  useEffect(() => {
    setName(token.name); setHp(token.hp ?? token.maxHp ?? 20);
    setMaxHp(token.maxHp ?? 20); setAc(token.ac ?? 10);
    setSize(token.size || 'medium'); setLocked(token.locked ?? false);
    setHidden(token.hidden ?? false); setConditions(token.conditions || []);
  }, [token.id]);

  const apply = (updates: Partial<TokenData>) => onUpdate(token.id, updates);

  const toggleCond = (cond: string) => {
    const next = conditions.includes(cond) ? conditions.filter(c => c !== cond) : [...conditions, cond];
    setConditions(next); apply({ conditions: next });
  };

  return (
    <AnimatePresence>
      <motion.div key={token.id} initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', damping: 25 }}
        className="w-[280px] bg-[#0c0c12] border-r border-white/[0.05] flex flex-col shrink-0 h-full overflow-y-auto">
        {/* Header */}
        <div className="h-11 px-3 flex items-center gap-2 border-b border-white/[0.05] shrink-0">
          <div className="w-6 h-6 rounded-lg bg-violet-600/20 flex items-center justify-center">
            {token.imageUrl
              ? <img src={token.imageUrl} className="w-full h-full rounded object-cover" />
              : <span className="text-[8px] font-mono text-violet-400">{token.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <span className="font-mono text-[11px] text-zinc-300 font-bold truncate flex-1">{token.name}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.05] text-zinc-500"><X size={14} /></button>
        </div>

        <div className="p-3 space-y-3 flex-1">
          {/* Name */}
          <div>
            <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Имя</label>
            <input value={name} onChange={e => setName(e.target.value)} onBlur={() => apply({ name })}
              className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-zinc-200 outline-none focus:border-violet-500/30" />
          </div>

          {/* HP + AC row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1 flex items-center gap-1"><Heart size={8} className="text-red-400" /> HP</label>
              <div className="flex items-center gap-1">
                <input type="number" value={hp} onChange={e => { const v = Math.max(0, parseInt(e.target.value) || 0); setHp(v); }}
                  onBlur={() => apply({ hp, maxHp })} className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none text-center" />
                <span className="text-[9px] text-zinc-600">/</span>
                <input type="number" value={maxHp} onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setMaxHp(v); }}
                  onBlur={() => apply({ hp, maxHp })} className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none text-center" />
              </div>
            </div>
            <div className="w-16">
              <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1 flex items-center gap-1"><Shield size={8} className="text-blue-400" /> AC</label>
              <input type="number" value={ac} onChange={e => { const v = Math.max(0, parseInt(e.target.value) || 0); setAc(v); }}
                onBlur={() => apply({ ac })} className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none text-center" />
            </div>
          </div>

          {/* Quick HP buttons */}
          <div className="flex gap-1.5">
            <button onClick={() => { const v = Math.max(0, hp - 5); setHp(v); apply({ hp: v }); }}
              className="flex-1 py-1 rounded-lg bg-red-500/10 text-red-400 text-[9px] font-mono hover:bg-red-500/20">-5</button>
            <button onClick={() => { const v = Math.max(0, hp - 1); setHp(v); apply({ hp: v }); }}
              className="flex-1 py-1 rounded-lg bg-red-500/[0.04] border border-red-500/10 text-red-400 text-[9px] font-mono hover:bg-red-500/10">-1</button>
            <button onClick={() => { const v = Math.min(maxHp, hp + 1); setHp(v); apply({ hp: v }); }}
              className="flex-1 py-1 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 text-emerald-400 text-[9px] font-mono hover:bg-emerald-500/10">+1</button>
            <button onClick={() => { const v = Math.min(maxHp, hp + 5); setHp(v); apply({ hp: v }); }}
              className="flex-1 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-mono hover:bg-emerald-500/20">+5</button>
          </div>

          {/* Size */}
          <div>
            <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Размер</label>
            <div className="flex flex-wrap gap-1">
              {SIZES.map(s => (
                <button key={s.value} onClick={() => { setSize(s.value); apply({ size: s.value }); }}
                  className={`text-[8px] font-mono px-2 py-1 rounded-lg border transition-colors ${
                    size === s.value ? 'border-violet-500/30 bg-violet-500/10 text-violet-400' : 'border-white/[0.04] text-zinc-500 hover:border-zinc-500'
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Состояния</label>
            <div className="flex flex-wrap gap-1">
              {CONDITIONS_QUICK.map(c => (
                <button key={c.id} onClick={() => toggleCond(c.id)}
                  className={`text-sm px-1.5 py-0.5 rounded-lg border transition-colors ${
                    conditions.includes(c.id) ? 'border-amber-500/30 bg-amber-500/10 ring-1 ring-amber-500/10' : 'border-white/[0.04] hover:border-zinc-500'
                  }`} title={c.id}>{c.emoji}</button>
              ))}
            </div>
          </div>

          {/* Visibility & Lock */}
          {isGM && (
            <div className="flex gap-2">
              <button onClick={() => { setHidden(!hidden); apply({ hidden: !hidden }); }}
                className={`flex-1 py-2 rounded-lg border font-mono text-[9px] flex items-center justify-center gap-1 transition-colors ${
                  hidden ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300'
                }`}>
                {hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                {hidden ? 'Скрыт' : 'Видимый'}
              </button>
              <button onClick={() => { setLocked(!locked); apply({ locked: !locked }); }}
                className={`flex-1 py-2 rounded-lg border font-mono text-[9px] flex items-center justify-center gap-1 transition-colors ${
                  locked ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300'
                }`}>
                {locked ? <Lock size={10} /> : <Unlock size={10} />}
                {locked ? 'Заблокирован' : 'Разблокирован'}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-white/[0.05] pt-3 space-y-1.5">
            <button onClick={() => onAddToInitiative(token.id)}
              className="w-full py-2 rounded-lg bg-amber-600/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-bold hover:bg-amber-600/20 transition-colors">
              ⚔️ В инициативу
            </button>
            <div className="flex gap-2">
              <button onClick={() => onDuplicate(token.id)}
                className="flex-1 py-1.5 rounded-lg border border-white/[0.06] text-zinc-400 font-mono text-[9px] hover:text-zinc-200 transition-colors flex items-center justify-center gap-1">
                <Copy size={10} /> Копия
              </button>
              <button onClick={() => { onDelete(token.id); onClose(); }}
                className="flex-1 py-1.5 rounded-lg border border-red-500/10 text-red-400 font-mono text-[9px] hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1">
                <Trash2 size={10} /> Удалить
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
