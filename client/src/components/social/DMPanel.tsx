import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { User, Search, Send, X, MessageCircle, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface Conversation {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_at: string | null;
  unread: number;
}

interface DMMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export function DMPanel() {
  const { user, token, socket } = useStore();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/dm/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setConversations(d); }).catch(() => {});
    fetch('/api/dm/unread/count', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d: any) => setUnreadTotal(d.count || 0)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!activeChat || !token) return;
    fetch(`/api/dm/${activeChat.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setMessages(d); }).catch(() => {});
  }, [activeChat?.id, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: DMMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (token) {
        fetch('/api/dm/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setConversations(d); }).catch(() => {});
      }
    };
    socket.on('dm:message', handler);
    return () => { socket.off('dm:message', handler); };
  }, [socket, token, user?.id]);

  const isOnTavern = location.pathname === '/discord';

  const sendMessage = () => {
    if (!input.trim() || !activeChat || !socket) return;
    socket.emit('dm:send', { to: activeChat.id, content: input.trim() });
    setInput('');
  };

  const openChat = (conv: Conversation) => {
    setActiveChat(conv);
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const searchUsers = (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    fetch(`/api/dm/search/${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).then(setSearchResults).catch(() => {});
  };

  const startChat = (u: any) => {
    const conv: Conversation = { id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url, last_message: null, last_at: null, unread: 0 };
    setConversations((prev) => prev.find((c) => c.id === u.id) ? prev : [...prev, conv]);
    setSearchOpen(false);
    setSearchQuery('');
    openChat(conv);
  };

  return (
    <>
      {/* DM Toggle Button */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setExpanded(!expanded)}
          className="relative p-3 rounded-xl bg-[#111118] border border-[#1a1a2e] text-zinc-400 hover:text-zinc-200 hover:border-purple-500/30 transition-all shadow-lg"
        >
          <MessageCircle size={20} />
          {unreadTotal > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-mono rounded-full w-5 h-5 flex items-center justify-center">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </button>
      </div>

      {/* DM Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ x: -380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            className="fixed left-0 top-0 bottom-0 w-[340px] bg-[#0d0d14] border-r border-[#1a1a2e] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="h-11 bg-[#111118] border-b border-[#1a1a2e] flex items-center px-3 justify-between shrink-0">
              <span className="font-mono text-[11px] text-zinc-400">Сообщения</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                  <Search size={14} />
                </button>
                <button onClick={() => setExpanded(false)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-mono text-xs text-zinc-600">Нет диалогов</p>
                  <button onClick={() => setSearchOpen(true)} className="mt-2 text-[10px] font-mono text-violet-400 hover:underline">
                    Найти собеседника
                  </button>
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openChat(c)}
                    className={`w-full text-left p-3 border-b border-[#1a1a2e]/50 hover:bg-white/[0.03] transition-colors flex items-center gap-3 ${
                      activeChat?.id === c.id ? 'bg-purple-600/10 border-l-2 border-l-purple-500' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                      <User size={16} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-zinc-300 truncate">
                          {c.display_name || c.username}
                        </span>
                        {c.last_at && (
                          <span className="text-[9px] text-zinc-600 font-mono">
                            {new Date(c.last_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                        {c.last_message || 'Нет сообщений'}
                      </p>
                    </div>
                    {c.unread > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-mono rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Chat window (opens when a conversation is active) */}
      <AnimatePresence>
        {activeChat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-[344px] bottom-4 w-[380px] h-[480px] bg-[#0d0d14] border border-[#1a1a2e] rounded-xl z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Chat header */}
            <div className="h-11 bg-[#111118] border-b border-[#1a1a2e] flex items-center px-3 justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <User size={12} className="text-violet-400" />
                </div>
                <span className="font-mono text-xs text-zinc-300">
                  {activeChat.display_name || activeChat.username}
                </span>
              </div>
              <button onClick={() => setActiveChat(null)} className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    m.sender_id === user?.id
                      ? 'bg-purple-600/20 border border-purple-500/20'
                      : 'bg-[#1a1a2e] border border-[#252540]'
                  }`}>
                    <p className="text-[11px] font-mono text-zinc-300 leading-relaxed">{m.content}</p>
                    <p className="text-[8px] text-zinc-600 mt-1 text-right">
                      {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-2 border-t border-[#1a1a2e] flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Сообщение..."
                className="flex-1 bg-transparent border-none outline-none text-[12px] font-mono text-zinc-300 placeholder:text-zinc-600"
              />
              <button onClick={sendMessage} disabled={!input.trim()} className="p-1.5 rounded-md text-violet-400 hover:bg-purple-600/10 disabled:text-zinc-700 transition-colors">
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center pt-20 bg-black/60"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-[400px] bg-[#0d0d14] border border-[#1a1a2e] rounded-xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <Search size={16} className="text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => searchUsers(e.target.value)}
                  placeholder="Поиск пользователей..."
                  className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-zinc-300 placeholder:text-zinc-600"
                  autoFocus
                />
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startChat(u)}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-white/[0.05] transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                      <User size={14} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="font-mono text-xs text-zinc-300">{u.display_name || u.username}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">@{u.username}</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-600 ml-auto" />
                  </button>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-[10px] text-zinc-600 font-mono text-center py-3">Никого не найдено</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
