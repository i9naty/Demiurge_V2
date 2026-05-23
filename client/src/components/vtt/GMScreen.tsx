import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Save, Download, Upload, FileText, Shield, Scroll, X, Plus, Copy } from 'lucide-react';

interface Slot {
  id: number; name: string; data: any; savedAt: string;
}

interface Props {
  onSave: (slot: number, name: string) => void;
  onLoad: (slot: number) => void;
  slots: Slot[];
  onHiddenRoll: (dice: string) => void;
  onExport: () => void;
  onImport: (data: any) => void;
}

export function GMScreen({ onSave, onLoad, slots, onHiddenRoll, onExport, onImport }: Props) {
  const [activeTab, setActiveTab] = useState<'notes' | 'rolls' | 'save'>('notes');
  const [notes, setNotes] = useState(() => localStorage.getItem('gm_notes') || '');
  const [hiddenDice, setHiddenDice] = useState('d20');
  const [hiddenMod, setHiddenMod] = useState('0');
  const [hiddenResults, setHiddenResults] = useState<string[]>([]);
  const [saveName, setSaveName] = useState('');
  const [loadConfirm, setLoadConfirm] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem('gm_notes', notes); }, [notes]);

  const doHiddenRoll = () => {
    const dice = hiddenDice.match(/^(\d+)?d(\d+)$/i);
    if (!dice) return;
    const count = parseInt(dice[1] || '1'), sides = parseInt(dice[2]);
    if (sides > 1000 || count > 100) return;
    const mod = parseInt(hiddenMod) || 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    const result = `🎲 ${hiddenDice}${mod ? `+${mod}` : ''}: [${rolls.join(', ')}] = ${total}`;
    setHiddenResults(prev => [result, ...prev].slice(0, 30));
    onHiddenRoll(result);
  };

  return (
    <div className="w-[300px] bg-[#0c0c12] border-l border-white/[0.05] flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="h-11 px-3 flex items-center gap-2 border-b border-white/[0.05] shrink-0">
        <Shield size={14} className="text-amber-400" />
        <span className="font-mono text-[11px] text-zinc-300 font-bold">Ширма ГМ</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.05] shrink-0">
        {([
          { id: 'notes', label: 'Заметки', icon: FileText },
          { id: 'rolls', label: 'Броски', icon: Scroll },
          { id: 'save', label: 'Сохранения', icon: Save },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-center font-mono text-[9px] transition-colors ${
              activeTab === t.id ? 'text-amber-400 border-b border-amber-500 bg-amber-500/[0.04]' : 'text-zinc-600 hover:text-zinc-400'
            }`}>
            <t.icon size={11} className="inline mr-1" />{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div className="p-3 h-full">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full h-[calc(100%-1rem)] bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-[11px] font-mono text-zinc-300 outline-none focus:border-amber-500/30 resize-none placeholder:text-zinc-700"
              placeholder="Приватные заметки мастера...&#10;&#10;Имена NPC, планы на сессию, секреты сюжета..." />
          </div>
        )}

        {/* Hidden rolls tab */}
        {activeTab === 'rolls' && (
          <div className="p-3 space-y-3">
            <div className="flex gap-1.5">
              <input value={hiddenDice} onChange={e => setHiddenDice(e.target.value)}
                placeholder="d20" className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-amber-500/30" />
              <input value={hiddenMod} onChange={e => setHiddenMod(e.target.value)}
                placeholder="мод" className="w-14 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-200 outline-none text-center" />
              <button onClick={doHiddenRoll}
                className="px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-bold hover:bg-amber-600/30">
                Бросок
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {['d20','d12','d10','d8','d6','d4'].map(d => (
                <button key={d} onClick={() => setHiddenDice(d)}
                  className={`text-[9px] font-mono px-2 py-1 rounded-lg border transition-colors ${
                    hiddenDice === d ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-white/[0.04] text-zinc-500 hover:border-zinc-500'
                  }`}>{d}</button>
              ))}
            </div>
            <div className="space-y-1 mt-2">
              <p className="text-[8px] text-zinc-600 font-mono uppercase">История скрытых бросков</p>
              {hiddenResults.length === 0 && <p className="text-[9px] text-zinc-700 font-mono text-center py-4">Нет бросков</p>}
              {hiddenResults.map((r, i) => (
                <div key={i} className="bg-amber-500/[0.03] border border-amber-500/[0.06] rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-amber-400/80">{r}</div>
              ))}
            </div>
          </div>
        )}

        {/* Save/Load tab */}
        {activeTab === 'save' && (
          <div className="p-3 space-y-3">
            <div className="flex gap-1.5">
              <input value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="Название сохранения" className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-zinc-200 outline-none focus:border-amber-500/30" />
              <button onClick={() => { if (!saveName.trim()) return; onSave(0, saveName); setSaveName(''); }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold hover:bg-emerald-600/30">
                <Save size={11} />
              </button>
            </div>

            {/* Quick save slots */}
            <div className="space-y-1">
              <p className="text-[8px] text-zinc-600 font-mono uppercase mb-2">Быстрые слоты</p>
              {[1, 2, 3, 4, 5].map(n => {
                const slot = slots.find(s => s.id === n);
                return (
                  <div key={n} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <span className="text-[8px] font-mono text-zinc-600 w-4">{n}</span>
                    <span className="text-[9px] font-mono text-zinc-400 flex-1 truncate">{slot ? slot.name : 'Пусто'}</span>
                    <button onClick={() => onSave(n, `Слот ${n}`)} className="p-0.5 rounded text-[8px] font-mono text-zinc-500 hover:text-emerald-400">💾</button>
                    {slot && (
                      <button onClick={() => setLoadConfirm(loadConfirm === n ? null : n)}
                        className="p-0.5 rounded text-[8px] font-mono text-zinc-500 hover:text-amber-400">📂</button>
                    )}
                    {loadConfirm === n && (
                      <button onClick={() => { onLoad(n); setLoadConfirm(null); }}
                        className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] font-mono">Загрузить</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Export/Import */}
            <div className="border-t border-white/[0.05] pt-3 flex gap-2">
              <button onClick={onExport}
                className="flex-1 py-2 rounded-lg border border-white/[0.06] text-zinc-400 font-mono text-[9px] hover:text-zinc-200 hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-1">
                <Download size={11} /> Экспорт
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 py-2 rounded-lg border border-white/[0.06] text-zinc-400 font-mono text-[9px] hover:text-zinc-200 hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-1">
                <Upload size={11} /> Импорт
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = () => { try { onImport(JSON.parse(r.result as string)); } catch {} };
                  r.readAsText(f); e.target.value = '';
                }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
