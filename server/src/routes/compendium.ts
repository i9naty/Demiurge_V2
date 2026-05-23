import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { ok, fail } from '../middleware/response';

export const compendiumRouter = Router();

// Search monsters
compendiumRouter.get('/monsters', authMiddleware, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const cr = req.query.cr as string;
    const type = req.query.type as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let sql = 'SELECT * FROM compendium_monsters WHERE 1=1';
    const params: unknown[] = [];

    if (q) { params.push(`%${q}%`); sql += ` AND name ILIKE $${params.length}`; }
    if (cr) { params.push(cr); sql += ` AND cr = $${params.length}`; }
    if (type) { params.push(type); sql += ` AND type = $${params.length}`; }

    params.push(limit);
    sql += ` ORDER BY name LIMIT $${params.length}`;

    const result = await query(sql, params);
    ok(res, result.rows);
  } catch (err) {
    console.error('Compendium monsters error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка поиска монстров', 500);
  }
});

// Search spells
compendiumRouter.get('/spells', authMiddleware, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const level = req.query.level as string;
    const school = req.query.school as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let sql = 'SELECT * FROM compendium_spells WHERE 1=1';
    const params: unknown[] = [];

    if (q) { params.push(`%${q}%`); sql += ` AND name ILIKE $${params.length}`; }
    if (level !== undefined && level !== '') { params.push(parseInt(level)); sql += ` AND level = $${params.length}`; }
    if (school) { params.push(school); sql += ` AND school = $${params.length}`; }

    params.push(limit);
    sql += ` ORDER BY level, name LIMIT $${params.length}`;

    const result = await query(sql, params);
    ok(res, result.rows);
  } catch (err) {
    console.error('Compendium spells error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка поиска заклинаний', 500);
  }
});

// Search items
compendiumRouter.get('/items', authMiddleware, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const type = req.query.type as string;
    const rarity = req.query.rarity as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let sql = 'SELECT * FROM compendium_items WHERE 1=1';
    const params: unknown[] = [];

    if (q) { params.push(`%${q}%`); sql += ` AND name ILIKE $${params.length}`; }
    if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
    if (rarity) { params.push(rarity); sql += ` AND rarity = $${params.length}`; }

    params.push(limit);
    sql += ` ORDER BY type, name LIMIT $${params.length}`;

    const result = await query(sql, params);
    ok(res, result.rows);
  } catch (err) {
    console.error('Compendium items error:', err);
    fail(res, 'SERVER_ERROR', 'Ошибка поиска предметов', 500);
  }
});

// Seed SRD data
export async function seedCompendium(): Promise<void> {
  const monsters = [
    { name: 'Goblin', cr: '1/4', type: 'humanoid', size: 'small', ac: 15, hp: 7, speed: '30 ft.',
      stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      actions: 'Scimitar: +4 to hit, 1d6+2 slashing. Shortbow: +4 to hit, 1d6+2 piercing.',
      traits: 'Nimble Escape: Disengage or Hide as bonus action.' },
    { name: 'Orc', cr: '1/2', type: 'humanoid', size: 'medium', ac: 13, hp: 15, speed: '30 ft.',
      stats: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
      actions: 'Greataxe: +5 to hit, 1d12+3 slashing. Javelin: +5 to hit, 1d6+3 piercing.',
      traits: 'Aggressive: Move up to speed toward enemy as bonus action.' },
    { name: 'Skeleton', cr: '1/4', type: 'undead', size: 'medium', ac: 13, hp: 13, speed: '30 ft.',
      stats: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
      actions: 'Shortsword: +4 to hit, 1d6+2 piercing. Shortbow: +4 to hit, 1d6+2 piercing.',
      traits: 'Undead Fortitude. Vulnerable to bludgeoning.' },
    { name: 'Zombie', cr: '1/4', type: 'undead', size: 'medium', ac: 8, hp: 22, speed: '20 ft.',
      stats: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
      actions: 'Slam: +3 to hit, 1d6+1 bludgeoning.',
      traits: 'Undead Fortitude: DC 5+damage Con save to drop to 1hp instead of 0.' },
    { name: 'Owlbear', cr: '3', type: 'monstrosity', size: 'large', ac: 13, hp: 59, speed: '40 ft.',
      stats: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
      actions: 'Multiattack: Claw +7 to hit (2d8+5) and Beak +7 (1d10+5).',
      traits: 'Keen Sight and Smell.' },
    { name: 'Troll', cr: '5', type: 'giant', size: 'large', ac: 15, hp: 84, speed: '30 ft.',
      stats: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
      actions: 'Multiattack: Bite +7 (1d6+4) and two Claws +7 (2d6+4).',
      traits: 'Regeneration: regain 10 hp at start of turn. Fire/acid stops regen.' },
    { name: 'Dragon (Young Red)', cr: '10', type: 'dragon', size: 'large', ac: 18, hp: 178, speed: '40 ft., fly 80 ft.',
      stats: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
      actions: 'Multiattack: Bite+10(2d10+6+1d6 fire), Claw+10(2d6+6). Fire Breath: 16d6 (DC 17 Dex).',
      traits: 'Fire immunity. Legendary Resistance 3/day.' },
    { name: 'Lich', cr: '21', type: 'undead', size: 'medium', ac: 17, hp: 135, speed: '30 ft.',
      stats: { str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16 },
      actions: 'Paralyzing Touch: +12 to hit, 3d6 cold. Spellcasting: DC 20, up to 9th level spells.',
      traits: 'Legendary Resistance 3/day. Rejuvenation. Turn Resistance.' },
    { name: 'Bandit', cr: '1/8', type: 'humanoid', size: 'medium', ac: 12, hp: 11, speed: '30 ft.',
      stats: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      actions: 'Scimitar: +3 to hit, 1d6+1 slashing. Light Crossbow: +3 to hit, 1d8+1 piercing.' },
    { name: 'Wolf', cr: '1/4', type: 'beast', size: 'medium', ac: 13, hp: 11, speed: '40 ft.',
      stats: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      actions: 'Bite: +4 to hit, 2d4+2 piercing. DC 11 Str or prone.',
      traits: 'Pack Tactics: advantage on attacks if ally within 5 ft.' },
    { name: 'Spider (Giant)', cr: '1', type: 'beast', size: 'large', ac: 14, hp: 26, speed: '30 ft., climb 30 ft.',
      stats: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
      actions: 'Bite: +5 to hit, 1d8+3 piercing + DC 11 Con save or 2d8 poison.',
      traits: 'Web Sense, Web Walker, Spider Climb.' },
    { name: 'Mimic', cr: '2', type: 'monstrosity', size: 'medium', ac: 12, hp: 58, speed: '15 ft.',
      stats: { str: 17, dex: 12, con: 15, int: 5, wis: 13, cha: 8 },
      actions: 'Pseudopod: +5 to hit, 1d8+3 bludgeoning + grapple. Bite: +5 to hit (grappled only), 1d8+3 piercing + 1d8 acid.',
      traits: 'Shapechanger, Adhesive, False Appearance, Grappler.' },
  ];

  const spells = [
    { name: 'Magic Missile', level: 1, school: 'evocation', description: 'Creates 3 glowing darts dealing 1d4+1 force each. +1 dart per higher level.' },
    { name: 'Fireball', level: 3, school: 'evocation', description: '20-ft radius explosion dealing 8d6 fire damage (Dex half). +1d6 per higher level.', classes: ['wizard', 'sorcerer'] },
    { name: 'Cure Wounds', level: 1, school: 'evocation', description: 'Touch a creature, it regains 1d8 + spellcasting mod HP. +1d8 per higher level.', classes: ['cleric', 'druid', 'bard', 'paladin', 'ranger'] },
    { name: 'Fire Bolt', level: 0, school: 'evocation', description: 'Ranged spell attack dealing 1d10 fire damage. Increases at 5th(2d10), 11th(3d10), 17th(4d10).', classes: ['wizard', 'sorcerer'] },
    { name: 'Shield', level: 1, school: 'abjuration', description: 'Reaction: +5 AC until your next turn, including against triggering attack.', classes: ['wizard', 'sorcerer'] },
    { name: 'Invisibility', level: 2, school: 'illusion', description: 'Target becomes invisible for 1 hour (concentration). Ends if attacks or casts.', classes: ['wizard', 'sorcerer', 'bard', 'warlock'] },
    { name: 'Lightning Bolt', level: 3, school: 'evocation', description: '100-ft line dealing 8d6 lightning (Dex half). +1d6 per higher level.', classes: ['wizard', 'sorcerer'] },
    { name: 'Mage Armor', level: 1, school: 'abjuration', description: 'Target base AC becomes 13 + Dex mod (8 hours, no armor).', classes: ['wizard', 'sorcerer'] },
    { name: 'Counterspell', level: 3, school: 'abjuration', description: 'Reaction: interrupt a spell. Auto-success if slot level >= spell level, else DC 10+spell level check.', classes: ['wizard', 'sorcerer', 'warlock'] },
    { name: 'Misty Step', level: 2, school: 'conjuration', description: 'Bonus action: teleport 30 ft. to visible unoccupied space.', classes: ['wizard', 'sorcerer', 'warlock'] },
    { name: 'Healing Word', level: 1, school: 'evocation', description: 'Bonus action: target within 60 ft regains 1d4+mod HP. +1d4 per higher level.', classes: ['cleric', 'bard', 'druid'] },
    { name: 'Bless', level: 1, school: 'enchantment', description: 'Up to 3 targets within 30 ft add 1d4 to attack rolls and saves (concentration, 1 min).', classes: ['cleric', 'paladin'] },
  ];

  const items = [
    { name: 'Longsword', type: 'weapon', rarity: 'common', cost: '15 gp', weight: 3, description: '1d8 slashing (versatile 1d10). Martial melee weapon.' },
    { name: 'Shortbow', type: 'weapon', rarity: 'common', cost: '25 gp', weight: 2, description: '1d6 piercing (range 80/320). Simple ranged weapon.' },
    { name: 'Dagger', type: 'weapon', rarity: 'common', cost: '2 gp', weight: 1, description: '1d4 piercing (finesse, light, thrown 20/60). Simple melee weapon.' },
    { name: 'Chain Mail', type: 'armor', rarity: 'common', cost: '75 gp', weight: 55, description: 'AC 16. Heavy armor, disadvantage on Stealth. Str 13 required.' },
    { name: 'Leather Armor', type: 'armor', rarity: 'common', cost: '10 gp', weight: 10, description: 'AC 11 + Dex mod. Light armor.' },
    { name: 'Shield', type: 'armor', rarity: 'common', cost: '10 gp', weight: 6, description: '+2 AC. Requires one hand.' },
    { name: 'Potion of Healing', type: 'potion', rarity: 'common', cost: '50 gp', weight: 0.5, description: 'Regain 2d4+2 HP when consumed.' },
    { name: 'Potion of Greater Healing', type: 'potion', rarity: 'uncommon', cost: '150 gp', weight: 0.5, description: 'Regain 4d4+4 HP when consumed.' },
    { name: 'Bag of Holding', type: 'wondrous', rarity: 'uncommon', cost: '400 gp', weight: 15, description: 'Interior space 4×4×4 ft. Holds 500 lb. Weight always 15 lb.' },
    { name: 'Cloak of Protection', type: 'wondrous', rarity: 'uncommon', cost: '350 gp', weight: 1, description: '+1 AC and +1 to all saving throws while worn. Requires attunement.' },
    { name: 'Rope (50 ft.)', type: 'adventuring_gear', rarity: 'common', cost: '1 gp', weight: 10, description: 'Hemp rope. Has 2 HP. DC 17 Str check to burst.' },
    { name: 'Torch', type: 'adventuring_gear', rarity: 'common', cost: '1 cp', weight: 1, description: 'Bright light 20 ft, dim 20 ft. Burns for 1 hour.' },
    { name: 'Thieves Tools', type: 'tools', rarity: 'common', cost: '25 gp', weight: 1, description: 'Proficiency allows adding prof. bonus to lockpicking and trap disarm checks.' },
    { name: 'Alchemist Fire', type: 'adventuring_gear', rarity: 'common', cost: '50 gp', weight: 1, description: 'Ranged attack: 1d4 fire on hit, and 1d4 fire at start of each turn (DC 10 Dex to extinguish).' },
    { name: 'Wand of Magic Missiles', type: 'wondrous', rarity: 'uncommon', cost: '800 gp', weight: 1, description: '7 charges. 1 charge = 1 dart version, +1 per extra charge. Regains 1d6+1 at dawn.' },
  ];

  for (const m of monsters) {
    try {
      await query(
        `INSERT INTO compendium_monsters (name, cr, type, size, ac, hp, speed, stats, actions, traits, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [m.name, m.cr, m.type, m.size, m.ac, m.hp, m.speed, JSON.stringify(m.stats), m.actions, m.traits, 'SRD']
      );
    } catch {}
  }
  for (const s of spells) {
    try {
      await query(
        `INSERT INTO compendium_spells (name, level, school, description, classes, source)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [s.name, s.level, s.school, s.description, s.classes || [], 'SRD']
      );
    } catch {}
  }
  for (const i of items) {
    try {
      await query(
        `INSERT INTO compendium_items (name, type, rarity, cost, weight, description, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [i.name, i.type, i.rarity, i.cost, i.weight, i.description, 'SRD']
      );
    } catch {}
  }
}
