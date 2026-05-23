import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, Heart, Plus, Skull } from 'lucide-react';

interface Monster {
  name: string; type: string; cr: number | string; hp: number; ac: number;
  size: string; speed: string; stats: string; actions: string;
}

const MONSTERS: Monster[] = [
  { name: 'Гоблин', type: 'гуманоид', cr: '1/4', hp: 7, ac: 15, size: 'small', speed: '30 ft', stats: 'СИЛ 8 ЛОВ 14 ТЕЛ 10', actions: 'Скимитар: +4, 1d6+2. Короткий лук: +4, 1d6+2.' },
  { name: 'Орк', type: 'гуманоид', cr: '1/2', hp: 15, ac: 13, size: 'medium', speed: '30 ft', stats: 'СИЛ 16 ЛОВ 12 ТЕЛ 16', actions: 'Грейтакс: +5, 1d12+3. Дротик: +5, 1d6+3.' },
  { name: 'Скелет', type: 'нежить', cr: '1/4', hp: 13, ac: 13, size: 'medium', speed: '30 ft', stats: 'СИЛ 10 ЛОВ 14 ТЕЛ 15', actions: 'Короткий меч: +4, 1d6+2. Короткий лук: +4, 1d6+2.' },
  { name: 'Зомби', type: 'нежить', cr: '1/4', hp: 22, ac: 8, size: 'medium', speed: '20 ft', stats: 'СИЛ 13 ЛОВ 6 ТЕЛ 16', actions: 'Удар: +3, 1d6+1. Нежить-стойкость: DC 5+урон CON.' },
  { name: 'Волк', type: 'зверь', cr: '1/4', hp: 11, ac: 13, size: 'medium', speed: '40 ft', stats: 'СИЛ 12 ЛОВ 15 ТЕЛ 12', actions: 'Укус: +4, 2d4+2. Pack Tactics: преимущество если союзник рядом.' },
  { name: 'Гигантский паук', type: 'зверь', cr: 1, hp: 26, ac: 14, size: 'large', speed: '30 ft, climb 30 ft', stats: 'СИЛ 14 ЛОВ 16 ТЕЛ 12', actions: 'Укус: +5, 1d8+3 + яд DC 11 CON (2d8). Паутина: +5, сдерживание.' },
  { name: 'Дракон (молодой красный)', type: 'дракон', cr: 10, hp: 178, ac: 18, size: 'large', speed: '40 ft, fly 80 ft', stats: 'СИЛ 23 ЛОВ 10 ТЕЛ 21', actions: 'Мультиатака (3). Укус: +10, 2d10+6. Когти: +10, 2d6+6. Огненное дыхание: 16d6, DC 17 DEX.' },
  { name: 'Дракон (молодой белый)', type: 'дракон', cr: 6, hp: 133, ac: 17, size: 'large', speed: '40 ft, fly 80 ft', stats: 'СИЛ 18 ЛОВ 10 ТЕЛ 18', actions: 'Мультиатака (3). Укус: +7, 2d10+4. Ледяное дыхание: 10d8, DC 15 CON.' },
  { name: 'Минотавр', type: 'монстр', cr: 3, hp: 76, ac: 14, size: 'large', speed: '40 ft', stats: 'СИЛ 18 ЛОВ 11 ТЕЛ 16', actions: 'Грейтакс: +6, 2d12+4. Атака рогами: +6, 2d8+4. Charge: +2d8 если разбег 10+ ft.' },
  { name: 'Тролль', type: 'гигант', cr: 5, hp: 84, ac: 15, size: 'large', speed: '30 ft', stats: 'СИЛ 18 ЛОВ 13 ТЕЛ 20', actions: 'Мультиатака (3). Укус: +7, 1d6+4. Коготь: +7, 2d6+4. Регенерация 10 HP/раунд (кроме огня/кислоты).' },
  { name: 'Гоблин-шаман', type: 'гуманоид', cr: 1, hp: 27, ac: 13, size: 'small', speed: '30 ft', stats: 'СИЛ 8 ЛОВ 14 ТЕЛ 12', actions: 'Огненный шар (3/день): 8d6, DC 13 DEX. Проклятие: DC 13 WIS, disadvantage.' },
  { name: 'Элементаль огня', type: 'элементаль', cr: 5, hp: 102, ac: 13, size: 'large', speed: '50 ft', stats: 'СИЛ 10 ЛОВ 17 ТЕЛ 16', actions: 'Мультиатака (2). Касание: +6, 2d6+3 огня. Поджог: существа в 5 ft горят 1d10/раунд.' },
  { name: 'Вампир', type: 'нежить', cr: 13, hp: 144, ac: 16, size: 'medium', speed: '30 ft', stats: 'СИЛ 18 ЛОВ 18 ТЕЛ 18', actions: 'Мультиатака (2). Когти: +9, 2d4+4. Укус: +9, 1d6+4 + 3d6 некротики. Регенерация 20 HP/раунд.' },
  { name: 'Лич', type: 'нежить', cr: 21, hp: 135, ac: 17, size: 'medium', speed: '30 ft', stats: 'СИЛ 11 ЛОВ 16 ТЕЛ 16', actions: 'Парализующее касание: +12, 3d6 холода. Легендарные действия (3). Заклинания до 9 уровня.' },
  { name: 'Красный дракон (взрослый)', type: 'дракон', cr: 17, hp: 256, ac: 19, size: 'huge', speed: '40 ft, fly 80 ft', stats: 'СИЛ 27 ЛОВ 10 ТЕЛ 25', actions: 'Мультиатака (3). Укус: +14, 2d10+8. Огненное дыхание: 18d6, DC 21 DEX. Frightful Presence DC 19.' },
  { name: 'Бехолдер', type: 'аберрация', cr: 13, hp: 180, ac: 18, size: 'large', speed: '0 ft, fly 20 ft', stats: 'СИЛ 10 ЛОВ 14 ТЕЛ 18', actions: 'Укус: +5, 4d6. Глазные лучи (случайные 3): очарование, паралич, страх, замедление и т.д. Антимагический конус (главный глаз).' },
  { name: 'Гигантская крыса', type: 'зверь', cr: '1/8', hp: 7, ac: 12, size: 'small', speed: '30 ft', stats: 'СИЛ 7 ЛОВ 15 ТЕЛ 11', actions: 'Укус: +4, 1d4+2. Pack Tactics.' },
  { name: 'Бандит', type: 'гуманоид', cr: '1/8', hp: 11, ac: 12, size: 'medium', speed: '30 ft', stats: 'СИЛ 11 ЛОВ 12 ТЕЛ 12', actions: 'Скимитар: +3, 1d6+1. Лёгкий арбалет: +3, 1d8+1.' },
  { name: 'Культист', type: 'гуманоид', cr: '1/8', hp: 9, ac: 12, size: 'medium', speed: '30 ft', stats: 'СИЛ 11 ЛОВ 12 ТЕЛ 10', actions: 'Скимитар: +3, 1d6+1. Тёмное благословение: advantage на спасброски от магии.' },
  { name: 'Гнолл', type: 'гуманоид', cr: '1/2', hp: 22, ac: 15, size: 'medium', speed: '30 ft', stats: 'СИЛ 14 ЛОВ 12 ТЕЛ 11', actions: 'Укус: +4, 1d4+2. Копьё: +4, 1d6+2. Rampage: бонусная атака при убийстве.' },
  { name: 'Огр', type: 'гигант', cr: 2, hp: 59, ac: 11, size: 'large', speed: '40 ft', stats: 'СИЛ 19 ЛОВ 8 ТЕЛ 16', actions: 'Большая дубина: +6, 2d8+4. Дротик: +6, 2d6+4.' },
  { name: 'Грифон', type: 'монстр', cr: 2, hp: 59, ac: 12, size: 'large', speed: '30 ft, fly 80 ft', stats: 'СИЛ 18 ЛОВ 15 ТЕЛ 16', actions: 'Мультиатака (2). Клюв: +6, 1d8+4. Когти: +6, 2d6+4.' },
  { name: 'Мишень (тренировочная)', type: 'конструкт', cr: 0, hp: 1, ac: 5, size: 'medium', speed: '0 ft', stats: 'СИЛ 1 ЛОВ 1 ТЕЛ 10', actions: 'Нет действий. Только для тестирования урона.' },
  { name: 'Стражник', type: 'гуманоид', cr: '1/8', hp: 11, ac: 16, size: 'medium', speed: '30 ft', stats: 'СИЛ 13 ЛОВ 12 ТЕЛ 12', actions: 'Копьё: +3, 1d6+1. Щит.' },
  { name: 'Рыцарь', type: 'гуманоид', cr: 3, hp: 52, ac: 18, size: 'medium', speed: '30 ft', stats: 'СИЛ 16 ЛОВ 11 ТЕЛ 14', actions: 'Мультиатака (2). Длинный меч: +5, 1d8+3. Лидерство (бонус): +1d4 союзнику.' },
  { name: 'Гоблин-босс', type: 'гуманоид', cr: 1, hp: 21, ac: 17, size: 'small', speed: '30 ft', stats: 'СИЛ 10 ЛОВ 14 ТЕЛ 10', actions: 'Мультиатака (2). Скимитар: +4, 1d6+2. Redirect Attack: перенаправить атаку на соседнего гоблина.' },
  { name: 'Медведь', type: 'зверь', cr: '1/2', hp: 19, ac: 11, size: 'medium', speed: '40 ft', stats: 'СИЛ 15 ЛОВ 10 ТЕЛ 14', actions: 'Мультиатака (2). Укус: +3, 1d6+2. Когти: +3, 2d4+2.' },
  { name: 'Виверна', type: 'дракон', cr: 6, hp: 110, ac: 13, size: 'large', speed: '20 ft, fly 80 ft', stats: 'СИЛ 19 ЛОВ 10 ТЕЛ 16', actions: 'Мультиатака (2). Укус: +7, 2d6+4. Жало: +7, 2d6+4 + 7d6 яда DC 15 CON (половина при успехе).' },
  { name: 'Кошка (пантера)', type: 'зверь', cr: '1/4', hp: 13, ac: 12, size: 'medium', speed: '50 ft, climb 40 ft', stats: 'СИЛ 14 ЛОВ 15 ТЕЛ 10', actions: 'Укус: +4, 1d6+2. Коготь: +4, 1d4+2. Pounce: DC 12 STR или prone + бонусная атака.' },
  { name: 'Доппельгангер', type: 'монстр', cr: 3, hp: 52, ac: 14, size: 'medium', speed: '30 ft', stats: 'СИЛ 11 ЛОВ 18 ТЕЛ 14', actions: 'Мультиатака. Удар: +6, 1d6+4. Чтение мыслей. Shapechanger: любая Medium форма.' },
  { name: 'Тёмный эльф (дроу)', type: 'гуманоид', cr: '1/4', hp: 13, ac: 15, size: 'medium', speed: '30 ft', stats: 'СИЛ 10 ЛОВ 14 ТЕЛ 10', actions: 'Короткий меч: +4, 1d6+2. Ручной арбалет: +4, 1d6 + яд DC 13 CON (сон). Тьма 1/день.' },
  { name: 'Дух (призрак)', type: 'нежить', cr: 4, hp: 45, ac: 11, size: 'medium', speed: '0 ft, fly 40 ft', stats: 'СИЛ 7 ЛОВ 13 ТЕЛ 10', actions: 'Истощающее касание: +5, 4d6+3 некротики. Эфирность. Владение (DC 13 CHA). Уязвимость к магии.' },
  { name: 'Химера', type: 'монстр', cr: 6, hp: 114, ac: 14, size: 'large', speed: '30 ft, fly 60 ft', stats: 'СИЛ 19 ЛОВ 11 ТЕЛ 19', actions: 'Мультиатака (3). Укус: +7, 2d6+4. Рог: +7, 1d12+4. Огненное дыхание: 7d8, DC 15 DEX (перезарядка 5-6).' },
];

const SPELLS = [
  { name: 'Волшебная стрела', level: 1, school: 'Воплощение', castTime: '1 действие', range: '120 футов', duration: 'Мгновенно', desc: '3 стрелы по 1d4+1 урона силовым полем. +1 стрела за каждый уровень выше 1.' },
  { name: 'Огненный шар', level: 3, school: 'Воплощение', castTime: '1 действие', range: '150 футов', duration: 'Мгновенно', desc: 'Сфера 20-футового радиуса. 8d6 урона огнём, DC DEX половина. +1d6 за уровень выше 3.' },
  { name: 'Лечение ран', level: 1, school: 'Воплощение', castTime: '1 действие', range: 'Касание', duration: 'Мгновенно', desc: 'Восстанавливает 1d8+мод заклинания HP. +1d8 за каждый уровень выше 1.' },
  { name: 'Щит', level: 1, school: 'Ограждение', castTime: '1 реакция', range: 'На себя', duration: '1 раунд', desc: '+5 AC до начала следующего хода. Неуязвимость к волшебной стреле.' },
  { name: 'Невидимость', level: 2, school: 'Иллюзия', castTime: '1 действие', range: 'Касание', duration: '1 час (конц)', desc: 'Цель становится невидимой. Атака или заклинание прерывает эффект.' },
  { name: 'Тьма', level: 2, school: 'Воплощение', castTime: '1 действие', range: '60 футов', duration: '10 минут (конц)', desc: 'Сфера тьмы радиусом 15 футов. Никакой свет не проникает. Тёмное зрение не работает.' },
  { name: 'Благословение', level: 1, school: 'Очарование', castTime: '1 действие', range: '30 футов', duration: '1 минута (конц)', desc: '+1d4 к броскам атаки и спасброскам для 3 существ.' },
  { name: 'Молния', level: 3, school: 'Воплощение', castTime: '1 действие', range: '100 футов', duration: 'Мгновенно', desc: 'Линия 100×5 футов. 8d6 урона молнией, DC DEX половина.' },
  { name: 'Полёт', level: 3, school: 'Трансмутация', castTime: '1 действие', range: 'Касание', duration: '10 минут (конц)', desc: 'Цель получает скорость полёта 60 футов.' },
  { name: 'Конус холода', level: 5, school: 'Воплощение', castTime: '1 действие', range: '60 футов', duration: 'Мгновенно', desc: 'Конус 60 футов. 8d8 урона холодом, DC CON половина.' },
  { name: 'Замедление', level: 3, school: 'Трансмутация', castTime: '1 действие', range: '120 футов', duration: '1 минута (конц)', desc: 'До 6 целей. -2 AC, -2 DEX спасброски, скорость пополам, только 1 атака за ход.' },
  { name: 'Ускорение', level: 3, school: 'Трансмутация', castTime: '1 действие', range: '30 футов', duration: '1 минута (конц)', desc: '+2 AC, advantage DEX, двойная скорость, доп. действие (одна атака).' },
  { name: 'Стена огня', level: 4, school: 'Воплощение', castTime: '1 действие', range: '120 футов', duration: '1 минута (конц)', desc: 'Стена 60×20 футов. 5d8 урона огнём при прохождении.' },
  { name: 'Оживление', level: 7, school: 'Некромантия', castTime: '1 час', range: 'Касание', duration: 'Мгновенно', desc: 'Воскрешает существо, умершее не более 100 лет назад. Полное восстановление HP.' },
  { name: 'Психический крик', level: 9, school: 'Очарование', castTime: '1 действие', range: '90 футов', duration: 'Мгновенно', desc: 'До 10 целей. 14d6 урона психикой, DC INT. Ошеломление при провале.' },
  { name: 'Сфера неуязвимости', level: 6, school: 'Ограждение', castTime: '1 действие', range: 'На себя', duration: '1 минута (конц)', desc: 'Сфера 10-футового радиуса. Заклинания 5 уровня и ниже не проходят внутрь/наружу.' },
  { name: 'Магическая рука', level: 0, school: 'Вызов', castTime: '1 действие', range: '30 футов', duration: '1 минута', desc: 'Создаёт призрачную руку. Манипуляции до 10 фнт. Заговор.' },
  { name: 'Огненные ладони', level: 1, school: 'Воплощение', castTime: '1 действие', range: '15 футов', duration: 'Мгновенно', desc: 'Конус 15 футов. 3d6 урона огнём, DC DEX половина.' },
  { name: 'Туманный шаг', level: 2, school: 'Вызов', castTime: '1 бонусное действие', range: 'На себя', duration: 'Мгновенно', desc: 'Телепорт до 30 футов в видимую точку.' },
  { name: 'Ледяная буря', level: 4, school: 'Воплощение', castTime: '1 действие', range: '300 футов', duration: 'Мгновенно', desc: 'Цилиндр 20-футового радиуса. 2d8 дробящего + 4d6 холода. Труднопроходимая местность.' },
];

export function Compendium({ onSummon }: { onSummon: (m: Monster) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Monster | null>(null);
  const [tab, setTab] = useState<'monsters' | 'spells'>('monsters');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (tab === 'monsters') return MONSTERS.filter(m => m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q) || String(m.cr).includes(q));
    return SPELLS.filter(s => s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q) || String(s.level).includes(q));
  }, [search, tab]);

  const spellLevel = (l: number) => l === 0 ? 'Заговор' : `${l} уровень`;

  return (
    <div className="w-[300px] bg-[#0c0c12] border-l border-white/[0.05] flex flex-col shrink-0 h-full">
      <div className="h-11 px-3 flex items-center gap-2 border-b border-white/[0.05] shrink-0">
        <Skull size={14} className="text-red-400" />
        <span className="font-mono text-[11px] text-zinc-300 font-bold">Компендиум</span>
      </div>

      <div className="p-2 border-b border-white/[0.05]">
        <div className="flex rounded-lg overflow-hidden border border-white/[0.05] mb-2">
          <button onClick={() => setTab('monsters')} className={`flex-1 py-1 text-[9px] font-mono ${tab === 'monsters' ? 'bg-red-500/10 text-red-400' : 'text-zinc-500'}`}>👹 Монстры</button>
          <button onClick={() => setTab('spells')} className={`flex-1 py-1 text-[9px] font-mono ${tab === 'spells' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-500'}`}>✨ Заклинания</button>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск монстров..." className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg pl-7 pr-2.5 py-1.5 text-[10px] font-mono text-zinc-200 outline-none focus:border-violet-500/30" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'monsters' ? (filtered as Monster[]).map(m => (
          <div key={m.name} className={`px-3 py-2 border-b border-white/[0.02] cursor-pointer transition-colors ${selected?.name === m.name ? 'bg-violet-500/[0.06]' : 'hover:bg-white/[0.01]'}`}
            onClick={() => setSelected(selected?.name === m.name ? null : m)}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-zinc-300 flex-1">{m.name}</span>
              <span className="text-[8px] font-mono text-zinc-500">{m.type}</span>
              <span className="text-[8px] font-mono text-amber-400 font-bold">CR {m.cr}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[8px] font-mono text-zinc-500">
              <span><Heart size={7} className="inline text-red-400" /> {m.hp}</span>
              <span><Shield size={7} className="inline text-blue-400" /> {m.ac}</span>
              <span>{m.size}</span>
            </div>
            <AnimatePresence>
              {selected?.name === m.name && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="mt-2 pt-2 border-t border-white/[0.05] space-y-1.5">
                    <p className="text-[8px] text-zinc-500 font-mono">{m.stats}</p>
                    <p className="text-[8px] text-zinc-400 font-mono leading-relaxed">{m.actions}</p>
                    <button onClick={(e) => { e.stopPropagation(); onSummon(m); }}
                      className="w-full py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[9px] font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1">
                      <Plus size={10} /> Призвать на карту
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )) : (filtered as typeof SPELLS).map(s => (
          <div key={s.name} className="px-3 py-2 border-b border-white/[0.02] hover:bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-zinc-300 flex-1">{s.name}</span>
              <span className="text-[8px] font-mono text-blue-400">{spellLevel(s.level)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[7px] font-mono text-zinc-500">
              <span>{s.school}</span><span>·</span><span>{s.castTime}</span><span>·</span><span>{s.range}</span>
            </div>
            <p className="text-[8px] text-zinc-400 mt-1 leading-relaxed">{s.desc}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-[9px] text-zinc-700 text-center py-8 font-mono">Ничего не найдено</p>}
      </div>
    </div>
  );
}

export type { Monster };
