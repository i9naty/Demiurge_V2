import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Plus, Minus, Sparkles, RotateCw } from 'lucide-react';

interface Props {
  onRoll: (content: string) => void;
  onClose: () => void;
}

const DICE = [
  { sides: 4, label: 'd4', color: '#ef4444', icon: '▲' },
  { sides: 6, label: 'd6', color: '#22c55e', icon: '■' },
  { sides: 8, label: 'd8', color: '#a855f7', icon: '◆' },
  { sides: 10, label: 'd10', color: '#f59e0b', icon: '◉' },
  { sides: 12, label: 'd12', color: '#a855f7', icon: '⬟' },
  { sides: 20, label: 'd20', color: '#ec4899', icon: '⬡' },
  { sides: 100, label: 'd100', color: '#6366f1', icon: '◐' },
];

export function DiceRoller({ onRoll, onClose }: Props) {
  const [diceSides, setDiceSides] = useState(20);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [modStr, setModStr] = useState('');
  const [advantage, setAdvantage] = useState<'normal' | 'adv' | 'dis'>('normal');
  const [rollResult, setRollResult] = useState<{ rolls: number[]; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [history, setHistory] = useState<{ dice: string; rolls: number[]; total: number; ts: number }[]>([]);

  const roll = useCallback(() => {
    setIsRolling(true);
    setRollResult(null);
    const animRolls: number[] = [];
    for (let i = 0; i < 20; i++) animRolls.push(Math.floor(Math.random() * diceSides) + 1);
    let idx = 0;
    const iv = setInterval(() => {
      setRollResult({ rolls: [animRolls[idx % 20]], total: animRolls[idx % 20] });
      idx++;
    }, 40);

    setTimeout(() => {
      clearInterval(iv);
      const n = advantage !== 'normal' ? 2 : count;
      const rolls: number[] = [];
      for (let i = 0; i < n; i++) rolls.push(Math.floor(Math.random() * diceSides) + 1);
      let mod = modifier;
      if (modStr && /^[+-]?\d+$/.test(modStr)) mod = parseInt(modStr);
      const advRolls = advantage === 'adv' ? [Math.max(...rolls)] : advantage === 'dis' ? [Math.min(...rolls)] : rolls;
      const total = advRolls.reduce((a, b) => a + b, 0) + mod;
      setRollResult({ rolls: advRolls, total });
      setIsRolling(false);
      const diceName = advantage !== 'normal' ? `d${diceSides} (${advantage === 'adv' ? 'преим' : 'помеха'})` : `${count}d${diceSides}`;
      const modText = mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : '';
      const msg = `🎲 ${diceName}${modText}: [${advRolls.join(', ')}]${mod !== 0 ? modText : ''} = ${total}`;
      setHistory(prev => [{ dice: diceName, rolls: advRolls, total, ts: Date.now() }, ...prev].slice(0, 10));
      onRoll(msg);
    }, 1000);
  }, [diceSides, count, modifier, modStr, advantage, onRoll]);

  const diceColor = DICE.find(d => d.sides === diceSides)?.color || '#a855f7';
  const diceIcon = DICE.find(d => d.sides === diceSides)?.icon || '⬡';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#0f0f16] border border-[#1a1a2e] rounded-2xl p-6 w-[420px] max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-lg text-zinc-200 flex items-center gap-2"><Dices size={20} className="text-violet-400" /> Бросок кубиков</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5">✕</button>
        </div>

        {/* Dice type selector */}
        <div className="mb-4">
          <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Тип кубика</label>
          <div className="grid grid-cols-7 gap-1.5">
            {DICE.map(d => (
              <button key={d.sides} onClick={() => { setDiceSides(d.sides); setRollResult(null); }}
                className={`p-2 rounded-xl border font-mono text-xs transition-all flex flex-col items-center gap-0.5 ${
                  diceSides === d.sides ? 'border-purple-500 bg-purple-600/20 text-violet-400 scale-105' : 'border-[#1a1a2e] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}>
                <span className="text-lg">{d.icon}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5 block">Количество</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setCount(Math.max(1, count - 1))} className="p-1.5 rounded-lg bg-[#1a1a2e] text-zinc-400 hover:text-zinc-200 disabled:opacity-30" disabled={advantage !== 'normal'}><Minus size={14} /></button>
              <span className="w-10 text-center font-mono text-lg text-zinc-200">{advantage !== 'normal' ? '1' : count}</span>
              <button onClick={() => setCount(Math.min(20, count + 1))} className="p-1.5 rounded-lg bg-[#1a1a2e] text-zinc-400 hover:text-zinc-200 disabled:opacity-30" disabled={advantage !== 'normal'}><Plus size={14} /></button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5 block">Модификатор</label>
            <input type="text" value={modStr} onChange={e => setModStr(e.target.value)} placeholder="0"
              className="w-20 bg-[#1a1a2e] border border-[#252540] rounded-lg px-3 py-1.5 text-center font-mono text-sm text-zinc-200 outline-none focus:border-purple-500/50" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5 block">Преимущество</label>
            <div className="flex rounded-lg overflow-hidden border border-[#1a1a2e]">
              <button onClick={() => setAdvantage('adv')} className={`flex-1 py-1.5 text-[10px] font-mono ${advantage === 'adv' ? 'bg-emerald-600/30 text-emerald-400' : 'bg-transparent text-zinc-500'}`}>Преим</button>
              <button onClick={() => setAdvantage('normal')} className={`flex-1 py-1.5 text-[10px] font-mono ${advantage === 'normal' ? 'bg-purple-600/20 text-violet-400' : 'bg-transparent text-zinc-500'}`}>Обыч</button>
              <button onClick={() => setAdvantage('dis')} className={`flex-1 py-1.5 text-[10px] font-mono ${advantage === 'dis' ? 'bg-red-600/20 text-red-400' : 'bg-transparent text-zinc-500'}`}>Помеха</button>
            </div>
          </div>
        </div>

        {/* Roll button */}
        <button onClick={roll} disabled={isRolling}
          className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all relative overflow-hidden disabled:opacity-70"
          style={{ background: `linear-gradient(135deg, ${diceColor}40, ${diceColor}80)` }}>
          <span className="relative z-10 flex items-center justify-center gap-2 text-white">
            {isRolling ? <><RotateCw size={16} className="animate-spin" /> Бросаем...</> : <><Sparkles size={16} /> Бросить {advantage !== 'normal' ? `d${diceSides}` : `${count}d${diceSides}`}{modStr && /^[+-]?\d+$/.test(modStr) ? ` ${modStr}` : ''}</>}
          </span>
          {isRolling && <div className="absolute inset-0 animate-pulse" style={{ background: `linear-gradient(135deg, ${diceColor}60, ${diceColor}90)` }} />}
        </button>

        {/* Result */}
        <AnimatePresence>
          {rollResult && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              {/* Dice faces */}
              <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
                {rollResult.rolls.map((r, i) => (
                  <motion.div key={i}
                    initial={{ rotateY: 0, scale: 0.5 }}
                    animate={{ rotateY: 360, scale: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="w-14 h-14 rounded-xl flex items-center justify-center font-mono text-2xl font-bold shadow-lg border-2"
                    style={{ background: `${diceColor}20`, borderColor: `${diceColor}60`, color: diceColor }}>
                    {r}
                  </motion.div>
                ))}
                {modifier !== 0 && (
                  <div className="flex items-center font-mono text-lg text-zinc-400">
                    <span className="mx-1">{modifier > 0 ? '+' : '−'}</span>
                    <span>{Math.abs(modifier)}</span>
                  </div>
                )}
              </div>
              {/* Total */}
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}
                className="text-center py-2 rounded-xl border-2"
                style={{ borderColor: `${diceColor}40`, background: `${diceColor}10` }}>
                <span className="font-mono text-3xl font-bold" style={{ color: diceColor }}>{rollResult.total}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#1a1a2e]">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">История</h3>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={h.ts} className="text-[10px] font-mono text-zinc-500 flex items-center justify-between py-0.5">
                  <span>{h.dice}</span>
                  <span className="font-bold text-zinc-300">= {h.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
