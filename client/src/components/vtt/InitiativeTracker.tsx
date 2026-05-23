import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Skull, Heart, Shield, Swords, Plus, X, ChevronUp, ChevronDown, Play, Pause, RotateCcw, Zap } from 'lucide-react';

export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  isPlayer: boolean;
  conditions: string[];
  tokenId?: string;
}

interface Props {
  combatants: Combatant[];
  currentTurn: string | null;
  round: number;
  isActive: boolean;
  onStart: () => void;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
  onAdd: (c: Omit<Combatant, 'id'>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Combatant>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const CONDITIONS = [
  { id: 'blinded', label: 'Ослеплён', emoji: '👁️‍🗨️' },
  { id: 'charmed', label: 'Очарован', emoji: '💫' },
  { id: 'deafened', label: 'Оглушён', emoji: '🔇' },
  { id: 'frightened', label: 'Испуган', emoji: '😨' },
  { id: 'grappled', label: 'Схвачен', emoji: '🤝' },
  { id: 'incapacitated', label: 'Недееспособен', emoji: '😵' },
  { id: 'invisible', label: 'Невидим', emoji: '👻' },
  { id: 'paralyzed', label: 'Парализован', emoji: '🧊' },
  { id: 'petrified', label: 'Окаменел', emoji: '🗿' },
  { id: 'poisoned', label: 'Отравлен', emoji: '☠️' },
  { id: 'prone', label: 'Сбит с ног', emoji: '📉' },
  { id: 'restrained', label: 'Опутан', emoji: '🪢' },
  { id: 'stunned', label: 'Ошеломлён', emoji: '⚡' },
  { id: 'unconscious', label: 'Без сознания', emoji: '💤' },
  { id: 'concentration', label: 'Концентрация', emoji: '🧠' },
];

export function InitiativeTracker({ combatants, currentTurn, round, isActive, onStart, onNext, onPrev, onStop, onAdd, onRemove, onUpdate, onReorder }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState(10);
  const [newHp, setNewHp] = useState(20);
  const [newAc, setNewAc] = useState(12);
  const [newIsPlayer, setNewIsPlayer] = useState(false);
  const [condMenu, setCondMenu] = useState<string | null>(null);

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ name: newName, initiative: newInit, hp: newHp, maxHp: newHp, ac: newAc, isPlayer: newIsPlayer, conditions: [] });
    setNewName(''); setNewInit(10); setNewHp(20); setNewAc(12); setShowAdd(false);
  };

  const toggleCondition = (cId: string, cond: string) => {
    const c = combatants.find(x => x.id === cId);
    if (!c) return;
    const newConds = c.conditions.includes(cond) ? c.conditions.filter(x => x !== cond) : [...c.conditions, cond];
    onUpdate(cId, { conditions: newConds });
    setCondMenu(null);
  };

  return (
    <div className="w-[300px] bg-[#0c0c12] border-l border-white/[0.05] flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="h-11 px-3 flex items-center gap-2 border-b border-white/[0.05] shrink-0">
        <Swords size={14} className="text-amber-400" />
        <span className="font-mono text-[11px] text-zinc-300 font-bold">Инициатива</span>
        <span className="font-mono text-[10px] text-zinc-600 ml-auto">Раунд {round}</span>
      </div>

      {/* Controls */}
      <div className="p-2 border-b border-white/[0.05] flex items-center gap-1.5 shrink-0">
        {!isActive ? (
          <button onClick={onStart} disabled={combatants.length === 0}
            className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold hover:bg-emerald-600/30 disabled:opacity-30 transition-colors flex items-center justify-center gap-1">
            <Play size={10} /> Бой
          </button>
        ) : (
          <>
            <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-400"><ChevronUp size={14} /></button>
            <button onClick={onNext}
              className="flex-1 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-bold hover:bg-amber-600/30 transition-colors flex items-center justify-center gap-1">
              <Zap size={10} /> Далее
            </button>
            <button onClick={onStop} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400"><X size={14} /></button>
          </>
        )}
      </div>

      {/* Combatant list */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {sorted.map((c, i) => {
            const isCurrent = c.id === currentTurn;
            const hpPct = Math.max(0, (c.hp / c.maxHp) * 100);
            const isLow = hpPct < 30;

            return (
              <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className={`px-3 py-2 border-b border-white/[0.02] transition-colors ${
                  isCurrent ? 'bg-amber-500/[0.06] border-l-2 border-l-amber-500' : 'hover:bg-white/[0.01]'
                }`}>
                {/* Header row */}
                <div className="flex items-center gap-2 mb-1"
                  draggable onDragStart={(e: any) => { e.dataTransfer.setData('text/plain', String(i)); }}
                  onDragOver={(e: any) => e.preventDefault()}
                  onDrop={(e: any) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain')); if (!isNaN(from)) onReorder(from, i); }}>
                  <GripVertical size={10} className="text-zinc-700 cursor-grab shrink-0" />
                  <span className={`font-mono text-[10px] font-bold truncate flex-1 ${c.isPlayer ? 'text-violet-300' : 'text-red-400'}`}>
                    {c.isPlayer ? '⚔️ ' : '👹 '}{c.name}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 tabular-nums">Иниц {c.initiative}</span>
                  <div className="flex items-center gap-0.5">
                    <Shield size={9} className="text-blue-400/60" />
                    <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{c.ac}</span>
                  </div>
                </div>

                {/* HP bar */}
                <div className="flex items-center gap-2 mb-1">
                  <Heart size={9} className={isLow ? 'text-red-400' : 'text-red-400/60'} />
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${isLow ? 'bg-red-500' : hpPct > 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${hpPct}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{c.hp}/{c.maxHp}</span>
                </div>

                {/* HP quick edit (only when current turn or always in combat) */}
                {isCurrent && (
                  <div className="flex items-center gap-1 mt-1">
                    <input type="number" className="w-12 bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-300 outline-none focus:border-amber-500/30 text-center"
                      placeholder="HP" onKeyDown={e => {
                        if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v)) { onUpdate(c.id, { hp: Math.max(0, Math.min(c.maxHp, v)) }); (e.target as HTMLInputElement).value = ''; } }
                      }} />
                    <button onClick={() => onUpdate(c.id, { hp: Math.max(0, c.hp - 5) })}
                      className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[8px] font-mono hover:bg-red-500/20">-5</button>
                    <button onClick={() => onUpdate(c.id, { hp: Math.min(c.maxHp, c.hp + 5) })}
                      className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-mono hover:bg-emerald-500/20">+5</button>
                    <button onClick={() => setCondMenu(condMenu === c.id ? null : c.id)}
                      className="px-1.5 py-0.5 rounded border border-white/[0.06] text-zinc-500 text-[8px] font-mono hover:border-zinc-500 ml-auto">
                      {c.conditions.length > 0 ? `Состояния (${c.conditions.length})` : '+Состояние'}
                    </button>
                  </div>
                )}

                {/* Conditions display */}
                {c.conditions.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {c.conditions.map(cond => {
                      const info = CONDITIONS.find(x => x.id === cond);
                      return <span key={cond} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04] flex items-center gap-0.5"
                        title={info?.label}>{info?.emoji}</span>;
                    })}
                  </div>
                )}

                {/* Conditions menu */}
                <AnimatePresence>
                  {condMenu === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {CONDITIONS.map(cond => (
                          <button key={cond.id} onClick={() => toggleCondition(c.id, cond.id)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                              c.conditions.includes(cond.id) ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-white/[0.04] text-zinc-500 hover:border-zinc-500'
                            }`}
                            title={cond.label}>{cond.emoji} {cond.label.slice(0, 10)}</button>
                        ))}
                        <button onClick={() => onRemove(c.id)} className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10">
                          <Skull size={8} className="inline mr-0.5" />Удалить
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-32 text-center px-4">
            <div>
              <Swords size={24} className="text-zinc-800 mx-auto mb-2" />
              <p className="font-mono text-[10px] text-zinc-600">Нет участников боя</p>
              <p className="font-mono text-[8px] text-zinc-700 mt-1">Добавьте персонажей и нажмите «Бой»</p>
            </div>
          </div>
        )}
      </div>

      {/* Add combatant */}
      <div className="p-2 border-t border-white/[0.05] shrink-0">
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="space-y-2 pb-2">
                <div className="flex gap-1.5">
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Имя" className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none focus:border-amber-500/30" />
                  <button onClick={() => setNewIsPlayer(!newIsPlayer)}
                    className={`px-2 rounded-lg border text-[9px] font-mono transition-colors ${newIsPlayer ? 'border-violet-500/30 bg-violet-500/10 text-violet-400' : 'border-white/[0.06] text-zinc-500'}`}>
                    {newIsPlayer ? '⚔️' : '👹'}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <div className="flex-1"><label className="text-[7px] text-zinc-600 block mb-0.5">Иниц</label><input type="number" value={newInit} onChange={e => setNewInit(parseInt(e.target.value) || 0)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none text-center" /></div>
                  <div className="flex-1"><label className="text-[7px] text-zinc-600 block mb-0.5">HP</label><input type="number" value={newHp} onChange={e => setNewHp(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none text-center" /></div>
                  <div className="flex-1"><label className="text-[7px] text-zinc-600 block mb-0.5">AC</label><input type="number" value={newAc} onChange={e => setNewAc(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-200 outline-none text-center" /></div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleAdd} disabled={!newName.trim()} className="flex-1 py-1.5 rounded-lg bg-amber-600 text-white font-mono text-[10px] font-bold hover:bg-amber-500 disabled:opacity-30 transition-colors">Добавить</button>
                  <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-zinc-400 font-mono text-[10px] hover:text-zinc-200">Отмена</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!showAdd && <button onClick={() => setShowAdd(true)} className="w-full py-2 rounded-lg border border-dashed border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 font-mono text-[10px] transition-colors flex items-center justify-center gap-1"><Plus size={10} /> Добавить в бой</button>}
      </div>
    </div>
  );
}
