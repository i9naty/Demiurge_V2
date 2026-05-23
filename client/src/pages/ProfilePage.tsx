import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/api';
import { User, Calendar, MessageCircle, Clock, Heart, Globe, Dices, Copy, Play, Plus, Camera, Edit2, Check, X, Users2, UserPlus, UserMinus, Trophy, Zap } from 'lucide-react';

interface Profile {
  profile: { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null; role: string; created_at: string; subscription_tier: string; posts_count: number; };
  posts: any[];
}
interface Room { id: string; name: string; mode: string; owner_id: string; is_public: boolean; invite_code: string; max_players: number; player_count: number; role: string; }
interface Achievement { id: string; name: string; description: string; icon: string; earned: boolean; earned_at: string | null; }
interface FollowInfo { followingCount: number; followersCount: number; isFollowing: boolean; }

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, token } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [followInfo, setFollowInfo] = useState<FollowInfo | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'rooms' ? 'rooms' : 'posts');
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [bioSaved, setBioSaved] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [achievementPopup, setAchievementPopup] = useState<Achievement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user && username === user.username;

  useEffect(() => {
    if (!username) return;
    apiGet(`/social/profile/${username}`).then((d) => { if (d && d.profile) setProfile(d); }).catch(() => {});
    apiGet(`/follows/${username}/status`).then((d) => { if (d && typeof d === 'object') setFollowInfo(d); }).catch(() => {});
    if (isOwnProfile && token) {
      apiGet('/rooms/my').then((d) => { if (Array.isArray(d)) setRooms(d); }).catch(() => {});
      apiGet('/achievements').then((d) => { if (d && Array.isArray(d.achievements)) setAchievements(d.achievements); }).catch(() => {});
    }
  }, [username, isOwnProfile, token]);

  const uploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const { avatarUrl } = await apiPost('/auth/avatar', { imageData: dataUrl });
      setProfile((prev) => prev ? { ...prev, profile: { ...prev.profile, avatar_url: avatarUrl } } : prev);
      useStore.setState({ user: { ...user!, avatarUrl } });
    };
    r.readAsDataURL(file);
    e.target.value = '';
  };

  const startEditBio = () => {
    setBioText(profile?.profile.bio || '');
    setEditingBio(true);
    setBioSaved(false);
  };
  const saveBio = async () => {
    if (!token) return;
    await apiPatch('/auth/me', { bio: bioText });
    setProfile((prev) => prev ? { ...prev, profile: { ...prev.profile, bio: bioText } } : prev);
    setEditingBio(false);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 2000);
  };

  const toggleFollow = async () => {
    if (!token || !followInfo) return;
    setFollowLoading(true);
    try {
      const fn = followInfo.isFollowing ? apiDelete : apiPost;
      const d = await fn(`/follows/${profile!.profile.username}`);
      setFollowInfo((prev) => prev ? { ...prev, isFollowing: d.following, followersCount: d.followersCount } : prev);
    } catch {}
    setFollowLoading(false);
  };

  if (!profile) return <div className="h-full flex items-center justify-center"><p className="font-mono text-demiurge-muted">Загрузка...</p></div>;
  const p = profile.profile;

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative bg-[#0d0d14] border-b border-[#1a1a2e]">
        <div className="h-32 bg-gradient-to-r from-purple-600/20 via-purple-600/20 to-purple-600/10" />
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative -mt-12 flex items-end gap-4 pb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-purple-600/20 border-2 border-purple-500/30 flex items-center justify-center shadow-lg overflow-hidden">
                {p.avatar_url && !p.avatar_url.includes('default') ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} className="text-violet-400" />
                )}
              </div>
              {isOwnProfile && (
                <button onClick={() => avatarInputRef.current?.click()} className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={20} className="text-white" />
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              {/* Status dot */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0d0d14] bg-emerald-500" />
            </div>
            <div className="flex-1">
              <h1 className="font-mono text-xl font-bold text-zinc-200">{p.display_name || p.username}</h1>
              <p className="font-mono text-sm text-zinc-500">@{p.username} · {p.role === 'master' ? 'Мастер' : p.role === 'admin' ? 'Админ' : 'Игрок'}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-600">
                <span className="flex items-center gap-1"><Calendar size={11} />{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                <span className="flex items-center gap-1"><MessageCircle size={11} />{p.posts_count} постов</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {p.subscription_tier !== 'free' && <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] border border-amber-500/30">{p.subscription_tier.toUpperCase()}</span>}
              {!isOwnProfile && followInfo && (
                <button onClick={toggleFollow} disabled={followLoading} className={`px-4 py-2 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-all ${followInfo.isFollowing ? 'bg-white/5 border border-zinc-700 text-zinc-400 hover:text-red-400' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                  {followInfo.isFollowing ? <><UserMinus size={13} /> Отписаться</> : <><UserPlus size={13} /> Подписаться</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Bio */}
        <div className="card p-4 mb-4">
          {editingBio ? (
            <div className="flex items-start gap-2">
              <textarea value={bioText} onChange={(e) => setBioText(e.target.value)} className="flex-1 bg-transparent border border-[#1a1a2e] rounded-lg p-2 font-mono text-xs text-zinc-300 resize-none outline-none focus:border-purple-500/50" rows={3} placeholder="Расскажите о себе..." />
              <div className="flex flex-col gap-1">
                <button onClick={saveBio} className="p-1.5 rounded bg-green-600/20 text-green-400"><Check size={14} /></button>
                <button onClick={() => setEditingBio(false)} className="p-1.5 rounded bg-red-500/20 text-red-400"><X size={14} /></button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between group">
              <p className="font-mono text-sm text-zinc-400 min-h-[1.5rem]">{p.bio || 'Нет описания'}</p>
              {isOwnProfile && (
                <button onClick={startEditBio} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 text-zinc-600 transition-all"><Edit2 size={13} /></button>
              )}
            </div>
          )}
          {bioSaved && <p className="text-[10px] text-emerald-400 font-mono mt-1">✓ Сохранено</p>}
          {followInfo && (
            <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-zinc-500">
              <span>{followInfo.followersCount} подписчиков</span>
              <span>{followInfo.followingCount} подписок</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a2e] mb-4">
          {['posts','rooms','achievements'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-mono text-xs transition-all ${activeTab === tab ? 'text-violet-400 border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {tab === 'posts' ? 'Посты' : tab === 'rooms' ? `Комнаты (${rooms.length})` : `Достижения (${achievements.filter((a) => a.earned).length})`}
            </button>
          ))}
        </div>

        {activeTab === 'posts' && (
          profile.posts.length === 0 ? <p className="font-mono text-sm text-zinc-600">Пока нет постов</p> :
          <div className="space-y-3">{profile.posts.map((post: any) => (
            <div key={post.id} className="card p-4">
              <p className="font-mono text-sm text-zinc-300">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt="" className="mt-2 rounded-lg max-w-md" />}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-600"><Clock size={10} />{new Date(post.created_at).toLocaleString('ru-RU')}<Heart size={10} />{post.likes_count || 0}<MessageCircle size={10} />{post.comments_count || 0}</div>
            </div>
          ))}</div>
        )}

        {activeTab === 'rooms' && (
          rooms.length === 0 ? <p className="font-mono text-sm text-zinc-600">Нет комнат</p> :
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{rooms.map((r) => (
            <div key={r.id} onClick={() => navigate(r.mode === 'world' ? `/world/${r.id}` : `/room/${r.id}`)} className="card p-4 hover:border-purple-500/30 cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">{r.mode === 'world' ? <Globe size={16} className="text-emerald-400" /> : <Dices size={16} className="text-violet-400" />}<h3 className="font-mono text-sm text-zinc-300 group-hover:text-violet-400">{r.name}</h3></div>
                <span className="text-[10px] font-mono text-zinc-600">{r.role === 'owner' ? 'Владелец' : 'Участник'}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500"><Users2 size={11} />{r.player_count}/{r.max_players} · код: {r.invite_code}</div>
            </div>
          ))}</div>
        )}

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div key={a.id} className={`card p-3 text-center ${a.earned ? 'border-emerald-500/30 bg-emerald-500/5' : 'opacity-40'}`}>
                <span className="text-2xl">{a.icon}</span>
                <h4 className="font-mono text-xs text-zinc-300 mt-1">{a.name}</h4>
                <p className="text-[9px] text-zinc-600 mt-0.5">{a.description}</p>
                {a.earned && <p className="text-[9px] text-emerald-400 font-mono mt-1">✓ {new Date(a.earned_at!).toLocaleDateString('ru-RU')}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
