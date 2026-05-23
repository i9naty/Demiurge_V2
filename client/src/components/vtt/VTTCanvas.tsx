import { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Lock } from 'lucide-react';

interface Token { id: string; name: string; imageUrl: string | null; x: number; y: number; width: number; height: number; }
interface Drawing { tool: string; points: {x:number;y:number}[]; color: string; width: number; }
interface Zone { id: string; type: 'damage'|'heal'|'trigger'; name: string; bounds: {x:number;y:number;w:number;h:number}; value: number; color: string; }
interface FogOp { x: number; y: number; r: number; add: boolean; }
interface Wall { x1: number; y1: number; x2: number; y2: number; type: 'solid'|'window'|'door'; }
interface Props {
  mapUrl?: string; tokens?: Token[]; fogEnabled?: boolean; gridType?: 'square'|'hex'|'iso';
  gridVisible?: boolean; gridSize?: number; gridOffset?: { x: number; y: number };
  snapToGrid?: boolean; rulerMode?: boolean; selectedTool?: string;
  onCanvasClick?: (x: number, y: number) => void;
  onMeasure?: (dist: string) => void;
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenDelete?: (id: string) => void;
  onTokenSelect?: (token: Token | null) => void;
  drawColor?: string; drawWidth?: number;
  weather?: 'none' | 'rain' | 'snow' | 'fog';
  showHidden?: boolean;
  darkvision?: boolean;
  showLabels?: boolean;
  showGmLayer?: boolean;
  onGridCalibrate?: (size: number) => void;
  socket?: any; roomId?: string; onMapChange?: (url: string) => void;
}

// LOS: check if a point (px,py) can see (tx,ty) through walls
function hasLOS(px: number, py: number, tx: number, ty: number, walls: Wall[]): boolean {
  for (const w of walls) {
    if (w.type === 'window') continue;
    const s1x = w.x2 - w.x1, s1y = w.y2 - w.y1;
    const s2x = tx - px, s2y = ty - py;
    const denom = s1x * s2y - s1y * s2x;
    if (Math.abs(denom) < 0.0001) continue;
    const t = ((px - w.x1) * s2y - (py - w.y1) * s2x) / denom;
    const u = ((px - w.x1) * s1y - (py - w.y1) * s1x) / denom;
    if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) return false;
  }
  return true;
}

// Compute visible polygon using raycasting from (cx,cy) with walls
function computeVisibility(cx: number, cy: number, walls: Wall[], range: number): {x:number;y:number}[] {
  const angles: number[] = [];
  const addAngle = (a: number) => { const na = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); angles.push(na); };

  for (const w of walls) {
    const dx1 = w.x1 - cx, dy1 = w.y1 - cy, dx2 = w.x2 - cx, dy2 = w.y2 - cy;
    const a1 = Math.atan2(dy1, dx1), a2 = Math.atan2(dy2, dx2);
    addAngle(a1 - 0.0001); addAngle(a1); addAngle(a1 + 0.0001);
    addAngle(a2 - 0.0001); addAngle(a2); addAngle(a2 + 0.0001);
  }
  // Add cardinal angles
  for (let i = 0; i < 360; i += 2) addAngle(i * Math.PI / 180);

  angles.sort((a, b) => a - b);

  const points: {x:number;y:number}[] = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let hit = { x: cx + dx * range, y: cy + dy * range, blocked: false };
    let minT = range;
    for (const w of walls) {
      if (w.type === 'window') continue;
      const s1x = w.x2 - w.x1, s1y = w.y2 - w.y1;
      const s2x = dx, s2y = dy;
      const denom = s1x * s2y - s1y * s2x;
      if (Math.abs(denom) < 0.0001) continue;
      const t = ((cx - w.x1) * s2y - (cy - w.y1) * s2x) / denom;
      const u = ((cx - w.x1) * s1y - (cy - w.y1) * s1x) / denom;
      if (t > 0.0001 && t < 0.9999 && u > 0 && u < minT) {
        minT = u; hit = { x: cx + dx * u, y: cy + dy * u, blocked: true };
      }
    }
    points.push({ x: hit.x, y: hit.y });
  }
  return points;
}

export function VTTCanvas(p: Props) {
  const tokens = p.tokens || [];
  const gridSize = p.gridSize || 70;
  const gridOffset = p.gridOffset || { x: 0, y: 0 };
  const snapToGrid = p.snapToGrid ?? true;
  const drawC = p.drawColor || '#ef4444';
  const drawW = p.drawWidth || 3;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapImg = useRef<HTMLImageElement | null>(null);
  const tokImg = useRef<Map<string, HTMLImageElement>>(new Map());
  const fogCv = useRef<HTMLCanvasElement | null>(null);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [rStart, setRStart] = useState<{x:number;y:number}|null>(null);
  const [rEnd, setREnd] = useState<{x:number;y:number}|null>(null);
  const [menu, setMenu] = useState<{x:number;y:number;tid:string}|null>(null);
  const [dX, setDX] = useState(0); const [dY, setDY] = useState(0);
  const pStart = useRef({x:0,y:0}); const dStart = useRef({x:0,y:0});
  const [selBox, setSelBox] = useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const [selTokens, setSelTokens] = useState<Set<string>>(new Set());
  const [resizeToken, setResizeToken] = useState<string | null>(null);
  const [rotateToken, setRotateToken] = useState<string | null>(null);
  const [facingAngles, setFacingAngles] = useState<Record<string, number>>({});
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const isRuler = p.rulerMode || p.selectedTool === 'ruler';
  const isFog = p.fogEnabled || p.selectedTool === 'fog';
  const isDraw = p.selectedTool === 'draw';
  const isTemplate = p.selectedTool === 'template';

  // Drawing state
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [curDrawing, setCurDrawing] = useState<Drawing | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [fogOps, setFogOps] = useState<FogOp[]>([]);
  const [zoneDraw, setZoneDraw] = useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const [effects, setEffects] = useState<{tokenId:string;type:'damage'|'heal';x:number;y:number;t:number;value:number}[]>([]);
  const [calibrateRect, setCalibrateRect] = useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const isCalibrate = p.selectedTool === 'calibrate';

  // Dynamic fog walls
  const [walls, setWalls] = useState<Wall[]>([]);
  const [wallDrawing, setWallDrawing] = useState<{points:{x:number;y:number}[]}|null>(null);
  const [revealedTiles, setRevealedTiles] = useState<Set<string>>(new Set());
  const isWallTool = p.selectedTool === 'wall';

  useEffect(() => {
    if (!p.mapUrl) { mapImg.current = null; return; }
    const img = new Image(); img.onload = () => { mapImg.current = img; };
    img.onerror = () => { mapImg.current = null; }; img.src = p.mapUrl;
  }, [p.mapUrl]);

  useEffect(() => {
    tokens.forEach(t => { if (t.imageUrl && !tokImg.current.has(t.id)) { const i = new Image(); i.src = t.imageUrl; i.onload = () => tokImg.current.set(t.id, i); } });
  }, [tokens]);

  const snap = (v: number) => snapToGrid ? Math.round(v / gridSize) * gridSize : v;
  const measureDist = (x1:number,y1:number,x2:number,y2:number) => {
    const dx=Math.abs(x2-x1),dy=Math.abs(y2-y1),mx=Math.max(dx,dy),mn=Math.min(dx,dy);
    const cells = mx + Math.floor(mn / 2); return {cells, feet: cells * 5};
  };

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.width / dpr, ch = c.height / dpr;
    ctx.save(); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0a0a10'; ctx.fillRect(0, 0, cw, ch);

    if (mapImg.current) ctx.drawImage(mapImg.current, offX, offY, mapImg.current.width * zoom, mapImg.current.height * zoom);

    const gs = gridSize * zoom, ox = offX + gridOffset.x * zoom, oy = offY + gridOffset.y * zoom;
    if (p.gridVisible && gs > 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
      if (p.gridType === 'square') {
        const sx = ox % gs, sy = oy % gs; ctx.beginPath();
        for (let x = sx; x < cw; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
        for (let y = sy; y < ch; y += gs) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
        ctx.stroke();
      } else if (p.gridType === 'hex') {
        const hw = gs / 2, hh = gs * 0.433; ctx.beginPath();
        for (let row = -2; row < ch / (hh * 2) + 2; row++) {
          for (let col = -2; col < cw / (hw * 1.5) + 2; col++) {
            const cx = ox + col * hw * 3 + (row % 2) * hw, cy = oy + row * hh * 2;
            ctx.moveTo(cx - hw, cy); ctx.lineTo(cx - hw / 2, cy - hh); ctx.lineTo(cx + hw / 2, cy - hh);
            ctx.lineTo(cx + hw, cy); ctx.lineTo(cx + hw / 2, cy + hh); ctx.lineTo(cx - hw / 2, cy + hh); ctx.closePath();
          }
        }
        ctx.stroke();
      }
    }

    tokens.forEach(t => {
      const tx = t.x * zoom + offX, ty = t.y * zoom + offY, tw = t.width * zoom, th = t.height * zoom;
      if (tx > cw || ty > ch || tx + tw < 0 || ty + th < 0) return;
      const cx = tx + tw / 2, cy = ty + th / 2, r = Math.min(tw, th) / 2;
      const img = tokImg.current.get(t.id);
      ctx.save();
      if (hoverId === t.id || dragId === t.id) { ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 8; }
      if (img) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, tx, ty, tw, th); }
      else { ctx.fillStyle = dragId === t.id ? '#f59e0b' : '#a855f7'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();

      // Name label
      {if (p.showLabels !== false) {
        ctx.fillStyle = '#e2e8f0'; ctx.font = `${Math.max(9, 10 * zoom)}px "JetBrains Mono"`; ctx.textAlign = 'center';
        ctx.fillText((t.name || '?').slice(0, 10), cx, cy + th / 2 + 12 * zoom);
      }}

      // Selection highlight
      if (selTokens.has(t.id)) {
        ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.setLineDash([4, 2]);
        ctx.strokeRect(tx - 2, ty - 2, tw + 4, th + 4); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(168,85,247,0.08)'; ctx.fillRect(tx - 2, ty - 2, tw + 4, th + 4);
      }
    });

    // Box selection rectangle
    if (selBox) {
      const x = Math.min(selBox.x1, selBox.x2), y = Math.min(selBox.y1, selBox.y2);
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, Math.abs(selBox.x2 - selBox.x1), Math.abs(selBox.y2 - selBox.y1));
      ctx.fillStyle = 'rgba(168,85,247,0.05)';
      ctx.fillRect(x, y, Math.abs(selBox.x2 - selBox.x1), Math.abs(selBox.y2 - selBox.y1));
      ctx.setLineDash([]);
    }

    // Resize/Rotate handles for selected tokens
    const withHandles = selTokens.size === 1 ? tokens.find(t => selTokens.has(t.id)) : null;
    if (withHandles) {
      const t = withHandles;
      const tx = t.x * zoom + offX, ty = t.y * zoom + offY, tw = t.width * zoom, th = t.height * zoom;
      const angle = facingAngles[t.id] || 0;
      const cx = tx + tw / 2, cy = ty + th / 2;
      const handleSize = 7;

      ctx.save();
      ctx.translate(cx, cy);
      if (angle) ctx.rotate(angle * Math.PI / 180);
      ctx.translate(-cx, -cy);

      // Facing arrow
      ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
      const arrowTip = tx + tw / 2; const arrowY = ty - 16 * zoom;
      ctx.beginPath(); ctx.moveTo(arrowTip, arrowY); ctx.lineTo(arrowTip - 6 * zoom, arrowY + 10 * zoom);
      ctx.lineTo(arrowTip + 6 * zoom, arrowY + 10 * zoom); ctx.closePath(); ctx.fill();

      // Corner handles
      const corners = [{x: tx - handleSize/2, y: ty - handleSize/2}, {x: tx + tw - handleSize/2, y: ty - handleSize/2},
                       {x: tx + tw - handleSize/2, y: ty + th - handleSize/2}, {x: tx - handleSize/2, y: ty + th - handleSize/2}];
      corners.forEach(c => {
        ctx.fillStyle = '#a855f7'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.fillRect(c.x, c.y, handleSize, handleSize); ctx.strokeRect(c.x, c.y, handleSize, handleSize);
      });

      // Rotation handle (top center)
      const rotHandle = { x: cx - handleSize/2, y: ty - 28 * zoom - handleSize/2 };
      ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#fff';
      ctx.fillRect(rotHandle.x, rotHandle.y, handleSize, handleSize); ctx.strokeRect(rotHandle.x, rotHandle.y, handleSize, handleSize);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(cx, ty - 20 * zoom); ctx.lineTo(cx, rotHandle.y + handleSize); ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }

    if (isRuler && rStart) {
      const end = rEnd || rStart;
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(rStart.x, rStart.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(rStart.x, rStart.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(end.x, end.y, 3, 0, Math.PI * 2); ctx.fill();
      const sx = Math.round((rStart.x - offX) / gs), sy = Math.round((rStart.y - offY) / gs);
      const ex = Math.round((end.x - offX) / gs), ey = Math.round((end.y - offY) / gs);
      const d = measureDist(sx, sy, ex, ey);
      const mx = (rStart.x + end.x) / 2, my = (rStart.y + end.y) / 2;
      ctx.fillStyle = '#0a0a10'; ctx.fillRect(mx - 40, my - 20, 80, 18);
      ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px "JetBrains Mono"'; ctx.textAlign = 'center';
      ctx.fillText(`${d.cells}кл · ${d.feet}ft`, mx, my - 6);
      if (p.onMeasure) p.onMeasure(`${d.cells} кл (${d.feet} ft)`);
    }

    if (isFog) {
      if (!fogCv.current || fogCv.current.width !== cw || fogCv.current.height !== ch) {
        fogCv.current = document.createElement('canvas'); fogCv.current.width = cw; fogCv.current.height = ch;
      }
      const fc = fogCv.current, fctx = fc.getContext('2d')!;
      fctx.clearRect(0, 0, cw, ch);

      const visTokens = p.showHidden ? tokens : tokens.filter(t => !(t as any).hidden);

      if (walls.length > 0 && visTokens.length > 0) {
        // Dynamic LOS fog
        fctx.fillStyle = 'rgba(0,0,0,0.85)'; fctx.fillRect(0, 0, cw, ch);
        const range = gridSize * zoom * (p.darkvision ? 12 : 6);

        for (const t of visTokens) {
          const cx = t.x * zoom + offX + t.width * zoom / 2;
          const cy = t.y * zoom + offY + t.height * zoom / 2;
          const visPoly = computeVisibility(cx, cy, walls, range);

          fctx.save();
          fctx.beginPath();
          fctx.moveTo(visPoly[0].x, visPoly[0].y);
          for (let i = 1; i < visPoly.length; i++) fctx.lineTo(visPoly[i].x, visPoly[i].y);
          fctx.closePath();
          fctx.globalCompositeOperation = 'destination-out';
          fctx.fillStyle = 'rgba(0,0,0,1)';
          fctx.fill();

          // Soft edge glow
          fctx.globalCompositeOperation = 'source-over';
          const grad = fctx.createRadialGradient(cx, cy, range * 0.4, cx, cy, range);
          grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.3)');
          fctx.fillStyle = grad; fctx.fill();
          fctx.restore();
        }
      } else {
        // Simple fog with token vision circles
        fctx.fillStyle = 'rgba(0,0,0,0.65)'; fctx.fillRect(0, 0, cw, ch);

        // Fog brush strokes
        for (const fo of fogOps) {
          fctx.save(); fctx.beginPath();
          fctx.arc(fo.x * zoom + offX, fo.y * zoom + offY, fo.r * zoom, 0, Math.PI * 2);
          if (fo.add) { fctx.fillStyle = 'rgba(0,0,0,0.65)'; fctx.fill(); }
          else {
            fctx.globalCompositeOperation = 'destination-out';
            const g = fctx.createRadialGradient(fo.x * zoom + offX, fo.y * zoom + offY, 0, fo.x * zoom + offX, fo.y * zoom + offY, fo.r * zoom);
            g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            fctx.fillStyle = g; fctx.fill(); fctx.globalCompositeOperation = 'source-over';
          }
          fctx.restore();
        }

        visTokens.forEach(t => {
          const cx = t.x * zoom + offX + t.width * zoom / 2, cy = t.y * zoom + offY + t.height * zoom / 2;
          const v = gs * (p.darkvision ? 6 : 3); const g = fctx.createRadialGradient(cx, cy, v * 0.3, cx, cy, v);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0)');
          g.addColorStop(1, 'rgba(0,0,0,0.65)'); fctx.fillStyle = g; fctx.fillRect(cx - v, cy - v, v * 2, v * 2);
        });
      }

      ctx.drawImage(fc, 0, 0);
    }

    // Dynamic fog walls rendering
    for (const w of walls) {
      ctx.strokeStyle = w.type === 'solid' ? '#ef4444' : w.type === 'window' ? '#3b82f6' : '#f59e0b';
      ctx.lineWidth = 2; ctx.setLineDash(w.type === 'door' ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(w.x1 * zoom + offX, w.y1 * zoom + offY);
      ctx.lineTo(w.x2 * zoom + offX, w.y2 * zoom + offY); ctx.stroke(); ctx.setLineDash([]);
      // Endpoint dots
      [w.x1, w.x2].forEach((_, i) => {
        const wx = (i === 0 ? w.x1 : w.x2) * zoom + offX;
        const wy = (i === 0 ? w.y1 : w.y2) * zoom + offY;
        ctx.fillStyle = w.type === 'solid' ? '#ef4444' : w.type === 'window' ? '#3b82f6' : '#f59e0b';
        ctx.beginPath(); ctx.arc(wx, wy, 3, 0, Math.PI * 2); ctx.fill();
      });
    }
    // Wall being drawn
    if (wallDrawing && wallDrawing.points.length > 0) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wallDrawing.points[0].x * zoom + offX, wallDrawing.points[0].y * zoom + offY);
      for (let i = 1; i < wallDrawing.points.length; i++) ctx.lineTo(wallDrawing.points[i].x * zoom + offX, wallDrawing.points[i].y * zoom + offY);
      if (wallDrawing.points.length === 1) { const mx = (wallDrawing as any)._mx, my = (wallDrawing as any)._my; if (mx !== undefined) ctx.lineTo(mx, my); }
      ctx.stroke();
    }

    // Zones
    for (const z of zones) {
      const zx = z.bounds.x * zoom + offX, zy = z.bounds.y * zoom + offY;
      const zw = z.bounds.w * zoom, zh = z.bounds.h * zoom;
      const colors = { damage: 'rgba(239,68,68,0.12)', heal: 'rgba(34,197,94,0.12)', trigger: 'rgba(168,85,247,0.12)' };
      const borders = { damage: 'rgba(239,68,68,0.4)', heal: 'rgba(34,197,94,0.4)', trigger: 'rgba(168,85,247,0.4)' };
      ctx.fillStyle = colors[z.type]; ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = borders[z.type]; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.strokeRect(zx, zy, zw, zh); ctx.setLineDash([]);
      ctx.fillStyle = borders[z.type]; ctx.font = `${Math.max(8, 9 * zoom)}px "JetBrains Mono"`;
      ctx.fillText(`${z.type === 'damage' ? '💀' : z.type === 'heal' ? '💚' : '⚡'} ${z.name}`, zx + 4, zy + 14 * zoom);
    }

    // Zone being drawn
    if (zoneDraw) {
      const x = Math.min(zoneDraw.x1, zoneDraw.x2), y = Math.min(zoneDraw.y1, zoneDraw.y2);
      ctx.strokeStyle = 'rgba(245,158,11,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, Math.abs(zoneDraw.x2 - zoneDraw.x1), Math.abs(zoneDraw.y2 - zoneDraw.y1));
      ctx.fillStyle = 'rgba(245,158,11,0.08)'; ctx.fillRect(x, y, Math.abs(zoneDraw.x2 - zoneDraw.x1), Math.abs(zoneDraw.y2 - zoneDraw.y1));
      ctx.setLineDash([]);
    }

    // Calibration rectangle
    if (calibrateRect) {
      const x = Math.min(calibrateRect.x1, calibrateRect.x2), y = Math.min(calibrateRect.y1, calibrateRect.y2);
      ctx.strokeStyle = 'rgba(34,197,94,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.strokeRect(x, y, Math.abs(calibrateRect.x2 - calibrateRect.x1), Math.abs(calibrateRect.y2 - calibrateRect.y1));
      ctx.setLineDash([]);
      const cell = Math.round(Math.min(Math.abs(calibrateRect.x2 - calibrateRect.x1), Math.abs(calibrateRect.y2 - calibrateRect.y1)) / 3);
      ctx.fillStyle = '#22c55e'; ctx.font = 'bold 11px "JetBrains Mono"';
      ctx.fillText(`3×3 → ${cell}px`, x + 4, y - 6);
    }

    // Drawings
    const allDrawings = [...drawings, ...(curDrawing ? [curDrawing] : [])];
    for (const d of allDrawings) {
      if (d.points.length < 1) continue;
      ctx.strokeStyle = d.color; ctx.lineWidth = d.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (d.tool === 'pencil' || d.tool === 'eraser') {
        if (d.tool === 'eraser') { ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = d.width * 4; }
        ctx.beginPath(); ctx.moveTo(d.points[0].x, d.points[0].y);
        for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x, d.points[i].y);
        ctx.stroke();
      } else if (d.tool === 'line' && d.points.length >= 2) {
        ctx.beginPath(); ctx.moveTo(d.points[0].x, d.points[0].y); ctx.lineTo(d.points[1].x, d.points[1].y); ctx.stroke();
      } else if (d.tool === 'rect' && d.points.length >= 2) {
        const [s, e] = [d.points[0], d.points[1]];
        ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
      }
    }

    // AoE Templates
    if (isTemplate && rStart && rEnd) {
      const sx = rStart.x, sy = rStart.y, ex = rEnd.x, ey = rEnd.y;
      const dx = ex - sx, dy = ey - sy, dist = Math.sqrt(dx * dx + dy * dy);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.fillStyle = 'rgba(245,158,11,0.08)';

      // Default: circle
      ctx.beginPath(); ctx.arc(sx, sy, dist, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Measurements
      const cells = Math.round(dist / gs);
      ctx.setLineDash([]); ctx.fillStyle = '#0a0a10'; ctx.fillRect(ex + 8, ey - 10, 80, 18);
      ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px "JetBrains Mono"';       ctx.fillText(`${cells} кл`, ex + 12, ey + 4);
    }

    // Damage/Heal effects
    const now = Date.now();
    setEffects(prev => prev.filter(f => now - f.t < 800));
    for (const fx of effects) {
      const age = now - fx.t; const alpha = 1 - age / 800;
      ctx.font = `bold ${14 * zoom}px "JetBrains Mono"`; ctx.textAlign = 'center';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fx.type === 'damage' ? '#ef4444' : '#22c55e';
      ctx.fillText(`${fx.type === 'damage' ? '-' : '+'}${fx.value}`, fx.x * zoom + offX + 35 * zoom, fx.y * zoom + offY - 8 * zoom - age / 20);
      ctx.globalAlpha = 1;
    }

    // Weather overlays
    if (p.weather === 'rain') {
      const t = Date.now() / 1000;
      for (let i = 0; i < 80; i++) {
        const x = ((i * 137 + t * 50) % cw + cw) % cw;
        const y = ((i * 251 + t * 200) % ch + ch) % ch;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + 12); ctx.stroke();
      }
    } else if (p.weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      const t = Date.now() / 1000;
      for (let i = 0; i < 60; i++) {
        const x = ((i * 173 + t * 20) % cw + cw) % cw;
        const y = ((i * 281 + t * 40) % ch + ch) % ch;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (p.weather === 'fog') {
      ctx.fillStyle = 'rgba(200,210,220,0.04)';
      const t = Date.now() / 1000;
      for (let i = 0; i < 20; i++) {
        const x = ((i * 197 + t * 10) % cw + cw) % cw;
        const y = ((i * 313 + t * 15) % ch + ch) % ch;
        ctx.beginPath(); ctx.arc(x, y, 60 + (i % 30), 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
  }, [tokens, offX, offY, zoom, gridSize, gridOffset, hoverId, dragId, isRuler, rStart, rEnd, isFog, snapToGrid, p.gridType, p.gridVisible, drawings, curDrawing, isTemplate, p.weather, selTokens, selBox, walls, wallDrawing, isWallTool, zoneDraw, calibrateRect, p.darkvision, p.showHidden, fogOps, effects, zones]);

  useEffect(() => { const rs = () => { const c = canvasRef.current; if (!c) return; const dpr = window.devicePixelRatio || 1; c.width = (c.parentElement?.clientWidth || 800) * dpr; c.height = (c.parentElement?.clientHeight || 600) * dpr; c.style.width = (c.parentElement?.clientWidth || 800) + 'px'; c.style.height = (c.parentElement?.clientHeight || 600) + 'px'; draw(); }; rs(); window.addEventListener('resize', rs); return () => window.removeEventListener('resize', rs); }, [draw]);
  useEffect(() => { draw(); }, [draw]);

  // Weather animation — requestAnimationFrame, stops when tab hidden
  useEffect(() => {
    if (p.weather === 'none') return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 50) {
        draw();
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else { raf = requestAnimationFrame(tick); } };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [p.weather, draw]);

  const hWheel = (e: React.WheelEvent) => {
    e.preventDefault(); const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const mx = e.clientX - r.left, my = e.clientY - r.top, f = e.deltaY < 0 ? 1.1 : 0.9;
    const nz = Math.max(0.1, Math.min(5, zoom * f));
    setOffX(mx - (mx - offX) * (nz / zoom)); setOffY(my - (my - offY) * (nz / zoom)); setZoom(nz);
  };

  const hDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2 || (e.shiftKey && p.selectedTool === 'move')) {
      e.preventDefault(); setPan(true); pStart.current = { x: e.clientX - offX, y: e.clientY - offY }; return;
    }
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (isRuler) { setRStart({ x: mx, y: my }); return; }
    if (isDraw) {
      setUndoStack(prev => [...prev, [...drawings]]);
      setIsDrawing(true);
      const tool = e.shiftKey ? 'line' : 'pencil';
      setCurDrawing({ tool, points: [{ x: mx, y: my }], color: drawC, width: drawW });
      return;
    }
    if (isTemplate) { setRStart({ x: mx, y: my }); setREnd({ x: mx, y: my }); return; }
    // Fog brush
    if (isFog && p.onCanvasClick) {
      const gx = Math.round((mx - offX) / (gridSize * zoom)), gy = Math.round((my - offY) / (gridSize * zoom));
      const isAdd = e.altKey; // Alt = add fog, normal = remove fog
      setFogOps(prev => [...prev, { x: gx, y: gy, r: 2, add: isAdd }]);
      return;
    }
    // Zone drawing
    if (p.selectedTool === 'zone') { setZoneDraw({ x1: mx, y1: my, x2: mx, y2: my }); return; }
    if (p.selectedTool === 'zone') { setZoneDraw({ x1: mx, y1: my, x2: mx, y2: my }); return; }
    // Grid calibration
    if (isCalibrate) { setCalibrateRect({ x1: mx, y1: my, x2: mx, y2: my }); return; }
    // Wall drawing
    if (isWallTool) {
      const gx = Math.round((mx - offX) / (gridSize * zoom)), gy = Math.round((my - offY) / (gridSize * zoom));
      if (e.detail === 2 || e.button === 2) {
        // Double-click or right-click: finish wall
        if (wallDrawing && wallDrawing.points.length >= 2) {
          for (let i = 1; i < wallDrawing.points.length; i++) {
            setWalls(prev => [...prev, { x1: wallDrawing.points[i-1].x, y1: wallDrawing.points[i-1].y, x2: wallDrawing.points[i].x, y2: wallDrawing.points[i].y, type: 'solid' }]);
          }
        }
        setWallDrawing(null);
        return;
      }
      setWallDrawing(prev => prev ? { points: [...prev.points, { x: gx, y: gy }] } : { points: [{ x: gx, y: gy }] });
      return;
    }
    // Box select with Shift
    if (e.shiftKey) { setSelBox({ x1: mx, y1: my, x2: mx, y2: my }); return; }
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i], tx = t.x * zoom + offX, ty = t.y * zoom + offY;
      if (mx >= tx && mx <= tx + t.width * zoom && my >= ty && my <= ty + t.height * zoom) {
        if (p.onTokenSelect && (p.selectedTool === 'move' || p.selectedTool === 'token')) p.onTokenSelect(t);
        if (e.ctrlKey || e.metaKey) {
          setSelTokens(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
          return;
        }
        setSelTokens(new Set([t.id]));
        setDragId(t.id); dStart.current = { x: mx - tx, y: my - ty }; return;
      }
    }
    if (p.onTokenSelect) p.onTokenSelect(null);
    setSelTokens(new Set());
    // Check for resize/rotate handles on single selected token
    if (selTokens.size === 1) {
      const t = tokens.find(tk => selTokens.has(tk.id));
      if (t) {
        const tx = t.x * zoom + offX, ty = t.y * zoom + offY, tw = t.width * zoom, th = t.height * zoom;
        const cx = tx + tw / 2, cy = ty + th / 2;
        // Rotation handle
        const rh = { x: cx - 3.5, y: ty - 28 * zoom - 3.5, w: 7, h: 7 };
        if (mx >= rh.x && mx <= rh.x + rh.w && my >= rh.y && my <= rh.y + rh.h) {
          setRotateToken(t.id); return;
        }
        // Corner resize handles
        const hs = 7;
        const corners = [{x: tx - hs/2, y: ty - hs/2}, {x: tx + tw - hs/2, y: ty - hs/2},
                         {x: tx + tw - hs/2, y: ty + th - hs/2}, {x: tx - hs/2, y: ty + th - hs/2}];
        for (const c of corners) {
          if (mx >= c.x && mx <= c.x + hs && my >= c.y && my <= c.y + hs) { setResizeToken(t.id); resizeStart.current = { x: mx, y: my, w: t.width, h: t.height }; return; }
        }
        // Facing arrow click
        const arrowY = ty - 16 * zoom;
        if (my >= arrowY - 6 * zoom && my <= arrowY + 10 * zoom && Math.abs(mx - cx) < 8 * zoom) {
          setFacingAngles(prev => ({ ...prev, [t.id]: ((prev[t.id] || 0) + 45) % 360 }));
          return;
        }
      }
    }
    if (p.onCanvasClick) { const gx = Math.round((mx - offX) / (gridSize * zoom)), gy = Math.round((my - offY) / (gridSize * zoom)); p.onCanvasClick(gx, gy); }
  };

  const hMove = (e: React.MouseEvent) => {
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (pan) { setOffX(e.clientX - pStart.current.x); setOffY(e.clientY - pStart.current.y); return; }
    if (dragId) { const nx = snap(mx - dStart.current.x) / zoom, ny = snap(my - dStart.current.y) / zoom; setDX(nx); setDY(ny); return; }
    if (resizeToken) {
      const t = tokens.find(tk => tk.id === resizeToken); if (!t) return;
      const dx = (mx - resizeStart.current.x) / zoom;
      const newW = Math.max(20, resizeStart.current.w + dx);
      const newH = Math.max(20, resizeStart.current.h + dx);
      // Update local token size (will be finalized on mouse up)
      const idx = tokens.findIndex(tk => tk.id === resizeToken);
      if (idx >= 0) {
        tokens[idx] = { ...tokens[idx], width: newW, height: newH };
        draw();
      }
      return;
    }
    if (rotateToken) {
      const t = tokens.find(tk => tk.id === rotateToken); if (!t) return;
      const cx = t.x * zoom + offX + (t.width * zoom) / 2;
      const cy = t.y * zoom + offY + (t.height * zoom) / 2;
      const angle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI + 90;
      setFacingAngles(prev => ({ ...prev, [t.id]: Math.round(angle / 15) * 15 }));
      return;
    }
    if (isDraw && isDrawing) {
      let px = mx, py = my;
      if (curDrawing?.tool === 'line' && curDrawing.points.length > 0) {
        const ox = curDrawing.points[0].x, oy = curDrawing.points[0].y;
        const a = Math.atan2(py - oy, px - ox) * 180 / Math.PI;
        const snap = Math.round(a / 15) * 15;
        const d = Math.sqrt((px - ox) ** 2 + (py - oy) ** 2);
        px = ox + Math.cos(snap * Math.PI / 180) * d;
        py = oy + Math.sin(snap * Math.PI / 180) * d;
      }
      setCurDrawing(prev => prev ? { ...prev, points: [{ x: px, y: py }] } : null);
      return;
    }
    if (selBox) { setSelBox(prev => prev ? { ...prev, x2: mx, y2: my } : null); return; }
    if (isRuler && rStart) { setREnd({ x: mx, y: my }); }
    if (isTemplate && rStart) { setREnd({ x: mx, y: my }); }
    if (zoneDraw) { setZoneDraw(prev => prev ? { ...prev, x2: mx, y2: my } : null); return; }
    if (calibrateRect) { setCalibrateRect(prev => prev ? { ...prev, x2: mx, y2: my } : null); return; }
    // Wall preview
    if (isWallTool && wallDrawing) {
      (wallDrawing as any)._mx = mx; (wallDrawing as any)._my = my; return;
    }
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i], tx = t.x * zoom + offX, ty = t.y * zoom + offY;
      if (mx >= tx && mx <= tx + t.width * zoom && my >= ty && my <= ty + t.height * zoom) { setHoverId(t.id); return; }
    }
    setHoverId(null);
  };

  const hUp = () => {
    if (dragId && p.onTokenMove) { p.onTokenMove(dragId, dX, dY); }
    if (isDrawing && curDrawing) { setDrawings(prev => [...prev, curDrawing]); setCurDrawing(null); }
    // Box select completion
    if (selBox) {
      const { x1, y1, x2, y2 } = selBox;
      const [bx, by] = [Math.min(x1, x2), Math.min(y1, y2)];
      const [bw, bh] = [Math.abs(x2 - x1), Math.abs(y2 - y1)];
      const selected = new Set<string>();
      tokens.forEach(t => {
        const tx = t.x * zoom + offX, ty = t.y * zoom + offY;
        if (tx + t.width * zoom >= bx && tx <= bx + bw && ty + t.height * zoom >= by && ty <= by + bh) selected.add(t.id);
      });
      setSelTokens(selected);
      setSelBox(null);
      return;
    }
    // Calibration completion
    if (calibrateRect) {
      const w = Math.abs(calibrateRect.x2 - calibrateRect.x1);
      const h = Math.abs(calibrateRect.y2 - calibrateRect.y1);
      const cellSize = Math.min(w, h) / 3;
      if (cellSize > 5 && p.onGridCalibrate) p.onGridCalibrate(Math.round(cellSize));
      setCalibrateRect(null);
      return;
    }
    setIsDrawing(false);
    setPan(false); setDragId(null); setDX(0); setDY(0);
    if (resizeToken) { setResizeToken(null); }
    if (rotateToken) { setRotateToken(null); }
    // Zone completion
    if (zoneDraw) {
      const x1 = Math.round((Math.min(zoneDraw.x1, zoneDraw.x2) - offX) / (gridSize * zoom));
      const y1 = Math.round((Math.min(zoneDraw.y1, zoneDraw.y2) - offY) / (gridSize * zoom));
      const x2 = Math.round((Math.max(zoneDraw.x1, zoneDraw.x2) - offX) / (gridSize * zoom));
      const y2 = Math.round((Math.max(zoneDraw.y1, zoneDraw.y2) - offY) / (gridSize * zoom));
      if (x2 > x1 && y2 > y1) {
        const z: Zone = { id: Math.random().toString(36).slice(2), type: 'damage', name: 'Зона', bounds: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, value: 5, color: '#ef4444' };
        setZones(prev => [...prev, z]);
      }
      setZoneDraw(null);
      return;
    }
  };

  const hCtx = (e: React.MouseEvent) => {
    e.preventDefault(); const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i], tx = t.x * zoom + offX, ty = t.y * zoom + offY;
      if (mx >= tx && mx <= tx + t.width * zoom && my >= ty && my <= ty + t.height * zoom) { setMenu({ x: e.clientX, y: e.clientY, tid: t.id }); return; }
    }
  };

  const hDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f || !f.type.startsWith('image/')) return; const rd = new FileReader(); rd.onload = ev => { if (ev.target?.result && p.onMapChange) p.onMapChange(ev.target.result as string); }; rd.readAsDataURL(f); };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden touch-none" onWheel={hWheel} onDragOver={e => e.preventDefault()} onDrop={hDrop}
      onTouchStart={(e) => {
        if (e.touches.length === 2) { const dx = e.touches[1].clientX - e.touches[0].clientX; const dy = e.touches[1].clientY - e.touches[0].clientY; (containerRef.current as any).__pinchStart = { dist: Math.sqrt(dx*dx+dy*dy), zoom, offX, offY }; return; }
        if (e.touches.length === 1) { const t = e.touches[0]; (containerRef.current as any).__touchStart = { x: t.clientX, y: t.clientY, offX, offY }; }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2) {
          const ps = (containerRef.current as any).__pinchStart; if (!ps) return;
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          const nd = Math.sqrt(dx*dx+dy*dy); const nz = Math.max(0.1, Math.min(5, ps.zoom * nd / ps.dist));
          setZoom(nz); setOffX(ps.offX); setOffY(ps.offY);
        }
        if (e.touches.length === 1) {
          const ts = (containerRef.current as any).__touchStart; if (!ts) return;
          setOffX(ts.offX + e.touches[0].clientX - ts.x);
          setOffY(ts.offY + e.touches[0].clientY - ts.y);
        }
      }}>
      <canvas ref={canvasRef} className="w-full h-full" aria-label="Игровая карта" role="img" onMouseDown={hDown} onMouseMove={hMove} onMouseUp={hUp} onMouseLeave={hUp} onContextMenu={hCtx} />
      {menu && (<>
        <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} />
        <div className="fixed z-[60] bg-[#18181b] border border-white/[0.08] rounded-xl shadow-2xl py-1 min-w-[150px]" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => { if (p.onTokenDelete) p.onTokenDelete(menu.tid); setMenu(null); }} className="w-full text-left px-4 py-2 text-xs font-mono text-red-400 hover:bg-red-500/10 flex items-center gap-2"><Trash2 size={12} />Удалить</button>
          <button onClick={() => setMenu(null)} className="w-full text-left px-4 py-2 text-xs font-mono text-zinc-400 hover:bg-white/[0.05] flex items-center gap-2"><Lock size={12} />Свойства</button>
        </div>
      </>)}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#0a0a10]/90 backdrop-blur-md border border-white/[0.06] rounded-xl px-2.5 py-1.5">
        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} className="text-zinc-400 hover:text-zinc-200 text-sm font-mono">−</button>
        <span className="font-mono text-[10px] text-zinc-400 tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="text-zinc-400 hover:text-zinc-200 text-sm font-mono">+</button>
        <button onClick={() => { setZoom(1); setOffX(0); setOffY(0); }} className="text-violet-400 hover:text-violet-300 font-mono text-[9px] ml-1 border-l border-white/[0.06] pl-1.5">Fit</button>
      </div>
    </div>
  );
}
