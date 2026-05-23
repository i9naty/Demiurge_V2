import { callAI } from './ai';
import { getAssetIdList, getAssetById } from './assetScanner';

const MASTER_SYSTEM = (params: {
  genre: string; setting: string; difficulty: string;
  nsfw: boolean; storyPrompt: string; playerCount: number;
}) => `Ты — Дедушка-рассказчик, ИИ-мастер игры Demiurge. Ты ведёшь приключение в реальном времени.

ТВОЙ СТИЛЬ:
- Ты добрый, мудрый старик, рассказчик у камина. Обращаешься к игрокам на «ты».
- Описываешь мир красочно, живо, литературно на русском языке (3-6 предложений).
- Твой тон зависит от режима: ${params.nsfw ? 'МОЖЕШЬ использовать взрослую лексику, мат, мрачные и жестокие описания' : 'Держись в рамках PG-13, без мата и откровенных сцен'}.

СЕТТИНГ:
- Жанр: ${params.genre} (фэнтези).
- Сеттинг: ${params.setting} (${params.setting === 'forest' ? 'древний лес, эльфийские руины, магия природы' : params.setting === 'dungeon' ? 'тёмные подземелья, коридоры, ловушки, сокровища' : params.setting === 'castle' ? 'замок, интриги, рыцари, тайны королевского двора' : 'горы, драконьи пики, гномьи шахты, перевалы'}).
- Сложность: ${params.difficulty === 'easy' ? 'ЛЁГКАЯ: давай подсказки, враги слабые, смерть маловероятна' : params.difficulty === 'hard' ? 'ОПАСНОСТЬ: без подсказок, враги сильные, смерть возможна' : 'НОРМАЛЬНАЯ: сбалансированные испытания'}.
- Игроков: ${params.playerCount}.

ПОЖЕЛАНИЯ К ИСТОРИИ ОТ ВЛАДЕЛЬЦА:
${params.storyPrompt || '(нет особых пожеланий — придумай сам захватывающий сюжет)'}

ПРАВИЛА ОТВЕТА:
- Отвечай СТРОГО валидным JSON без markdown-форматирования.
- Если нужно проверить удачу — кидай d20 (DC 10 легко, 15 средне, 20 сложно).
- Управляй токенами через массив "tokens" (move/add/remove).
- Не убивай игроков без возможности воскрешения (кроме сложности «опасность»).
- Веди историю к логическому завершению.`;

export async function generateWorld(params: {
  genre: string; setting: string; difficulty: string;
  nsfw: boolean; storyPrompt: string; playerCount: number;
  playerNames: string[]; playerPrompts: string[];
  playTime: number;
}): Promise<{
  intro: string; map: string[][]; objects: any[]; npcs: any[];
  playerStart: { x: number; y: number };
  timeOfDay: 'day' | 'night';
} | null> {
  const assets = getAssetIdList();
  const tiles = assets.filter(a => a.startsWith('tiles_'));
  const props = assets.filter(a => a.startsWith('props_'));
  const tileList = tiles.slice(0, 40).join(', ');
  const propList = props.slice(0, 30).join(', ');
  const chars = params.playerNames.map((n, i) => `${n} (prompt: ${params.playerPrompts[i] || 'стандартный герой'})`).join('; ');

  const prompt = `СОЗДАЙ МИР ДЛЯ ПРИКЛЮЧЕНИЯ.

Параметры:
- Время игры: примерно ${params.playTime} минут
- Персонажи: ${chars || 'один герой'}

Доступные ID тайлов: ${tileList}
Доступные ID объектов: ${propList}

Сгенерируй:
1. story_intro — атмосферная завязка (3-5 предложений).
2. map — матрица 40×40, где каждая ячейка — ID тайла (выбирай только из списка доступных!).
   - Для травы: tiles_ground_grass_2, tiles_ground_grass_3, tiles_ground_grass_4
   - Для камня: tiles_ground_grounde_stone_1, tiles_ground_grounde_stone_2, tiles_ground_grounde_stone_3
   - Для воды: tiles_ground_water_1, tiles_ground_water_2, tiles_ground_water_3
   - Для деревянного пола: tiles_floors_floor_wood_1, tiles_floors_floor_wood_2
   - Для каменного пола: tiles_floors_floor_stone_1, tiles_floors_floor_stone_2
   - Для пещер: tiles_floors_floor_cave, tiles_floors_floor_cave_2
   - Для дорог: tiles_ground_path_1, tiles_ground_path_2
   - Для стен: tiles_walls_walls_stone_1, tiles_walls_walls_brick_1, tiles_walls_walls_wood
3. objects — массив объектов (деревья, мебель, факелы, сундуки).
4. npcs — 3-6 NPC с именами, диалогами (1 предложение), HP, координатами.
5. player_start — {x, y} где появляются игроки (в центре безопасной зоны).

Верни СТРОГО JSON (без markdown!):
{"story_intro":"...","map":[["tiles_ground_grass_2",...],...все 40×40...],"objects":[{"id":"props_nature_tree","x":5,"y":6},...],"npcs":[{"name":"Трактирщик","x":10,"y":12,"dialog":"Привет, путник!","hp":15,"maxHp":15,"type":"npc"},...],"player_start":{"x":20,"y":20}}`;

  try {
    const result = await callAI([
      { role: 'system', content: MASTER_SYSTEM(params) },
      { role: 'user', content: prompt },
    ], 6000, 120000);

    const json = extractJSON(result);
    if (json && json.map && Array.isArray(json.map) && json.map.length >= 30) return {
      intro: json.story_intro || 'Приключение начинается...',
      map: json.map,
      objects: json.objects || [],
      npcs: (json.npcs || []).map((n: any) => ({ ...n, type: n.type || 'npc' })),
      playerStart: json.player_start || { x: 20, y: 20 },
      timeOfDay: (params.setting === 'dungeon' || params.setting === 'castle') ? 'night' : 'day',
    };
  } catch {}

  return null;
}

export async function processGameAction(params: {
  genre: string; setting: string; difficulty: string;
  nsfw: boolean; storyPrompt: string; playerCount: number;
  action: string; playerName: string; playerPrompt: string;
  history: string[]; tokens: any[]; objects: any[];
  playerHp: number; playerMaxHp: number;
  inventory: { id: string; name: string; qty: number }[];
}): Promise<any> {
  const h = params.history.slice(-10).join('\n');
  const tokenRefs = params.tokens.map((t: any) =>
    `"${t.name}"(id:${t.id.slice(0, 8)}, x${t.x}y${t.y}, ${t.type}, hp${t.hp}/${t.maxHp})`
  ).join(' | ');
  const objRefs = params.objects.slice(0, 15).map((o: any) =>
    `${o.id?.split('_').pop() || 'объект'} (x${o.x}y${o.y})`
  ).join(', ');

  const prompt = `ИГРОК ДЕЛАЕТ ХОД.

Персонаж: ${params.playerName}${params.playerPrompt ? ` (описание: ${params.playerPrompt})` : ''}
Действие: «${params.action}»
HP: ${params.playerHp}/${params.playerMaxHp}
Инвентарь: ${params.inventory.map(i => `${i.name}×${i.qty}`).join(', ') || 'пусто'}

Последние события:
${h || '(начало игры)'}

Токены на карте: ${tokenRefs}
Объекты рядом: ${objRefs}

Опиши что происходит (narration). Если нужно проверить навык — кинь d20 (roll). Двигай токены если нужно (tokens). Предложи 2-4 варианта действий (options). Если пора заканчивать — sessionEnd:true + epilogue.

Верни СТРОГО JSON:
{"narration":"текст описания","roll":null|{"dice":"d20","result":15,"dc":12,"success":true},"tokens":[{"action":"move"|"add"|"remove","id":"короткий_id_токена","x":5,"y":6}],"options":["вар1","вар2","вар3"],"sessionEnd":false,"epilogue":null,"playerHp":null,"inventory":{"add":[],"remove":[]}}`;

  try {
    const result = await callAI([
      { role: 'system', content: MASTER_SYSTEM(params) },
      { role: 'user', content: prompt },
    ], 1500, 30000);

    const json = extractJSON(result);
    if (json && (json.narration || json.description)) return {
      ...json,
      description: json.narration || json.description,
    };
  } catch {}

  return null;
}

export function generateFallbackWorld(assets: string[], settings: any): any {
  const find = (pattern: string) => assets.find(a => a.toLowerCase().includes(pattern.toLowerCase())) || null;
  const findAll = (pattern: string) => assets.filter(a => a.toLowerCase().includes(pattern.toLowerCase()));

  const grass = findAll('ground_grass').sort(() => Math.random() - 0.5)[0] || 'tiles_ground_grass_2';
  const stone = findAll('grounde_stone').filter(a => !a.includes('darker')).sort(() => Math.random() - 0.5)[0] || grass;
  const darkStone = find('darker') || stone;
  const water = find('water') || null;
  const path = find('path') || null;
  const wetSand = find('wet_sand') || find('sand') || null;
  const floorWood = find('floor_wood') || null;
  const floorStone = find('floor_stone') || null;
  const floorCave = find('floor_cave') || floorStone;
  const wallStone = find('walls_stone') || find('wall_stone') || null;
  const snow = find('snow') || null;
  const tree = find('tree') || find('nature_tree') || null;
  const light = find('torch') || find('lantern') || find('light') || null;
  const table = find('table') || null;
  const chair = find('chair') || null;
  const barrel = find('barrel') || null;
  const chest = find('chest') || null;
  const bookshelf = find('bookshelf') || null;
  const banner = find('banner') || null;
  const size = 40;
  const setting = settings.setting || 'forest';
  const map: string[][] = [];
  const objects: any[] = [];
  const npcs: any[] = [];

  function rnd(s: number) { const x = Math.sin(s * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }

  for (let y = 0; y < size; y++) { map[y] = []; for (let x = 0; x < size; x++) map[y][x] = grass; }

  if (setting === 'forest') {
    if (water) for (let y = 5; y < 35; y++) { const dx = Math.floor(Math.sin(y * 0.3) * 4); map[y][20 + dx] = water; if (rnd(y * 3) > 0.5) map[y][21 + dx] = water; }
    if (wetSand) for (let y = 5; y < 35; y++) { const dx = Math.floor(Math.sin(y * 0.3) * 4); if (map[y][19 + dx] === grass) map[y][19 + dx] = wetSand; if (map[y][22 + dx] === grass) map[y][22 + dx] = wetSand; }
    if (floorWood) for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 7; dx++) map[27 + dy][5 + dx] = floorWood;
    if (table) { objects.push({ id: table, x: 6, y: 28 }); objects.push({ id: table, x: 8, y: 29 }); objects.push({ id: table, x: 7, y: 30 }); }
    if (chair) { objects.push({ id: chair, x: 5, y: 28 }); objects.push({ id: chair, x: 9, y: 29 }); objects.push({ id: chair, x: 6, y: 30 }); objects.push({ id: chair, x: 8, y: 31 }); }
    if (barrel) { objects.push({ id: barrel, x: 10, y: 27 }); objects.push({ id: barrel, x: 11, y: 27 }); }
    if (light) { objects.push({ id: light, x: 5, y: 27 }); objects.push({ id: light, x: 10, y: 28 }); }
    if (path) { for (let i = 0; i < 15; i++) map[17 + i][8] = path; for (let i = 0; i < 6; i++) map[17][8 - i] = path; map[16][2] = path; map[16][3] = path; }
    if (tree) for (let i = 0; i < 55; i++) { objects.push({ id: tree, x: 3 + Math.floor(Math.abs(rnd(i * 100 + 1)) * 34), y: 3 + Math.floor(Math.abs(rnd(i * 100 + 2)) * 34) }); }
    if (chest) objects.push({ id: chest, x: 34, y: 6 });
    if (darkStone) for (let i = 0; i < 8; i++) { const sx = 25 + Math.floor(rnd(i * 5) * 12); const sy = 30 + Math.floor(rnd(i * 6) * 8); if (map[sy][sx] === grass) map[sy][sx] = darkStone; }
    npcs.push({ type: 'npc', name: 'Трактирщица Мира', x: 7, y: 29, dialog: 'Добро пожаловать в таверну «Старый дуб»!', hp: 15, maxHp: 15 });
    npcs.push({ type: 'npc', name: 'Странник Эльдар', x: 34, y: 7, dialog: 'Я ищу древний артефакт... Не поможешь?', hp: 18, maxHp: 18 });
    npcs.push({ type: 'npc', name: 'Лесничий Бран', x: 30, y: 2, dialog: 'В лесу волки — будьте осторожны.', hp: 20, maxHp: 20 });
    return { story_intro: `Вы прибыли в деревушку у Древнего леса. Трактирщица Мира приветливо машет из таверны «Старый дуб». Странник Эльдар что-то ищет у старого дуба на востоке. Лесничий Бран предупреждает о волках на севере. Воздух пахнет приключениями...`, map, objects, npcs, player_start: { x: 8, y: 16 } };
  }

  if (setting === 'dungeon') {
    const F = floorCave || floorStone || grass, W = wallStone || stone;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const innerW = (y === 10 && x < 32) || (y === 20 && x > 8 && x < 38) || (y === 30 && x < 30) || (x === 10 && y > 10 && y < 30) || (x === 28 && y > 20 && y < 38) || (x === 18 && y > 10 && y < 20);
      map[y][x] = (edge || innerW) ? W : F;
    }
    if (light) for (let i = 0; i < 10; i++) { objects.push({ id: light, x: 3 + i * 4, y: 1 }); objects.push({ id: light, x: 1, y: 11 + i * 3 }); }
    if (light) objects.push({ id: light, x: 38, y: 25 });
    if (chest) { objects.push({ id: chest, x: 6, y: 18 }); objects.push({ id: chest, x: 32, y: 28 }); }
    if (barrel) for (let i = 0; i < 5; i++) objects.push({ id: barrel, x: 4 + i * 5, y: 32 });
    npcs.push({ type: 'monster', name: 'Скелет-страж', x: 8, y: 15, dialog: '...', hp: 10, maxHp: 10 });
    npcs.push({ type: 'monster', name: 'Скелет-страж', x: 30, y: 25, dialog: '...', hp: 10, maxHp: 10 });
    npcs.push({ type: 'monster', name: 'Орк-воин', x: 35, y: 32, dialog: 'Ты не пройдёшь!', hp: 22, maxHp: 22 });
    npcs.push({ type: 'npc', name: 'Узница Гвен', x: 5, y: 35, dialog: 'Спасибо, что нашли меня!', hp: 8, maxHp: 15 });
    return { story_intro: 'Тяжёлые двери захлопнулись. Факелы отбрасывают дрожащие тени. Из глубины доносится звон цепей и женский крик. Нужно найти выход — или погибнуть в темноте...', map, objects, npcs, player_start: { x: 20, y: 2 } };
  }

  if (setting === 'castle') {
    const F = floorStone || grass, W = wallStone || stone;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const outer = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const inner = (y === 7 && x < 35) || (y === 30 && x > 5) || (x === 10 && y > 7 && y < 30) || (x === 30 && y > 7 && y < 30) || (x === 20 && y > 15 && y < 22);
      map[y][x] = (outer || inner) ? W : F;
    }
    if (light) for (let i = 0; i < 10; i++) { objects.push({ id: light, x: 2, y: 3 + i * 4 }); objects.push({ id: light, x: 38, y: 3 + i * 4 }); }
    if (table) { objects.push({ id: table, x: 19, y: 18 }); objects.push({ id: table, x: 21, y: 18 }); }
    if (chair) for (let i = 0; i < 6; i++) objects.push({ id: chair, x: 17 + i, y: 19 });
    if (banner) { objects.push({ id: banner, x: 18, y: 9 }); objects.push({ id: banner, x: 22, y: 9 }); }
    if (chest) { objects.push({ id: chest, x: 35, y: 20 }); objects.push({ id: chest, x: 8, y: 25 }); }
    npcs.push({ type: 'npc', name: 'Король Торин', x: 20, y: 17, dialog: 'Герои! Тьма наступает с востока.', hp: 25, maxHp: 25 });
    npcs.push({ type: 'npc', name: 'Советник Каэль', x: 22, y: 18, dialog: 'Древнее пророчество гласит...', hp: 15, maxHp: 15 });
    npcs.push({ type: 'npc', name: 'Стражник', x: 12, y: 25, dialog: 'Вход в подземелье заперт.', hp: 20, maxHp: 20 });
    return { story_intro: 'Вы в тронном зале замка Эльдория. Король Торин с тревогой смотрит на вас. Советник Каэль нервно теребит свиток. Грядёт война — и только вы можете всё изменить...', map, objects, npcs, player_start: { x: 20, y: 22 } };
  }

  // mountains
  if (darkStone) for (let i = 0; i < 30; i++) { const sx = 5 + Math.floor(rnd(i * 5) * 30); const sy = 5 + Math.floor(rnd(i * 6) * 30); map[sy][sx] = darkStone; }
  if (path) for (let i = 0; i < 20; i++) map[15 + i][20] = path;
  if (floorCave) for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 6; dx++) map[30 + dy][5 + dx] = floorCave;
  if (wallStone) { for (let dy = 0; dy < 5; dy++) { map[30 + dy][4] = wallStone; map[30 + dy][11] = wallStone; } for (let dx = 0; dx < 8; dx++) { map[29][5 + dx] = wallStone; map[35][5 + dx] = wallStone; } }
  if (tree) for (let i = 0; i < 10; i++) objects.push({ id: tree, x: 30 + Math.floor(rnd(i * 1) * 8), y: 2 + Math.floor(rnd(i * 2) * 10) });
  if (light) { objects.push({ id: light, x: 20, y: 15 }); objects.push({ id: light, x: 7, y: 32 }); objects.push({ id: light, x: 8, y: 32 }); }
  if (chest) objects.push({ id: chest, x: 8, y: 33 });
  if (barrel) objects.push({ id: barrel, x: 9, y: 33 });
  npcs.push({ type: 'npc', name: 'Горный проводник Орм', x: 20, y: 16, dialog: 'Я проведу через перевал.', hp: 18, maxHp: 18 });
  npcs.push({ type: 'monster', name: 'Горный тролль', x: 7, y: 31, dialog: 'ГРРР! Кто посмел?!', hp: 35, maxHp: 35 });
  return { story_intro: 'Высоко в горах воздух тонок и свеж. Горный проводник Орм ждёт у костра на перевале. Где-то в пещере на западе рычит тролль, охраняющий древние сокровища...', map, objects, npcs, player_start: { x: 20, y: 17 } };
}

export function smartFallback(data: {
  action: string; curTokens: any[]; curObjects: any[]; ws: any; userId: string;
}): { description: string; options: string[]; changes: any } {
  const { action, curTokens, curObjects, ws, userId } = data;
  const a = action.toLowerCase();
  const player = curTokens.find((t: any) => t.id === userId);
  const px = player?.x ?? 20, py = player?.y ?? 20;
  const nearbyNpcs = curTokens.filter((t: any) => t.type !== 'player' && Math.abs(t.x - px) <= 5 && Math.abs(t.y - py) <= 5);
  const nearbyObjs = curObjects.filter((o: any) => Math.abs(o.x - px) <= 3 && Math.abs(o.y - py) <= 3);
  const changes: any = { tokens: [] };

  let desc = '';
  const opts: string[] = [];

  if (a.includes('осмотреться') || a.includes('осмотреть') || a.includes('оглядеться') || a.includes('look')) {
    const tileId = ws.map?.[py]?.[px] || '?';
    const tileName = tileId?.includes('grass') ? 'траве' : tileId?.includes('stone') ? 'камнях' : tileId?.includes('floor') ? 'полу' : tileId?.includes('path') ? 'тропинке' : tileId?.includes('water') ? 'берегу' : 'местности';
    desc = `Вы находитесь на ${tileName}. `;
    if (nearbyObjs.length > 0) desc += `Рядом вы видите: ${nearbyObjs.slice(0, 3).map(o => o.id?.split('_').pop() || 'объект').join(', ')}. `;
    if (nearbyNpcs.length > 0) desc += `Поблизости: ${nearbyNpcs.map(n => n.name).join(', ')}. `;
    else desc += 'Вокруг ни души. ';
    opts.push(...['Идти дальше', 'Поговорить с NPC', 'Исследовать местность']);
  } else if (a.includes('поговорить') || a.includes('говорить') || a.includes('talk') || a.includes('npc')) {
    if (nearbyNpcs.length > 0) {
      const npc = nearbyNpcs[0];
      desc = `Вы подходите к ${npc.name}. «${npc.dialog || 'Приветствую, путник!'}» — ${npc.name === 'Трактирщица Мира' ? 'она' : 'он'} приветливо смотрит на вас.`;
      if (player) changes.tokens.push({ id: player.id, x: npc.x, y: npc.y + 1 });
      opts.push(...['Расспросить подробнее', 'Попросить помощи', 'Попрощаться']);
    } else {
      desc = 'Рядом никого нет. Вы слышите лишь шум ветра и собственные шаги.';
      opts.push(...['Идти дальше', 'Осмотреться', 'Позвать на помощь']);
    }
  } else if (a.includes('идти') || a.includes('пойти') || a.includes('двигаться') || a.includes('вперёд') || a.includes('дальше') || a.includes('walk') || a.includes('go')) {
    let dx = 0, dy = 0;
    if (a.includes('направо') || a.includes('right')) dx = 1;
    else if (a.includes('налево') || a.includes('left')) dx = -1;
    else if (a.includes('вверх') || a.includes('вперёд') || a.includes('forward') || a.includes('up') || a.includes('дальше')) dy = -1;
    else if (a.includes('вниз') || a.includes('назад') || a.includes('back') || a.includes('down')) dy = 1;
    else { dx = Math.random() > 0.5 ? 1 : -1; dy = Math.random() > 0.5 ? 1 : -1; }
    const nx = Math.max(0, Math.min(39, px + dx)), ny = Math.max(0, Math.min(39, py + dy));
    if (player) changes.tokens.push({ id: player.id, x: nx, y: ny });
    desc = `Вы идёте ${dx > 0 ? 'направо' : dx < 0 ? 'налево' : ''}${dy > 0 ? ' вниз' : dy < 0 ? ' вверх' : ''}. ${nearbyNpcs.length > 0 ? `Впереди виднеется ${nearbyNpcs[0].name}.` : 'Дорога продолжается дальше.'}`;
    opts.push(...['Осмотреться', 'Поговорить с NPC', 'Идти дальше']);
  } else if (a.includes('атаковать') || a.includes('ударить') || a.includes('attack') || a.includes('fight')) {
    if (nearbyNpcs.length > 0) {
      const npc = nearbyNpcs[0];
      const dmg = Math.floor(Math.random() * 8) + 3;
      const newHp = Math.max(0, (npc.hp || 10) - dmg);
      desc = `Вы атакуете ${npc.name}! Наносите ${dmg} урона. ${newHp > 0 ? `${npc.name} ранен, но держится.` : `${npc.name} повержен!`}`;
      changes.tokens.push({ id: npc.id, hp: newHp });
      if (newHp === 0) changes.tokens.push({ id: npc.id, remove: true });
      opts.push(...['Добить', 'Отступить', 'Осмотреться']);
    } else {
      desc = 'Некого атаковать. Вы размахиваете оружием в воздухе.';
      opts.push(...['Осмотреться', 'Идти дальше', 'Искать врагов']);
    }
  } else if (a.includes('инвентарь') || a.includes('вещи') || a.includes('рюкзак') || a.includes('inventory')) {
    desc = 'Вы проверяете свой инвентарь. У вас пока немного вещей — всё впереди!';
    opts.push(...['Осмотреться', 'Идти дальше', 'Искать предметы']);
  } else if (a.includes('взять') || a.includes('подобрать') || a.includes('take') || a.includes('grab')) {
    if (nearbyObjs.length > 0) {
      desc = `Вы подбираете ${nearbyObjs[0].id?.split('_').pop() || 'предмет'}.`;
      opts.push(...['Осмотреться', 'Идти дальше', 'Использовать предмет']);
    } else {
      desc = 'Рядом нет предметов, которые можно подобрать.';
      opts.push(...['Осмотреться', 'Идти дальше', 'Искать предметы']);
    }
  } else {
    desc = `Вы ${a.toLowerCase()}. Вокруг тишина и спокойствие. Что делать дальше?`;
    opts.push(...['Осмотреться вокруг', 'Идти дальше', 'Поговорить с NPC']);
  }

  return { description: desc, options: opts, changes };
}

function extractJSON(text: string): any {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch {
    return null;
  }
}
