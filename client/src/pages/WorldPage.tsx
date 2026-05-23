import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { IsometricMap } from '../components/world/IsometricMap';
import { ArrowLeft, Heart, Package, Hammer, ScrollText, TrendingUp, Sparkles, Globe, TreePine, Mountain, CloudSnow, Droplets, Map } from 'lucide-react';

interface Building { id: string; tile_x: number; tile_y: number; building_type: string; name: string; health: number; }
interface NPC { id: string; name: string; personality: string; type: string; x: number; y: number; is_unique: boolean; }
interface InvItem { id: string; item_type: string; quantity: number; slot: number; }
interface Quest { id: string; title: string; description: string; objective_type: string; status: string; reward: any; }

const BIOMES = [
  { id:'mixed', label:'Смешанный', icon:Globe },
  { id:'forest', label:'Лес', icon:TreePine },
  { id:'desert', label:'Пустыня', icon:Globe },
  { id:'snow', label:'Снега', icon:CloudSnow },
  { id:'swamp', label:'Болото', icon:Droplets },
  { id:'plains', label:'Равнины', icon:Map },
  { id:'mountain', label:'Горы', icon:Mountain },
];

export function WorldPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, user } = useStore();
  const [activeTab, setActiveTab] = useState<'map'|'inventory'|'quests'|'build'>('map');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [playerPos, setPlayerPos] = useState({ x: 250, y: 250 });
  const [worldState, setWorldState] = useState<any>(null);
  const [aiEvent, setAiEvent] = useState<any>(null);
  const [buildingMode, setBuildingMode] = useState(false);
  const [selBuilding, setSelBuilding] = useState('house');
  const [showCfg, setShowCfg] = useState(false);
  const [cfgBiome, setCfgBiome] = useState('mixed');
  const [cfgDensity, setCfgDensity] = useState('medium');
  const [seed, setSeed] = useState(Math.floor(Math.random() * 2147483647));
  const [biome, setBiome] = useState('mixed');
  const [density, setDensity] = useState(1.0);
  const hdrs = { Authorization: `Bearer ${localStorage.getItem('demiurge_token')||''}` };

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/world/${roomId}`,{headers:hdrs}).then(r=>r.json()).then(ws=>{
      setWorldState(ws);
      if (ws.seed) setSeed(ws.seed);
    }).catch(()=>{});
    fetch(`/api/world/${roomId}/buildings`,{headers:hdrs}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setBuildings(d)}).catch(()=>{});
    fetch(`/api/world/${roomId}/npcs`,{headers:hdrs}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setNpcs(d)}).catch(()=>{});
    fetch(`/api/world/${roomId}/inventory`,{headers:hdrs}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setInventory(d)}).catch(()=>{});
    fetch(`/api/world/${roomId}/quests`,{headers:hdrs}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setQuests(d)}).catch(()=>{});
  }, [roomId]);

  useEffect(() => {
    if (!socket||!roomId) return;
    socket.emit('room:join',roomId);
    socket.on('world:resource_gathered',(d:any)=>{
      if (d.userId===user?.id) setInventory(p=>{const ex=p.find(i=>i.item_type===d.resourceType);if(ex)return p.map(i=>i.item_type===d.resourceType?{...i,quantity:i.quantity+1}:i);return[...p,{id:'',item_type:d.resourceType,quantity:1,slot:p.length}]});
    });
    socket.on('world:event',(e:any)=>{setAiEvent(e);setTimeout(()=>setAiEvent(null),8000)});
    return ()=>{socket.emit('room:leave',roomId);socket.off('world:resource_gathered');socket.off('world:event')};
  }, [socket,roomId]);

  const moveTo = (tx:number,ty:number) => { setPlayerPos({x:tx,y:ty}); if(socket&&roomId)socket.emit('world:move',{roomId,x:tx,y:ty}); };
  const gather = () => { if(socket&&roomId)socket.emit('world:gather',{roomId,tileX:playerPos.x,tileY:playerPos.y}); };
  const build = async () => {
    if(!roomId)return;
    try {
      const r=await fetch(`/api/world/${roomId}/buildings`,{method:'POST',headers:{'Content-Type':'application/json',...hdrs},body:JSON.stringify({tileX:playerPos.x,tileY:playerPos.y,buildingType:selBuilding,name:selBuilding})});
      if(!r.ok)return;
      const b=await r.json();
      if(b && b.id) { setBuildings(p=>[...p,b]); setBuildingMode(false); }
    } catch {}
  };
  const applyCfg = () => {
    setBiome(cfgBiome); setDensity(cfgDensity==='high'?1.5:cfgDensity==='low'?0.5:1.0); setShowCfg(false);
  };

  const colors: Record<string,string> = {
    grass:'#4ade80',forest:'#166534',deep_forest:'#14532d',plains:'#84cc16',desert:'#f59e0b',sand_dunes:'#d97706',
    snow:'#e0f2fe',tundra:'#bae6fd',swamp:'#4a7c59',water:'#a855f7',river:'#c084fc',lake:'#9333ea',
    mountain:'#78716c',rocky:'#a8a29e',volcano:'#ef4444',wasteland:'#57534e',
    crystal:'#c084fc',enchanted:'#a78bfa',corrupted:'#7c3aed',cavern_entrance:'#292524',dungeon_entrance:'#1c1917',
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d14]">
      <AnimatePresence>
        {showCfg && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
            <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-[#0f0f16] border border-[#1a1a2e] rounded-2xl p-8 w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl">
              <h2 className="font-mono text-xl text-zinc-200 mb-1 flex items-center gap-2"><Sparkles size={22} className="text-violet-400"/>Настройка мира</h2>
              <p className="font-mono text-xs text-zinc-500 mb-5">1 клетка = 1 метр. Процедурная генерация.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-zinc-500 uppercase mb-2 block">Биом</label>
                  <div className="grid grid-cols-4 gap-2">
                    {BIOMES.map(b=>(<button key={b.id} onClick={()=>setCfgBiome(b.id)} className={`p-2.5 rounded-xl border text-center transition-all ${cfgBiome===b.id?'border-purple-500 bg-purple-600/20':'border-[#1a1a2e] hover:border-zinc-600'}`}><b.icon size={18} className={`mx-auto mb-1 ${cfgBiome===b.id?'text-violet-400':'text-zinc-500'}`}/><div className="font-mono text-[10px] text-zinc-300">{b.label}</div></button>))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-500 mb-1.5 block">Плотность мира</label>
                  <div className="flex rounded-lg overflow-hidden border border-[#1a1a2e]">
                    {['low','medium','high'].map(d=><button key={d} onClick={()=>setCfgDensity(d)} className={`flex-1 py-1.5 text-[10px] font-mono ${cfgDensity===d?'bg-purple-600/20 text-violet-400':'text-zinc-500'}`}>{d==='low'?'Низкая':d==='medium'?'Средняя':'Высокая'}</button>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={applyCfg} className="flex-1 py-3 rounded-xl font-mono text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-600 text-white hover:opacity-90 flex items-center justify-center gap-2"><Sparkles size={18}/>Применить</button>
                  <button onClick={()=>setShowCfg(false)} className="px-4 py-3 rounded-xl border border-[#1a1a2e] font-mono text-sm text-zinc-400 hover:bg-white/5">Закрыть</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-12 bg-[#111118] border-b border-[#1a1a2e] flex items-center px-4 gap-3 shrink-0 z-20">
        <a href="/" className="p-1.5 rounded-md hover:bg-white/5 text-zinc-400"><ArrowLeft size={18}/></a>
        <div className="flex-1 flex items-center gap-3">
          <h2 className="font-mono text-sm text-zinc-300">{worldState?`Мир #${worldState.seed}`:'Мир'}</h2>
        </div>
        <div className="flex items-center gap-2"><Heart size={14} className="text-red-400"/><div className="w-16 h-2 bg-[#1a1a2e] rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{width:'100%'}}/></div></div>
        <button onClick={()=>setShowCfg(true)} className="text-[10px] font-mono text-violet-400 hover:underline">Настройки</button>
        <button onClick={()=>{if(socket&&roomId)socket.emit('world:request_events',{roomId})}} className="btn-secondary text-[10px] py-1 px-2">⚡ Событие</button>
      </div>

      {aiEvent&&<motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} className="bg-purple-500/10 border-b border-purple-500/20 px-4 py-2"><p className="font-mono text-xs text-violet-400">⚡ {aiEvent.eventType?.toUpperCase()}: {aiEvent.description}</p></motion.div>}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <IsometricMap buildings={buildings} npcs={npcs} playerPos={playerPos} buildingMode={buildingMode} onTileClick={moveTo} onGather={gather} onBuild={build} colors={colors} seed={seed} biome={biome} density={density}/>
          <div className="absolute top-3 left-3 glass-panel px-3 py-1.5 font-mono text-[10px] text-zinc-400">X:{playerPos.x} Y:{playerPos.y}</div>
        </div>
        <div className="w-72 bg-[#0f0f16] border-l border-[#1a1a2e] flex flex-col shrink-0">
          <div className="flex border-b border-[#1a1a2e]">
            {[{id:'map',icon:TrendingUp,l:'Мир'},{id:'inventory',icon:Package,l:'Вещи'},{id:'quests',icon:ScrollText,l:'Квесты'},{id:'build',icon:Hammer,l:'Строй'}].map(({id,icon:Icon,l})=>(
              <button key={id} onClick={()=>setActiveTab(id as any)} className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-[10px] font-mono ${activeTab===id?'text-violet-400 border-b-2 border-purple-500':'text-zinc-500'}`}><Icon size={14}/>{l}</button>))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab==='map'&&<div className="space-y-2">
              <h3 className="font-mono text-xs text-violet-400">NPC ({npcs.length})</h3>
              {npcs.filter(n=>Math.abs(n.x-playerPos.x)<8&&Math.abs(n.y-playerPos.y)<8).map(n=>(<div key={n.id} className="card p-2.5 flex items-center gap-2"><div className="w-8 h-8 rounded bg-purple-600/20 flex items-center justify-center font-mono text-xs text-violet-400">{n.name[0]}</div><div><p className="font-mono text-xs text-zinc-300">{n.name}</p><p className="text-[9px] text-zinc-500">{n.personality}·{n.type}{n.is_unique&&'⭐'}</p></div></div>))}
              <h3 className="font-mono text-xs text-violet-400 mt-3">Здания ({buildings.length})</h3>
              {buildings.filter(b=>Math.abs(b.tile_x-playerPos.x)<10&&Math.abs(b.tile_y-playerPos.y)<10).map(b=>(<div key={b.id} className="card p-2.5"><p className="font-mono text-xs text-zinc-300">{b.name}</p><p className="text-[9px] text-zinc-500">{b.building_type}·HP{b.health}</p></div>))}
            </div>}
            {activeTab==='inventory'&&<div className="space-y-1.5"><h3 className="font-mono text-xs text-violet-400">Инвентарь ({inventory.reduce((s,i)=>s+i.quantity,0)})</h3>{inventory.map(i=><div key={i.slot} className="flex justify-between card p-2"><span className="font-mono text-xs text-zinc-300 capitalize">{i.item_type}</span><span className="font-mono text-xs text-violet-400">x{i.quantity}</span></div>)}</div>}
            {activeTab==='quests'&&<div className="space-y-2"><h3 className="font-mono text-xs text-violet-400">Квесты ({quests.length})</h3>{quests.map(q=><div key={q.id} className="card p-2.5"><p className="font-mono text-xs text-zinc-300">{q.title}</p><p className="text-[9px] text-zinc-500 mt-0.5">{q.description}</p></div>)}</div>}
            {activeTab==='build'&&<div className="space-y-2"><h3 className="font-mono text-xs text-violet-400">Постройки</h3><div className="grid grid-cols-2 gap-1.5">{[{id:'house',l:'🏠Дом'},{id:'workshop',l:'🔧Мастерская'},{id:'farm',l:'🌾Ферма'},{id:'mine',l:'⛏Шахта'},{id:'temple',l:'⛪Храм'},{id:'wall',l:'🧱Стена'}].map(({id,l})=>(<button key={id} onClick={()=>{setSelBuilding(id);setBuildingMode(true)}} className={`p-2 rounded-lg font-mono text-[10px] ${selBuilding===id&&buildingMode?'bg-purple-600/20 border border-purple-500 text-violet-400':'bg-[#1a1a2e] text-zinc-400 hover:text-zinc-200'}`}>{l}</button>))}</div>{buildingMode&&<div className="card p-2.5 mt-2"><p className="font-mono text-[10px] text-violet-400">Кликни на клетку</p><button onClick={()=>setBuildingMode(false)} className="btn-secondary text-[10px] py-1 w-full mt-1">Отмена</button></div>}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
