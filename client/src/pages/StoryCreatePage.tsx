import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { apiGet, apiPost } from '../utils/api';
import {
  Sparkles, Swords, Skull, Zap, Trees, Mountain, Building2, Ghost, Moon,
  ArrowRight, ArrowLeft, Loader2, Users, Copy, Check, Heart, Shield,
  UserPlus, Play, Clock, Eye, Lock, Globe, AlertTriangle, Save, BookOpen,
  ChevronRight, Gamepad2,
} from 'lucide-react';

const GENRES = [
  { id: 'fantasy', label: 'Фэнтези', icon: Swords, desc: 'Магия, драконы, королевства', color: '#f59e0b', available: true },
  { id: 'scifi', label: 'Сай-фай', icon: Zap, desc: 'Космос, технологии, будущее', color: '#06b6d4', available: false },
  { id: 'horror', label: 'Хоррор', icon: Ghost, desc: 'Тайны, ужас, выживание', color: '#7c3aed', available: false },
  { id: 'cyberpunk', label: 'Киберпанк', icon: Moon, desc: 'Мегаполисы, хакеры, корпорации', color: '#ec4899', available: false },
];

const SETTINGS = [
  { id: 'forest', label: 'Древний лес', icon: Trees, desc: 'Эльфийские руины, магия природы', color: '#4ade80' },
  { id: 'dungeon', label: 'Подземелье', icon: Skull, desc: 'Тёмные коридоры, сокровища, ловушки', color: '#a78bfa' },
  { id: 'castle', label: 'Замок', icon: Building2, desc: 'Интриги, рыцари, королевские тайны', color: '#38bdf8' },
  { id: 'mountains', label: 'Горы', icon: Mountain, desc: 'Драконьи пики, гномы, шахты', color: '#fb923c' },
];

const DIFFICULTIES = [
  { id: 'easy', label: 'Лёгкая', desc: 'Подсказки, щадящие враги', color: '#4ade80', emoji: '🌱' },
  { id: 'normal', label: 'Нормальная', desc: 'Сбалансированные испытания', color: '#f59e0b', emoji: '⚔️' },
  { id: 'hard', label: 'Опасность', desc: 'Без подсказок, сильные враги', color: '#ef4444', emoji: '💀' },
];

const RACES = [
  { id: 'human', label: 'Человек', emoji: '🧑', bonus: '+1 ко всем' },
  { id: 'elf', label: 'Эльф', emoji: '🧝', bonus: '+2 ловкость' },
  { id: 'dwarf', label: 'Дворф', emoji: '🏔️', bonus: '+2 выносливость' },
  { id: 'orc', label: 'Орк', emoji: '👹', bonus: '+2 сила' },
  { id: 'mage', label: 'Маг', emoji: '🧙', bonus: '+2 интеллект' },
];

const CLASSES = [
  { id: 'warrior', label: 'Воин', emoji: '⚔️', hp: 24, ac: 14, desc: 'Ближний бой, высокая защита' },
  { id: 'rogue', label: 'Плут', emoji: '🗡️', hp: 18, ac: 12, desc: 'Скрытность, ловушки, криты' },
  { id: 'mage', label: 'Маг', emoji: '🔮', hp: 14, ac: 10, desc: 'Заклинания, контроль, урон' },
  { id: 'ranger', label: 'Следопыт', emoji: '🏹', hp: 20, ac: 12, desc: 'Дальний бой, природа, звери' },
  { id: 'cleric', label: 'Жрец', emoji: '✨', hp: 18, ac: 13, desc: 'Лечение, баффы, светлая магия' },
];

interface Participant {
  user_id: string; username: string; avatar_url: string | null;
  character_data: any; role: string; is_online: boolean;
}

interface SavedGame {
  id: string; save_name: string; world_state: any; story_state: any;
  settings: any; created_at: string; session_id: string;
}

export function StoryCreatePage() {
  const { user, token, socket } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [genre, setGenre] = useState('fantasy');
  const [setting, setSetting] = useState('forest');
  const [difficulty, setDifficulty] = useState('normal');
  const [playTime, setPlayTime] = useState(60);
  const [nsfw, setNsfw] = useState(false);
  const [storyPrompt, setStoryPrompt] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [charName, setCharName] = useState('');
  const [charRace, setCharRace] = useState('human');
  const [charClass, setCharClass] = useState('warrior');
  const [charPrompt, setCharPrompt] = useState('');
  const [charRole, setCharRole] = useState<'player' | 'observer'>('player');
  const [sessionId, setSessionId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saves, setSaves] = useState<SavedGame[]>([]);
  const [showSaves, setShowSaves] = useState(false);
  const [loadingSave, setLoadingSave] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    socket.on('lobby:participants', setParticipants);
    return () => { socket.off('lobby:participants'); };
  }, [socket]);

  const handleCreate = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const data = await apiPost('/game/create', { genre, setting, difficulty, playTime, nsfw, storyPrompt, isPublic });
      setSessionId(data.id);
      setInviteCode(data.code);
      setIsOwner(true);
      if (socket) {
        socket.emit('lobby:join', data.id);
        socket.emit('lobby:update', {
          sessionId: data.id,
          characterData: { name: charName || user?.username, race: charRace, class: charClass, prompt: charPrompt },
        });
      }
      setStep(4);
    } catch {}
    setCreating(false);
  };

  const handleJoin = async (code: string) => {
    if (!code.trim() || !token) return;
    try {
      const data = await apiPost(`/game/join/${code.trim().toUpperCase()}`);
      setSessionId(data.id);
      if (socket) {
        socket.emit('lobby:join', data.id);
        socket.emit('lobby:update', {
          sessionId: data.id,
          characterData: { name: charName || user?.username, race: charRace, class: charClass, prompt: charPrompt },
        });
      }
      setStep(4);
    } catch {}
  };

  const updateCharacter = () => {
    if (!socket || !sessionId) return;
    socket.emit('lobby:update', {
      sessionId,
      characterData: { name: charName || user?.username, race: charRace, class: charClass, prompt: charPrompt },
      role: charRole,
    });
  };

  const startGame = () => {
    if (!socket || !sessionId) return;
    socket.emit('game:start', { sessionId });
    navigate(`/story/${sessionId}`);
  };

  const loadSavedGames = async () => {
    if (!token) return;
    try {
      const saves = await apiGet('/game/saves');
      setSaves(saves);
    } catch {}
  };

  const loadGame = async (save: SavedGame) => {
    if (!token) return;
    setLoadingSave(save.id);
    try {
      const data = await apiPost('/game/load', { saveId: save.id });
      navigate(`/story/${data.sessionId}`);
    } catch {}
    setLoadingSave(null);
  };

  // Card variants for consistent styling
  const cardClass = "bg-white/[0.02] border border-white/[0.05] rounded-2xl";
  const cardActive = "border-purple-500/30 bg-purple-600/[0.06]";

  if (!token) return (
    <div className="h-full flex items-center justify-center bg-[#06060c]">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-purple-500/20">
          <Gamepad2 size={24} className="text-white" />
        </div>
        <p className="font-mono text-sm text-zinc-400">Войдите, чтобы создать игру</p>
        <button onClick={() => navigate('/login')} className="mt-4 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-mono text-xs hover:bg-purple-500 transition-colors">
          Войти
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#06060c] overflow-y-auto">
      <div className="flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-700 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-purple-500/30">
              <Sparkles size={28} className="text-white" />
            </motion.div>
            <h1 className="font-mono text-2xl font-bold text-zinc-100">Живая история</h1>
            <p className="font-mono text-xs text-zinc-500 mt-1">Приключение с нейросетевым Мастером</p>
          </div>

          {/* Step indicators */}
          {step < 4 && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {['Жанр', 'Сеттинг', 'Настройки', 'Персонаж'].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-[10px] transition-all ${
                    step === i ? 'bg-purple-600 text-white scale-110 shadow-lg shadow-purple-500/30' :
                    step > i ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.03] text-zinc-600'
                  }`}>
                    {step > i ? <Check size={14} /> : i + 1}
                  </div>
                  <span className={`font-mono text-[9px] hidden sm:block ${step >= i ? 'text-zinc-400' : 'text-zinc-700'}`}>{s}</span>
                  {i < 3 && <div className={`w-10 h-px ${step > i ? 'bg-emerald-500/30' : 'bg-white/[0.04]'}`} />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 0: Genre */}
            {step === 0 && (
              <motion.div key="genre" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-mono text-lg text-zinc-200 text-center mb-5">Выберите жанр</h2>
                <div className="grid grid-cols-2 gap-3">
                  {GENRES.map(g => (
                    <button key={g.id} onClick={() => g.available && setGenre(g.id)}
                      className={`p-5 rounded-2xl text-left transition-all relative overflow-hidden ${
                        !g.available ? 'opacity-30 cursor-not-allowed' :
                        genre === g.id ? cardActive + ' shadow-lg shadow-purple-500/10' : cardClass + ' hover:border-white/[0.1]'
                      }`}>
                      {!g.available && (
                        <span className="absolute top-3 right-3 text-[8px] font-mono bg-white/[0.04] text-zinc-500 px-2 py-1 rounded-lg">
                          В разработке
                        </span>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: g.color + '15' }}>
                          <g.icon size={20} style={{ color: g.available ? g.color : '#52525b' }} />
                        </div>
                        <span className={`font-mono font-bold ${g.available ? 'text-zinc-200' : 'text-zinc-600'}`}>
                          {g.label}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-zinc-500">{g.desc}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 1: Setting */}
            {step === 1 && (
              <motion.div key="setting" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-mono text-lg text-zinc-200 text-center mb-5">Выберите сеттинг</h2>
                <div className="grid grid-cols-2 gap-3">
                  {SETTINGS.map(s => (
                    <button key={s.id} onClick={() => setSetting(s.id)}
                      className={`p-5 rounded-2xl text-left transition-all ${
                        setting === s.id ? cardActive + ' shadow-lg shadow-emerald-500/10' : cardClass + ' hover:border-white/[0.1]'
                      }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                          <s.icon size={20} style={{ color: s.color }} />
                        </div>
                        <span className="font-mono font-bold text-zinc-200">{s.label}</span>
                      </div>
                      <p className="font-mono text-[10px] text-zinc-500">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Settings */}
            {step === 2 && (
              <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <h2 className="font-mono text-lg text-zinc-200 text-center">Настройки игры</h2>

                {/* Difficulty */}
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Сложность</p>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map(d => (
                      <button key={d.id} onClick={() => setDifficulty(d.id)}
                        className={`flex-1 p-4 rounded-2xl text-center transition-all ${
                          difficulty === d.id ? cardActive : cardClass + ' hover:border-white/[0.1]'
                        }`}>
                        <span className="text-xl">{d.emoji}</span>
                        <p className="font-mono text-sm font-bold text-zinc-200 mt-1">{d.label}</p>
                        <p className="font-mono text-[9px] text-zinc-500 mt-0.5">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Play Time */}
                <div className={`p-4 ${cardClass}`}>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock size={10} /> Время игры: <span className="text-zinc-300 font-bold">~{playTime >= 60 ? `${Math.floor(playTime/60)}ч ${playTime%60}м` : `${playTime}м`}</span>
                  </p>
                  <input type="range" min={20} max={600} step={10} value={playTime}
                    onChange={e => setPlayTime(parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 rounded-full appearance-none bg-white/[0.06] cursor-pointer" />
                  <div className="flex justify-between text-[8px] font-mono text-zinc-600 mt-1.5">
                    <span>20м</span><span>1ч</span><span>3ч</span><span>10ч</span>
                  </div>
                </div>

                {/* NSFW + Privacy */}
                <div className="flex gap-3">
                  <button onClick={() => setNsfw(!nsfw)}
                    className={`flex-1 p-4 rounded-2xl font-mono text-sm font-bold border transition-all text-center ${
                      nsfw ? 'border-red-500/30 bg-red-500/[0.06] text-red-400' : cardClass + ' text-zinc-500 hover:border-white/[0.1]'
                    }`}>
                    {nsfw ? '🔞 NSFW Вкл' : '🔒 NSFW Выкл'}
                    <p className="font-mono text-[8px] mt-1 font-normal opacity-70">{nsfw ? 'Взрослая лексика' : 'Без мата'}</p>
                  </button>
                  <button onClick={() => setIsPublic(!isPublic)}
                    className={`flex-1 p-4 rounded-2xl font-mono text-sm font-bold border transition-all text-center ${
                      isPublic ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : cardClass + ' text-zinc-500 hover:border-white/[0.1]'
                    }`}>
                    {isPublic ? <Globe size={14} className="inline mr-1" /> : <Lock size={14} className="inline mr-1" />}
                    {isPublic ? 'Публичная' : 'Приватная'}
                    <p className="font-mono text-[8px] mt-1 font-normal opacity-70">
                      {isPublic ? 'Видна в ленте' : 'Только по коду'}
                    </p>
                  </button>
                </div>

                {/* Story Prompt */}
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                    Пожелания к истории <span className="text-zinc-600">({storyPrompt.length}/500)</span>
                  </p>
                  <textarea value={storyPrompt} onChange={e => setStoryPrompt(e.target.value.slice(0, 500))}
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3.5 text-sm font-mono text-zinc-200 outline-none focus:border-purple-500/40 h-24 resize-none placeholder:text-zinc-700 transition-colors"
                    placeholder="Например: Герои должны найти древний артефакт в заброшенном храме, но на пути встанет древнее зло..." />
                </div>
              </motion.div>
            )}

            {/* STEP 3: Character */}
            {step === 3 && (
              <motion.div key="char" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <h2 className="font-mono text-lg text-zinc-200 text-center">Ваш персонаж</h2>

                <input value={charName} onChange={e => setCharName(e.target.value)}
                  placeholder={user?.username || 'Имя героя'}
                  className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3 text-sm font-mono text-zinc-200 outline-none focus:border-purple-500/40 placeholder:text-zinc-700 transition-colors" />

                {/* Race */}
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Раса</p>
                  <div className="flex gap-2 flex-wrap">
                    {RACES.map(r => (
                      <button key={r.id} onClick={() => setCharRace(r.id)}
                        className={`px-4 py-2.5 rounded-xl border font-mono text-xs transition-all ${
                          charRace === r.id ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300' : 'border-white/[0.05] text-zinc-500 hover:border-white/[0.1]'
                        }`}>
                        {r.emoji} {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Class */}
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Класс</p>
                  <div className="space-y-2">
                    {CLASSES.map(c => (
                      <button key={c.id} onClick={() => setCharClass(c.id)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                          charClass === c.id ? 'border-purple-500/30 bg-purple-600/[0.06]' : cardClass + ' hover:border-white/[0.1]'
                        }`}>
                        <span className="text-2xl">{c.emoji}</span>
                        <div className="flex-1">
                          <p className="font-mono text-sm font-bold text-zinc-200">{c.label}</p>
                          <p className="font-mono text-[9px] text-zinc-500">{c.desc}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Heart size={10} className="text-red-400" />
                            <span className="font-mono text-[10px] text-zinc-300">{c.hp}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Shield size={10} className="text-violet-400" />
                            <span className="font-mono text-[10px] text-zinc-300">{c.ac}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Character prompt */}
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                    Описание персонажа <span className="text-zinc-600">({charPrompt.length}/300)</span>
                  </p>
                  <textarea value={charPrompt} onChange={e => setCharPrompt(e.target.value.slice(0, 300))}
                    className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3 text-sm font-mono text-zinc-200 outline-none focus:border-purple-500/40 h-20 resize-none placeholder:text-zinc-700 transition-colors"
                    placeholder="Характер, внешность, история вашего героя..." />
                </div>
              </motion.div>
            )}

            {/* STEP 4: Lobby */}
            {step === 4 && (
              <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <Users size={28} className="text-emerald-400" />
                  </div>
                  <h2 className="font-mono text-lg text-zinc-200">Лобби</h2>
                  <p className="font-mono text-[10px] text-zinc-500 mt-1">Пригласите друзей или начните игру</p>
                </div>

                {/* Invite Code */}
                <div className={`p-4 ${cardClass}`}>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Код приглашения</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-center">
                      <span className="font-mono text-2xl font-bold tracking-[0.3em] text-purple-400">{inviteCode}</span>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="p-3.5 rounded-xl bg-purple-600/20 border border-purple-500/20 text-purple-400 hover:bg-purple-600/30 transition-colors">
                      {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                  <p className="font-mono text-[8px] text-zinc-600 mt-2 text-center">{copied ? 'Скопировано!' : 'Отправьте код друзьям'}</p>
                </div>

                {/* Invite Link */}
                <div className={`p-4 ${cardClass}`}>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Ссылка для приглашения</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={`${window.location.origin}/story?join=${inviteCode}`}
                      className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs font-mono text-zinc-400 outline-none" />
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/story?join=${inviteCode}`); }}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
                    Участники ({participants.filter(p => p.role !== 'observer').length} игроков, {participants.filter(p => p.role === 'observer').length} зрителей)
                  </p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {participants.map(p => (
                      <motion.div key={p.user_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        className={`border rounded-xl p-3 flex items-center gap-3 transition-all ${
                          p.is_online ? 'border-white/[0.05] bg-white/[0.01]' : 'border-white/[0.02] bg-transparent opacity-40'
                        }`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          p.role === 'owner' ? 'bg-amber-500/[0.12]' : p.role === 'observer' ? 'bg-zinc-500/[0.08]' : 'bg-purple-500/[0.08]'
                        }`}>
                          {p.avatar_url
                            ? <img src={p.avatar_url} className="w-full h-full rounded-xl object-cover" />
                            : <span className="font-mono text-[10px] text-purple-400">
                                {p.username?.slice(0, 2).toUpperCase()}
                              </span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-mono text-xs text-zinc-300 truncate">
                              {(p.character_data || {}).name || p.username}
                            </p>
                            {!p.is_online && <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" title="Офлайн" />}
                          </div>
                          <p className="font-mono text-[9px] text-zinc-500">
                            {['human', 'elf', 'dwarf', 'orc', 'mage'].includes((p.character_data || {}).race?.toLowerCase())
                              ? RACES.find(r => r.id === (p.character_data || {}).race?.toLowerCase())?.emoji + ' ' : ''}
                            {(p.character_data || {}).race || '?'} · {(p.character_data || {}).class || '?'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.role === 'owner' && <span className="text-[8px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">👑 Владелец</span>}
                            {p.role === 'observer' && <span className="text-[8px] font-mono text-zinc-500 bg-zinc-500/10 px-1.5 py-0.5 rounded">👁 Наблюдатель</span>}
                          </div>
                        </div>
                        {p.user_id === user?.id && !isOwner && (
                          <button onClick={() => { setCharRole(charRole === 'player' ? 'observer' : 'player'); updateCharacter(); }}
                            className={`text-[8px] px-2.5 py-1 rounded-lg font-mono border transition-colors ${
                              charRole === 'player' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.04]' : 'border-zinc-600 text-zinc-500'
                            }`}>
                            {charRole === 'player' ? '⚔️ Играть' : '👁 Смотреть'}
                          </button>
                        )}
                      </motion.div>
                    ))}
                    {participants.length === 0 && (
                      <p className="text-[10px] text-zinc-600 text-center py-6 font-mono">Ожидание игроков...</p>
                    )}
                  </div>
                </div>

                {/* Character config in lobby */}
                {user && step === 4 && !isOwner && (
                  <div className={`p-4 ${cardClass} space-y-3`}>
                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">Настройка персонажа</p>
                    <input value={charName} onChange={e => { setCharName(e.target.value); }} onBlur={updateCharacter}
                      placeholder={user?.username || 'Имя'} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm font-mono text-zinc-200 outline-none focus:border-purple-500/30" />
                    <div className="flex gap-2">
                      <select value={charRace} onChange={e => { setCharRace(e.target.value); updateCharacter(); }}
                        className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-200 outline-none focus:border-purple-500/30">
                        {RACES.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
                      </select>
                      <select value={charClass} onChange={e => { setCharClass(e.target.value); updateCharacter(); }}
                        className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-200 outline-none focus:border-purple-500/30">
                        {CLASSES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Saved Games Button */}
                <div className={`p-4 ${cardClass}`}>
                  <button onClick={() => { setShowSaves(!showSaves); loadSavedGames(); }}
                    className="w-full flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors">
                    <Save size={12} />
                    {showSaves ? 'Скрыть сохранения' : 'Загрузить сохранение'}
                    <ChevronRight size={12} className={`ml-auto transition-transform ${showSaves ? 'rotate-90' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showSaves && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="mt-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                          {saves.length === 0 && (
                            <p className="text-[10px] text-zinc-600 text-center py-3 font-mono">Нет сохранений</p>
                          )}
                          {saves.map(s => (
                            <button key={s.id} onClick={() => loadGame(s)} disabled={loadingSave === s.id}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors text-left disabled:opacity-50">
                              <BookOpen size={14} className="text-purple-400 shrink-0" />
                              <div className="flex-1">
                                <p className="font-mono text-[11px] text-zinc-300">{s.save_name}</p>
                                <p className="font-mono text-[8px] text-zinc-600">{new Date(s.created_at).toLocaleDateString('ru')}</p>
                              </div>
                              {loadingSave === s.id ? <Loader2 size={12} className="animate-spin text-zinc-500" /> : <ArrowRight size={12} className="text-zinc-600" />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Start Button */}
                {isOwner && (
                  <motion.button onClick={startGame} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-2xl font-mono text-sm font-bold bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-700 text-white flex items-center justify-center gap-2 shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow">
                    <Play size={18} /> Начать игру
                  </motion.button>
                )}

                {/* Join by code */}
                <JoinSection onJoin={handleJoin} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-8">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl font-mono text-sm border border-white/[0.05] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.1] disabled:opacity-20 transition-all">
                <ArrowLeft size={14} /> Назад
              </button>
              <button onClick={() => step < 2 ? setStep(step + 1) : handleCreate()} disabled={creating}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm font-bold bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 shadow-lg shadow-purple-500/20 transition-all">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {creating ? 'Создаём...' : step < 2 ? 'Далее' : 'Создать лобби'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JoinSection({ onJoin }: { onJoin: (code: string) => void }) {
  const [code, setCode] = useState('');
  const searchParams = new URLSearchParams(window.location.search);
  const joinParam = searchParams.get('join');

  useEffect(() => {
    if (joinParam) { setCode(joinParam); onJoin(joinParam); }
  }, [joinParam]);

  return (
    <div className="border-t border-white/[0.05] pt-5">
      <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Присоединиться по коду</p>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8}
          placeholder="XXXXXXXX" onKeyDown={e => e.key === 'Enter' && onJoin(code)}
          className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 text-center font-mono text-sm tracking-[0.2em] text-zinc-200 uppercase outline-none focus:border-purple-500/40 placeholder:text-zinc-700 transition-colors" />
        <button onClick={() => onJoin(code)} disabled={code.length < 4}
          className="px-5 py-3 rounded-xl font-mono text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-30 transition-colors">
          Войти
        </button>
      </div>
    </div>
  );
}
