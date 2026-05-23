import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Users, Plus, MessageCircle, X, Clock,
  Sparkles, Send, Check, User, Loader2, Link2,
} from 'lucide-react';

interface Session {
  id: string; master_id: string; title: string; description: string;
  scheduled_at: string; max_players: number; system: string; status: string;
  master_name: string; master_avatar: string; accepted_count: number; pending_count: number;
  discord_server_id?: string;
}

interface ChatMsg { id: string; session_id: string; user_id: string; username: string; content: string; created_at: string; }

export function GameFinder() {
  const { user, token } = useStore();
  const [tab, setTab] = useState<'all' | 'my'>('all');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [appsData, setAppsData] = useState<Record<string, any[]>>({});
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [schedAt, setSchedAt] = useState('');
  const [maxPl, setMaxPl] = useState(4);
  const [system, setSystem] = useState('D&D 5e');
  const [error, setError] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const hdrs = { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' as const };

  const load = () => {
    fetch('/api/sessions').then(r => r.json()).then(d => { if (Array.isArray(d)) setSessions(d); }).catch(() => {});
    if (user && token) {
      fetch('/api/sessions/my', { headers: hdrs }).then(r => r.json()).then(d => {
        if (!Array.isArray(d)) return;
        setMySessions(d);
        d.forEach((s: Session) => {
          if (s.master_id === user.id) {
            fetch(`/api/sessions/${s.id}/applications`, { headers: hdrs })
              .then(r => r.json()).then(apps => { if (Array.isArray(apps)) setAppsData(prev => ({ ...prev, [s.id]: apps })); }).catch(() => {});
          }
        });
      }).catch(() => {});
    }
  };

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [user, token]);

  const list = tab === 'all' ? sessions : mySessions;

  const handleCreate = async () => {
    if (!title || !schedAt || !token) return;
    const res = await fetch('/api/sessions', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ title, description: desc, scheduledAt: schedAt, maxPlayers: maxPl, system }),
    });
    if (res.ok) { setShowCreate(false); setTitle(''); setDesc(''); setSchedAt(''); load(); }
    else { const e = await res.json(); setError(e.error || 'Ошибка'); }
  };

  const applyToSession = async (sessionId: string) => {
    if (!token) return;
    setApplyingId(sessionId);
    const res = await fetch(`/api/sessions/${sessionId}/apply`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ message: 'Хочу участвовать!' }),
    });
    if (res.ok) {
      setAppliedIds(prev => new Set(prev).add(sessionId));
      load();
    }
    setApplyingId(null);
  };

  const openChat = async (sessionId: string) => {
    if (activeChat === sessionId) { setActiveChat(null); setChatMsgs([]); return; }
    setActiveChat(sessionId); setChatMsgs([]);
    const res = await fetch(`/api/sessions/${sessionId}/chat`);
    if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setChatMsgs(d); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !activeChat || !token) return;
    const res = await fetch(`/api/sessions/${activeChat}/chat`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ content: chatInput }),
    });
    if (res.ok) { const m = await res.json(); setChatMsgs(prev => [...prev, m]); setChatInput(''); }
  };

  const openServer = (serverId?: string) => {
    if (!serverId) return;
    window.dispatchEvent(new CustomEvent('tavern:open_server', { detail: { serverId } }));
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e14]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-[#1a1a2e] bg-[#0f0f16] gap-3 shrink-0">
        <Swords size={16} className="text-amber-400" />
        <h2 className="font-mono text-sm text-zinc-300">Поиск игр</h2>
        <div className="flex-1" />
        <div className="flex rounded-lg overflow-hidden border border-[#1a1a2e]">
          <button onClick={() => setTab('all')} className={`px-3 py-1 text-[10px] font-mono ${tab === 'all' ? 'bg-purple-600/20 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`}>Все</button>
          <button onClick={() => setTab('my')} className={`px-3 py-1 text-[10px] font-mono ${tab === 'my' ? 'bg-purple-600/20 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`}>Мои</button>
        </div>
        {user && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/15 text-violet-400 font-mono text-[10px] hover:bg-purple-600/25 transition-colors">
            <Plus size={12} /> Создать
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Swords size={32} className="text-zinc-800 mx-auto mb-2" />
              <p className="font-mono text-xs text-zinc-600">{tab === 'all' ? 'Нет активных сессий' : 'У вас нет сессий'}</p>
              {tab === 'all' && user && (
                <button onClick={() => setShowCreate(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-purple-600/15 text-violet-400 font-mono text-[10px] hover:bg-purple-600/25 transition-colors">
                  Создать сессию
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {list.map(s => {
              const schedDate = new Date(s.scheduled_at);
              const now = new Date();
              const diff = schedDate.getTime() - now.getTime();
              const daysLeft = Math.max(0, Math.ceil(diff / 86400000));
              const hoursLeft = Math.max(0, Math.floor((diff % 86400000) / 3600000));
              const isSoon = diff > 0 && diff < 86400000;
              const isPast = diff < 0;
              const hasApplied = appliedIds.has(s.id);
              const isMaster = s.master_id === user?.id;

              return (
              <div key={s.id} className={`bg-[#0f0f16] border rounded-xl p-4 transition-all ${
                isSoon ? 'border-amber-500/30' : isPast ? 'border-[#1a1a2e] opacity-60' : 'border-[#1a1a2e] hover:border-zinc-700'
              }`}>
                {/* Timer banner */}
                {!isPast && (
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-[10px] font-mono ${
                    isSoon ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-purple-600/5 text-violet-400 border border-purple-500/10'
                  }`}>
                    <Clock size={12} />
                    {isSoon ? (
                      <span>⚡ Через {hoursLeft}ч {Math.floor((diff % 3600000) / 60000)}м</span>
                    ) : (
                      <span>Через {daysLeft}д {hoursLeft}ч</span>
                    )}
                    <span className="ml-auto text-zinc-500">{schedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {isPast && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-zinc-800/20 text-zinc-500 text-[10px] font-mono border border-[#1a1a2e]">
                    <Clock size={12} /> Завершена {schedDate.toLocaleDateString('ru-RU')}
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-mono text-sm font-bold text-zinc-200 truncate">🎲 {s.title}</h3>
                    <p className="font-mono text-[10px] text-zinc-500 mt-0.5">{s.system}</p>
                    {s.description && <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">{s.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1"><Users size={10} />{s.accepted_count}/{s.max_players} игроков</span>
                      {s.status === 'full' && <span className="text-[9px] font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Заполнена</span>}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 shrink-0 ml-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                      <Swords size={14} className="text-amber-400" />
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-zinc-400">{s.master_name}</p>
                      <p className="font-mono text-[9px] text-zinc-600">👑 Мастер</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1a1a2e] flex-wrap">
                  {s.status === 'open' && !isMaster && (
                    <button onClick={() => applyToSession(s.id)} disabled={applyingId === s.id || hasApplied}
                      className={`text-[10px] font-mono font-bold py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all ${
                        hasApplied
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-default'
                          : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20 disabled:opacity-50'
                      }`}>
                      {applyingId === s.id ? <Loader2 size={10} className="animate-spin" /> :
                       hasApplied ? <Check size={10} /> : <Send size={10} />}
                      {hasApplied ? 'Заявка отправлена' : 'Откликнуться'}
                    </button>
                  )}
                  {s.status === 'full' && hasApplied && <span className="text-[10px] font-mono text-zinc-500">Группа набрана</span>}
                  {s.status === 'open' && isMaster && (
                    <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">👑 Вы мастер</span>
                  )}
                  <button onClick={() => openChat(s.id)} className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                    activeChat === s.id ? 'bg-purple-600/20 border-purple-500/30 text-violet-400' : 'border-[#1a1a2e] text-zinc-500 hover:border-zinc-600'
                  }`}>
                    <MessageCircle size={10} /> Чат
                  </button>
                  {s.discord_server_id && (
                    <button onClick={() => openServer(s.discord_server_id)}
                      className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.1] transition-colors flex items-center gap-1">
                      <Link2 size={10} /> Сервер
                    </button>
                  )}
                </div>

                {/* Applications for master */}
                {(() => {
                  const apps = appsData[s.id];
                  if (!isMaster || !apps || apps.length === 0) return null;
                  return (
                  <div className="mt-3 pt-3 border-t border-[#1a1a2e]">
                    <p className="text-[9px] font-mono text-zinc-500 mb-2">Заявки ({apps.length}):</p>
                    {apps.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                        <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center"><User size={10} className="text-violet-400" /></div>
                        <span className="text-[10px] font-mono text-zinc-300">{a.username}</span>
                        <span className="text-[9px] text-zinc-600 flex-1 truncate">{a.message}</span>
                        {a.status === 'pending' ? (
                          <div className="flex gap-1.5">
                            <button onClick={async () => {
                              await fetch(`/api/sessions/${s.id}/applications/${a.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ status: 'accepted' }) });
                              load();
                            }} className="text-[11px] text-emerald-400 hover:bg-emerald-500/10 px-2 py-1 rounded-lg font-bold">✓</button>
                            <button onClick={async () => {
                              await fetch(`/api/sessions/${s.id}/applications/${a.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ status: 'rejected' }) });
                              load();
                            }} className="text-[11px] text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-lg font-bold">✕</button>
                          </div>
                        ) : (
                          <span className={`text-[8px] font-mono px-2 py-0.5 rounded ${
                            a.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>{a.status === 'accepted' ? 'Принят' : 'Отклонён'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Session chat panel */}
      <AnimatePresence>
        {activeChat && (
          <motion.div initial={{ height: 0 }} animate={{ height: 260 }} exit={{ height: 0 }}
            className="border-t border-[#1a1a2e] bg-[#0f0f16] flex flex-col shrink-0 overflow-hidden">
            <div className="h-8 px-3 flex items-center justify-between border-b border-[#1a1a2e]">
              <span className="font-mono text-[10px] text-zinc-400">Чат сессии</span>
              <button onClick={() => { setActiveChat(null); setChatMsgs([]); }} className="text-zinc-600 hover:text-zinc-400"><X size={12} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chatMsgs.map(m => (
                <div key={m.id} className="text-[10px]">
                  <span className="font-mono text-zinc-500 mr-1">{m.username}:</span>
                  <span className="text-zinc-400">{m.content}</span>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-[#1a1a2e] flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                className="flex-1 bg-[#1a1a2e] rounded px-2 py-1 text-[11px] font-mono text-zinc-300 outline-none" placeholder="Сообщение..." />
              <button onClick={sendChat} className="text-violet-400 hover:text-violet-300"><Send size={12} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create session modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#0f0f16] border border-white/[0.06] rounded-2xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
              <h2 className="font-mono text-lg text-zinc-200 mb-4 flex items-center gap-2"><Sparkles size={18} className="text-violet-400" /> Новая сессия</h2>
              {error && <p className="text-[10px] text-red-400 mb-3 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
              <input value={title} onChange={e => setTitle(e.target.value)} className="input-field mb-3" placeholder="Название" />
              <textarea value={desc} onChange={e => setDesc(e.target.value)} className="input-field mb-3 h-20 resize-none" placeholder="Описание" />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[9px] font-mono text-zinc-500 block mb-1">Дата и время</label>
                  <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-zinc-500 block mb-1">Система</label>
                  <select value={system} onChange={e => setSystem(e.target.value)} className="input-field">
                    {['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Cyberpunk RED', 'Vampire', 'Other'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[9px] font-mono text-zinc-500 block mb-1">Макс. игроков</label>
                <input type="number" min={1} max={10} value={maxPl} onChange={e => setMaxPl(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))} className="input-field w-20" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button>
                <button onClick={handleCreate} className="btn-primary text-xs py-2 px-4">Создать</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
