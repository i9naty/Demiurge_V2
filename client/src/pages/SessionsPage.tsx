import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { apiGet, apiPost, apiPatch } from '../utils/api';
import { Calendar, Clock, Users, ScrollText, Send, Plus, X, Check, User, MessageCircle, CheckCheck, XCircle } from 'lucide-react';

interface Session {
  id: string; title: string; description: string; master_id: string; master_name: string;
  scheduled_at: string; max_players: number; system: string; status: string;
  accepted_count: number; pending_count: number;
}
interface ChatMsg { id: string; user_id: string; username: string; content: string; created_at: string; }

export function SessionsPage() {
  const { user, token } = useStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [schedAt, setSchedAt] = useState('');
  const [maxPl, setMaxPl] = useState(4); const [system, setSystem] = useState('D&D 5e');
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [appsData, setAppsData] = useState<Record<string, any[]>>({});

  const loadSessions = () => {
    apiGet('/sessions').then((d) => { if (Array.isArray(d)) setSessions(d); }).catch(() => {});
    if (user && token) {
      apiGet('/sessions/my')
        .then((data) => {
          if (!Array.isArray(data)) return;
          setMySessions(data);
          data.forEach((s: Session) => {
            if (s.master_id === user.id) {
              apiGet(`/sessions/${s.id}/applications`)
                .then((apps) => {
                  if (Array.isArray(apps)) setAppsData((prev) => ({ ...prev, [s.id]: apps }));
                }).catch(() => {});
            }
          });
        }).catch(() => {});
    }
  };
  useEffect(() => { loadSessions(); const iv = setInterval(loadSessions, 10000); return () => clearInterval(iv); }, [user, token]);

  const list = activeTab === 'all' ? sessions : mySessions;

  const openChat = async (sessionId: string) => {
    if (activeChat === sessionId) { setActiveChat(null); setChatMsgs([]); return; }
    setActiveChat(sessionId);
    setChatMsgs([]);
    try {
      const data = await apiGet(`/sessions/${sessionId}/chat`);
      if (Array.isArray(data)) setChatMsgs(data);
    } catch {}
  };
  const sendChat = async () => {
    if (!chatInput.trim() || !activeChat || !token) return;
    try {
      const m = await apiPost(`/sessions/${activeChat}/chat`, { content: chatInput });
      setChatMsgs((prev) => [...prev, m]); setChatInput('');
    } catch {}
  };
  const handleCreate = async () => {
    if (!title || !schedAt || !token) return;
    try {
      const s = await apiPost('/sessions', { title, description: desc, scheduledAt: schedAt, maxPlayers: maxPl, system });
      setSessions((prev) => [s, ...prev]); setMySessions((prev) => [s, ...prev]); setShowCreate(false); setTitle(''); setDesc(''); setSchedAt(''); setMaxPl(4);
    } catch {}
  };
  const apply = async (sessionId: string) => {
    if (!token) return;
    try {
      await apiPost(`/sessions/${sessionId}/apply`, { message: 'Хочу участвовать!' });
      setApplied((prev) => new Set([...prev, sessionId]));
    } catch {}
  };
  const handleApplication = async (sessionId: string, appId: string, status: string) => {
    if (!token) return;
    try {
      await apiPatch(`/sessions/${sessionId}/applications/${appId}`, { status });
      loadSessions();
    } catch {}
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0d0d14]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-mono text-xl text-zinc-200 flex items-center gap-2"><Calendar size={22} className="text-violet-400" /> D&D Сессии</h1>
          {user && <button onClick={() => setShowCreate(true)} className="btn-primary text-xs py-2 px-4 flex items-center gap-1"><Plus size={14} />Создать</button>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a2e] mb-4">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 font-mono text-xs ${activeTab === 'all' ? 'text-violet-400 border-b-2 border-purple-500' : 'text-zinc-500'}`}>Все сессии</button>
          <button onClick={() => setActiveTab('my')} className={`px-4 py-2 font-mono text-xs ${activeTab === 'my' ? 'text-violet-400 border-b-2 border-purple-500' : 'text-zinc-500'}`}>Мои ({mySessions.length})</button>
        </div>

        {showCreate && (
          <div className="card p-4 mb-6 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Название сессии" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field resize-none" rows={2} placeholder="Описание" />
            <div className="flex gap-3">
              <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="input-field flex-1" />
              <input type="number" value={maxPl} onChange={(e) => setMaxPl(parseInt(e.target.value) || 4)} min={2} max={20} className="input-field w-20" placeholder="Игроки" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={!title || !schedAt} className="btn-primary text-xs py-2 px-6">Создать</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-sm text-zinc-200">{s.title}</h3>
                  {s.description && <p className="text-[11px] text-zinc-500 mt-1">{s.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1"><Clock size={11} />{new Date(s.scheduled_at).toLocaleString('ru-RU')}</span>
                    <span className="flex items-center gap-1"><Users size={11} />{s.accepted_count}/{s.max_players}</span>
                    <span className="flex items-center gap-1"><ScrollText size={11} />{s.system}</span>
                    <span>Мастер: <span className="text-violet-400">{s.master_name}</span></span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${s.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{s.status === 'open' ? 'Открыта' : s.status}</span>
                  {user && s.master_id !== user.id && s.status === 'open' && !applied.has(s.id) && (
                    <button onClick={() => apply(s.id)} className="text-[10px] font-mono text-violet-400 hover:underline">Подать заявку</button>
                  )}
                  {applied.has(s.id) && <span className="text-[10px] text-emerald-400 font-mono">✓ Заявка подана</span>}
                  <button onClick={() => openChat(s.id)} className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1"><MessageCircle size={11} />Чат</button>
                </div>
              </div>

              {/* Master panel */}
              {s.master_id === user?.id && activeTab === 'my' && appsData[s.id] && (
                <div className="mt-3 pt-3 border-t border-[#1a1a2e]">
                  <p className="font-mono text-[10px] text-zinc-500 mb-2">Заявки:</p>
                  {appsData[s.id].length === 0 ? <p className="text-[10px] text-zinc-600">Нет заявок</p> :
                    <div className="space-y-1">
                      {appsData[s.id].map((app: any) => (
                        <div key={app.id} className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="font-mono text-[10px] text-zinc-400">{app.username}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${app.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : app.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{app.status}</span>
                          {app.status === 'pending' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleApplication(s.id, app.id, 'accepted')} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"><CheckCheck size={12} /></button>
                              <button onClick={() => handleApplication(s.id, app.id, 'rejected')} className="p-1 rounded text-red-400 hover:bg-red-500/20"><XCircle size={12} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )}

              {/* Chat */}
              {activeChat === s.id && (
                <div className="mt-3 pt-3 border-t border-[#1a1a2e]">
                  <div className="space-y-2 max-h-[200px] overflow-y-auto mb-2">
                    {chatMsgs.map((m) => (
                      <div key={m.id}><span className="font-mono text-[10px] text-violet-400">{m.username}:</span> <span className="font-mono text-[10px] text-zinc-400">{m.content}</span></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} className="flex-1 bg-transparent border border-[#1a1a2e] rounded px-2 py-1 text-[11px] font-mono text-zinc-300 outline-none" placeholder="Сообщение..." />
                    <button onClick={sendChat} className="p-1.5 text-violet-400"><Send size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <p className="text-center text-zinc-600 font-mono text-sm py-8">Нет сессий</p>}
        </div>
      </div>
    </div>
  );
}
