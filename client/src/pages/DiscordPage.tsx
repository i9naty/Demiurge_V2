import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { apiGet, apiPost } from '../utils/api';
import { Hash, Volume2, Plus, X, User, Users, Settings, HashIcon, Mic, MicOff, Headphones, Phone, PhoneOff, Send, Copy, ChevronDown } from 'lucide-react';

interface Server { id: string; name: string; icon_url: string | null; owner_id: string; invite_code: string; member_count: number; }
interface Channel { id: string; server_id: string; name: string; type: string; position: number; }
interface Member { id: string; username: string; display_name: string | null; avatar_url: string | null; }
interface DMessage { id: string; channel_id: string; user_id: string; username: string; content: string; created_at: string; }

export function DiscordPage() {
  const { user, token, socket } = useStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<DMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [input, setInput] = useState('');
  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [serverName, setServerName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    apiGet('/discord/servers').then(setServers).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!activeServer || !token) return;
    apiGet(`/discord/servers/${activeServer.id}/channels`).then(setChannels).catch(() => {});
    apiGet(`/discord/servers/${activeServer.id}/members`).then(setMembers).catch(() => {});
    joinServerSocket(activeServer.id);
  }, [activeServer?.id, token]);

  useEffect(() => {
    if (!activeChannel || activeChannel.type !== 'text' || !token) return;
    apiGet(`/discord/channels/${activeChannel.id}/messages`).then(setMessages).catch(() => {});
    if (socket) {
      socket.emit('discord:join_channel', { serverId: activeServer?.id, channelId: activeChannel.id });
    }
  }, [activeChannel?.id, token]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const handler = (m: DMessage) => { if (m.channel_id === activeChannel?.id) setMessages((prev) => [...prev, m]); };
    socket.on('discord:message', handler);
    return () => { socket.off('discord:message', handler); };
  }, [socket, activeChannel?.id]);

  const joinServerSocket = (serverId: string) => {
    if (socket) socket.emit('discord:join_server', serverId);
  };
  const createServer = async () => {
    if (!serverName.trim() || !token) return;
    try {
      const s = await apiPost('/discord/servers', { name: serverName });
      setServers((prev) => [...prev, s]); setShowCreateServer(false); setServerName(''); setActiveServer(s);
    } catch {}
  };
  const joinServer = async () => {
    if (!inviteCode.trim() || !token) return;
    try {
      const s = await apiPost(`/discord/servers/join/${inviteCode.trim().toUpperCase()}`);
      setServers((prev) => [...prev, s]); setShowJoinServer(false); setInviteCode(''); setActiveServer(s);
    } catch {}
  };
  const createChannel = async () => {
    if (!channelName.trim() || !activeServer || !token) return;
    try {
      const ch = await apiPost(`/discord/servers/${activeServer.id}/channels`, { name: channelName, type: channelType });
      setChannels((prev) => [...prev, ch]); setShowCreateChannel(false); setChannelName('');
    } catch {}
  };
  const sendMessage = () => {
    if (!input.trim() || !activeChannel || !socket) return;
    socket.emit('discord:message', { channelId: activeChannel.id, content: input.trim() });
    setInput('');
  };
  const copyInvite = () => {
    if (activeServer) { navigator.clipboard.writeText(activeServer.invite_code); setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000); }
  };
  const toggleVoice = (channelId: string) => {
    if (voiceChannel === channelId) {
      if (socket) socket.emit('voice:leave', channelId);
      setVoiceChannel(null);
    } else {
      if (voiceChannel && socket) socket.emit('voice:leave', voiceChannel);
      if (socket) socket.emit('voice:join', { channelId, serverId: activeServer?.id });
      setVoiceChannel(channelId);
    }
  };

  return (
    <div className="h-full flex bg-[#0e0e14] text-zinc-300">
      {/* Server sidebar */}
      <div className="w-[60px] bg-[#0a0a0f] flex flex-col items-center py-3 gap-2 shrink-0 overflow-y-auto border-r border-[#1a1a2e]">
        {servers.map((s) => (
          <button key={s.id} onClick={() => setActiveServer(s.id === activeServer?.id ? null : s)} title={s.name}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono text-sm font-bold transition-all duration-200 ${
              activeServer?.id === s.id ? 'rounded-xl bg-purple-600 text-white' : 'bg-[#1a1a2e] text-zinc-400 hover:bg-purple-600 hover:text-white hover:rounded-xl'
            }`}>
            {s.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <div className="w-8 h-[2px] bg-[#1a1a2e] rounded" />
        <button onClick={() => setShowCreateServer(true)} className="w-11 h-11 rounded-2xl bg-[#1a1a2e] text-emerald-400 hover:bg-emerald-600 hover:text-white hover:rounded-xl transition-all flex items-center justify-center" title="Создать сервер">
          <Plus size={22} />
        </button>
        <button onClick={() => setShowJoinServer(true)} className="w-11 h-11 rounded-2xl bg-[#1a1a2e] text-violet-400 hover:bg-purple-600 hover:text-white hover:rounded-xl transition-all flex items-center justify-center" title="Войти на сервер">
          <ChevronDown size={22} />
        </button>
      </div>

      {/* Channel list */}
      {activeServer && (
        <div className="w-56 bg-[#0f0f16] flex flex-col shrink-0 border-r border-[#1a1a2e]">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1a1a2e] font-mono text-sm font-bold text-zinc-300 truncate">
            <span>{activeServer.name}</span>
            <div className="flex items-center gap-1">
              <button onClick={copyInvite} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300" title="Копировать код">
                <Copy size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <div className="px-3 py-1">
              <div className="flex items-center justify-between group">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Каналы</span>
                <button onClick={() => setShowCreateChannel(true)} className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100">
                  <Plus size={12} />
                </button>
              </div>
            </div>
            {channels.map((ch) => (
              <button key={ch.id}
                onClick={() => ch.type === 'text' ? setActiveChannel(ch) : toggleVoice(ch.id)}
                className={`w-full text-left px-2 py-1.5 flex items-center gap-2 font-mono text-[13px] transition-colors ${
                  activeChannel?.id === ch.id ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                }`}>
                {ch.type === 'voice' ? <Volume2 size={14} className={voiceChannel === ch.id ? 'text-emerald-400' : ''} /> : <Hash size={14} />}
                {ch.name}
                {voiceChannel === ch.id && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </div>
          {/* Voice panel */}
          {voiceChannel && (
            <div className="p-3 border-t border-[#1a1a2e] bg-[#0a0a0f]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1"><Volume2 size={12} />Голосовой</span>
                <button onClick={() => { if (socket) socket.emit('voice:leave', voiceChannel); setVoiceChannel(null); }} className="p-1 rounded text-red-400 hover:bg-red-500/20"><PhoneOff size={14} /></button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button className="p-1.5 rounded bg-[#1a1a2e] text-zinc-400 hover:text-zinc-200"><Mic size={14} /></button>
                <button className="p-1.5 rounded bg-[#1a1a2e] text-zinc-400 hover:text-zinc-200"><Headphones size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      {activeChannel ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 px-4 flex items-center border-b border-[#1a1a2e] bg-[#0f0f16] font-mono text-sm text-zinc-400 gap-2">
            <Hash size={16} className="text-zinc-500" />
            {activeChannel.name}
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3 py-1 hover:bg-white/[0.01] rounded">
                <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={15} className="text-violet-400" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold text-zinc-200">{m.username}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-[#0f0f16] border-t border-[#1a1a2e]">
            <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-3 py-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                placeholder={`Написать в #${activeChannel.name}`}
                className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono text-zinc-300 placeholder:text-zinc-600" />
              <button onClick={sendMessage} disabled={!input.trim()} className="text-violet-400 disabled:text-zinc-700"><Send size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#0e0e14]">
          <div className="text-center">
            <Hash size={48} className="text-zinc-800 mx-auto mb-4" />
            <p className="font-mono text-zinc-600">Выберите сервер и канал</p>
          </div>
        </div>
      )}

      {/* Member list */}
      {activeServer && (
        <div className="w-56 bg-[#0f0f16] border-l border-[#1a1a2e] shrink-0 hidden lg:flex flex-col">
          <div className="h-12 px-4 flex items-center border-b border-[#1a1a2e]">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Участники — {members.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {members.map((m) => (
              <div key={m.id} className="px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.02]">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center">
                    <User size={14} className="text-violet-400" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f0f16] bg-emerald-500" />
                </div>
                <span className="font-mono text-[12px] text-zinc-400">{m.display_name || m.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateServer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowCreateServer(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Создать сервер</h2>
            <input value={serverName} onChange={(e) => setServerName(e.target.value)} className="input-field mb-4" placeholder="Название сервера" autoFocus onKeyDown={(e) => e.key === 'Enter' && createServer()} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateServer(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button>
              <button onClick={createServer} disabled={!serverName.trim()} className="btn-primary text-xs py-2 px-4">Создать</button>
            </div>
          </div>
        </div>
      )}
      {showJoinServer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowJoinServer(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Войти на сервер</h2>
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="input-field mb-4 text-center tracking-widest" placeholder="Код приглашения" maxLength={8} onKeyDown={(e) => e.key === 'Enter' && joinServer()} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowJoinServer(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button>
              <button onClick={joinServer} disabled={inviteCode.length < 4} className="btn-primary text-xs py-2 px-4">Войти</button>
            </div>
          </div>
        </div>
      )}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowCreateChannel(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Создать канал</h2>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setChannelType('text')} className={`flex-1 p-2 rounded-lg font-mono text-xs border ${channelType === 'text' ? 'border-purple-500/50 bg-purple-600/10 text-violet-400' : 'border-[#1a1a2e] text-zinc-500'}`}><Hash size={14} className="inline mr-1" />Текст</button>
              <button onClick={() => setChannelType('voice')} className={`flex-1 p-2 rounded-lg font-mono text-xs border ${channelType === 'voice' ? 'border-emerald-500/50 bg-emerald-600/10 text-emerald-400' : 'border-[#1a1a2e] text-zinc-500'}`}><Volume2 size={14} className="inline mr-1" />Голос</button>
            </div>
            <input value={channelName} onChange={(e) => setChannelName(e.target.value)} className="input-field mb-4" placeholder="Название канала" onKeyDown={(e) => e.key === 'Enter' && createChannel()} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateChannel(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button>
              <button onClick={createChannel} disabled={!channelName.trim()} className="btn-primary text-xs py-2 px-4">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
