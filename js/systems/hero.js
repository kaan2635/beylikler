import { HERO, xpForLevel, RARITIES, RARITY_IDS, ITEM_SLOTS, SLOT_IDS } from '../config/hero.js';
import { hash3, mulberry32 } from '../core/random.js';
import { bonusOf } from './bonus.js';

/**
 * Kahraman. Oyuncunun kaydında: state.hero =
 *   { name, level, xp, points, attrs: { kilic, kalkan, bereket, akin }, home (köy id),
 *     away (birlikte olduğu hareketin id'si | null), woundedUntil (gerçek ms),
 *     equipment: { silah, zirh, at, nisan } (eşya | null), inventory: [eşya], nextItemId }
 * Eşya: { id, slot, rarity, name, effects: { attack?, defense?, travel?, production?, carry?,
 *   xp?, heroAttack?, heroDefense? } }
 * Kahraman köyündeyken (yaralı değilse) o köyün üretimini ve savunmasını artırır (bkz.
 * premium.js syncBonuses); orduya katılınca hareket kahramanın o anki gücünü taşır.
 */

const HOUR = 3_600_000;
const HERO_NAMES = ['Turgut Alp', 'Konur Alp', 'Samsa Çavuş', 'Akça Koca', 'Abdurrahman Gazi', 'Gazi Rahman', 'Aykut Alp', 'Hasan Alp'];

export function ensureHero(state) {
  if (state.hero) return state.hero;
  const capital = Object.values(state.villages).find((v) => v.capital) ?? state.villages[state.activeVillageId];
  const pick = mulberry32(hash3(state.world.seed, 0x4e20, 7))();
  state.hero = {
    name: HERO_NAMES[Math.floor(pick * HERO_NAMES.length)],
    level: 1,
    xp: 0,
    points: HERO.startPoints,
    attrs: { kilic: 0, kalkan: 0, bereket: 0, akin: 0 },
    home: capital.id,
    away: null,
    woundedUntil: 0,
    equipment: { silah: null, zirh: null, at: null, nisan: null },
    inventory: [],
    nextItemId: 1,
  };
  return state.hero;
}

/** Eşyaların ve özelliklerin toplam etkisi; kahramanın kendi saldırı ve savunma gücü. */
export function heroEffects(hero) {
  const fx = { attack: 0, defense: 0, production: 0, carry: 0, travel: 0, xp: 0, heroAttack: 0, heroDefense: 0 };
  for (const item of Object.values(hero.equipment)) {
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) fx[key] = (fx[key] ?? 0) + value;
  }
  const { attributes } = HERO;
  fx.attack += hero.attrs.kilic * attributes.kilic.perPoint;
  fx.defense += hero.attrs.kalkan * attributes.kalkan.perPoint;
  fx.production += hero.attrs.bereket * attributes.bereket.perPoint;
  fx.carry += hero.attrs.akin * attributes.akin.perPoint;
  fx.power = HERO.attack.base + HERO.attack.perLevel * (hero.level - 1) + fx.heroAttack;
  fx.guard = HERO.defense.base + HERO.defense.perLevel * (hero.level - 1) + fx.heroDefense;
  return fx;
}

export function heroHealthy(hero, now) {
  return (hero.woundedUntil ?? 0) <= now;
}

/** Kahraman bu köyden orduya katılabilir mi? */
export function heroAvailable(state, village, now) {
  const hero = state.hero;
  if (!hero) return { ok: false, reason: 'Kahramanın yok' };
  if (hero.home !== village.id) return { ok: false, reason: 'Kahraman başka bir köyde' };
  if (hero.away) return { ok: false, reason: 'Kahraman seferde' };
  if (!heroHealthy(hero, now)) return { ok: false, reason: 'Kahraman yaralı, iyileşiyor' };
  return { ok: true };
}

/**
 * Köyündeki sağlıklı kahramanın köye kattığı etki ({ villageId, production, defense }), yoksa null.
 * Motor bunu köyün etkisine işler.
 */
export function heroHomeBonus(state) {
  const hero = state.hero;
  if (!hero || hero.away || !heroHealthy(hero, state.world.clock.at)) return null;
  const fx = heroEffects(hero);
  return { villageId: hero.home, production: 1 + fx.production, defense: 1 + fx.defense };
}

/** Köyde savunmaya katılan kahramanın gücü (yoksa 0). */
export function heroGuard(state, village, now) {
  const hero = state.hero;
  if (!hero || hero.home !== village.id || hero.away || !heroHealthy(hero, now)) return 0;
  return heroEffects(hero).guard;
}

/** Kahraman orduyla yola çıkar: hareket kahramanın o anki etkisini taşır. */
export function departHero(state, movement) {
  const hero = state.hero;
  const fx = heroEffects(hero);
  hero.away = movement.id;
  movement.hero = { name: hero.name, attack: fx.attack, carry: fx.carry, power: fx.power };
}

/** Ordunun yolculuk süresi çarpanı (kahramanın atı). */
export function heroTravelFactor(state) {
  return state.hero ? Math.max(0.5, 1 - heroEffects(state.hero).travel) : 1;
}

export function returnHero(state) {
  if (state.hero) state.hero.away = null;
}

/** Yenilen ordudaki ya da düşen köydeki kahraman yaralanıp köyüne döner. */
export function woundHero(state, at) {
  const hero = state.hero;
  if (!hero) return null;
  hero.away = null;
  hero.woundedUntil = at + (HERO.healHours * HOUR) / state.world.speed;
  return { type: 'hero-wounded', name: hero.name, until: hero.woundedUntil, at };
}

export function healHero(state, at) {
  const hero = state.hero;
  hero.woundedUntil = 0;
  return { type: 'hero-healed', name: hero.name, at };
}

/** Tecrübe ekler; seviye atlarsa olaylarını döndürür. `factor`: araştırmalardan gelen çarpan. */
export function addHeroXp(state, amount, at, factor = 1) {
  const hero = state.hero;
  if (!hero || amount <= 0) return [];
  const bonus = 1 + heroEffects(hero).xp;
  hero.xp += Math.round(amount * bonus * factor);
  const events = [];
  while (hero.level < HERO.maxLevel && hero.xp >= xpForLevel(hero.level)) {
    hero.xp -= xpForLevel(hero.level);
    hero.level += 1;
    hero.points += HERO.pointsPerLevel;
    events.push({ type: 'hero-level', name: hero.name, level: hero.level, at });
  }
  if (hero.level >= HERO.maxLevel) hero.xp = Math.min(hero.xp, xpForLevel(hero.level));
  return events;
}

/**
 * Savaştan sonra orduyla giden kahraman: yenilgide yaralanır (köyüne döner), zaferde tecrübe
 * kazanır. Dönen: ek olaylar (seviye atlama, yaralanma).
 */
export function heroAfterBattle(state, village, movement, won, winXp, killPoints) {
  if (!movement.hero || !state.hero) return [];
  if (!won) return [woundHero(state, movement.arriveAt)];
  return addHeroXp(state, winXp + killPoints * HERO.xp.perKillPoint, movement.arriveAt, bonusOf(village).heroXp);
}

export function spendPoint(state, attr) {
  const hero = state.hero;
  if (!hero || !HERO.attributes[attr]) return { ok: false, reason: 'Geçerli bir özellik seç' };
  if (hero.points <= 0) return { ok: false, reason: 'Dağıtılacak puan yok' };
  if (hero.attrs[attr] >= HERO.maxAttribute) return { ok: false, reason: 'Bu özellik en yüksek seviyede' };
  hero.points -= 1;
  hero.attrs[attr] += 1;
  return { ok: true, attr, value: hero.attrs[attr] };
}

export function renameHero(state, name) {
  const clean = String(name ?? '').trim().slice(0, 24);
  if (!clean || !state.hero) return false;
  state.hero.name = clean;
  return true;
}

// ---------- Eşyalar ----------

/**
 * Rastgele eşya. `quality`: nadirlik ağırlıklarını iyiye kaydırır (1 olağan, 2 harabe,
 * 3 ordugâh); `minRarity` en düşük nadirlik.
 */
export function rollItem(rng, { quality = 1, minRarity = 'siradan' } = {}) {
  const minIndex = RARITY_IDS.indexOf(minRarity);
  const options = RARITY_IDS.slice(minIndex);
  const weights = options.map((id) => RARITIES[id].weight * (RARITIES[id].scale ? quality ** RARITIES[id].scale : 1));
  let pick = rng() * weights.reduce((a, b) => a + b, 0);
  const rarity = options.find((_, i) => (pick -= weights[i]) < 0) ?? options[options.length - 1];
  const tier = RARITY_IDS.indexOf(rarity);
  const slot = SLOT_IDS[Math.floor(rng() * SLOT_IDS.length)];
  const def = ITEM_SLOTS[slot];
  const names = def.names[tier];
  const variant = def.effects[Math.floor(rng() * def.effects.length)];
  const effects = Object.fromEntries(Object.entries(variant).map(([key, values]) => [key, values[tier]]));
  return { slot, rarity, name: names[Math.floor(rng() * names.length)], effects };
}

/** Eşyayı heybeye koyar; heybe doluysa satılır (Akçe değeri döner). */
export function giveItem(state, item) {
  const hero = ensureHero(state);
  if (hero.inventory.length >= HERO.inventoryMax) return { stored: false, item, akce: RARITIES[item.rarity].akce };
  const stored = { id: hero.nextItemId++, ...item };
  hero.inventory.push(stored);
  return { stored: true, item: stored, akce: 0 };
}

export function equipItem(state, itemId) {
  const hero = state.hero;
  const index = hero?.inventory.findIndex((item) => item.id === itemId) ?? -1;
  if (index < 0) return { ok: false, reason: 'Bu eşya heybede yok' };
  if (hero.away) return { ok: false, reason: 'Kahraman seferdeyken eşya değiştirilemez' };
  const [item] = hero.inventory.splice(index, 1);
  const previous = hero.equipment[item.slot];
  hero.equipment[item.slot] = item;
  if (previous) hero.inventory.push(previous);
  return { ok: true, item, previous };
}

export function unequipItem(state, slot) {
  const hero = state.hero;
  const item = hero?.equipment[slot];
  if (!item) return { ok: false, reason: 'Bu yuvada eşya yok' };
  if (hero.away) return { ok: false, reason: 'Kahraman seferdeyken eşya değiştirilemez' };
  if (hero.inventory.length >= HERO.inventoryMax) return { ok: false, reason: 'Heybe dolu' };
  hero.equipment[slot] = null;
  hero.inventory.push(item);
  return { ok: true, item };
}

/** Heybedeki eşyayı satar; Akçe değeri döner (Akçeyi çağıran verir). */
export function sellItem(state, itemId) {
  const hero = state.hero;
  const index = hero?.inventory.findIndex((item) => item.id === itemId) ?? -1;
  if (index < 0) return { ok: false, reason: 'Bu eşya heybede yok' };
  const [item] = hero.inventory.splice(index, 1);
  return { ok: true, item, akce: RARITIES[item.rarity].akce };
}
