import { create } from 'zustand';

export interface Token {
  id: string;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  createdBy?: string;
  rotation?: number;
  isHidden?: boolean;
  hp?: number;
  maxHp?: number;
  ac?: number;
}

export interface Scene {
  id: string;
  name: string;
  grid_type?: string;
  grid_color?: string;
  grid_size?: number;
  map_url?: string;
  fog_data?: string;
}

export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
  ac?: number;
  isActive?: boolean;
}

export type Tool = 'select' | 'draw' | 'fog' | 'ruler' | 'wall' | 'los' | 'token';

interface VTTState {
  tokens: Token[];
  scenes: Scene[];
  activeSceneId: string | null;
  tool: Tool;
  drawColor: string;
  gridType: string;
  gridSize: number;
  fogEnabled: boolean;
  weather: string;
  combatants: Combatant[];
  currentTurn: number;
  saveSlots: unknown[];
  selectedTokens: string[];

  setTokens: (tokens: Token[]) => void;
  addToken: (token: Token) => void;
  updateToken: (id: string, updates: Partial<Token>) => void;
  removeToken: (id: string) => void;
  setTool: (tool: Tool) => void;
  setDrawColor: (color: string) => void;
  setGridType: (type: string) => void;
  setGridSize: (size: number) => void;
  setFogEnabled: (enabled: boolean) => void;
  setWeather: (weather: string) => void;
  setCombatants: (combatants: Combatant[]) => void;
  addCombatant: (c: Combatant) => void;
  updateCombatant: (id: string, updates: Partial<Combatant>) => void;
  removeCombatant: (id: string) => void;
  nextTurn: () => void;
  setScenes: (scenes: Scene[]) => void;
  setActiveScene: (id: string | null) => void;
  setSaveSlots: (slots: unknown[]) => void;
  setSelectedTokens: (ids: string[]) => void;
}

export const useVTTStore = create<VTTState>((set) => ({
  tokens: [],
  scenes: [],
  activeSceneId: null,
  tool: 'select',
  drawColor: '#a855f7',
  gridType: 'square',
  gridSize: 50,
  fogEnabled: false,
  weather: 'none',
  combatants: [],
  currentTurn: 0,
  saveSlots: [],
  selectedTokens: [],

  setTokens: (tokens) => set({ tokens }),
  addToken: (token) => set((s) => ({ tokens: [...s.tokens, token] })),
  updateToken: (id, updates) =>
    set((s) => ({ tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
  removeToken: (id) => set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),
  setTool: (tool) => set({ tool }),
  setDrawColor: (color) => set({ drawColor: color }),
  setGridType: (type) => set({ gridType: type }),
  setGridSize: (size) => set({ gridSize: size }),
  setFogEnabled: (enabled) => set({ fogEnabled: enabled }),
  setWeather: (weather) => set({ weather }),
  setCombatants: (combatants) => set({ combatants }),
  addCombatant: (c) => set((s) => ({ combatants: [...s.combatants, c] })),
  updateCombatant: (id, updates) =>
    set((s) => ({ combatants: s.combatants.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
  removeCombatant: (id) => set((s) => ({ combatants: s.combatants.filter((c) => c.id !== id) })),
  nextTurn: () => set((s) => ({ currentTurn: (s.currentTurn + 1) % (s.combatants.length || 1) })),
  setScenes: (scenes) => set({ scenes }),
  setActiveScene: (id) => set({ activeSceneId: id }),
  setSaveSlots: (slots) => set({ saveSlots: slots }),
  setSelectedTokens: (ids) => set({ selectedTokens: ids }),
}));
