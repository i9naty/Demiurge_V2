
import { env } from '../config/env';
import { query } from '../config/database';

const AI_BASE = env.ROUTERAI_BASE_URL;
const AI_KEY = env.ROUTERAI_API_KEY;

interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callAI(messages: AIChatMessage[], maxTokens = 512, timeoutMs = 30000): Promise<string> {
  if (!AI_KEY) return '🤖 ИИ не настроен. Добавьте ROUTERAI_API_KEY в .env';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: 'deepseek/deepseek-v4-pro', messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) { console.error('AI API error:', response.status, await response.text()); return '🤖 ИИ временно недоступен.'; }
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '🤖 Нет ответа от ИИ.';
  } catch (err: any) { 
    if (err.name === 'AbortError') { console.error('AI call timeout'); return 'TIMEOUT'; }
    console.error('AI call error:', err.message); return '🤖 Ошибка связи с ИИ.'; 
  }
}

export async function generateNPC(type: string): Promise<string> {
  return callAI([{ role: 'system', content: `Ты — генератор NPC для фэнтези-мира Demiurge. Создай ${type}: придумай имя, внешность, характер (3-5 черт), потребности и краткую историю. Формат: структурированный JSON. Ответ строго на русском языке.` }, { role: 'user', content: `Сгенерируй ${type} для мира Demiurge. Дай JSON с полями: name, appearance, traits[], needs[], backstory` }]);
}

export async function generateQuest(worldContext: string): Promise<string> {
  return callAI([{ role: 'system', content: `Ты — ИИ-бог мира Demiurge. Ты создаёшь динамические квесты на основе состояния мира. Ответ должен быть JSON с полями: title, description, objectiveType, reward, difficulty (1-10). Ответ строго на русском языке.` }, { role: 'user', content: `Контекст мира: ${worldContext}\nСгенерируй квест.` }]);
}

export async function generateWorldEvents(roomId: string): Promise<any> {
  try {
    const result = await callAI([{ role: 'system', content: 'Ты — ИИ-бог. Создай событие мира. JSON с eventType, description, effects. Кратко. Русский.' }, { role: 'user', content: `Комната ${roomId}. Одно случайное событие.` }]);
    try { return JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || result); } catch { return { eventType: 'mystery', description: result, effects: {} }; }
  } catch {
    const events = ['нашествие гоблинов', 'торговый караван', 'магическая буря', 'праздник урожая', 'землетрясение', 'открытие портала', 'пророчество'];
    const e = events[Math.floor(Math.random() * events.length)];
    return { eventType: e, description: `Произошло: ${e}`, effects: { economy: 'изменения', npcs: 'реагируют' } };
  }
}

export async function generateNPCResponse(prompt: string, npcType: string): Promise<string> {
  return callAI([{ role: 'system', content: `Ты — ${npcType} в мире Demiurge. Отвечай от своего лица, в характере. Используй русский язык. Будь естественным, как настоящий NPC в RPG.` }, { role: 'user', content: prompt }]);
}

export async function generateWorldDescription(seed: number, biome: string): Promise<string> {
  return callAI([{ role: 'system', content: 'Ты — генератор описаний миров. Создай атмосферное описание биома для игры Demiurge. 2-3 предложения. Русский язык.' }, { role: 'user', content: `Сид мира: ${seed}. Биом: ${biome}. Опиши этот регион мира.` }]);
}

// ========================================
// ГЕНЕРАЦИЯ ПОЛНОГО МИРА
// ========================================

export async function generateWorld(config: {
  seed: number; width: number; height: number;
  biome: string; density: string; difficulty: string; prompt: string;
}): Promise<any> {
  const systemPrompt = `Ты — генератор процедурных миров для RPG-игры Demiurge.
Создай карту ${config.width}x${config.height} тайлов. Биом: ${config.biome}. Плотность: ${config.density}. Сложность: ${config.difficulty}. Пожелания: "${config.prompt}". Сид: ${config.seed}.

Типы тайлов (terrain): grass, forest, deep_forest, plains, desert, sand_dunes, snow, tundra, swamp, water, river, lake, mountain, rocky, volcano, wasteland, crystal, enchanted, corrupted, cavern_entrance, dungeon_entrance.

Ресурсы: wood, stone, ore, gold, gems, food, herbs, mana_crystal, ancient_relic, monster_lair.

Здания: house, workshop, farm, mine, temple, wall, tower, castle, tavern, market, bridge, portal.

NPC (name русское, personality: дружелюбный/нейтральный/агрессивный/мудрый/безумный, type: крестьянин/торговец/стражник/маг/чудовище/дракон/дух/разбойник).

Сгенерируй JSON:
{
  "tiles": [{ "x":0,"y":0,"terrain":"grass","elevation":0.2,"resource_type":null,"resource_amount":0 }],
  "buildings": [{ "tile_x":10,"tile_y":15,"building_type":"tavern","name":"Таверна" }],
  "npcs": [{ "name":"Эльдар","personality":"мудрый","type":"маг","x":12.5,"y":15.3,"is_unique":true }],
  "factions": [{ "name":"Лесной Совет","reputation":60,"color":"#22c55e","wealth":2000 }],
  "quests": [{ "title":"Спасти деревню","description":"Гоблины!","objectiveType":"kill","reward":{"gold":100}}]
}
НЕ используй markdown. Только JSON. Количество: ~${Math.round(config.width * config.height * 0.65)} тайлов, 5-15 зданий, 5-15 NPC, 2-4 фракции, 3-6 квестов. Всё на русском.`;

  try {
    const result = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Сгенерируй мир. Сид: ${config.seed}. Размер: ${config.width}x${config.height}.` }
    ], 4096);
    try {
      return JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || result);
    } catch {
      return generateFallback(config.width, config.height, config.seed, config.biome, config.density, config.difficulty);
    }
  } catch (err: any) {
    console.error('World gen AI error, using fallback:', err.message);
    return generateFallback(config.width, config.height, config.seed, config.biome, config.density, config.difficulty);
  }
}

function generateFallback(w: number, h: number, seed: number, biome: string, density = 'medium', difficulty = 'normal'): any {
  const rand = (x: number, y: number) => { let n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453; return n - Math.floor(n); };
  const biomeMap: Record<string, string[]> = {
    forest: ['grass','forest','deep_forest','grass','forest','river','forest','grass'],
    desert: ['desert','sand_dunes','desert','desert','rocky','desert','wasteland','sand_dunes'],
    snow: ['snow','tundra','snow','snow','tundra','mountain','snow','tundra'],
    swamp: ['swamp','water','swamp','swamp','grass','swamp','water','swamp'],
    plains: ['plains','grass','plains','grass','plains','river','grass','plains'],
    mountain: ['rocky','mountain','rocky','grass','mountain','rocky','crystal','mountain'],
    mixed: ['grass','forest','plains','desert','water','mountain','swamp','rocky'],
  };
  const terrains = biomeMap[biome] || biomeMap.mixed;
  const densityMult = density === 'high' ? 1.5 : density === 'low' ? 0.5 : 1.0;
  const diffMult = difficulty === 'hard' ? 2 : difficulty === 'easy' ? 0.3 : 1.0;
  const resources = ['wood','stone','ore','food','herbs','gold','gems','mana_crystal',null,null,null];
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = rand(x, y), t = terrains[Math.floor(r * terrains.length)];
    const res = r > (0.8 / densityMult) ? resources[Math.floor(rand(x+1,y) * resources.length)] : null;
    tiles.push({ x, y, terrain: t, elevation: parseFloat((rand(x, y+1) * 2 - 0.5).toFixed(1)), resource_type: res, resource_amount: res ? Math.floor(rand(x+2, y) * 8 * densityMult) + 1 : 0 });
  }
  const bTypes = ['house','workshop','farm','tavern','temple','tower','mine','castle','market','bridge'];
  const bCount = Math.floor((w * h / 60) * densityMult * diffMult);
  const buildings = [];
  for (let i = 0; i < bCount; i++) buildings.push({ tile_x: Math.floor(rand(i*7,3)*w), tile_y: Math.floor(rand(i*13,7)*h), building_type: bTypes[i%bTypes.length], name: ['Дом','Хижина','Башня','Таверна','Кузня','Амбар','Храм','Замок','Рынок','Мост'][i%10]+` #${i+1}` });
  const names = ['Эльдар','Мира','Торин','Гвен','Рагнар','Селена','Каэль','Лира','Бран','Фрейя','Зейн','Ниса','Орфей','Веста','Ксан'];
  const npcCount = Math.floor(12 * densityMult * diffMult);
  const npcs = [];
  for (let i = 0; i < npcCount; i++) npcs.push({ name: names[i%15], personality: ['дружелюбный','нейтральный','мудрый','агрессивный','безумный'][i%5], type: ['крестьянин','торговец','стражник','маг','охотник','кузнец','травник','разбойник','паладин','друид'][i%10], x: (rand(i*31,17)*w)|0, y: (rand(i*41,19)*h)|0, is_unique: i < Math.ceil(npcCount/3) });
  const qCount = Math.floor(5 * diffMult);
  const quests = [];
  for (let i = 0; i < qCount; i++) quests.push({ title: ['Спасти деревню','Найти артефакт','Убить чудовище','Исследовать руины','Собрать травы','Защитить караван','Освободить пленника','Найти проход'][i%8], description: ['Гоблины нападают!','Древний артефакт ждёт','Чудовище в пещере','Руины хранят тайны','Алхимику нужны травы','Караван в опасности','Пленник в темнице','Тайный проход скрыт'][i%8], objectiveType: ['kill','explore','kill','explore','gather','deliver','explore','explore'][i%8], reward: {gold: Math.floor(rand(i,99)*300*diffMult)+50} });
  return { tiles, buildings, npcs, factions: [{ name:'Корона', reputation:50, color:'#3b82f6', wealth:5000*diffMult },{ name:'Теневой Союз', reputation:30, color:'#a855f7', wealth:2000*diffMult }], quests };
}
