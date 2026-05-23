import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { VTTCanvas } from '../components/vtt/VTTCanvas';
import { ChatPanel } from '../components/vtt/ChatPanel';
import { InitiativeTracker, Combatant } from '../components/vtt/InitiativeTracker';
import { GMScreen } from '../components/vtt/GMScreen';
import { TokenInspector } from '../components/vtt/TokenInspector';
import { SoundPad } from '../components/vtt/SoundPad';
import { CharacterSheet } from '../components/vtt/CharacterSheet';
import { Compendium } from '../components/vtt/Compendium';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MousePointer2, Image, Upload, Eye, EyeOff, Trash2,
  PanelRightClose, PanelRight, Grid3X3, Hash, Ruler, Hexagon, Box,
  Plus, X, Layers, Target, PenTool, Swords, Maximize2, Copy, Clipboard,
} from 'lucide-react';

interface LocalToken { id: string; name: string; imageUrl: string | null; x: number; y: number; width: number; height: number; }
interface Message { id: string; userId: string; username: string; content: string; type: string; createdAt: string; }
interface Scene { id: string; room_id: string; name: string; map_url: string | null; grid_type: string; grid_size: number; grid_visible: boolean; grid_offset_x: number; grid_offset_y: number; sort_order: number; }

const TOOLS = [
  { id: 'move', icon: MousePointer2, label: 'Перемещение', shortcut: 'V' },
  { id: 'token', icon: Image, label: 'Токен', shortcut: 'T' },
  { id: 'ruler', icon: Ruler, label: 'Линейка', shortcut: 'R' },
  { id: 'fog', icon: EyeOff, label: 'Туман', shortcut: 'F' },
  { id: 'draw', icon: PenTool, label: 'Рисование', shortcut: 'D' },
  { id: 'template', icon: Target, label: 'Шаблоны', shortcut: 'E' },
  { id: 'zone', icon: Box, label: 'Зоны', shortcut: 'Z' },
  { id: 'calibrate', icon: Grid3X3, label: 'Калибровка', shortcut: 'C' },
  { id: 'wall', icon: Box, label: 'Стены (LOS)', shortcut: 'W' },
] as const;

type ToolId = typeof TOOLS[number]['id'];

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, user, token } = useStore();
  const navigate = useNavigate();

  const [room, setRoom] = useState<any>(null);
  const [tokens, setTokens] = useState<LocalToken[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [tool, setTool] = useState<ToolId>('move');
  const [fogEnabled, setFogEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [initOpen, setInitOpen] = useState(false);
  const [rulerMode, setRulerMode] = useState(false);
  const [rulerText, setRulerText] = useState('');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [pendingTokenPos, setPendingTokenPos] = useState<{ x: number; y: number } | null>(null);
  const [tokenNameInput, setTokenNameInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [templateType, setTemplateType] = useState<'cone' | 'circle' | 'line'>('circle');

  // Initiative state
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [combatActive, setCombatActive] = useState(false);
  const [gmOpen, setGmOpen] = useState(false);
  const [cinematic, setCinematic] = useState(false);
  const [copiedTokens, setCopiedTokens] = useState<LocalToken[]>([]);
  const [saveSlots, setSaveSlots] = useState<any[]>([]);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<LocalToken | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [weather, setWeather] = useState<'none' | 'rain' | 'snow' | 'fog'>('none');
  const [soundOpen, setSoundOpen] = useState(false);
  const [darkvision, setDarkvision] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [charOpen, setCharOpen] = useState(false);
  const [charData, setCharData] = useState<any>(null);
  const [compOpen, setCompOpen] = useState(false);
  const [showGmLayer, setShowGmLayer] = useState(false);
  const [sessionStart] = useState(() => Date.now());
  const [sessionTime, setSessionTime] = useState('0:00');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Dungeon generator
  const generateDungeon = () => {
    const gs = activeScene?.grid_size || 70;
    const w = 40, h = 30, canvas = document.createElement('canvas');
    canvas.width = w * gs; canvas.height = h * gs;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0a0a10'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const noise = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = noise(x * 0.3, y * 0.3) * noise(x * 0.15 + 2.5, y * 0.15 + 1.5);
        if (v > 0.35) {
          ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x * gs, y * gs, gs, gs);
          ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
          ctx.strokeRect(x * gs + 0.5, y * gs + 0.5, gs - 1, gs - 1);
        }
      }
    }
    for (let i = 0; i < 8; i++) {
      const rx = 5 + Math.floor(Math.abs(noise(i * 3, 0)) * (w - 15));
      const ry = 5 + Math.floor(Math.abs(noise(0, i * 3)) * (h - 15));
      const rw = 3 + Math.floor(Math.abs(noise(i, i + 1)) * 5);
      const rh = 3 + Math.floor(Math.abs(noise(i + 2, i)) * 5);
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(rx * gs, ry * gs, rw * gs, rh * gs);
    }
    const url = canvas.toDataURL();
    if (activeScene) uploadMap(url);
  };

  // Session timer
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60);
      setSessionTime(h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(elapsed % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [sessionStart]);

  // Auto-save every 5 minutes
  useEffect(() => {
    if (!roomId || !tokens.length) return;
    const iv = setInterval(() => {
      const data = { tokens, scenes, combatants, round, combatActive, currentTurn, fogEnabled };
      setSaveSlots(prev => { const f = prev.filter(s => s.id !== 0); return [...f, { id: 0, name: `Авто-${new Date().toLocaleTimeString('ru')}`, data, savedAt: new Date().toISOString() }]; });
    }, 300000);
    return () => clearInterval(iv);
  }, [roomId, tokens, combatants, combatActive, currentTurn, fogEnabled]);

  // Paste image from clipboard
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const item = e.clipboardData?.items[0];
      if (item?.type.startsWith('image/')) {
        const blob = item.getAsFile(); if (!blob || !socket || !roomId) return;
        const r = new FileReader(); r.onload = ev => {
          const url = ev.target?.result as string;
          socket.emit('token:create', { roomId, name: 'Токен', x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20), width: 70, height: 70, imageUrl: url });
        };
        r.readAsDataURL(blob);
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [socket, roomId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hdrs = { Authorization: `Bearer ${token || ''}` };

  // Combat handlers
  const initHandlers = {
    onStart: () => { if (combatants.length > 0) { setCombatActive(true); setCurrentTurn(combatants[0].id); } },
    onNext: () => {
      const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
      const idx = sorted.findIndex(c => c.id === currentTurn);
      const next = idx + 1 >= sorted.length ? 0 : idx + 1;
      setCurrentTurn(sorted[next].id);
      if (next === 0) setRound(r => r + 1);
    },
    onPrev: () => {
      const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
      const idx = sorted.findIndex(c => c.id === currentTurn);
      const prev = idx - 1 < 0 ? sorted.length - 1 : idx - 1;
      setCurrentTurn(sorted[prev].id);
      if (prev === sorted.length - 1) setRound(r => Math.max(1, r - 1));
    },
    onStop: () => { setCombatActive(false); setCurrentTurn(null); setRound(1); },
    onAdd: (c: Omit<Combatant, 'id'>) => {
      const id = Math.random().toString(36).slice(2, 10);
      setCombatants(prev => [...prev, { ...c, id }]);
    },
    onRemove: (id: string) => {
      setCombatants(prev => prev.filter(c => c.id !== id));
      if (currentTurn === id) {
        const remaining = combatants.filter(c => c.id !== id).sort((a, b) => b.initiative - a.initiative);
        setCurrentTurn(remaining[0]?.id || null);
      }
    },
    onUpdate: (id: string, updates: Partial<Combatant>) => {
      setCombatants(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    },
    onReorder: (from: number, to: number) => {
      setCombatants(prev => {
        const sorted = [...prev].sort((a, b) => b.initiative - a.initiative);
        const [moved] = sorted.splice(from, 1);
        sorted.splice(to, 0, moved);
        return sorted;
      });
    },
  };

  // GM Screen handlers
  const handleSave = (slot: number, name: string) => {
    const data = { tokens, scenes, combatants, round, combatActive, currentTurn, fogEnabled };
    setSaveSlots(prev => { const f = prev.filter(s => s.id !== slot); return [...f, { id: slot, name, data, savedAt: new Date().toISOString() }]; });
  };
  const handleLoad = (slot: number) => {
    const s = saveSlots.find(x => x.id === slot);
    if (s?.data) {
      if (s.data.tokens) setTokens(s.data.tokens);
      if (s.data.combatants) setCombatants(s.data.combatants);
      if (s.data.round) setRound(s.data.round);
      if (s.data.currentTurn) setCurrentTurn(s.data.currentTurn);
      if (s.data.combatActive) { setCombatActive(true); } else { setCombatActive(false); setCurrentTurn(null); }
      if (s.data.fogEnabled !== undefined) setFogEnabled(s.data.fogEnabled);
    }
  };
  const handleExport = () => {
    const data = { tokens, scenes, combatants, round, combatActive, currentTurn, fogEnabled, activeScene: activeScene?.id };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `demiurge-${roomId?.slice(0,8)}.json`; a.click();
  };
  const handleImport = (data: any) => {
    if (data.tokens) setTokens(data.tokens);
    if (data.combatants) setCombatants(data.combatants);
    if (data.fogEnabled !== undefined) setFogEnabled(data.fogEnabled);
  };

  // Copy/Paste tokens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && e.key === 'c') { setCopiedTokens([...tokens]); }
      if (e.ctrlKey && e.key === 'v' && copiedTokens.length > 0) {
        copiedTokens.forEach(t => {
          socket?.emit('token:create', { roomId, name: t.name + ' (копия)', x: t.x + 1, y: t.y + 1, width: t.width, height: t.height });
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tokens, copiedTokens, socket, roomId]);

  // Load room data
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}`, { headers: hdrs }).then(r => r.json()).then(setRoom).catch(() => {});
    loadScenes();
    fetch(`/api/rooms/${roomId}/messages`, { headers: hdrs }).then(r => r.json()).then((d: any) => {
      if (Array.isArray(d)) setMessages(d.reverse());
    }).catch(() => {});
  }, [roomId]);

  const loadScenes = () => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/scenes`, { headers: hdrs }).then(r => r.json()).then((data: any) => {
      if (!Array.isArray(data)) return;
      setScenes(data);
      if (!activeScene && data.length > 0) setActiveScene(data[0]);
      else if (activeScene) { const found = data.find((s: any) => s.id === activeScene.id); setActiveScene(found || data[0]); }
    }).catch(() => {});
  };

  // Load tokens
  useEffect(() => {
    if (!roomId || !activeScene) return;
    fetch(`/api/rooms/${roomId}/tokens`, { headers: hdrs }).then(r => r.json()).then((t: any) => {
      if (!Array.isArray(t)) return;
      setTokens(t.map((tok: any) => ({ ...tok, imageUrl: tok.image_url ?? tok.imageUrl ?? null })));
    }).catch(() => {});
  }, [activeScene?.id, roomId]);

  // Socket
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit('room:join', roomId);
    const onToken = (t: any) => setTokens(prev => { if (prev.find(x => x.id === t.id)) return prev; return [...prev, { id: t.id, name: t.name, imageUrl: t.imageUrl ?? null, x: t.x, y: t.y, width: t.width || 70, height: t.height || 70 }]; });
    const onMove = (d: any) => setTokens(prev => prev.map(t => t.id === d.tokenId ? { ...t, x: d.x, y: d.y } : t));
    const onDel = (d: any) => setTokens(prev => prev.filter(t => t.id !== d.tokenId));
    const onMsg = (m: Message) => setMessages(prev => [...prev, m]);
    const onParts = (p: any[]) => setParticipants(p);
    socket.on('token:created', onToken); socket.on('token:moved', onMove); socket.on('token:deleted', onDel);
    socket.on('chat:message', onMsg); socket.on('room:participants', onParts);
    return () => { socket.emit('room:leave', roomId); socket.off('token:created', onToken); socket.off('token:moved', onMove); socket.off('token:deleted', onDel); socket.off('chat:message', onMsg); socket.off('room:participants', onParts); };
  }, [socket, roomId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'v') setTool('move');
      else if (key === 't') setTool('token');
      else if (key === 'r') { setRulerMode(!rulerMode); setTool('ruler'); }
      else if (key === 'f') { setFogEnabled(!fogEnabled); setTool('fog'); }
      else if (key === 'd') setTool('draw');
      else if (key === 'e') setTool('template');
      else if (key === 'z') setTool('zone');
      else if (key === 'c') setTool('calibrate');
      else if (key === 'w') setTool('wall');
      else if (key === 'delete' || key === 'backspace') { if (tokens.length > 0) { socket?.emit('token:delete', { roomId, tokenId: tokens[tokens.length - 1].id }); } }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [socket, roomId, tokens, rulerMode, fogEnabled]);

  const canvasClick = useCallback((x: number, y: number) => {
    if (!socket || !roomId) return;
    if (tool === 'token') { setPendingTokenPos({ x, y }); setTokenNameInput(''); }
  }, [socket, roomId, tool]);

  const confirmToken = () => { if (!pendingTokenPos || !socket || !roomId) return; const n = tokenNameInput.trim() || 'Токен'; socket.emit('token:create', { roomId, name: n, x: pendingTokenPos.x, y: pendingTokenPos.y, width: 70, height: 70 }); setPendingTokenPos(null); };

  const sendMsg = useCallback((c: string) => {
    if (!socket || !roomId) return;
    if (c.startsWith('/roll ')) {
      socket.emit('chat:message', { roomId, content: c, type: 'roll' });
      return;
    }
    socket.emit('chat:message', { roomId, content: c });
  }, [socket, roomId]);

  const deleteLastToken = () => { if (!socket || !roomId || tokens.length === 0) return; socket.emit('token:delete', { roomId, tokenId: tokens[tokens.length - 1].id }); };

  const uploadMap = (url: string) => {
    if (!activeScene || !roomId) return;
    fetch(`/api/rooms/${roomId}/scenes/${activeScene.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...hdrs }, body: JSON.stringify({ mapUrl: url }) }).then(loadScenes);
  };

  const createScene = () => {
    if (!roomId || !newSceneName.trim()) return;
    fetch(`/api/rooms/${roomId}/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...hdrs }, body: JSON.stringify({ name: newSceneName }) })
      .then(r => r.json()).then(s => { setScenes(prev => [...prev, s]); setActiveScene(s); setNewSceneName(''); setShowScenePanel(false); });
  };

  const confirmDeleteScene = (id: string) => setDeleteConfirm(id);
  const doDeleteScene = () => {
    if (!roomId || !deleteConfirm) return;
    const id = deleteConfirm; setDeleteConfirm(null);
    fetch(`/api/rooms/${roomId}/scenes/${id}`, { method: 'DELETE', headers: hdrs }).then(() => {
      setScenes(prev => prev.filter(s => s.id !== id));
      if (activeScene?.id === id) setActiveScene(scenes.find(s => s.id !== id) || null);
    });
  };

  const updateSceneGrid = (upd: Record<string, any>) => {
    if (!activeScene || !roomId) return;
    fetch(`/api/rooms/${roomId}/scenes/${activeScene.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...hdrs }, body: JSON.stringify(upd) }).then(() => loadScenes());
  };

  const switchGridType = () => { const types = ['square', 'hex', 'iso']; const idx = types.indexOf(activeScene?.grid_type as any); updateSceneGrid({ gridType: types[(idx + 1) % 3] }); };
  const toggleGrid = () => updateSceneGrid({ gridVisible: !(activeScene?.grid_visible ?? true) });

  if (!room) return (
    <div className="h-full flex items-center justify-center bg-[#06060c]">
      <div className="w-10 h-10 border-2 border-white/[0.05] border-t-violet-400 rounded-full animate-spin" />
    </div>
  );

  const isGM = room.owner_id === user?.id;

  return (
    <div className="h-full flex flex-col bg-[#06060c]">
      {/* Toolbar — hidden in cinematic mode */}
      <AnimatePresence>
        {!cinematic && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="bg-[#0a0a10] border-b border-white/[0.05] overflow-hidden shrink-0">
      <div className="h-11 flex items-center px-3 gap-1">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-400"><ArrowLeft size={16} /></button>
        <div className="w-px h-5 bg-white/[0.05] mx-1" />

        {TOOLS.map(t => {
          const active = tool === t.id || (t.id === 'ruler' && rulerMode) || (t.id === 'fog' && fogEnabled);
          return (
            <button key={t.id} onClick={() => { setTool(t.id); if (t.id === 'ruler') setRulerMode(!rulerMode); if (t.id === 'fog') setFogEnabled(!fogEnabled); }}
              className={`p-1.5 rounded-lg text-xs font-mono transition-all ${active ? 'bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'}`}
              title={`${t.label} (${t.shortcut})`}>
              <t.icon size={15} />
            </button>
          );
        })}

        <div className="w-px h-5 bg-white/[0.05] mx-1" />

        <button onClick={switchGridType} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]" title="Сетка">
          {activeScene?.grid_type === 'hex' ? <Hexagon size={15} /> : activeScene?.grid_type === 'iso' ? <Box size={15} /> : <Grid3X3 size={15} />}
        </button>
        <button onClick={toggleGrid} className={`p-1.5 rounded-lg text-xs font-mono ${!(activeScene?.grid_visible ?? true) ? 'text-zinc-700' : 'text-zinc-500'} hover:text-zinc-300`} title="Показать/скрыть сетку"><Hash size={15} /></button>
        <button onClick={() => setSnapToGrid(!snapToGrid)} className={`p-1.5 rounded-lg text-[9px] font-mono ${snapToGrid ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-600'} hover:text-zinc-300`} title="Привязка к сетке">⊞</button>
        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]" title="Загрузить карту"><Upload size={15} /></button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = new FileReader(); r.onload = ev => { const u = ev.target?.result as string; if (u) uploadMap(u); }; r.readAsDataURL(f); e.target.value = '';
        }} />

        <div className="w-px h-5 bg-white/[0.05] mx-1" />
        <button onClick={() => setShowScenePanel(!showScenePanel)} className={`p-1.5 rounded-lg ${showScenePanel ? 'bg-violet-600/10 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`} title="Сцены"><Layers size={15} /></button>

        {isGM && (
          <>
            <button onClick={() => setInitOpen(!initOpen)}
              className={`ml-auto p-1.5 rounded-lg flex items-center gap-1.5 px-2.5 font-mono text-[10px] font-bold transition-all ${
                combatActive ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20' :
                initOpen ? 'bg-violet-600/10 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}>
              <Swords size={13} /> {combatActive ? `Раунд ${round}` : 'Иниц'}
            </button>
            <button onClick={() => setGmOpen(!gmOpen)}
              className={`p-1.5 rounded-lg flex items-center gap-1.5 px-2.5 font-mono text-[10px] font-bold transition-all ${
                gmOpen ? 'bg-amber-600/10 text-amber-400 ring-1 ring-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'
              }`}>
              🛡️ Ширма
            </button>
            <button onClick={() => setShowHidden(!showHidden)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${showHidden ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500'}`}
              title="Показать скрытые токены">👁</button>
            <select value={weather} onChange={e => setWeather(e.target.value as any)}
              className="bg-transparent border border-white/[0.06] rounded-lg px-1.5 py-1 text-[9px] font-mono text-zinc-400 outline-none">
              <option value="none">☀️</option><option value="rain">🌧️</option>
              <option value="snow">❄️</option><option value="fog">🌫️</option>
            </select>
            <button onClick={() => setSoundOpen(!soundOpen)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${soundOpen ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="SoundPad">🎵</button>
            <button onClick={() => setDarkvision(!darkvision)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${darkvision ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-500'}`}
              title="Ночное зрение">🌙</button>
            <button onClick={() => setShowLabels(!showLabels)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${!showLabels ? 'text-zinc-600' : 'text-zinc-500'}`}
              title="Метки токенов">Aa</button>
            <button onClick={() => setShowUrlInput(!showUrlInput)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${showUrlInput ? 'text-violet-400' : 'text-zinc-500'}`}
              title="Токен из URL">🔗</button>
            <button onClick={() => setCharOpen(!charOpen)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${charOpen ? 'text-violet-400' : 'text-zinc-500'}`}
              title="Лист персонажа">📋</button>
            <button onClick={() => setCompOpen(!compOpen)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${compOpen ? 'text-red-400 bg-red-500/10' : 'text-zinc-500'}`}
              title="Компендиум монстров">👹</button>
            <button onClick={generateDungeon}
              className="p-1.5 rounded-lg font-mono text-[10px] text-zinc-500 hover:text-zinc-300"
              title="Сгенерировать подземелье">🏚️</button>
            <button onClick={() => setShowGmLayer(!showGmLayer)}
              className={`p-1.5 rounded-lg font-mono text-[10px] ${showGmLayer ? 'text-amber-400' : 'text-zinc-500'}`}
              title="Слой ГМ">🛡️</button>
            <button onClick={() => setShowShortcuts(true)}
              className="p-1.5 rounded-lg font-mono text-[10px] text-zinc-600 hover:text-zinc-300"
              title="Горячие клавиши">?</button>
            <button onClick={() => setCinematic(!cinematic)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
              title="Режим кино"><Maximize2 size={13} /></button>
          </>
        )}

        <div className="flex -space-x-1 ml-2">
          {participants.slice(0, 4).map(p => (
            <div key={p.userId} className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-[7px] font-mono text-violet-400" title={p.username}>
              {p.username?.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {participants.length > 4 && <div className="w-6 h-6 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-[7px] font-mono text-zinc-500">+{participants.length - 4}</div>}
        </div>

        <button onClick={() => setChatOpen(!chatOpen)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 ml-1">
          {chatOpen ? <PanelRightClose size={15} /> : <PanelRight size={15} />}
        </button>
      </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scene Panel */}
      <AnimatePresence>
        {showScenePanel && !cinematic && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-[#0a0a10] border-b border-white/[0.05] px-3 py-2 flex items-center gap-2 overflow-x-auto overflow-hidden">
            <span className="text-[9px] font-mono text-zinc-600 uppercase mr-1">Сцены:</span>
            {scenes.map(s => (
              <div key={s.id} className="flex items-center gap-1 shrink-0">
                <button onClick={() => setActiveScene(s)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[10px] whitespace-nowrap transition-all ${activeScene?.id === s.id ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {s.name}
                </button>
                {scenes.length > 1 && <button onClick={() => confirmDeleteScene(s.id)} className="p-0.5 rounded text-zinc-600 hover:text-red-400"><X size={10} /></button>}
              </div>
            ))}
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <input value={newSceneName} onChange={e => setNewSceneName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createScene()}
                placeholder="Новая сцена" className="bg-transparent border border-white/[0.06] rounded-lg px-2.5 py-1 text-[10px] font-mono text-zinc-300 w-28 outline-none focus:border-violet-500/30" />
              <button onClick={createScene} className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10"><Plus size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* URL Token Bar */}
      <AnimatePresence>
        {showUrlInput && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-[#0a0a10] border-b border-white/[0.05] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[9px] font-mono text-zinc-500">URL токена:</span>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter' && urlInput.trim()) {
                  socket?.emit('token:create', { roomId, name: 'Токен из URL', x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20), width: 70, height: 70, imageUrl: urlInput });
                  setUrlInput(''); setShowUrlInput(false);
                }
              }} placeholder="https://i.imgur.com/..." className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-1 text-[10px] font-mono text-zinc-200 outline-none focus:border-violet-500/30" autoFocus />
              <button onClick={() => { if (urlInput.trim()) { socket?.emit('token:create', { roomId, name: 'Токен из URL', x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20), width: 70, height: 70, imageUrl: urlInput }); setUrlInput(''); setShowUrlInput(false); } }}
                className="px-3 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-mono">OK</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {activeScene && (
            <VTTCanvas
              mapUrl={activeScene.map_url || ''}
              tokens={tokens}
              fogEnabled={fogEnabled}
              gridType={(activeScene.grid_type as any) || 'square'}
              gridVisible={activeScene.grid_visible ?? true}
              gridSize={activeScene.grid_size || 70}
              gridOffset={{ x: activeScene.grid_offset_x || 0, y: activeScene.grid_offset_y || 0 }}
              snapToGrid={snapToGrid}
              rulerMode={rulerMode || tool === 'ruler'}
              selectedTool={tool}
              drawColor={drawColor}
              weather={weather}
              showHidden={showHidden}
              darkvision={darkvision}
              showLabels={showLabels}
              showGmLayer={showGmLayer}
              onGridCalibrate={(size) => {
                if (activeScene) updateSceneGrid({ gridSize: size });
              }}
              onCanvasClick={canvasClick}
              onMeasure={(d: string) => setRulerText(d)}
              onTokenMove={(id, x, y) => { socket?.emit('token:move', { roomId, tokenId: id, x, y }); }}
              onTokenDelete={(id) => { socket?.emit('token:delete', { roomId, tokenId: id }); }}
              onTokenSelect={(t) => setSelectedToken(t)}
              socket={socket}
              roomId={roomId}
              onMapChange={uploadMap}
            />
          )}
          {rulerText && (
            <div className="absolute top-3 right-3 text-[10px] font-mono text-amber-400 bg-amber-500/10 backdrop-blur-md border border-amber-500/20 px-3 py-1.5 rounded-xl">
              {rulerText}
            </div>
          )}
        </div>

        {chatOpen && !cinematic && (
          <ChatPanel messages={messages} onSend={sendMsg} currentUserId={user?.id || ''} />
        )}

        {initOpen && isGM && (
          <InitiativeTracker
            combatants={combatants}
            currentTurn={currentTurn}
            round={round}
            isActive={combatActive}
            onStart={initHandlers.onStart}
            onNext={initHandlers.onNext}
            onPrev={initHandlers.onPrev}
            onStop={initHandlers.onStop}
            onAdd={initHandlers.onAdd}
            onRemove={initHandlers.onRemove}
            onUpdate={initHandlers.onUpdate}
            onReorder={initHandlers.onReorder}
          />
        )}

        {gmOpen && isGM && (
          <GMScreen
            onSave={handleSave}
            onLoad={handleLoad}
            slots={saveSlots}
            onHiddenRoll={(r) => { }}
            onExport={handleExport}
            onImport={handleImport}
          />
        )}

        {selectedToken && (
          <TokenInspector
            token={selectedToken}
            onClose={() => setSelectedToken(null)}
            onUpdate={(id, updates) => {
              setTokens(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
            }}
            onDelete={(id) => { socket?.emit('token:delete', { roomId, tokenId: id }); }}
            onDuplicate={(id) => {
              const t = tokens.find(x => x.id === id);
              if (t) socket?.emit('token:create', { roomId, name: t.name + ' (копия)', x: t.x + 1, y: t.y + 1, width: t.width, height: t.height });
            }}
            onAddToInitiative={(id) => {
              const t = tokens.find(x => x.id === id);
              if (t) {
                setCombatants(prev => [...prev, { id: Math.random().toString(36).slice(2, 10), name: t.name, initiative: Math.floor(Math.random() * 20) + 1, hp: 20, maxHp: 20, ac: 12, isPlayer: false, conditions: [], tokenId: t.id }]);
              }
            }}
            isGM={isGM}
          />
        )}

        {soundOpen && (
          <SoundPad socket={socket} roomId={roomId} isGM={isGM} />
        )}

        {charOpen && (
          <CharacterSheet
            character={charData}
            onClose={() => setCharOpen(false)}
            onUpdate={(c) => setCharData(c)}
          />
        )}

        {compOpen && (
          <Compendium onDragToken={(data) => {
            socket?.emit('token:create', { roomId, name: data.name, x: data.x, y: data.y, width: data.width, height: data.height });
          }} />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {pendingTokenPos && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPendingTokenPos(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#0f0f16] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <p className="font-mono text-sm text-zinc-200 mb-4">Название токена</p>
              <input autoFocus value={tokenNameInput} onChange={e => setTokenNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmToken(); if (e.key === 'Escape') setPendingTokenPos(null); }}
                placeholder="Токен" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm font-mono text-zinc-200 outline-none focus:border-violet-500/40 mb-4" />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setPendingTokenPos(null)} className="px-4 py-2 rounded-xl font-mono text-xs border border-white/[0.06] text-zinc-400">Отмена</button>
                <button onClick={confirmToken} className="px-4 py-2 rounded-xl font-mono text-xs bg-violet-600 text-white">Создать</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#0f0f16] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <p className="font-mono text-sm text-zinc-200 mb-2">Удалить сцену?</p>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">Это действие нельзя отменить</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-xl font-mono text-xs border border-white/[0.06] text-zinc-400">Отмена</button>
                <button onClick={doDeleteScene} className="px-4 py-2 rounded-xl font-mono text-xs bg-red-600 text-white">Удалить</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shortcut cheat sheet */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#0f0f16] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm text-zinc-200 font-bold">Горячие клавиши</h2>
                <button onClick={() => setShowShortcuts(false)} className="p-1 rounded text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                {[
                  ['V','Перемещение'],['T','Токен'],['R','Линейка'],['F','Туман войны'],
                  ['D','Рисование'],['E','Шаблоны'],['Z','Зоны'],['C','Калибровка'],
                  ['Del','Удалить токен'],['Ctrl+Z','Отмена рисунка'],['Ctrl+C','Копировать токены'],
                  ['Ctrl+V','Вставить токены'],['Shift','Box-select / Линия (в Draw)'],
                  ['Alt+Click','Добавить туман (в Fog)'],['Shift+Click','Панорама'],
                  ['Ctrl+Click','Мультивыделение'],['🌙','Ночное зрение'],
                  ['🏚️','Генератор карт'],['👹','Компендиум']
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.02]">
                    <kbd className="bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded text-[9px] text-violet-400 min-w-[28px] text-center">{key}</kbd>
                    <span className="text-zinc-500">{desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
