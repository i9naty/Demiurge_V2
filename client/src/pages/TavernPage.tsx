import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { VoiceService } from '../utils/voiceService';
import { VoicePanel } from '../components/vtt/VoicePanel';
import { GameFinder } from '../components/tavern/GameFinder';
import { EmojiPicker } from '../components/tavern/EmojiPicker';
import { Markdown } from '../components/ui/Markdown';
import { playMessagePing, playUserJoin, playUserLeave, playVoiceJoin } from '../utils/notifications';
import { Hash, Volume2, Plus, X, User, Copy, Send, Trash2, Edit2, Search, MessageCircle, ChevronRight, Smile, Swords, UserPlus, Shield } from 'lucide-react';

interface Server { id: string; name: string; icon_url: string | null; owner_id: string; invite_code: string; member_count: number; }
interface Channel { id: string; server_id: string; name: string; type: string; position: number; category_id?: string; topic?: string; }
interface Member { id: string; username: string; display_name: string | null; avatar_url: string | null; }
interface DMessage { id: string; channel_id: string; user_id: string; username: string; content: string; created_at: string; }
interface DMConv { id: string; username: string; display_name: string | null; last_message: string | null; last_at: string | null; unread: number; }
interface DMMsg { id: string; sender_id: string; sender_name: string; receiver_id: string; content: string; created_at: string; }

export function TavernPage() {
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
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, {emoji:string;cnt:number}[]>>({});
  const [serverName, setServerName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [inviteCode, setInviteCode] = useState('');
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editName, setEditName] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#8e9297');
  const [showInvite, setShowInvite] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dmRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'servers' | 'dm' | 'finder'>('servers');
  const [dmConvs, setDmConvs] = useState<DMConv[]>([]);
  const [activeDm, setActiveDm] = useState<DMConv | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMsg[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [dmSearchOpen, setDmSearchOpen] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState<any[]>([]);
  const [voiceParticipants, setVoiceParticipants] = useState<{userId:string;username:string;isSpeaking:boolean}[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(() => parseFloat(localStorage.getItem('demiurge_voice_volume') || '0.75'));
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const [typingUsers, setTypingUsers] = useState<{userId:string;username:string}[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push-to-Talk: Ctrl key
  useEffect(() => {
    if (!pushToTalk || !voiceChannel) return;
    const down = (e: KeyboardEvent) => { if (e.key === 'Control' && !e.repeat) voiceServiceRef.current?.setMuted(false); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Control') voiceServiceRef.current?.setMuted(true); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [pushToTalk, voiceChannel]);

  // Listen for server open events from GameFinder
  useEffect(() => {
    const handler = async (e: any) => {
      await loadServers();
      // servers state update is async, need to find from current state
      const fetched = await fetch('/api/discord/servers', { headers: { Authorization: `Bearer ${token}` } });
      const list = await fetched.json();
      if (Array.isArray(list)) {
        setServers(list);
        const svr = list.find((s: Server) => s.id === e.detail.serverId);
        if (svr) { setActiveServer(svr); setActiveTab('servers'); setActiveDm(null); setActiveChannel(null); }
      }
    };
    window.addEventListener('tavern:open_server', handler);
    return () => window.removeEventListener('tavern:open_server', handler);
  }, [token]);

  const loadServers = async () => {
    const r = await fetch('/api/discord/servers', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (Array.isArray(d)) setServers(d);
  };

  // Load servers
  useEffect(() => {
    if (!token) return;
    loadServers();
    fetch('/api/dm/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setDmConvs(d); }).catch(() => {});
  }, [token]);

  // Load channels + members when server selected
  useEffect(() => {
    if (!activeServer || !token) return;
    if (socket) { socket.emit('discord:join_server', activeServer.id); socket.emit('presence:online'); }
    fetch(`/api/discord/servers/${activeServer.id}/channels`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setChannels(d); }).catch(() => {});
    fetch(`/api/discord/servers/${activeServer.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setMembers(d); }).catch(() => {});
    if (socket) socket.emit('discord:join_server', activeServer.id);
    setActiveChannel(null);
    setMessages([]);
  }, [activeServer?.id, token]);

  // Load channel messages
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== 'text' || !token) return;
    setUnreadChannels(prev => { const next = new Set(prev); next.delete(activeChannel.id); return next; });
    fetch(`/api/discord/channels/${activeChannel.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setMessages(d); }).catch(() => {});
    if (socket) socket.emit('discord:join_channel', { serverId: activeServer?.id, channelId: activeChannel.id });
  }, [activeChannel?.id, token]);

  // Load DM messages
  useEffect(() => {
    if (!activeDm || !token) return;
    fetch(`/api/dm/${activeDm.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setDmMessages(d); }).catch(() => {});
    // Mark as active
    setActiveServer(null);
    setActiveChannel(null);
    if (socket) {
      if (voiceChannel) { socket.emit('voice:leave', voiceChannel); setVoiceChannel(null); }
    }
  }, [activeDm?.id, token]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    const onMsg = (m: DMessage) => {
      if (m.channel_id === activeChannel?.id) {
        setMessages((prev) => [...prev, m]);
        if (m.user_id !== user?.id) playMessagePing();
      } else {
        setUnreadChannels(prev => new Set(prev).add(m.channel_id));
      }
    };
    const onDm = (m: DMMsg) => {
      if (activeDm && (m.sender_id === activeDm.id || m.receiver_id === activeDm.id)) setDmMessages((prev) => [...prev, m]);
      fetch('/api/dm/conversations', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setDmConvs(d); }).catch(() => {});
    };
    socket.on('discord:message', onMsg);
    socket.on('dm:message', onDm);
    socket.on('typing:start', (d: any) => {
      if (d.channelId === activeChannel?.id) {
        setTypingUsers(prev => prev.find(p => p.userId === d.userId) ? prev : [...prev, { userId: d.userId, username: d.username }]);
      }
    });
    socket.on('typing:stop', (d: any) => {
      setTypingUsers(prev => prev.filter(p => p.userId !== d.userId));
    });
    socket.on('presence:online', (d: any) => {
      setOnlineUsers(prev => new Set(prev).add(d.userId));
    });
    return () => { socket.off('discord:message', onMsg); socket.off('dm:message', onDm); socket.off('typing:start'); socket.off('typing:stop'); socket.off('presence:online'); };
  }, [socket, activeChannel?.id, activeDm?.id, token]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);
  useEffect(() => { dmRef.current?.scrollTo(0, dmRef.current.scrollHeight); }, [dmMessages]);

  const sendMessage = () => {
    if (!input.trim() || !activeChannel || !socket) return;
    socket.emit('discord:message', { channelId: activeChannel.id, content: input.trim() });
    setInput('');
  };
  const sendDm = () => {
    if (!dmInput.trim() || !activeDm || !socket) return;
    socket.emit('dm:send', { to: activeDm.id, content: dmInput.trim() });
    setDmInput('');
  };
  const createServer = async () => {
    if (!serverName.trim() || !token) return;
    const res = await fetch('/api/discord/servers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: serverName }) });
    if (res.ok) { const s = await res.json(); setServers((prev) => [...prev, s]); setShowCreateServer(false); setServerName(''); setActiveServer(s); setActiveTab('servers'); }
  };
  const joinServer = async () => {
    if (!inviteCode.trim() || !token) return;
    const res = await fetch(`/api/discord/servers/join/${inviteCode.trim().toUpperCase()}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const s = await res.json(); setServers((prev) => [...prev, s]); setShowJoinServer(false); setInviteCode(''); setActiveServer(s); setActiveTab('servers'); }
  };
  const loadRoles = async (serverId: string) => {
    fetch(`/api/discord/servers/${serverId}/roles`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };
  const loadMessages = (channelId: string) => {
    if (!channelId || !token) return;
    fetch(`/api/discord/channels/${channelId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setMessages(d); }).catch(() => {});
  };
  const createChannel = async () => {
    if (!channelName.trim() || !activeServer || !token) return;
    const res = await fetch(`/api/discord/servers/${activeServer.id}/channels`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: channelName, type: channelType }) });
    if (res.ok) { const ch = await res.json(); setChannels((prev) => [...prev, ch]); setShowCreateChannel(false); setChannelName(''); }
  };
  const createCategory = async () => {
    if (!categoryName.trim() || !activeServer || !token) return;
    const res = await fetch(`/api/discord/servers/${activeServer.id}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: categoryName }) });
    if (res.ok) { const cat = await res.json(); setChannels((prev) => [...prev, cat]); setShowCreateCategory(false); setCategoryName(''); }
  };
  const deleteMessage = async (msgId: string) => {
    if (!token) return;
    await fetch(`/api/discord/messages/${msgId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };
  const editMessage = async () => {
    if (!editContent.trim() || !editingMessage || !token) return;
    await fetch(`/api/discord/messages/${editingMessage}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editContent }) });
    setMessages(prev => prev.map(m => m.id === editingMessage ? { ...m, content: editContent } : m));
    setEditingMessage(null); setEditContent('');
  };
  const addReaction = async (msgId: string, emoji: string) => {
    if (!token) return;
    const res = await fetch(`/api/discord/messages/${msgId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ emoji }) });
    if (res.ok) { const data = await res.json(); setMessageReactions(prev => ({ ...prev, [msgId]: data.reactions })); }
  };
  const loadReactions = async (msgId: string) => {
    if (!token || messageReactions[msgId]) return;
    const res = await fetch(`/api/discord/messages/${msgId}/reactions`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setMessageReactions(prev => ({ ...prev, [msgId]: data })); }
  };

  // Drag & drop channels
  const [dragChannel, setDragChannel] = useState<Channel | null>(null);
  const [dropZone, setDropZone] = useState<string | null>(null);

  const onDragStart = (ch: Channel) => {
    setDragChannel(ch);
  };
  const onDragEnd = () => {
    setDragChannel(null);
    setDropZone(null);
  };
  const onDragOver = (e: React.DragEvent, targetCategoryId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZone(targetCategoryId);
  };
  const onDrop = async (targetCategoryId: string | null) => {
    setDropZone(null);
    if (!dragChannel || !token || !activeServer) return;
    if (dragChannel.category_id === targetCategoryId) return; // no change

    const updated = [...channels];
    const idx = updated.findIndex(c => c.id === dragChannel.id);
    if (idx === -1) return;

    const targetChannels = updated.filter(c => c.category_id === targetCategoryId && c.type !== 'category');
    const newPosition = targetChannels.length;

    updated[idx] = { ...updated[idx], category_id: targetCategoryId || undefined, position: newPosition };
    setChannels(updated);

    await fetch(`/api/discord/channels/${dragChannel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: targetCategoryId || null, position: newPosition }),
    });
    setDragChannel(null);
  };
  const updateServer = async () => {
    if (!editingServer || !token) return;
    await fetch(`/api/discord/servers/${editingServer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editName }) });
    setServers((prev) => prev.map((s) => s.id === editingServer.id ? { ...s, name: editName } : s));
    if (activeServer?.id === editingServer.id) setActiveServer((prev) => prev ? { ...prev, name: editName } : null);
    setEditingServer(null);
  };
  const deleteServer = async (s: Server) => {
    if (!token || !confirm('Удалить сервер навсегда?')) return;
    await fetch(`/api/discord/servers/${s.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setServers((prev) => prev.filter((x) => x.id !== s.id));
    if (activeServer?.id === s.id) setActiveServer(null);
  };
  const updateChannel = async () => {
    if (!editingChannel || !token) return;
    await fetch(`/api/discord/channels/${editingChannel.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editName }) });
    setChannels((prev) => prev.map((c) => c.id === editingChannel.id ? { ...c, name: editName } : c));
    if (activeChannel?.id === editingChannel.id) setActiveChannel((prev) => prev ? { ...prev, name: editName } : null);
    setEditingChannel(null);
  };
  const deleteChannel = async (ch: Channel) => {
    if (!token || !confirm('Удалить канал?')) return;
    await fetch(`/api/discord/channels/${ch.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setChannels((prev) => prev.filter((c) => c.id !== ch.id));
    if (activeChannel?.id === ch.id) setActiveChannel(null);
  };

  const joinVoice = async (channel: Channel) => {
    if (!socket || !user || !activeServer) return;

    if (voiceChannel) {
      voiceServiceRef.current?.leaveChannel();
      socket.emit('voice:leave', voiceChannel);
      setVoiceChannel(null);
      setVoiceParticipants([]);
      if (voiceChannel === channel.id) return;
    }

    const vs = new VoiceService(socket, user.id);
    vs.setMuted(isMuted);
    vs.setDeafened(isDeafened);
    vs.setVolume(voiceVolume);
    vs.setCallbacks({
      onPeerJoined: (peer) => {
        setVoiceParticipants(prev => prev.find(p => p.userId === peer.userId) ? prev : [...prev, { userId: peer.userId, username: peer.username, isSpeaking: false }]);
      },
      onPeerLeft: (userId) => {
        setVoiceParticipants(prev => prev.filter(p => p.userId !== userId));
      },
      onSpeakingChange: (userId, speaking) => {
        setVoiceParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isSpeaking: speaking } : p));
      },
    });

    await vs.joinChannel(channel.id);
    voiceServiceRef.current = vs;
    setVoiceChannel(channel.id);
    socket.emit('voice:join', { channelId: channel.id, serverId: activeServer.id });

    // Get existing participants
    const onParticipants = (participants: any[]) => {
      if (Array.isArray(participants)) {
        vs.connectToPeers(participants);
        const vp = participants.map((p: any) => ({
          userId: p.userId,
          username: p.username,
          isSpeaking: false,
        }));
        if (!vp.find((p: any) => p.userId === user.id)) {
          vp.push({ userId: user.id, username: user.username || 'Вы', isSpeaking: false });
        }
        setVoiceParticipants(vp);
      }
    };
    socket.on('voice:participants', onParticipants);

    // New user joined
    const onUserJoined = (data: any) => {
      if (data.userId !== user?.id) playUserJoin();
      setVoiceParticipants(prev => {
        if (prev.find(p => p.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username, isSpeaking: false }];
      });
    };
    socket.on('voice:user_joined', onUserJoined);

    // User left
    const onUserLeft = (data: any) => {
      playUserLeave();
      setVoiceParticipants(prev => prev.filter(p => p.userId !== data.userId));
    };
    socket.on('voice:user_left', onUserLeft);

    // Speaking status from others
    socket.on('voice:speaking', (data: { userId: string; speaking: boolean }) => {
      setVoiceParticipants(prev => prev.map(p => p.userId === data.userId ? { ...p, isSpeaking: data.speaking } : p));
    });

    // Cleanup on leave
    const cleanup = () => {
      socket.off('voice:participants', onParticipants);
      socket.off('voice:user_joined', onUserJoined);
      socket.off('voice:user_left', onUserLeft);
      socket.off('voice:speaking');
    };
    (vs as any)._cleanup = cleanup;
  };

  const leaveVoice = () => {
    (voiceServiceRef.current as any)?._cleanup?.();
    voiceServiceRef.current?.leaveChannel();
    voiceServiceRef.current = null;
    if (socket && voiceChannel) socket.emit('voice:leave', voiceChannel);
    socket?.off('voice:speaking');
    socket?.off('voice:participants');
    socket?.off('voice:user_joined');
    socket?.off('voice:user_left');
    setVoiceChannel(null);
    setVoiceParticipants([]);
  };

  const togglePTT = () => {
    const ptt = !pushToTalk;
    setPushToTalk(ptt);
    if (ptt) { voiceServiceRef.current?.setMuted(true); setIsMuted(true); }
  };

  const toggleMute = () => {
    const muted = !isMuted;
    setIsMuted(muted);
    voiceServiceRef.current?.setMuted(muted);
  };

  const toggleDeafen = () => {
    const deafened = !isDeafened;
    setIsDeafened(deafened);
    voiceServiceRef.current?.setDeafened(deafened);
  };

  const changeVolume = (v: number) => {
    setVoiceVolume(v);
    voiceServiceRef.current?.setVolume(v);
  };

  const searchDmUsers = (q: string) => {
    setDmSearchQuery(q);
    if (q.length < 2) { setDmSearchResults([]); return; }
    fetch(`/api/dm/search/${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setDmSearchResults).catch(() => {});
  };
  const openDm = (conv: DMConv) => { setActiveDm(conv); setActiveTab('dm'); setActiveServer(null); };
  const startDmChat = (u: any) => {
    const conv: DMConv = { id: u.id, username: u.username, display_name: u.display_name, last_message: null, last_at: null, unread: 0 };
    setDmConvs((prev) => prev.find((c) => c.id === u.id) ? prev : [...prev, conv]);
    setDmSearchOpen(false);
    openDm(conv);
  };

  return (
    <div className="h-full flex bg-[#0e0e14] text-zinc-300">
      {/* Server sidebar + DM sidebar */}
      <div className="w-[60px] bg-[#0a0a0f] flex flex-col items-center py-3 gap-1.5 shrink-0 overflow-y-auto border-r border-[#1a1a2e]">
        {/* Home / DM button */}
        <button onClick={() => { setActiveServer(null); setActiveChannel(null); setActiveDm(null); setActiveTab('dm'); }} title="Личные сообщения"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            activeTab === 'dm' && !activeServer ? 'rounded-xl bg-purple-600 text-white' : 'bg-[#1a1a2e] text-zinc-400 hover:bg-purple-600 hover:text-white hover:rounded-xl'
          }`}>
          <MessageCircle size={22} />
        </button>
        <button onClick={() => { setActiveServer(null); setActiveChannel(null); setActiveDm(null); setActiveTab('finder'); }} title="Поиск игр"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            activeTab === 'finder' ? 'rounded-xl bg-amber-600 text-white' : 'bg-[#1a1a2e] text-zinc-400 hover:bg-amber-600 hover:text-white hover:rounded-xl'
          }`}>
          <Swords size={22} />
        </button>
        <div className="w-8 h-[2px] bg-[#1a1a2e] rounded" />
        {servers.map((s) => (
          <button key={s.id} onClick={() => { setActiveServer(s.id === activeServer?.id ? null : s); setActiveTab('servers'); setActiveDm(null); }} title={s.name}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono text-sm font-bold transition-all duration-200 ${
              activeServer?.id === s.id ? 'rounded-xl bg-purple-600 text-white' : 'bg-[#1a1a2e] text-zinc-400 hover:bg-purple-600 hover:text-white hover:rounded-xl'
            }`}>
            {s.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button onClick={() => setShowCreateServer(true)} className="w-11 h-11 rounded-2xl bg-[#1a1a2e] text-emerald-400 hover:bg-emerald-600 hover:text-white hover:rounded-xl transition-all flex items-center justify-center">
          <Plus size={22} />
        </button>
        <button onClick={() => setShowJoinServer(true)} className="w-11 h-11 rounded-2xl bg-[#1a1a2e] text-violet-400 hover:bg-purple-600 hover:text-white hover:rounded-xl transition-all flex items-center justify-center">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* DM list (when in DM mode, no active server) */}
      {activeTab === 'dm' && !activeServer && (
        <div className="w-64 bg-[#0f0f16] flex flex-col shrink-0 border-r border-[#1a1a2e]">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1a1a2e]">
            <span className="font-mono text-sm font-bold text-zinc-300">Сообщения</span>
            <button onClick={() => setDmSearchOpen(true)} className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300"><Search size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {dmConvs.map((c) => (
              <button key={c.id} onClick={() => openDm(c)}
                className={`w-full text-left p-2.5 flex items-center gap-3 hover:bg-white/[0.03] ${activeDm?.id === c.id ? 'bg-white/[0.05] border-l-2 border-l-purple-500' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center shrink-0"><User size={15} className="text-violet-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-300 truncate">{c.display_name || c.username}</span>
                    {c.last_at && <span className="text-[9px] text-zinc-600">{new Date(c.last_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">{c.last_message || 'Нет сообщений'}</p>
                </div>
                {c.unread > 0 && <span className="bg-red-500 text-white text-[9px] font-mono rounded-full w-4 h-4 flex items-center justify-center shrink-0">{c.unread}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channel list */}
      {activeServer && (
        <div className="w-60 bg-[#0f0f16] flex flex-col shrink-0 border-r border-[#1a1a2e]">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1a1a2e] font-mono text-sm font-bold text-zinc-300 truncate group">
            <span>{activeServer.name}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditingServer(activeServer); setEditName(activeServer.name); }} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300"><Edit2 size={12} /></button>
              <button onClick={() => setShowInvite(true)} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-emerald-400" title="Пригласить"><UserPlus size={12} /></button>
              <button onClick={() => setShowCreateRole(true)} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-amber-400" title="Создать роль"><Shield size={12} /></button>
              {activeServer.owner_id === user?.id && <button onClick={() => deleteServer(activeServer)} className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"><Trash2 size={12} /></button>}
            </div>
          </div>
          {copiedInvite && <div className="bg-purple-600/20 text-violet-400 text-[10px] font-mono text-center py-1 border-b border-purple-500/20">Код скопирован!</div>}
            <div className="flex-1 overflow-y-auto py-2">
              <div className="px-3 py-1 flex items-center justify-between group">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Каналы</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setShowCreateChannel(true); setChannelType('text'); }} className="p-0.5 rounded text-zinc-600 hover:text-zinc-300"><Plus size={12} /></button>
                  <button onClick={() => setShowCreateCategory(true)} className="p-0.5 rounded text-zinc-600 hover:text-zinc-300" title="Категория"><span className="text-[10px] font-bold">📁</span></button>
                </div>
              </div>
              {channels.filter(c => c.type !== 'category' && !c.category_id).map((ch) => (
                <div key={ch.id} className="group relative"
                  draggable
                  onDragStart={() => onDragStart(ch)}
                  onDragEnd={onDragEnd}
                >
                  <button onClick={() => ch.type === 'text' ? (setActiveChannel(ch), setActiveDm(null)) : joinVoice(ch)}
                    className={`w-full text-left pl-2 pr-2 py-1.5 flex items-center gap-2 font-mono text-[13px] transition-colors ${
                      activeChannel?.id === ch.id ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                    } ${dragChannel?.id === ch.id ? 'opacity-50' : ''}`}>
                    {ch.type === 'voice' ? <Volume2 size={14} className={voiceChannel === ch.id ? 'text-emerald-400' : ''} /> : <Hash size={14} />}
                    {ch.name}
                    {voiceChannel === ch.id && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                  </button>
                  {activeServer.owner_id === user?.id && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingChannel(ch); setEditName(ch.name); }} className="p-0.5 rounded hover:bg-white/10 text-zinc-600 hover:text-zinc-300"><Edit2 size={10} /></button>
                      <button onClick={() => deleteChannel(ch)} className="p-0.5 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400"><X size={10} /></button>
                    </div>
                  )}
                </div>
              ))}
              {/* Drop zone: no category */}
              <div
                onDragOver={(e) => onDragOver(e, null)}
                onDrop={() => onDrop(null)}
                onDragLeave={() => setDropZone(null)}
                className={`text-[10px] font-mono text-zinc-600 text-center py-1 transition-colors ${dropZone === null && dragChannel ? 'bg-purple-600/10 border border-dashed border-purple-500/30 rounded mx-1' : ''}`}
              >
                {dropZone === null && dragChannel ? 'Отпустите сюда' : ''}
              </div>
              {channels.filter(c => c.type === 'category').sort((a, b) => a.position - b.position).map((cat) => (
                <div key={cat.id}>
                  <div className="px-2 py-1.5 flex items-center gap-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    <ChevronRight size={10} className="text-zinc-600" /> {cat.name}
                  </div>
                  {channels.filter(c => c.category_id === cat.id && c.type !== 'category').map((ch) => (
                    <div key={ch.id} className="group relative"
                      draggable
                      onDragStart={() => onDragStart(ch)}
                      onDragEnd={onDragEnd}
                    >
                      <button onClick={() => ch.type === 'text' ? (setActiveChannel(ch), setActiveDm(null)) : joinVoice(ch)}
                        className={`w-full text-left pl-4 pr-2 py-1.5 flex items-center gap-2 font-mono text-[13px] transition-colors ${
                          activeChannel?.id === ch.id ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                        } ${dragChannel?.id === ch.id ? 'opacity-50' : ''}`}>
                        {ch.type === 'voice' ? <Volume2 size={14} className={voiceChannel === ch.id ? 'text-emerald-400' : ''} /> : <Hash size={14} />}
                        {ch.name}
                        {voiceChannel === ch.id && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                      </button>
                      {activeServer.owner_id === user?.id && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingChannel(ch); setEditName(ch.name); }} className="p-0.5 rounded hover:bg-white/10 text-zinc-600 hover:text-zinc-300"><Edit2 size={10} /></button>
                          <button onClick={() => deleteChannel(ch)} className="p-0.5 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400"><X size={10} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Drop zone: inside this category */}
                  <div
                    onDragOver={(e) => onDragOver(e, cat.id)}
                    onDrop={() => onDrop(cat.id)}
                    onDragLeave={() => setDropZone(null)}
                    className={`text-[10px] font-mono text-zinc-600 text-center py-1 transition-colors ${dropZone === cat.id && dragChannel ? 'bg-purple-600/10 border border-dashed border-purple-500/30 rounded mx-1' : ''}`}
                  >
                    {dropZone === cat.id && dragChannel ? 'Отпустите здесь' : ''}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      {activeTab === 'finder' ? (
        <GameFinder />
      ) : activeChannel ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 px-4 flex items-center border-b border-[#1a1a2e] bg-[#0f0f16] font-mono text-sm text-zinc-400 gap-2">
            <Hash size={16} className="text-zinc-500" /> {activeChannel.name}
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3 py-1 hover:bg-white/[0.01] group"
                onMouseEnter={() => loadReactions(m.id)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msgId: m.id, channelId: activeChannel.id }); }}>
                <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5"><User size={15} className="text-violet-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold text-zinc-200">{m.username}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {editingMessage === m.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input value={editContent} onChange={e => setEditContent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') editMessage(); if (e.key === 'Escape') setEditingMessage(null); }}
                        className="flex-1 bg-[#1a1a2e] border border-purple-500/30 rounded px-2 py-1 text-[13px] font-mono text-zinc-200 outline-none" autoFocus />
                      <button onClick={editMessage} className="text-xs text-violet-400">Сохранить</button>
                      <button onClick={() => setEditingMessage(null)} className="text-xs text-zinc-500">Esc</button>
                    </div>
                  ) : (
                    <p className="text-[13px] text-zinc-400 leading-relaxed"><Markdown text={m.content} /></p>
                  )}
                  {/* Reactions */}
                  {messageReactions[m.id]?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {messageReactions[m.id].map((r, i) => (
                        <button key={i} onClick={() => addReaction(m.id, r.emoji)}
                          className="text-[10px] bg-[#1a1a2e] hover:bg-purple-600/20 border border-[#252540] hover:border-purple-500/30 rounded px-1.5 py-0.5 transition-colors">
                          {r.emoji} {r.cnt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Hover actions */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 self-center transition-opacity">
                  {['👍','❤️','😂','😮','😢','🔥'].map(emoji => (
                    <button key={emoji} onClick={() => addReaction(m.id, emoji)} className="text-xs hover:scale-125 transition-transform">{emoji}</button>
                  ))}
                  {m.user_id === user?.id && (
                    <>
                      <button onClick={() => { setEditingMessage(m.id); setEditContent(m.content); }} className="text-[10px] text-zinc-600 hover:text-zinc-300 ml-1"><Edit2 size={10} /></button>
                      <button onClick={() => deleteMessage(m.id)} className="text-[10px] text-zinc-600 hover:text-red-400"><X size={10} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {typingUsers.length > 0 && (
              <p className="text-[9px] font-mono text-zinc-600 italic px-4 pb-0.5">
                {typingUsers.map(u => u.username).join(', ')} печатает...
              </p>
            )}
          </div>
          <div className="p-3 bg-[#0f0f16] border-t border-[#1a1a2e] relative">
            <AnimatePresence>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={emoji => { setInput(prev => prev + emoji); inputRef.current?.focus(); }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </AnimatePresence>
            <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-3 py-2">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-zinc-500 hover:text-zinc-300">
                <Smile size={16} />
              </button>
              <input ref={inputRef} value={input} onChange={(e) => {
                setInput(e.target.value);
                if (socket && activeChannel) {
                  if (!typingTimeout.current) socket.emit('typing:start', { channelId: activeChannel.id });
                  if (typingTimeout.current !== null) clearTimeout(typingTimeout.current);
                  typingTimeout.current = setTimeout(() => {
                    if (socket && activeChannel) socket.emit('typing:stop', { channelId: activeChannel.id });
                    typingTimeout.current = null;
                  }, 3000);
                }
              }} onKeyDown={(e) => { if (e.key === 'Enter') { sendMessage(); if (socket && activeChannel) socket.emit('typing:stop', { channelId: activeChannel.id }); } }}
                placeholder={`Написать в #${activeChannel.name}`} className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono text-zinc-300 placeholder:text-zinc-600" />
              <button onClick={sendMessage} disabled={!input.trim()} className="text-violet-400 disabled:text-zinc-700"><Send size={16} /></button>
            </div>
          </div>
        </div>
      ) : activeDm ? (
        /* DM Chat */
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 px-4 flex items-center border-b border-[#1a1a2e] bg-[#0f0f16] font-mono text-sm text-zinc-300 gap-2">
            <User size={16} className="text-violet-400" /> {activeDm.display_name || activeDm.username}
            <button onClick={() => setActiveDm(null)} className="ml-auto p-1 rounded hover:bg-white/5 text-zinc-500"><X size={14} /></button>
          </div>
          <div ref={dmRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {dmMessages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-xl px-3 py-2 ${m.sender_id === user?.id ? 'bg-purple-600/20 border border-purple-500/20' : 'bg-[#1a1a2e] border border-[#252540]'}`}>
                  <p className="text-[12px] font-mono text-zinc-300 leading-relaxed"><Markdown text={m.content} /></p>
                  <p className="text-[8px] text-zinc-600 mt-1 text-right">{new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-[#0f0f16] border-t border-[#1a1a2e]">
            <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-3 py-2">
              <input value={dmInput} onChange={(e) => setDmInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendDm(); }}
                placeholder={`Личное сообщение`} className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono text-zinc-300 placeholder:text-zinc-600" />
              <button onClick={sendDm} disabled={!dmInput.trim()} className="text-violet-400 disabled:text-zinc-700"><Send size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#0e0e14]">
          <div className="text-center bg-[#111118] border border-[#1a1a2e] rounded-2xl p-8 max-w-sm">
            <MessageCircle size={48} className="text-purple-500/50 mx-auto mb-4" />
            <p className="font-mono text-zinc-200 text-lg font-bold mb-1">Добро пожаловать в Таверну</p>
            <p className="font-mono text-zinc-400 text-sm">Выберите сервер или диалог слева</p>
            <button onClick={() => setShowCreateServer(true)} className="btn-primary text-xs py-2 px-4 mt-4 mx-auto inline-flex items-center gap-1">
              <Plus size={12} /> Создать сервер
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      {activeServer && (
        <div className="w-56 bg-[#0f0f16] border-l border-[#1a1a2e] shrink-0 hidden lg:flex flex-col">
          <div className="h-12 px-4 flex items-center border-b border-[#1a1a2e]"><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Участники — {members.length}</span></div>
          <div className="flex-1 overflow-y-auto py-2">
            {members.map((m) => (
              <div key={m.id} className="px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/[0.02] group cursor-pointer" onClick={() => { const c = { id: m.id, username: m.username, display_name: m.display_name, last_message: null, last_at: null, unread: 0 }; setDmConvs((prev) => prev.find((x) => x.id === m.id) ? prev : [...prev, { ...c, id: m.id }]); openDm(c); }}>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center"><User size={14} className="text-violet-400" /></div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f0f16] ${onlineUsers.has(m.id) ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                </div>
                <span className="font-mono text-[12px] text-zinc-400 group-hover:text-zinc-200 truncate">{m.display_name || m.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Panel */}
      {voiceChannel && activeServer && (
        <VoicePanel
          channelName={channels.find(c => c.id === voiceChannel)?.name || 'Голосовой'}
          participants={voiceParticipants}
          myUserId={user?.id || ''}
          isMuted={isMuted}
          isDeafened={isDeafened}
          pushToTalk={pushToTalk}
          volume={voiceVolume}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onVolumeChange={changeVolume}
          onTogglePTT={togglePTT}
          onLeave={leaveVoice}
        />
      )}

      {/* Modals */}
      {showCreateServer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowCreateServer(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Создать сервер</h2>
            <input value={serverName} onChange={(e) => setServerName(e.target.value)} className="input-field mb-4" placeholder="Название сервера" autoFocus onKeyDown={(e) => e.key === 'Enter' && createServer()} />
            <div className="flex gap-2 justify-end"><button onClick={() => setShowCreateServer(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button><button onClick={createServer} disabled={!serverName.trim()} className="btn-primary text-xs py-2 px-4">Создать</button></div>
          </div>
        </div>
      )}
      {showJoinServer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowJoinServer(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Войти на сервер</h2>
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="input-field mb-4 text-center tracking-widest" placeholder="Код приглашения" maxLength={8} onKeyDown={(e) => e.key === 'Enter' && joinServer()} />
            <div className="flex gap-2 justify-end"><button onClick={() => setShowJoinServer(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button><button onClick={joinServer} disabled={inviteCode.length < 4} className="btn-primary text-xs py-2 px-4">Войти</button></div>
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
            <div className="flex gap-2 justify-end"><button onClick={() => setShowCreateChannel(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button><button onClick={createChannel} disabled={!channelName.trim()} className="btn-primary text-xs py-2 px-4">Создать</button></div>
          </div>
        </div>
      )}
      {showCreateCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowCreateCategory(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Создать категорию</h2>
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="input-field mb-4" placeholder="Название категории" onKeyDown={(e) => e.key === 'Enter' && createCategory()} />
            <div className="flex gap-2 justify-end"><button onClick={() => setShowCreateCategory(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button><button onClick={createCategory} disabled={!categoryName.trim()} className="btn-primary text-xs py-2 px-4">Создать</button></div>
          </div>
        </div>
      )}
      {editingServer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setEditingServer(null)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Настройки сервера</h2>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field mb-4" onKeyDown={(e) => e.key === 'Enter' && updateServer()} />
            <div className="flex gap-2 justify-end"><button onClick={() => setEditingServer(null)} className="btn-secondary text-xs py-2 px-4">Отмена</button><button onClick={updateServer} className="btn-primary text-xs py-2 px-4">Сохранить</button></div>
          </div>
        </div>
      )}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setEditingChannel(null)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-lg text-zinc-200 mb-4">Переименовать канал</h2>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field mb-4" onKeyDown={(e) => e.key === 'Enter' && updateChannel()} />
            <div className="flex gap-2 justify-end"><button onClick={() => setEditingChannel(null)} className="btn-secondary text-xs py-2 px-4">Отмена</button><button onClick={updateChannel} className="btn-primary text-xs py-2 px-4">Сохранить</button></div>
          </div>
        </div>
      )}
      {dmSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-20" onClick={() => setDmSearchOpen(false)}>
          <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-xl p-4 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><Search size={16} className="text-zinc-500" /><input type="text" value={dmSearchQuery} onChange={(e) => searchDmUsers(e.target.value)} placeholder="Поиск пользователей..." className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-zinc-300 placeholder:text-zinc-600" autoFocus /></div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {dmSearchResults.map((u) => (
                <button key={u.id} onClick={() => startDmChat(u)} className="w-full text-left p-2.5 rounded-lg hover:bg-white/[0.05] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center"><User size={14} className="text-violet-400" /></div>
                  <div><p className="font-mono text-xs text-zinc-300">{u.display_name || u.username}</p><p className="text-[10px] text-zinc-600">@{u.username}</p></div>
                </button>
              ))}
              {dmSearchQuery.length >= 2 && dmSearchResults.length === 0 && <p className="text-[10px] text-zinc-600 text-center py-3">Никого не найдено</p>}
            </div>
          </div>
        </div>
      )}
      {/* ===== NEW MODALS ===== */}
      <AnimatePresence>
        {showCreateRole && activeServer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCreateRole(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#0f0f16] border border-white/[0.06] rounded-2xl p-6 w-[380px]" onClick={e => e.stopPropagation()}>
              <h2 className="font-mono text-lg text-zinc-200 mb-4">Создать роль</h2>
              <input value={roleName} onChange={e => setRoleName(e.target.value)}
                className="input-field mb-3" placeholder="Название роли" />
              <div className="mb-4">
                <label className="text-[9px] font-mono text-zinc-500 block mb-1">Цвет</label>
                <input type="color" value={roleColor} onChange={e => setRoleColor(e.target.value)} className="w-12 h-8 rounded cursor-pointer" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreateRole(false)} className="btn-secondary text-xs py-2 px-4">Отмена</button>
                <button onClick={async () => {
                  if (!roleName.trim() || !activeServer) return;
                  await fetch(`/api/discord/servers/${activeServer.id}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: roleName, color: roleColor }) });
                  setShowCreateRole(false); setRoleName(''); loadRoles(activeServer.id);
                }} disabled={!roleName.trim()} className="btn-primary text-xs py-2 px-4">Создать</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showInvite && activeServer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowInvite(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#0f0f16] border border-white/[0.06] rounded-2xl p-6 w-[380px]" onClick={e => e.stopPropagation()}>
              <h2 className="font-mono text-lg text-zinc-200 mb-4">Пригласить на сервер</h2>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-center mb-4">
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-violet-400">{activeServer.invite_code}</span>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowInvite(false)} className="btn-secondary text-xs py-2 px-4">Закрыть</button>
                <button onClick={() => {
                  navigator.clipboard.writeText(activeServer.invite_code);
                  setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000);
                }} className="btn-primary text-xs py-2 px-4">{copiedInvite ? 'Скопировано' : 'Копировать код'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {contextMenu && (
          <div className="fixed z-[100] bg-[#18181b] border border-white/[0.08] rounded-xl shadow-2xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={() => setContextMenu(null)}>
            <button onClick={async () => {
              if (!contextMenu) return;
              await fetch(`/api/discord/messages/${contextMenu.msgId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
              loadMessages(contextMenu.channelId);
              setContextMenu(null);
            }} className="w-full text-left px-4 py-2 text-xs font-mono text-red-400 hover:bg-red-500/10 transition-colors">
              Удалить сообщение
            </button>
            <button onClick={() => setContextMenu(null)} className="w-full text-left px-4 py-2 text-xs font-mono text-zinc-400 hover:bg-white/[0.05] transition-colors">
              Отмена
            </button>
          </div>
        )}
      </AnimatePresence>
      {/* Click-to-dismiss context menu */}
      {contextMenu && <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} />}
    </div>
  );
}
