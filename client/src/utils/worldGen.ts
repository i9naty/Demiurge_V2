// Fallout-style procedural world generator. 1 cell = 1 meter.
export interface Tile {
  x: number; y: number; terrain: string; elevation: number;
  resource_type: string | null; resource_amount: number;
}

const TERRAINS: Record<string, string[]> = {
  mixed:    ['grass','forest','plains','desert','water','mountain','swamp','rocky','grass','plains'],
  forest:   ['grass','forest','deep_forest','grass','forest','river','forest','grass','grass','forest'],
  desert:   ['desert','sand_dunes','desert','desert','rocky','desert','wasteland','sand_dunes','desert','desert'],
  snow:     ['snow','tundra','snow','snow','tundra','mountain','snow','tundra','snow','tundra'],
  swamp:    ['swamp','water','swamp','swamp','grass','swamp','water','swamp','swamp','grass'],
  plains:   ['plains','grass','plains','grass','plains','river','grass','plains','grass','plains'],
  mountain: ['rocky','mountain','rocky','grass','mountain','rocky','crystal','mountain','rocky','grass'],
};

const RESOURCES = ['wood','stone','ore','gold','herbs','food','gems',null,null,null,null,null];

function hash(x: number, y: number, seed: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.001) * 43758.5453;
  return n - Math.floor(n);
}

export function getTile(x: number, y: number, seed: number, biome: string, density: number): Tile {
  const r = hash(x, y, seed);
  const terrains = TERRAINS[biome] || TERRAINS.mixed;
  const terrain = terrains[Math.floor(Math.abs(r) * terrains.length) % terrains.length];
  const elevation = Math.round((hash(x + 1, y + 1, seed) * 4 - 1) * 10) / 10;
  const hasRes = Math.abs(hash(x + 2, y + 3, seed)) > (0.82 / (density || 1));
  const resIdx = Math.floor(Math.abs(hash(x + 4, y + 5, seed)) * RESOURCES.length) % RESOURCES.length;
  return {
    x, y, terrain, elevation,
    resource_type: hasRes ? RESOURCES[resIdx] : null,
    resource_amount: hasRes ? Math.floor(Math.abs(hash(x + 6, y + 7, seed)) * 10 * (density || 1)) + 1 : 0,
  };
}

export function getTileArea(cx: number, cy: number, radius: number, seed: number, biome: string, density: number): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      tiles.push(getTile(cx + dx, cy + dy, seed, biome, density));
  return tiles;
}
