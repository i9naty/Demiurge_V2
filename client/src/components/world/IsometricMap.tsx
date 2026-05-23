import { useRef, useEffect, useState, useCallback } from 'react';
import { getTile } from '../../utils/worldGen';

interface Tile { x: number; y: number; terrain: string; elevation: number; resource_type: string|null; resource_amount: number; }
interface Building { id: string; tile_x: number; tile_y: number; building_type: string; name: string; health?: number; }
interface NPC { id: string; name: string; x: number; y: number; is_unique?: boolean; }

interface Props {
  buildings: Building[]; npcs: NPC[]; playerPos: { x: number; y: number };
  buildingMode: boolean; onTileClick: (x: number, y: number) => void;
  onGather: () => void; onBuild: () => void;
  colors: Record<string, string>; seed: number; biome: string; density: number;
}

const TW = 64, TH = 32;

export function IsometricMap({ buildings, npcs, playerPos, buildingMode, onTileClick, onGather, onBuild, colors, seed, biome, density }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{x:number;y:number}|null>(null);
  const [hover, setHover] = useState<{x:number;y:number}|null>(null);
  const [anim, setAnim] = useState<{x:number;y:number;fromX:number;fromY:number;toX:number;toY:number;t:number}|null>(null);
  const animRef = useRef(0);
  const tileCache = useRef(new Map<string,Tile>());

  const iso = useCallback((ix: number, iy: number, el = 0) => ({
    x: (ix - iy) * (TW / 2) + view.x,
    y: (ix + iy) * (TH / 2) - el * TH * 0.3 + view.y,
  }), [view]);

  const screenToIso = useCallback((sx: number, sy: number) => {
    const c = canvasRef.current; if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      x: Math.round((sx - r.left - view.x) / (TW / 2) + (sy - r.top - view.y) / (TH / 2)) / 2,
      y: Math.round((sy - r.top - view.y) / (TH / 2) - (sx - r.left - view.x) / (TW / 2)) / 2,
    };
  }, [view]);

  const animateStep = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    let t = 0;
    const fn = () => {
      t += 0.12;
      if (t >= 1) { setAnim(null); return; }
      setAnim({ x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t, fromX, fromY, toX, toY, t });
      animRef.current = requestAnimationFrame(fn);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(fn);
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, w, h);

    const pd = anim || playerPos;
    const R = 22;
    const bm = new Map<string, Building>();
    if (Array.isArray(buildings)) buildings.forEach(b => bm.set(`${b.tile_x},${b.tile_y}`, b));
    const nm = new Map<string, NPC[]>();
    if (Array.isArray(npcs)) npcs.forEach(n => { const k = `${Math.round(n.x)},${Math.round(n.y)}`; if (!nm.has(k)) nm.set(k, []); nm.get(k)!.push(n); });

    for (let sum = 0; sum <= R * 2; sum++) {
      for (let x = Math.max(0, sum - R); x <= Math.min(R, sum); x++) {
        const y = sum - x; if (x > R || y > R) continue;
        const tx = Math.round(pd.x) - Math.floor(R / 2) + x;
        const ty = Math.round(pd.y) - Math.floor(R / 2) + y;
        const key = `${tx},${ty}`;
        let tile = tileCache.current.get(key);
        if (!tile) { tile = getTile(tx, ty, seed, biome, density); tileCache.current.set(key, tile); if (tileCache.current.size > 500) { const first = tileCache.current.keys().next().value; if (first) tileCache.current.delete(first); } }
        const building = bm.get(key);
        const npcsHere = nm.get(key);
        const pos = iso(tx, ty, tile.elevation);
        if (pos.x < -TW || pos.x > w + TW || pos.y < -TH * 2 || pos.y > h + TH * 2) continue;

        const c0 = colors[tile.terrain] || '#4ade80';
        const hov = hover?.x === tx && hover?.y === ty;
        const isPlayer = tx === Math.round(pd.x) && ty === Math.round(pd.y);

        ctx.save(); ctx.translate(pos.x, pos.y);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.moveTo(0, TH/2+2); ctx.lineTo(TW/2, TH+2); ctx.lineTo(0, TH*1.5+2); ctx.lineTo(-TW/2, TH+2); ctx.closePath(); ctx.fill();

        // Diamond tile
        const g = ctx.createLinearGradient(0, TH/2, TW/2, TH*1.5);
        g.addColorStop(0, c0); g.addColorStop(0.5, c0+'dd'); g.addColorStop(1, c0+'99');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, TH/2); ctx.lineTo(TW/2, TH); ctx.lineTo(0, TH*1.5); ctx.lineTo(-TW/2, TH); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hov ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.05)';
        ctx.lineWidth = hov ? 1.2 : 0.5; ctx.stroke();

        // Terrain details
        if (tile.terrain === 'forest' || tile.terrain === 'deep_forest') {
          ctx.fillStyle = '#0a3d0a';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-TW/6 + i*TW/5, TH*0.85, 4, 0, Math.PI*2); ctx.fill(); }
        } else if (tile.terrain === 'mountain' || tile.terrain === 'rocky') {
          ctx.fillStyle = '#555'; ctx.beginPath(); ctx.moveTo(-TW/5, TH*0.9); ctx.lineTo(0, TH*0.3); ctx.lineTo(TW/5, TH*0.9); ctx.closePath(); ctx.fill();
        } else if (tile.terrain === 'water' || tile.terrain === 'river' || tile.terrain === 'lake') {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-TW/4 + i*8, TH*0.9); ctx.quadraticCurveTo(i*4, TH*0.7, -TW/4 + i*8 + 4, TH*0.95); ctx.stroke(); }
        } else if (tile.terrain === 'cavern_entrance' || tile.terrain === 'dungeon_entrance') {
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, TH*0.85, 8, 5, 0, Math.PI, 0); ctx.fill();
        }

        // Resource
        if (tile.resource_type && tile.resource_amount > 0) {
          const icons: Record<string,string> = { wood:'🪵', stone:'🪨', ore:'💎', gold:'✨', gems:'💠', food:'🍎', herbs:'🌿' };
          ctx.font = `${TH*0.4}px sans-serif`; ctx.textAlign = 'center';
          ctx.fillText(icons[tile.resource_type] || '•', 0, TH*0.85);
        }

        // Building
        if (building) {
          const icons: Record<string,string> = { house:'🏠', workshop:'🔧', farm:'🌾', mine:'⛏', temple:'⛪', wall:'🧱', tower:'🗼', castle:'🏰', tavern:'🍺', market:'🏪' };
          ctx.font = `${TH*0.6}px sans-serif`; ctx.textAlign = 'center';
          ctx.fillText(icons[building.building_type] || '🏗', 0, TH*0.65);
        }

        // NPC
        if (npcsHere) {
          npcsHere.slice(0, 3).forEach((n, i) => {
            ctx.font = `${TH*0.35}px sans-serif`; ctx.textAlign = 'center';
            ctx.fillText(n.is_unique ? '⭐' : '👤', (i-1)*8, TH*1.15);
          });
        }

        // Player
        if (isPlayer) {
          const glow = ctx.createRadialGradient(0, TH, 0, 0, TH, TW);
          glow.addColorStop(0, 'rgba(59,130,246,0.5)'); glow.addColorStop(0.4, 'rgba(59,130,246,0.1)'); glow.addColorStop(1, 'rgba(59,130,246,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, TH, TW/2, 0, Math.PI*2); ctx.fill();
          ctx.font = `${TH*0.7}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🧙', 0, TH*0.55);
        }

        // Hover
        if (hov && buildingMode) { ctx.fillStyle = 'rgba(245,158,11,0.15)'; ctx.beginPath(); ctx.moveTo(0, TH/2); ctx.lineTo(TW/2, TH); ctx.lineTo(0, TH*1.5); ctx.lineTo(-TW/2, TH); ctx.closePath(); ctx.fill(); }

        ctx.restore();
      }
    }
  }, [view, buildings, npcs, playerPos, hover, buildingMode, colors, seed, biome, density, iso, anim]);

  const centered = useRef(false);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const rs = () => {
      const p = c.parentElement; if (!p) return;
      c.width = p.clientWidth; c.height = p.clientHeight;
      if (!centered.current) {
        setView({
          x: c.width / 2 - (playerPos.x - playerPos.y) * (TW / 2),
          y: c.height / 2 - (playerPos.x + playerPos.y) * (TH / 2),
        });
        centered.current = true;
      }
    };
    rs(); const ro = new ResizeObserver(rs); ro.observe(c.parentElement!); window.addEventListener('resize', rs);
    return () => { ro.disconnect(); window.removeEventListener('resize', rs); };
  }, []);
  useEffect(() => { draw(); }, [draw]);

  const onDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) { setDrag({ x: e.clientX - view.x, y: e.clientY - view.y }); return; }
    const iso = screenToIso(e.clientX, e.clientY); if (!iso) return;
    if (buildingMode) { onBuild(); return; }
    const dx = iso.x - playerPos.x, dy = iso.y - playerPos.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
      animateStep(playerPos.x, playerPos.y, Math.round(iso.x), Math.round(iso.y));
      onTileClick(Math.round(iso.x), Math.round(iso.y));
    } else if (dx !== 0 || dy !== 0) {
      const nx = playerPos.x + Math.sign(dx), ny = playerPos.y + Math.sign(dy);
      animateStep(playerPos.x, playerPos.y, nx, ny);
      onTileClick(nx, ny);
    }
  };
  const onMove = (e: React.MouseEvent) => {
    if (drag) { setView({ x: e.clientX - drag.x, y: e.clientY - drag.y }); return; }
    const iso = screenToIso(e.clientX, e.clientY); if (iso) setHover({ x: Math.floor(iso.x), y: Math.floor(iso.y) });
  };
  const onUp = () => setDrag(null);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" style={{cursor: buildingMode?'crosshair':drag?'grabbing':'pointer'}}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onContextMenu={e=>e.preventDefault()} />
      <div className="absolute top-2 right-3 text-[10px] font-mono text-zinc-500 glass-panel px-3 py-1.5">Клик=идти · Shift+Drag=камера · ПКМ=камера</div>
      {hover && <div className="absolute bottom-2 right-3 glass-panel px-3 py-1.5 font-mono text-[10px] text-zinc-400">[{hover.x},{hover.y}]{buildingMode&&<span className="text-amber-400 ml-2">Стройка</span>}</div>}
    </div>
  );
}
