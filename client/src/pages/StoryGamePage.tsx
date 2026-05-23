import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import {
  ArrowLeft, Heart, Package, Sparkles, Save, Map, Users, Zap,
  Sword, Shield, Eye, Moon, Sun, Loader2,
} from 'lucide-react';

const TILE = 32;
const VIS = 9;

interface Token {
  id: string; name: string; type: string; x: number; y: number;
  hp?: number; maxHp?: number; charData?: any; dialog?: string;
}

interface GenerateStep {
  step: number; message: string;
}

export function StoryGamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, token, socket } = useStore();
  const navigate = useNavigate();

  const [map, setMap] = useState<string[][]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [desc, setDesc] = useState('');
  const [opts, setOpts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [genMsg, setGenMsg] = useState<GenerateStep>({ step: 0, message: 'Подготовка...' });
  const [genPct, setGenPct] = useState(0);
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hp, setHp] = useState(20);
  const [mhp, setMhp] = useState(20);
  const [inv, setInv] = useState<{ id: string; name: string; qty: number }[]>([]);
  const [end, setEnd] = useState(false);
  const [epi, setEpi] = useState('');
  const [mode, setMode] = useState<'load' | 'gen' | 'play'>('load');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'night'>('day');
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const cv = useRef<HTMLCanvasElement>(null);
  const ic = useRef<Record<string, HTMLImageElement>>({});
  const fogCanvas = useRef<HTMLCanvasElement | null>(null);
  const centered = useRef(false);
  const loaded = useRef(false);
  const hdrs = { Authorization: `Bearer ${token || ''}` };

  const me = tokens.find(t => t.id === user?.id) || tokens.find(t => t.type === 'player');
  const px = me?.x ?? 20;
  const py = me?.y ?? 20;

  // Load assets
  useEffect(() => {
    fetch('/api/assets').then(r => r.json()).then((list: any[]) => {
      const m: Record<string, string> = {};
      list.forEach((a: any) => { m[a.id] = a.path; });
      setAssets(m);
      Object.values(m).forEach(p => { if (!ic.current[p]) { const img = new Image(); img.src = p; ic.current[p] = img; } });
    }).catch(() => {});
  }, []);

  // Load game state
  useEffect(() => {
    if (!sessionId || !token || loaded.current) return;
    loaded.current = true;
    fetch(`/api/game/${sessionId}/lobby`, { headers: hdrs }).then(r => r.json()).then(d => {
      if (d.status === 'active' && d.world_state) {
        const ws = d.world_state; const ss = d.story_state || {};
        setMap(Array.isArray(ws.map) ? ws.map : []);
        setTokens(Array.isArray(ws.tokens) ? ws.tokens : []);
        setObjects(Array.isArray(ws.objects) ? ws.objects : []);
        setDesc(ss.intro || '');
        setMode('play');
        const s = d.settings || {};
        if (s.setting === 'dungeon' || s.setting === 'castle') setTimeOfDay('night');
        if (socket) socket.emit('lobby:join', sessionId);
      } else if (d.status === 'loading') {
        setMode('gen');
      } else {
        setMode('gen');
      }
    }).catch(() => setMode('gen'));
  }, [sessionId, token, socket]);

  // Socket events
  useEffect(() => {
    if (!socket || !sessionId) return;
    socket.emit('lobby:join', sessionId);

    socket.on('game:generating', (d: GenerateStep) => {
      setMode('gen');
      setGenMsg(d);
      setGenPct(Math.min(95, (d.step / 5) * 100 + Math.random() * 10));
    });

    socket.on('game:started', (d: any) => {
      setMode('play');
      setMap(Array.isArray(d.map) ? d.map : []);
      setTokens(Array.isArray(d.tokens) ? d.tokens : []);
      setObjects(Array.isArray(d.objects) ? d.objects : []);
      setDesc(d.intro || '');
      if (d.timeOfDay) setTimeOfDay(d.timeOfDay);
      setGenPct(100);
      centered.current = false;
    });

    socket.on('game:state', (d: any) => {
      setLoading(false);
      if (d.description) setDesc(d.description);
      if (d.options) setOpts(d.options);
      if (Array.isArray(d.tokens)) setTokens(d.tokens);
      if (Array.isArray(d.objects)) setObjects(d.objects);
      if (d.player_hp != null) setHp(Math.max(0, d.player_hp));
      if (d.inventory?.add) {
        const adds = Array.isArray(d.inventory.add) ? d.inventory.add : [];
        if (adds.length > 0) {
          setInv(p => {
            const updated = [...p];
            for (const a of adds) {
              const idx = updated.findIndex(i => i.id === a.id || i.name === a.name);
              if (idx >= 0) updated[idx] = { ...updated[idx], qty: updated[idx].qty + (a.qty || 1) };
              else updated.push({ id: a.id || a.name, name: a.name || a.id, qty: a.qty || 1 });
            }
            return updated;
          });
        }
      }
      if (d.inventory?.remove) {
        const rems = Array.isArray(d.inventory.remove) ? d.inventory.remove : [];
        if (rems.length > 0) setInv(p => p.filter(i => !rems.find((r: any) => r.id === i.id || r.name === i.name)));
      }
      if (d.end_session) { setEnd(true); setEpi(d.epilogue || ''); }
    });

    socket.on('game:save_result', (d: any) => {
      setSaving(false);
      setSavedMsg(d.error ? '❌ ' + d.error : '✅ Сохранено');
      setTimeout(() => setSavedMsg(''), 2500);
    });

    return () => {
      socket.off('game:generating');
      socket.off('game:started');
      socket.off('game:state');
      socket.off('game:save_result');
    };
  }, [socket, sessionId]);

  // Sprite matching
  const sprite = useCallback((t: Token): HTMLImageElement | null => {
    const cd = t.charData || {};
    const nm = (t.name || '').toLowerCase().replace(/[^a-zа-я]/g, '');

    // Try exact asset matches first
    const assetKeys = Object.keys(assets);

    // Player sprite by class
    if (t.type === 'player' && cd.class) {
      const clsMap: Record<string, string> = {
        warrior: 'warrior', воин: 'warrior',
        rogue: 'rogue', плут: 'rogue',
        mage: 'mage', маг: 'mage',
        ranger: 'ranger', следопыт: 'ranger',
        cleric: 'cleric', жрец: 'cleric',
      };
      const cls = clsMap[cd.class.toLowerCase()] || cd.class.toLowerCase();
      const key = assetKeys.find(k => k.includes(`players_${cls}`) || k.includes(`character_${cls}`));
      if (key) return ic.current[assets[key]]?.complete ? ic.current[assets[key]] : null;
    }

    // NPC sprite
    if (t.type === 'npc') {
      const key = assetKeys.find(k => k.includes('npcs_') && (k.includes(nm) || nm.includes(k.split('_').pop() || '')));
      if (key) return ic.current[assets[key]]?.complete ? ic.current[assets[key]] : null;
      // Generic NPC
      const genKey = assetKeys.find(k => k.includes('npcs_'));
      if (genKey) return ic.current[assets[genKey]]?.complete ? ic.current[assets[genKey]] : null;
    }

    // Monster sprite
    if (t.type === 'monster') {
      const key = assetKeys.find(k => k.includes('monsters_') && (k.includes(nm) || nm.includes(k.split('_').pop() || '')));
      if (key) return ic.current[assets[key]]?.complete ? ic.current[assets[key]] : null;
      const genKey = assetKeys.find(k => k.includes('monsters_'));
      if (genKey) return ic.current[assets[genKey]]?.complete ? ic.current[assets[genKey]] : null;
    }

    return null;
  }, [assets]);

  // Draw
  const draw = useCallback(() => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, timeOfDay === 'night' ? '#050510' : '#0a0f14');
    bg.addColorStop(1, timeOfDay === 'night' ? '#0a0a18' : '#0c1215');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    if (!map.length) return;

    // Draw tiles
    for (let ry = 0; ry < map.length; ry++) {
      for (let rx = 0; rx < (map[ry]?.length || 0); rx++) {
        const sx = rx * TILE + vx; const sy = ry * TILE + vy;
        if (sx < -TILE || sx > w + TILE || sy < -TILE || sy > h + TILE) continue;
        const tid = map[ry][rx];
        const ip = assets[tid];
        const wall = tid?.toLowerCase().includes('wall');

        if (ip && ic.current[ip]?.complete) {
          ctx.drawImage(ic.current[ip], sx, sy, TILE, TILE);
        } else {
          const cl = tid?.includes('grass') ? '#1e3d1a' :
            tid?.includes('stone') ? '#3d3d3d' :
            tid?.includes('water') ? '#0d3349' :
            tid?.includes('path') ? '#5c4a32' :
            tid?.includes('sand') ? '#8a7535' :
            tid?.includes('snow') ? '#e8eef0' :
            tid?.includes('mud') ? '#4a3728' :
            tid?.includes('floor_wood') ? '#3d2b1a' :
            tid?.includes('floor_stone') ? '#2d2d2d' :
            tid?.includes('floor_cave') ? '#1a1a1a' :
            tid?.includes('wall') ? '#1a1a1a' : '#1e3d1a';
          ctx.fillStyle = cl;
          ctx.fillRect(sx, sy, TILE, TILE);

          // Grid lines (subtle)
          if (timeOfDay !== 'night') {
            ctx.strokeStyle = 'rgba(255,255,255,0.02)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(sx, sy, TILE, TILE);
          }
        }
      }
    }

    // Objects
    for (const o of objects) {
      const ip = assets[o.id]; const sx = o.x * TILE + vx; const sy = o.y * TILE + vy;
      if (sx < -TILE || sx > w + TILE || sy < -TILE || sy > h + TILE) continue;
      if (ip && ic.current[ip]?.complete) {
        const isLight = o.id?.toLowerCase().includes('torch') || o.id?.toLowerCase().includes('lantern') || o.id?.toLowerCase().includes('light');
        if (isLight) {
          ctx.save();
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 8;
          ctx.drawImage(ic.current[ip], sx, sy, TILE, TILE);
          ctx.restore();
        } else {
          ctx.drawImage(ic.current[ip], sx, sy, TILE, TILE);
        }
      } else {
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.strokeRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
      }
    }

    // Tokens
    for (const t of tokens) {
      const sx = t.x * TILE + vx; const sy = t.y * TILE + vy;
      if (sx < -TILE || sx > w + TILE || sy < -TILE || sy > h + TILE) continue;
      const sp = sprite(t);
      const isMe = t.id === user?.id;
      const cx = sx + TILE / 2, cy = sy + TILE / 2;

      // Token glow
      if (isMe || t.type === 'monster') {
        ctx.save();
        ctx.shadowColor = isMe ? '#f59e0b' : '#ef4444';
        ctx.shadowBlur = isMe ? 12 : 6;
      }

      if (sp) {
        ctx.drawImage(sp, sx - 2, sy - 10, TILE + 4, TILE + 14);
      } else {
        const clr = isMe ? '#f59e0b' : t.type === 'player' ? '#c084fc' : t.type === 'npc' ? '#34d399' : '#f87171';
        // Base circle
        ctx.fillStyle = '#0a0a0f';
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = clr + 'cc';
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();

      // Selection ring for player
      if (isMe) {
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.48, 0, Math.PI * 2); ctx.stroke();
        // Pulsing outer ring
        ctx.strokeStyle = 'rgba(245,158,11,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.55 + Math.sin(Date.now() / 500) * 2, 0, Math.PI * 2); ctx.stroke();
      }

      // Name label
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText((t.name || '?').slice(0, 10), cx, sy + TILE + 12);

      // HP bar
      if (t.hp != null && t.maxHp && t.type !== 'player') {
        const bw = TILE * 0.5; const by = sy + TILE + 14;
        ctx.fillStyle = '#1c1917'; ctx.fillRect(cx - bw / 2, by, bw, 3);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(cx - bw / 2, by, bw * Math.max(0, t.hp / t.maxHp), 3);
      }
    }

    // Fog of war (cached canvas)
    if (me) {
      if (!fogCanvas.current || fogCanvas.current.width !== w || fogCanvas.current.height !== h) {
        fogCanvas.current = document.createElement('canvas');
        fogCanvas.current.width = w;
        fogCanvas.current.height = h;
      }
      const fc = fogCanvas.current;
      const fctx = fc.getContext('2d')!;
      fctx.clearRect(0, 0, w, h);
      fctx.fillStyle = timeOfDay === 'night' ? 'rgba(2,2,12,0.88)' : 'rgba(0,0,0,0.5)';
      fctx.fillRect(0, 0, w, h);

      const cx = px * TILE + TILE / 2 + vx;
      const cy = py * TILE + TILE / 2 + vy;
      const playerLight = fctx.createRadialGradient(cx, cy, TILE * 2, cx, cy, TILE * VIS);
      playerLight.addColorStop(0, 'rgba(0,0,0,0)');
      playerLight.addColorStop(0.5, 'rgba(0,0,0,0)');
      playerLight.addColorStop(1, timeOfDay === 'night' ? 'rgba(2,2,15,0.92)' : 'rgba(0,0,0,0.6)');
      fctx.fillStyle = playerLight; fctx.fillRect(0, 0, w, h);

      for (const o of objects) {
        if (!o.id?.toLowerCase().includes('torch') && !o.id?.toLowerCase().includes('lantern') && !o.id?.toLowerCase().includes('light')) continue;
        const lx = o.x * TILE + TILE / 2 + vx; const ly = o.y * TILE + TILE / 2 + vy;
        const light = fctx.createRadialGradient(lx, ly, 0, lx, ly, TILE * 4);
        light.addColorStop(0, 'rgba(255,200,100,0.15)');
        light.addColorStop(0.5, 'rgba(255,150,50,0.05)');
        light.addColorStop(1, 'rgba(0,0,0,0)');
        fctx.fillStyle = light; fctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(fc, 0, 0);
    }

    // Vignette
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.6, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);

    // Hover cell highlight
    if (hoverCell && me) {
      const hx = hoverCell.x * TILE + vx; const hy = hoverCell.y * TILE + vy;
      const dist = Math.abs(hoverCell.x - px) + Math.abs(hoverCell.y - py);
      if (dist <= 3 && dist > 0) {
        ctx.fillStyle = 'rgba(245,158,11,0.15)';
        ctx.fillRect(hx, hy, TILE, TILE);
        ctx.strokeStyle = 'rgba(245,158,11,0.5)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(hx + 0.5, hy + 0.5, TILE - 1, TILE - 1);
        ctx.setLineDash([]);
      }
    }
  }, [map, tokens, objects, assets, vx, vy, px, py, user?.id, timeOfDay, hoverCell, sprite]);

  // Resize
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const rs = () => {
      const p = c.parentElement; if (!p) return;
      const w = p.clientWidth;
      const h = p.clientHeight;
      c.width = w;
      c.height = h;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      if (!centered.current && me) {
        setVx(w / 2 - me.x * TILE - TILE / 2);
        setVy(h / 2 - me.y * TILE - TILE / 2);
        centered.current = true;
      }
      draw();
    };
    rs();
    const ro = new ResizeObserver(rs); ro.observe(c.parentElement!);
    return () => ro.disconnect();
  }, [me, draw]);

  useEffect(() => { draw(); }, [draw]);

  // Only draw on game tick, not every animation frame
  useEffect(() => {
    if (mode !== 'play') return;
    const interval = setInterval(draw, 100);
    return () => clearInterval(interval);
  }, [mode, draw]);

  // Click to move
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!me || loading || end) return;
    const rect = cv.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const tx = Math.floor((mx - vx) / TILE);
    const ty = Math.floor((my - vy) / TILE);
    if (tx < 0 || ty < 0 || tx >= (map[0]?.length || 40) || ty >= map.length) return;

    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    if (dist === 0) return;
    if (dist > 3) return; // Max 3 tiles per click

    const targetTile = map[ty]?.[tx];
    if (targetTile?.toLowerCase().includes('wall')) return;

    // Check if clicking on an NPC
    const targetToken = tokens.find(t => t.x === tx && t.y === ty && t.type !== 'player');
    if (targetToken) {
      setLoading(true); setOpts([]);
      socket?.emit('game:action', { sessionId, action: `Подойти к ${targetToken.name} и заговорить` });
      return;
    }

    const dirs: string[] = [];
    if (tx > px) dirs.push('направо');
    if (tx < px) dirs.push('налево');
    if (ty > py) dirs.push('вниз');
    if (ty < py) dirs.push('вверх');

    setLoading(true); setOpts([]);
    socket?.emit('game:action', { sessionId, action: `Идти ${dirs.join(' и ')}` });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (drag) {
      setVx(e.clientX - drag.x);
      setVy(e.clientY - drag.y);
      return;
    }
    if (!cv.current) return;
    const rect = cv.current.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const tx = Math.floor((mx - vx) / TILE);
    const ty = Math.floor((my - vy) / TILE);
    if (tx < 0 || ty < 0 || tx >= (map[0]?.length || 40) || ty >= map.length) {
      setHoverCell(null);
      return;
    }
    setHoverCell({ x: tx, y: ty });
  };

  const act = (a: string) => {
    if (!socket || !sessionId || end || loading) return;
    setLoading(true); setOpts([]);
    socket.emit('game:action', { sessionId, action: a });
  };

  const handleSave = () => {
    if (!socket || !sessionId) return;
    setSaving(true);
    socket.emit('game:save', { sessionId, name: 'Автосохранение' });
  };

  // Loading screen
  if (mode === 'load') return (
    <div className="h-full flex items-center justify-center bg-[#06060c]">
      <div className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-purple-500/30">
          <Sparkles size={26} className="text-white" />
        </motion.div>
        <p className="font-mono text-sm text-zinc-500">Загрузка игры...</p>
      </div>
    </div>
  );

  // Generation screen
  if (mode === 'gen') {
    const genSteps = ['Сканирование ассетов...', 'Нейросеть создаёт мир...', 'Генерация карты...', 'Расстановка NPC...', 'Подготовка сюжета...'];
    return (
      <div className="h-full flex items-center justify-center bg-[#06060c]">
        <div className="text-center w-96">
          {/* Central orb */}
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-700 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-purple-500/40">
            <Sparkles size={44} className="text-white" />
          </motion.div>

          {/* Orbiting particles */}
          {[0, 1, 2, 3].map(i => (
            <motion.div key={i} className="absolute w-2 h-2 rounded-full bg-purple-400/60"
              style={{
                top: '50%', left: '50%',
                transform: `rotate(${i * 90}deg) translateY(-60px)`,
              }}
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.5 + i * 0.3, repeat: Infinity }}
            />
          ))}

          {/* Step text */}
          <motion.p key={genMsg.step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="font-mono text-zinc-300 text-lg mb-6">{genMsg.message}</motion.p>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden mb-3 backdrop-blur">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-500"
              animate={{ width: `${genPct}%` }}
              transition={{ duration: 0.5 }} />
          </div>

          <p className="font-mono text-[10px] text-zinc-600">{Math.round(genPct)}%</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {genSteps.map((s, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i <= genMsg.step ? 'bg-purple-500 scale-125 shadow-sm shadow-purple-500/50' : 'bg-white/[0.06]'
              }`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#06060c]">
      {/* LEFT PANEL */}
      <div className="w-[340px] bg-gradient-to-b from-[#09090f] to-[#0c0c14] border-r border-white/[0.05] flex flex-col shrink-0">
        {/* Header */}
        <div className="h-12 border-b border-white/[0.05] flex items-center px-4 gap-2 shrink-0">
          <button onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-400 hover:text-zinc-200 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="w-6 h-6 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Sparkles size={12} className="text-purple-400" />
          </div>
          <span className="font-mono text-xs text-zinc-300 font-medium">Дедушка-рассказчик</span>
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
            title="Сохранить игру">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          </button>
        </div>

        {/* Saved message */}
        <AnimatePresence>
          {savedMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-[10px] font-mono text-emerald-400 text-center">
              {savedMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Description */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {desc && (
            <motion.div key={desc.slice(0, 30)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-purple-600/[0.06] to-violet-600/[0.04] border border-purple-500/[0.08] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center">
                  <span className="text-[10px]">📖</span>
                </div>
                <span className="font-mono text-[10px] text-amber-400/80">Дедушка говорит</span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">{desc}</p>
            </motion.div>
          )}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500/[0.05] border border-amber-500/[0.08]">
              <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-amber-400/70">Дедушка думает...</span>
            </motion.div>
          )}

          {end && epi && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-amber-600/[0.08] to-orange-600/[0.04] border border-amber-500/[0.12] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center">
                  <span className="text-[10px]">🏁</span>
                </div>
                <span className="font-mono text-[10px] text-amber-400">Эпилог</span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed font-sans">{epi}</p>
            </motion.div>
          )}
        </div>

        {/* Options */}
        <div className="border-t border-white/[0.05] p-3">
          {opts.length > 0 && !loading && (
            <div className="space-y-1 max-h-[220px] overflow-y-auto">
              <p className="text-[9px] text-zinc-600 text-center mb-1">▾ Что делать? ▾</p>
              {opts.map((o, i) => (
                <motion.button key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => act(o)}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] hover:border-purple-500/20 border border-transparent text-xs font-mono text-zinc-300 transition-all"
                >▸ {o}</motion.button>
              ))}
            </div>
          )}
          {opts.length === 0 && !loading && !end && (
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-600 text-center mb-1">▾ Действия ▾</p>
              {['Осмотреться вокруг', 'Поговорить с NPC', 'Идти дальше', 'Проверить инвентарь'].map((o, i) => (
                <button key={i} onClick={() => act(o)}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-purple-500/10 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-all"
                >▸ {o}</button>
              ))}
            </div>
          )}
          {loading && opts.length === 0 && (
            <p className="text-[10px] text-zinc-600 text-center py-2">Ожидайте ответа...</p>
          )}
        </div>

        {/* HUD: Inventory + HP */}
        <div className="p-3 border-t border-white/[0.05] bg-[#08080e]">
          {/* HP */}
          <div className="flex items-center gap-3 mb-3">
            <Heart size={14} className="text-red-400" />
            <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                animate={{ width: `${(hp / mhp) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>
            <span className="font-mono text-[11px] text-zinc-300 tabular-nums">{hp}/{mhp}</span>
          </div>

          {/* Inventory */}
          <div className="flex items-center gap-2 mb-2">
            <Package size={12} className="text-zinc-500" />
            <span className="font-mono text-[10px] text-zinc-500">Инвентарь</span>
            <span className="font-mono text-[9px] text-zinc-600 ml-auto">{inv.length} предм.</span>
          </div>
          {inv.length > 0 ? (
            <div className="grid grid-cols-5 gap-1.5">
              {inv.map((it, i) => {
                const p = assets[`items_${it.id?.replace('item_', '').replace(/-/g, '_')}`]
                  || Object.values(assets).find(x => x.toLowerCase().includes(it.id?.toLowerCase().replace(/[^a-z]/g, '') || ''));
                return (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.04] rounded-lg p-1.5 flex flex-col items-center hover:bg-white/[0.06] transition-colors cursor-default"
                    title={it.name}>
                    {p && ic.current[p]?.complete
                      ? <img src={p} className="w-6 h-6 object-contain" />
                      : <span className="text-sm">📦</span>}
                    <span className="text-[7px] font-mono text-zinc-500 mt-0.5">{it.name.slice(0, 6)}</span>
                    <span className="text-[7px] font-mono text-zinc-400">×{it.qty}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[9px] text-zinc-600 text-center py-1">Пусто</p>
          )}
        </div>
      </div>

      {/* CANVAS */}
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={cv} className="w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={e => {
            if (e.button === 1 || e.button === 2 || e.shiftKey) {
              setDrag({ x: e.clientX - vx, y: e.clientY - vy });
            }
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => setDrag(null)}
          onMouseLeave={() => { setDrag(null); setHoverCell(null); }}
          onContextMenu={e => e.preventDefault()} />

        {/* HUD overlays */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {/* Time of day */}
          <div className={`text-[9px] font-mono px-2.5 py-1.5 rounded-lg backdrop-blur-md border ${
            timeOfDay === 'night'
              ? 'bg-indigo-950/60 border-indigo-500/20 text-indigo-300'
              : 'bg-amber-950/40 border-amber-500/20 text-amber-300'
          }`}>
            {timeOfDay === 'night' ? '🌙 ночь' : '☀️ день'}
          </div>
          {/* Cam hint */}
          <div className="text-[8px] font-mono text-zinc-500 bg-[#06060c]/80 backdrop-blur-md border border-white/[0.04] px-2.5 py-1.5 rounded-lg">
            ПКМ/Shift — камера · Клик — идти
          </div>
        </div>

        {me && (
          <div className="absolute top-4 left-4 flex items-center gap-3">
            <div className="text-[10px] font-mono px-3 py-1.5 rounded-lg backdrop-blur-md bg-[#06060c]/80 border border-white/[0.06] text-zinc-300">
              {me.name} · x:{me.x} y:{me.y}
            </div>
            {hp < mhp * 0.3 && (
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}
                className="text-[9px] font-mono px-2.5 py-1 rounded-lg backdrop-blur-md bg-red-950/40 border border-red-500/20 text-red-400">
                ⚠ Низкое HP
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
