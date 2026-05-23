import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Skull, Sparkles, Package, Plus } from 'lucide-react';
import { useStore } from '../../store';
import { Tabs } from '../ui/Tabs';
import { EmptyState } from '../ui/EmptyState';

interface Monster { id: string; name: string; cr: string; type: string; size: string; ac: number; hp: number; speed: string; actions: string; traits: string; stats: Record<string, number>; }
interface Spell { id: string; name: string; level: number; school: string; description: string; classes: string[]; casting_time: string; range: string; duration: string; }
interface Item { id: string; name: string; type: string; rarity: string; cost: string; weight: number; description: string; }

type TabId = 'monsters' | 'spells' | 'items';
const TAB_LIST = [
  { id: 'monsters' as TabId, label: 'Монстры' },
  { id: 'spells' as TabId, label: 'Заклинания' },
  { id: 'items' as TabId, label: 'Предметы' },
];

export function Compendium({ onDragToken }: { onDragToken?: (data: { name: string; x: number; y: number; width: number; height: number }) => void }) {
  const { token } = useStore();
  const [tab, setTab] = useState<TabId>('monsters');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<(Monster | Spell | Item)[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', '50');

    fetch(`/api/compendium/${tab}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, query, token]);

  const handleDragStart = (e: React.DragEvent, name: string) => {
    e.dataTransfer.setData('text/plain', name);
    e.dataTransfer.effectAllowed = 'copy';
    if (onDragToken) {
      e.dataTransfer.setData('application/demiurge-token', JSON.stringify({ name, x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20), width: 64, height: 64 }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a10] border-l border-white/[0.05] w-[320px]">
      <div className="px-3 py-2 border-b border-white/[0.05]">
        <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">Компендиум</h3>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск..."
            className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg pl-7 pr-3 py-1.5 text-[10px] font-mono text-zinc-200 outline-none focus:border-violet-500/30 transition-colors"
          />
        </div>
      </div>
      <Tabs tabs={TAB_LIST} active={tab} onChange={(id) => { setTab(id as TabId); setExpanded(null); }} />

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" /></div>}
        {!loading && data.length === 0 && (
          <EmptyState icon={<Search size={20} />} message="Ничего не найдено" />
        )}
        {data.map((entry) => (
          <div key={entry.id} className="relative">
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, 'name' in entry ? (entry as Monster | Item).name : (entry as Spell).name)}
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors"
            >
              <div className="w-6 h-6 rounded bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                {tab === 'monsters' ? <Skull size={12} className="text-red-400/60" /> :
                 tab === 'spells' ? <Sparkles size={12} className="text-blue-400/60" /> :
                 <Package size={12} className="text-amber-400/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-zinc-300 truncate">{'name' in entry ? entry.name : ''}</div>
                <div className="text-[8px] font-mono text-zinc-600 truncate">
                  {tab === 'monsters' && (entry as Monster).cr && `CR ${(entry as Monster).cr} • ${(entry as Monster).type}`}
                  {tab === 'spells' && `${(entry as Spell).level === 0 ? 'Заговор' : `${(entry as Spell).level} уровень`} • ${(entry as Spell).school}`}
                  {tab === 'items' && `${(entry as Item).type} • ${(entry as Item).rarity}`}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={12} className="text-zinc-500" />
              </div>
            </div>
            {expanded === entry.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                <div className="px-3 pb-2.5 space-y-1.5">
                  {tab === 'monsters' && (
                    <>
                      <Detail label="HP" value={`${(entry as Monster).hp}`} />
                      <Detail label="AC" value={`${(entry as Monster).ac}`} />
                      <Detail label="CR" value={`${(entry as Monster).cr}`} />
                      <Detail label="Speed" value={(entry as Monster).speed} />
                      <Detail label="Size" value={(entry as Monster).size} />
                      {(entry as Monster).actions && (
                        <div className="text-[9px] font-mono text-zinc-400 leading-relaxed"><span className="text-amber-400/80">Действия:</span> {(entry as Monster).actions}</div>
                      )}
                      {(entry as Monster).traits && (
                        <div className="text-[9px] font-mono text-zinc-400 leading-relaxed"><span className="text-purple-400/80">Особенности:</span> {(entry as Monster).traits}</div>
                      )}
                    </>
                  )}
                  {tab === 'spells' && (
                    <>
                      <Detail label="Уровень" value={(entry as Spell).level === 0 ? 'Заговор' : `${(entry as Spell).level}`} />
                      <Detail label="Школа" value={(entry as Spell).school} />
                      {(entry as Spell).casting_time && <Detail label="Время" value={(entry as Spell).casting_time} />}
                      {(entry as Spell).range && <Detail label="Дистанция" value={(entry as Spell).range} />}
                      {(entry as Spell).duration && <Detail label="Длительность" value={(entry as Spell).duration} />}
                      <div className="text-[9px] font-mono text-zinc-400 leading-relaxed">{(entry as Spell).description}</div>
                    </>
                  )}
                  {tab === 'items' && (
                    <>
                      <Detail label="Тип" value={(entry as Item).type} />
                      <Detail label="Редкость" value={(entry as Item).rarity} />
                      <Detail label="Цена" value={(entry as Item).cost} />
                      {(entry as Item).weight > 0 && <Detail label="Вес" value={`${(entry as Item).weight} фнт`} />}
                      <div className="text-[9px] font-mono text-zinc-400 leading-relaxed">{(entry as Item).description}</div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[9px] font-mono">
      <span className="text-zinc-600">{label}</span>
      <span className="text-zinc-400">{value}</span>
    </div>
  );
}
