import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { Heart, MessageCircle, Send, Clock, User, Globe, Dices, Flame, ScrollText, Sparkles, ImageIcon, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Post {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

interface Comment {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

interface Room {
  id: string;
  name: string;
  mode: string;
  owner_name: string;
  player_count: number;
  max_players: number;
  is_public: boolean;
  invite_code: string;
}

type Tab = 'feed' | 'popular' | 'parties';

export function SocialPage() {
  const { user, token } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (activeTab === 'feed') fetchPosts('');
    else if (activeTab === 'popular') fetchPosts('popular');
    else fetchActiveRooms();
  }, [activeTab]);

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  const fetchPosts = (type: string) => {
    const url = type === 'popular' ? '/api/social/posts/popular' : '/api/social/posts';
    fetch(url).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setPosts(d); }).catch(() => {});
  };

  const fetchActiveRooms = () => {
    fetch('/api/rooms?mode=world').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setActiveRooms(d); }).catch(() => {});
    fetch('/api/rooms').then((r) => r.json()).then(() => {
      setPosts([]);
    }).catch(() => {});
  };

  const createPost = async () => {
    if (!newPost.trim() || !token) return;
    try {
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newPost, imageUrl: postImage }),
      });
      if (res.ok) {
        const post = await res.json();
        setPosts((prev) => [{ ...post, likes_count: 0, comments_count: 0 }, ...prev]);
        setNewPost('');
        setPostImage(null);
      }
    } catch {}
  };

  const toggleLike = async (postId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/social/posts/${postId}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { likesCount } = await res.json();
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: likesCount } : p)));
      }
    } catch {}
  };

  const loadComments = async (postId: string) => {
    if (expandedComments === postId) { setExpandedComments(null); return; }
    setExpandedComments(postId);
    try {
      const res = await fetch(`/api/social/posts/${postId}/comments`);
      const data = await res.json();
      if (Array.isArray(data)) setComments((prev) => ({ ...prev, [postId]: data }));
    } catch {}
  };

  const addComment = async (postId: string) => {
    if (!commentInput.trim() || !token) return;
    try {
      const res = await fetch(`/api/social/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: commentInput }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), comment] }));
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p)));
        setCommentInput('');
      }
    } catch {}
  };

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'feed', icon: ScrollText, label: 'Лента' },
    { id: 'popular', icon: Flame, label: 'Популярное' },
    { id: 'parties', icon: Dices, label: 'Партии' },
  ];

  return (
    <div className="h-full flex">
      {/* Left sidebar */}
      <div className="w-56 bg-[#0d0d14] border-r border-[#1a1a2e] p-3 hidden lg:flex flex-col shrink-0">
        <h2 className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-3 px-2">Меню</h2>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full text-left px-3 py-2 rounded-lg font-mono text-[12px] flex items-center gap-2.5 transition-all ${
              activeTab === id
                ? 'bg-purple-600/15 text-violet-400 border border-purple-500/20'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
        <div className="mt-4 pt-4 border-t border-[#1a1a2e]">
          <h2 className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-2 px-2">Активные миры</h2>
          <div className="space-y-1">
            {activeRooms.length === 0 ? (
              <p className="text-[10px] text-zinc-600 font-mono px-2">Пока нет активных миров</p>
            ) : (
              activeRooms.slice(0, 6).filter((r) => r.mode === 'world').map((room) => (
                <button
                  key={room.id}
                  onClick={() => navigate(`/world/${room.id}`)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group"
                >
                  <p className="font-mono text-[11px] text-zinc-400 group-hover:text-zinc-200 truncate flex items-center gap-1.5">
                    <Globe size={11} className="text-emerald-500 shrink-0" />
                    {room.name}
                  </p>
                  <p className="text-[9px] text-zinc-600 mt-0.5 ml-[22px]">
                    {room.player_count} игроков · {room.owner_name}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main feed */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Post composer */}
        {user && (
          <div className="p-4 border-b border-[#1a1a2e] bg-[#0d0d14]">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <User size={18} className="text-violet-400" />
              </div>
              <div className="flex-1">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Поделитесь новостью из своего мира..."
                  className="w-full bg-transparent border-none outline-none text-sm font-mono text-zinc-300 placeholder:text-zinc-600 resize-none min-h-[60px]"
                  rows={2}
                />
                {postImage && (
                  <div className="relative inline-block mt-2">
                    <img src={postImage} alt="" className="w-32 h-32 object-cover rounded-lg" />
                    <button onClick={() => setPostImage(null)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X size={10} /></button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <label className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 cursor-pointer transition-colors">
                      <ImageIcon size={14} />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setPostImage(ev.target?.result as string); r.readAsDataURL(f); e.target.value = '';
                      }} />
                    </label>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-600">Поддержите Demiurge!</span>
                  <button onClick={createPost} disabled={!newPost.trim()} className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1">
                    <Send size={12} /> Отправить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile tabs */}
        <div className="lg:hidden flex border-b border-[#1a1a2e] bg-[#0d0d14]">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 text-xs font-mono flex items-center justify-center gap-1.5 ${
                activeTab === id ? 'text-violet-400 border-b-2 border-purple-500' : 'text-zinc-500'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'feed' || activeTab === 'popular' ? (
            posts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle size={40} className="text-zinc-700 mx-auto mb-3" />
                  <p className="font-mono text-sm text-zinc-600">Пока нет постов</p>
                  <p className="font-mono text-xs text-zinc-700 mt-1">Будьте первым!</p>
                </div>
              </div>
            ) : (
              posts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border-b border-[#1a1a2e] hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex gap-3">
                    <Link to={`/profile/${post.username}`}>
                      <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 hover:scale-110 transition-transform">
                        <User size={16} className="text-violet-400" />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/profile/${post.username}`} className="font-mono text-xs text-violet-400 hover:underline">
                          {post.display_name || post.username}
                        </Link>
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(post.created_at).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                      {post.image_url && (
                        <img src={post.image_url} alt="" className="mt-2 rounded-lg max-w-md" />
                      )}
                      <div className="flex items-center gap-4 mt-3">
                        <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-all text-xs">
                          <Heart size={14} /> {post.likes_count || 0}
                        </button>
                        <button onClick={() => loadComments(post.id)} className="flex items-center gap-1 text-zinc-500 hover:text-violet-400 transition-all text-xs">
                          <MessageCircle size={14} /> {post.comments_count || 0}
                        </button>
                      </div>

                      {expandedComments === post.id && (
                        <div className="mt-3 pl-4 border-l border-[#1a1a2e]">
                          {(comments[post.id] || []).map((c) => (
                            <div key={c.id} className="py-1.5">
                              <span className="font-mono text-xs text-violet-400">{c.username}</span>
                              <span className="font-mono text-xs text-zinc-400 ml-2">{c.content}</span>
                            </div>
                          ))}
                          {user && (
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                type="text"
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                                placeholder="Комментарий..."
                                className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-zinc-300 placeholder:text-zinc-600"
                              />
                              <button onClick={() => addComment(post.id)} className="text-violet-400 hover:text-violet-300">
                                <Send size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )
          ) : (
            /* Parties tab - active rooms */
            <div className="p-4">
              <h3 className="font-mono text-sm text-zinc-300 mb-4 flex items-center gap-2">
                <Dices size={16} className="text-violet-400" />
                Активные партии и миры
              </h3>
              {activeRooms.length === 0 ? (
                <div className="text-center py-12">
                  <Globe size={40} className="text-zinc-700 mx-auto mb-3" />
                  <p className="font-mono text-sm text-zinc-600">Нет активных публичных комнат</p>
                  <p className="font-mono text-xs text-zinc-700 mt-1">Создайте первую!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeRooms.map((room) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(room.mode === 'world' ? `/world/${room.id}` : `/room/${room.id}`)}
                      className="card p-4 hover:border-purple-500/30 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          {room.mode === 'world' ? (
                            <Globe size={18} className="text-emerald-400" />
                          ) : (
                            <Dices size={18} className="text-violet-400" />
                          )}
                          <div>
                            <h4 className="font-mono text-sm text-zinc-300 group-hover:text-violet-400 transition-colors">{room.name}</h4>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              room.mode === 'world' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-violet-400'
                            }`}>
                              {room.mode === 'world' ? 'МИР' : 'VTT'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-600">
                          {room.player_count}/{room.max_players}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                        <User size={10} /> {room.owner_name}
                        {room.invite_code && (
                          <span className="ml-auto text-zinc-700">Код: {room.invite_code}</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-64 bg-[#0d0d14] border-l border-[#1a1a2e] p-4 hidden xl:block shrink-0 overflow-y-auto">
        <h3 className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Активные миры</h3>
        <div className="space-y-2">
          {activeRooms.filter((r) => r.mode === 'world').length === 0 ? (
            <p className="text-[10px] text-zinc-600 font-mono">Нет активных миров</p>
          ) : (
            activeRooms.filter((r) => r.mode === 'world').slice(0, 5).map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/world/${room.id}`)}
                className="w-full text-left p-3 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-[#1a1a2e] transition-all group"
              >
                <p className="font-mono text-xs text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1.5">
                  <Globe size={11} className="text-emerald-500 shrink-0" /> {room.name}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">{room.player_count} игроков · {room.owner_name}</p>
              </button>
            ))
          )}
        </div>

        <h3 className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mt-6 mb-3">VTT столы</h3>
        <div className="space-y-2">
          {activeRooms.filter((r) => r.mode === 'vtt').slice(0, 5).map((room) => (
            <button
              key={room.id}
              onClick={() => navigate(`/room/${room.id}`)}
              className="w-full text-left p-3 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-[#1a1a2e] transition-all group"
            >
              <p className="font-mono text-xs text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1.5">
                <Dices size={11} className="text-violet-400 shrink-0" /> {room.name}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">{room.player_count} игроков · {room.owner_name}</p>
            </button>
          ))}
          {activeRooms.filter((r) => r.mode === 'vtt').length === 0 && (
            <p className="text-[10px] text-zinc-600 font-mono">Нет активных столов</p>
          )}
        </div>
      </div>
    </div>
  );
}
