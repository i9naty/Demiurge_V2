import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Upload, Trash2, Music, Plus, X } from 'lucide-react';

interface Track {
  id: string; name: string; url: string; duration: number; category: string;
}

interface Props {
  socket: any; roomId: string | undefined; isGM: boolean;
}

export function SoundPad({ socket, roomId, isGM }: Props) {
  const [tracks, setTracks] = useState<Track[]>(() => {
    try { return JSON.parse(localStorage.getItem('soundpad_tracks') || '[]'); } catch { return []; }
  });
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [category, setCategory] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem('soundpad_tracks', JSON.stringify(tracks)); }, [tracks]);

  // Listen for remote playback commands
  useEffect(() => {
    if (!socket) return;
    const onPlay = (data: { url: string; time: number; volume: number }) => {
      const audio = audioRef.current; if (!audio) return;
      audio.src = data.url; audio.volume = data.volume; audio.currentTime = data.time;
      audio.play().catch(() => {}); setIsPlaying(true);
      setCurrentTrack(data.url);
    };
    const onPause = () => { audioRef.current?.pause(); setIsPlaying(false); };
    const onStop = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } setIsPlaying(false); };
    const onVolume = (v: number) => { if (audioRef.current) audioRef.current.volume = v; setVolume(v); };

    socket.on('soundpad:play', onPlay);
    socket.on('soundpad:pause', onPause);
    socket.on('soundpad:stop', onStop);
    socket.on('soundpad:volume', onVolume);

    return () => {
      socket.off('soundpad:play', onPlay);
      socket.off('soundpad:pause', onPause);
      socket.off('soundpad:stop', onStop);
      socket.off('soundpad:volume', onVolume);
    };
  }, [socket]);

  const play = (url: string) => {
    const audio = audioRef.current; if (!audio) return;
    audio.src = url; audio.volume = muted ? 0 : volume;
    audio.play().catch(() => {}); setIsPlaying(true); setCurrentTrack(url);
    if (isGM && socket && roomId) {
      socket.emit('soundpad:play', { roomId, url, time: 0, volume: muted ? 0 : volume });
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current; if (!audio) return;
    if (isPlaying) {
      audio.pause(); setIsPlaying(false);
      if (isGM && socket && roomId) socket.emit('soundpad:pause', { roomId });
    } else if (currentTrack) {
      play(currentTrack);
    }
  };

  const stop = () => {
    const audio = audioRef.current; if (!audio) return;
    audio.pause(); audio.currentTime = 0; setIsPlaying(false); setCurrentTrack(null);
    if (isGM && socket && roomId) socket.emit('soundpad:stop', { roomId });
  };

  const changeVolume = (v: number) => {
    setVolume(v); if (audioRef.current) audioRef.current.volume = muted ? 0 : v;
    if (isGM && socket && roomId) socket.emit('soundpad:volume', { roomId, volume: muted ? 0 : v });
  };

  const toggleMute = () => {
    setMuted(!muted); const v = !muted ? 0 : volume;
    if (audioRef.current) audioRef.current.volume = v;
    if (isGM && socket && roomId) socket.emit('soundpad:volume', { roomId, volume: v });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 50 * 1024 * 1024) { alert('Максимум 50MB'); return; }
    const r = new FileReader();
    r.onload = ev => {
      const url = ev.target?.result as string;
      const t: Track = { id: Math.random().toString(36).slice(2), name: f.name.replace(/\.[^.]+$/, ''), url, duration: 0, category: 'uploads' };
      setTracks(prev => [...prev, t]);
    };
    r.readAsDataURL(f); e.target.value = '';
  };

  const removeTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
    if (currentTrack === tracks.find(t => t.id === id)?.url) stop();
  };

  const cats = ['all', ...new Set(tracks.map(t => t.category))];
  const filtered = category === 'all' ? tracks : tracks.filter(t => t.category === category);

  // Default tracks
  const defaults: Track[] = [
    { id: 'ambient-tavern', name: 'Таверна', url: '', duration: 0, category: 'ambient' },
    { id: 'ambient-forest', name: 'Лес', url: '', duration: 0, category: 'ambient' },
    { id: 'battle-light', name: 'Бой (лёгкий)', url: '', duration: 0, category: 'battle' },
    { id: 'battle-epic', name: 'Бой (эпичный)', url: '', duration: 0, category: 'battle' },
    { id: 'mystery', name: 'Тайна', url: '', duration: 0, category: 'mood' },
  ];

  return (
    <div className="w-[280px] bg-[#0c0c12] border-l border-white/[0.05] flex flex-col shrink-0 h-full">
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setCurrentTrack(null); }} />

      {/* Header */}
      <div className="h-11 px-3 flex items-center gap-2 border-b border-white/[0.05] shrink-0">
        <Music size={14} className="text-emerald-400" />
        <span className="font-mono text-[11px] text-zinc-300 font-bold">SoundPad</span>
        {isGM && (
          <button onClick={() => setShowUpload(!showUpload)}
            className="ml-auto p-1 rounded hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300"><Plus size={14} /></button>
        )}
      </div>

      {/* Upload area */}
      <AnimatePresence>
        {showUpload && isGM && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/[0.05]">
            <div className="p-3">
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 font-mono text-[10px] transition-colors flex items-center justify-center gap-2">
                <Upload size={14} /> Загрузить MP3/OGG/WAV (до 50MB)
              </button>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category tabs */}
      <div className="flex gap-1 px-2 py-2 border-b border-white/[0.05] overflow-x-auto shrink-0">
        {cats.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`text-[8px] font-mono px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${
              category === c ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.04] text-zinc-500 hover:border-zinc-500'
            }`}>{c}</button>
        ))}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {defaults.filter(t => category === 'all' || t.category === category).map(t => (
          <button key={t.id} onClick={() => play(t.url)} disabled={!t.url}
            className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              currentTrack === t.url ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/[0.02] border border-transparent'
            } disabled:opacity-30 disabled:cursor-default`}>
            <Music size={12} className={currentTrack === t.url ? 'text-emerald-400' : 'text-zinc-600'} />
            <span className="font-mono text-[10px] text-zinc-400 flex-1">{t.name}</span>
            {!t.url && <span className="text-[7px] text-zinc-700 font-mono">нет файла</span>}
          </button>
        ))}
        {filtered.filter(t => t.url).map(t => (
          <div key={t.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <button onClick={() => play(t.url)} className="flex-1 text-left flex items-center gap-2">
              <Music size={12} className={currentTrack === t.url ? 'text-emerald-400' : 'text-zinc-600'} />
              <span className="font-mono text-[10px] text-zinc-400 truncate">{t.name}</span>
            </button>
            {isGM && (
              <button onClick={() => removeTrack(t.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-600 hover:text-red-400 transition-all">
                <Trash2 size={10} /></button>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-[9px] text-zinc-700 text-center py-4 font-mono">Пусто</p>}
      </div>

      {/* Player controls */}
      <div className="p-3 border-t border-white/[0.05] shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          {(isGM || currentTrack) && (
            <>
              <button onClick={stop} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300"><SkipBack size={16} /></button>
              <button onClick={togglePlay}
                className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={stop} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300"><SkipForward size={16} /></button>
            </>
          )}
          <button onClick={toggleMute} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 ml-auto">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
          onChange={e => changeVolume(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 h-1 rounded-full appearance-none bg-white/[0.06] cursor-pointer" />
        {currentTrack && (
          <p className="text-[9px] font-mono text-zinc-500 text-center truncate px-2">
            {tracks.find(t => t.url === currentTrack)?.name || 'Трек'}
          </p>
        )}
      </div>
    </div>
  );
}
