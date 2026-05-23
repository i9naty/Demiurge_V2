import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Shield, Footprints, X, Plus } from 'lucide-react';

interface CharacterData {
  name: string; race: string; cls: string; level: number; xp: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  hp: number; maxHp: number; tempHp: number; ac: number; initiative: number;
  speed: number; hitDice: string; hitDiceTotal: number; hitDiceUsed: number;
  skills: { name: string; proficient: boolean; stat: keyof CharacterData['stats']; bonus: number }[];
  inventory: { id: string; name: string; qty: number; weight: number }[];
  spells: { level: number; total: number; used: number }[];
  features: string[];
}

interface Props {
  character: CharacterData | null;
  onClose: () => void;
  onUpdate: (c: CharacterData) => void;
}

const STAT_NAMES: Record<string, string> = { str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МДР', cha: 'ХАР' };
const SKILLS_DEFAULT = [
  { name: 'Акробатика', proficient: false, stat: 'dex' as const, bonus: 0 },
  { name: 'Анализ', proficient: false, stat: 'int' as const, bonus: 0 },
  { name: 'Атлетика', proficient: false, stat: 'str' as const, bonus: 0 },
  { name: 'Внимательность', proficient: false, stat: 'wis' as const, bonus: 0 },
  { name: 'Выживание', proficient: false, stat: 'wis' as const, bonus: 0 },
  { name: 'Выступление', proficient: false, stat: 'cha' as const, bonus: 0 },
  { name: 'Запугивание', proficient: false, stat: 'cha' as const, bonus: 0 },
  { name: 'История', proficient: false, stat: 'int' as const, bonus: 0 },
  { name: 'Ловк. рук', proficient: false, stat: 'dex' as const, bonus: 0 },
  { name: 'Магия', proficient: false, stat: 'int' as const, bonus: 0 },
  { name: 'Медицина', proficient: false, stat: 'wis' as const, bonus: 0 },
  { name: 'Обман', proficient: false, stat: 'cha' as const, bonus: 0 },
  { name: 'Природа', proficient: false, stat: 'int' as const, bonus: 0 },
  { name: 'Проницательность', proficient: false, stat: 'wis' as const, bonus: 0 },
  { name: 'Религия', proficient: false, stat: 'int' as const, bonus: 0 },
  { name: 'Скрытность', proficient: false, stat: 'dex' as const, bonus: 0 },
  { name: 'Убеждение', proficient: false, stat: 'cha' as const, bonus: 0 },
  { name: 'Уход', proficient: false, stat: 'wis' as const, bonus: 0 },
];

const EMPTY_CHAR: CharacterData = {
  name: 'Герой', race: 'Человек', cls: 'Воин', level: 1, xp: 0,
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  hp: 12, maxHp: 12, tempHp: 0, ac: 10, initiative: 0, speed: 30,
  hitDice: '1d10', hitDiceTotal: 1, hitDiceUsed: 0,
  skills: SKILLS_DEFAULT, inventory: [],
  spells: [{ level: 0, total: 2, used: 0 }],
  features: [],
};

export function CharacterSheet({ character, onClose, onUpdate }: Props) {
  const [char, setChar] = useState<CharacterData>(character || EMPTY_CHAR);
  const [activeTab, setActiveTab] = useState<'stats'|'skills'|'inventory'|'spells'>('stats');

  useEffect(() => { if (character) setChar(character); }, [character]);

  const mod = (stat: number) => Math.floor((stat - 10) / 2);
  const profBonus = Math.ceil(char.level / 4) + 1;

  const update = (updates: Partial<CharacterData>) => {
    const next = { ...char, ...updates };
    setChar(next); onUpdate(next);
  };

  const updateStat = (stat: keyof CharacterData['stats'], val: number) => {
    update({ stats: { ...char.stats, [stat]: Math.max(1, Math.min(30, val)) } });
  };

  return (
    <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', damping: 25 }}
      className="w-[300px] bg-[#0c0c12] border-r border-white/[0.05] flex flex-col shrink-0 h-full overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] text-zinc-300 font-bold">Лист персонажа</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.05] text-zinc-500"><X size={14} /></button>
        </div>
        <input value={char.name} onChange={e => update({ name: e.target.value })}
          className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-bold text-zinc-200 outline-none focus:border-violet-500/30 mb-2" />
        <div className="flex gap-2 text-[9px] font-mono text-zinc-500">
          <span>{char.race}</span><span>·</span><span>{char.cls}</span><span>·</span><span>Ур. {char.level}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.05] shrink-0">
        {['stats','skills','inventory','spells'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)}
            className={`flex-1 py-1.5 text-center font-mono text-[8px] transition-colors ${
              activeTab === t ? 'text-violet-400 border-b border-violet-500' : 'text-zinc-600 hover:text-zinc-400'
            }`}>
            {t === 'stats' ? 'Статы' : t === 'skills' ? 'Навыки' : t === 'inventory' ? 'Инвентарь' : 'Заклинания'}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 space-y-3">
        {/* HP + AC + Speed */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2 text-center">
            <Heart size={10} className="text-red-400 mx-auto mb-0.5" />
            <div className="flex items-center justify-center gap-1">
              <input type="number" value={char.hp} onChange={e => update({ hp: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-10 bg-transparent text-center text-[10px] font-mono font-bold text-zinc-200 outline-none" />
              <span className="text-[9px] text-zinc-600">/</span>
              <span className="text-[10px] font-mono text-zinc-400">{char.maxHp}</span>
            </div>
            {char.tempHp > 0 && <p className="text-[8px] text-blue-400 font-mono">+{char.tempHp} врем</p>}
          </div>
          <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2 text-center">
            <Shield size={10} className="text-blue-400 mx-auto mb-0.5" />
            <span className="text-[11px] font-mono font-bold text-zinc-200 block">{char.ac}</span>
            <span className="text-[7px] text-zinc-600">AC</span>
          </div>
          <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2 text-center">
            <Footprints size={10} className="text-amber-400 mx-auto mb-0.5" />
            <span className="text-[10px] font-mono font-bold text-zinc-200 block">{char.speed} ft</span>
            <span className="text-[7px] text-zinc-600">Скорость</span>
          </div>
        </div>

        {/* Stats tab */}
        {activeTab === 'stats' && (
          <div className="space-y-1">
            {Object.entries(char.stats).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 bg-white/[0.01] rounded-lg px-2.5 py-1.5">
                <span className="w-8 text-[8px] font-mono text-zinc-500">{STAT_NAMES[key]}</span>
                <span className="w-7 text-center text-[11px] font-mono font-bold text-zinc-200">{val}</span>
                <span className="w-7 text-center text-[9px] font-mono text-zinc-400">{mod(val) >= 0 ? '+' : ''}{mod(val)}</span>
                <div className="flex-1" />
                <button onClick={() => updateStat(key as any, val - 1)} className="w-5 h-5 rounded bg-white/[0.03] text-zinc-600 text-[10px]">−</button>
                <button onClick={() => updateStat(key as any, val + 1)} className="w-5 h-5 rounded bg-white/[0.03] text-zinc-600 text-[10px]">+</button>
              </div>
            ))}
            <div className="pt-2 border-t border-white/[0.05] flex gap-4 text-center text-[9px] font-mono text-zinc-500">
              <div><span className="text-zinc-400 font-bold block">+{Math.max(0, mod(char.stats.dex) + (char.initiative))}</span>Инициатива</div>
              <div><span className="text-zinc-400 font-bold block">{char.speed} ft</span>Скорость</div>
              <div><span className="text-zinc-400 font-bold block">+{profBonus}</span>Бонус мастерства</div>
            </div>
          </div>
        )}

        {/* Skills tab */}
        {activeTab === 'skills' && (
          <div className="space-y-0.5">
            {char.skills.map(s => {
              const total = mod(char.stats[s.stat]) + (s.proficient ? profBonus : 0) + s.bonus;
              return (
                <div key={s.name} className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-white/[0.01]">
                  <button onClick={() => {
                    update({ skills: char.skills.map(sk => sk.name === s.name ? { ...sk, proficient: !sk.proficient } : sk) });
                  }}
                    className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] ${s.proficient ? 'bg-violet-500/20 border-violet-500/30 text-violet-400' : 'border-white/[0.06] text-transparent hover:text-zinc-700'}`}>
                    {s.proficient ? '✓' : ''}
                  </button>
                  <span className="flex-1 text-[9px] font-mono text-zinc-400">{s.name}</span>
                  <span className="text-[8px] text-zinc-600 font-mono w-5 text-right">{STAT_NAMES[s.stat]}</span>
                  <span className="text-[10px] font-mono font-bold text-zinc-200 w-7 text-right">{total >= 0 ? '+' : ''}{total}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Inventory tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-1">
            {char.inventory.length === 0 && (
              <p className="text-[9px] text-zinc-700 text-center py-4 font-mono">Пусто</p>
            )}
            {char.inventory.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.01]">
                <span className="flex-1 text-[9px] font-mono text-zinc-400">{item.name}</span>
                <span className="text-[8px] text-zinc-600">×{item.qty}</span>
                <span className="text-[8px] text-zinc-700">{item.weight}ф</span>
              </div>
            ))}
            <div className="pt-2 border-t border-white/[0.05] text-[9px] font-mono text-zinc-500 text-center">
              Вес: {char.inventory.reduce((a, i) => a + i.qty * i.weight, 0)} / {char.stats.str * 15} фнт
            </div>
          </div>
        )}

        {/* Spells tab */}
        {activeTab === 'spells' && (
          <div className="space-y-2">
            {char.spells.map((sl, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/[0.01] rounded-lg px-2.5 py-1.5">
                <span className="text-[9px] font-mono text-zinc-500">
                  {sl.level === 0 ? 'Заговоры' : `${sl.level} уровень`}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  {Array.from({ length: sl.total }).map((_, j) => (
                    <button key={j} onClick={() => {
                      const spells = [...char.spells];
                      const spell = spells[i]!;
                      spells[i] = { ...spell, used: j < spell.used ? j : j + 1 > spell.used ? Math.min(spell.total, spell.used + 1) : spell.used };
                      update({ spells });
                    }}
                      className={`w-3 h-3 rounded-sm border transition-colors ${
                        j < sl.used ? 'bg-violet-500/30 border-violet-500/40' : 'border-white/[0.06] hover:border-zinc-600'
                      }`} />
                  ))}
                </div>
                <span className="text-[8px] font-mono text-zinc-500 w-8 text-right">{sl.used}/{sl.total}</span>
              </div>
            ))}
            <button onClick={() => update({ spells: [...char.spells, { level: char.spells.length, total: 2, used: 0 }] })}
              className="w-full py-1.5 rounded-lg border border-dashed border-white/[0.06] text-zinc-600 hover:text-zinc-400 font-mono text-[9px] flex items-center justify-center gap-1">
              <Plus size={10} /> Добавить уровень
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
