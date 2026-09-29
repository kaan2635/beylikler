import { WORLD, VILLAGE_NAME_PARTS } from '../config/world.js';
import { BUILDINGS } from '../config/buildings.js';
import { buildingPoints } from '../core/formulas.js';
import { hash3, mulberry32, valueNoise } from '../core/random.js';
import { MIN_BUILDING_LEVEL } from '../config/combat.js';
import { LORD, LORD_NAMES, PERSONALITIES } from '../config/lords.js';
import { START_VILLAGE_ID } from '../config/game.js';
import { remainingDamage } from './barbarians.js';

/**
 * Dünya haritası. Harita kayda yazılmaz: her alanın arazisi ve barbar köyü, dünya tohumundan
 * (world.seed) ve koordinattan her seferinde aynen yeniden üretilir. Kayıtta yalnızca oyuncunun
 * köyleri ve ileride barbar köylerinde değişenler (yağma, kayıplar) tutulur.
 */

// Aynı tohumdan birbirinden bağımsız sayı dizileri almak için her kullanıma ayrı bir tuz.
const SALT = { terrain: 0x51ed270b, forest: 0x2c1b3c6d, village: 0x7a3d9f11, detail: 0x1b873593, lords: 0x68e31da4 };
const DAY = 86_400_000;

export function inWorld(x, y) {
  return x >= 0 && y >= 0 && x < WORLD.size && y < WORLD.size;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Koordinatın bulunduğu 100×100'lük kıta: (512|487) → K45. */
export function continentOf(x, y) {
  return `K${Math.floor(y / 100)}${Math.floor(x / 100)}`;
}

/** Alanın arazi türü: 'gol' | 'tepe' | 'orman' | 'cayir'. */
export function terrainAt(seed, x, y) {
  const height = valueNoise(seed ^ SALT.terrain, x, y, 9);
  if (height < 0.24) return 'gol';
  if (height > 0.75) return 'tepe';
  return valueNoise(seed ^ SALT.forest, x, y, 5) > 0.6 ? 'orman' : 'cayir';
}

/** Çizimde süs (ağaç yerleri, çimen tonu) için alana özgü sabit bir sayı. */
export function tileDetail(seed, x, y) {
  return hash3(seed ^ SALT.detail, x, y);
}

/** Binaların toplam puanı. */
export function villagePoints(buildings) {
  let points = 0;
  for (const [id, level] of Object.entries(buildings)) if (BUILDINGS[id]) points += buildingPoints(BUILDINGS[id], level);
  return points;
}

/** Dünya kurulduğundan beri geçen oyun günü (dünya hızıyla ölçeklenmiş). */
export function worldDays(world) {
  return world.clock.time / DAY;
}

/**
 * Dünya saatini `now` anına ilerletir. Saat dünya hızıyla işler; hız sonradan değişse de
 * geçmişte biriken süre değişmez.
 */
export function advanceClock(world, now) {
  const { clock } = world;
  if (now <= clock.at) return;
  clock.time += (now - clock.at) * world.speed;
  clock.at = now;
}

/** Merkezden uzaklaştıkça köy olasılığı azalır; yerleşim sınırının ötesinde köy yoktur. */
function barbarianChance(x, y) {
  const d = distance(x, y, WORLD.center, WORLD.center);
  if (d > WORLD.settledRadius) return 0;
  const { inner, outer } = WORLD.barbarianChance;
  return inner + (outer - inner) * (d / WORLD.settledRadius);
}

function ownVillageAt(state, x, y) {
  for (const village of Object.values(state.villages)) {
    if (village.x === x && village.y === y) return village;
  }
  return null;
}

/**
 * Başlangıç köyünün hemen çevresi boş kalır; barbar köyü kapıya dayanmasın. Yalnızca başlangıç
 * köyü için geçerlidir: fethedilen bir köyün komşusu olan barbar köyleri yerinde kalmalı.
 */
function nearStartVillage(state, x, y) {
  const start = state.villages[START_VILLAGE_ID];
  return !!start && distance(x, y, start.x, start.y) < WORLD.ownVillageClearance;
}

/**
 * (x, y) alanındaki barbar köyü; yoksa null.
 * Gelişmişlik dünya saatiyle artar: köyler zamanla büyür, merkezden uzaktakiler daha güçlü başlar.
 */
export function barbarianAt(state, x, y) {
  if (!inWorld(x, y)) return null;
  const { seed } = state.world;
  const rng = mulberry32(hash3(seed ^ SALT.village, x, y));
  if (rng() >= barbarianChance(x, y)) return null;
  if (terrainAt(seed, x, y) === 'gol' || lordTiles(seed).has(`${x}|${y}`)) return null;
  if (nearStartVillage(state, x, y) || ownVillageAt(state, x, y)) return null; // fethedilen alan artık oyuncunun

  const { first, second } = VILLAGE_NAME_PARTS;
  const head = first[Math.floor(rng() * first.length)];
  let tail = second[Math.floor(rng() * second.length)];
  if (tail === head.toLocaleLowerCase('tr')) tail = 'köy';

  const fromCenter = distance(x, y, WORLD.center, WORLD.center);
  const start = 1 + rng() * 3 + fromCenter / 20;
  const perDay = 0.15 + rng() * 0.45;
  const growth = Math.min(WORLD.barbarianMaxGrowth, start + perDay * worldDays(state.world));
  const id = `b${x}_${y}`;
  const buildings = applyDamage(state, id, barbarianBuildings(growth));

  return {
    id,
    kind: 'barbar',
    name: head + tail,
    x,
    y,
    growth,
    buildings,
    points: villagePoints(buildings),
  };
}

/** Koçbaşı ve mancınıkla yıkılan, henüz onarılmamış seviyeleri düşer. */
function applyDamage(state, id, buildings) {
  const damage = state.barbarians?.[id]?.damage;
  if (damage) {
    for (const [building, entry] of Object.entries(damage)) {
      const min = MIN_BUILDING_LEVEL[building] ?? 0;
      buildings[building] = Math.max(min, buildings[building] - remainingDamage(entry, state.world.clock.time));
    }
  }
  return buildings;
}

/** Gelişmişlik değerinden barbar (ve bey) köyünün bina seviyeleri. */
function barbarianBuildings(growth) {
  const level = Math.floor(growth);
  const half = Math.max(1, Math.floor(growth / 2));
  return {
    konak: half,
    oduncu: level,
    kilocagi: level,
    demirmadeni: Math.max(1, level - 1),
    ambar: level,
    ciftlik: half,
    gizlidepo: Math.min(10, Math.floor(growth / 3)),
    sur: Math.min(20, Math.floor(growth / 3)),
  };
}

// ---------- Rakip beyler ----------

const lordCache = new Map(); // tohum → { lords, tiles }

/**
 * (bx, by)'ye en yakın uygun alan: göl değil, alınmamış. Bulunana kadar kare halkalar hâlinde
 * dışa doğru genişler; her halkada en yakın alan seçilir.
 */
function nearestLand(seed, bx, by, taken) {
  for (let r = 0; r <= 50; r++) {
    let best = null;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // yalnızca halkanın kenarı
        const x = bx + dx;
        const y = by + dy;
        if (terrainAt(seed, x, y) === 'gol' || taken.has(`${x}|${y}`)) continue;
        if (!best || Math.hypot(dx, dy) < Math.hypot(best.x - bx, best.y - by)) best = { x, y };
      }
    }
    if (best) return best;
  }
  return { x: bx, y: by };
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function lordData(seed) {
  let data = lordCache.get(seed);
  if (data) return data;
  const rng = mulberry32(hash3(seed ^ SALT.lords, 0, 0));
  const names = shuffle([...LORD_NAMES], rng).slice(0, LORD.count);
  const kinds = Object.keys(PERSONALITIES);
  const personalities = shuffle(names.map((_, i) => kinds[i % kinds.length]), rng);
  const tiles = new Set();
  const lords = names.map((name, index) => {
    const angle = ((index + rng() * 0.6) / LORD.count) * Math.PI * 2;
    const dist = LORD.ringMin + rng() * (LORD.ringMax - LORD.ringMin);
    const { x, y } = nearestLand(
      seed,
      Math.round(WORLD.center + Math.cos(angle) * dist),
      Math.round(WORLD.center + Math.sin(angle) * dist),
      tiles,
    );
    tiles.add(`${x}|${y}`);
    const [low, high] = LORD.startPower;
    return { id: `bey${index}`, index, name, personality: personalities[index], x, y, startPower: low + rng() * (high - low) };
  });
  data = { lords, tiles };
  lordCache.set(seed, data);
  return data;
}

/**
 * Dünyadaki rakip beyler. Yerleri, adları ve kişilikleri yalnızca tohumdan belirlenir:
 * merkez çevresindeki bir halkaya eşit aralıklarla dağılırlar, göle düşmezler.
 */
export function lordsOf(seed) {
  return lordData(seed).lords;
}

function lordTiles(seed) {
  return lordData(seed).tiles;
}

/**
 * Beyin gücü: gelişmişlik gibi işler, kişiliğine göre günden güne artar. `bonus` savaşlarla
 * kazanılan ya da kaybedilen paydır (state.ai.lords[id].bonus).
 */
export function lordPower(lord, world, bonus = 0) {
  const base = Math.min(LORD.maxPower, lord.startPower + PERSONALITIES[lord.personality].growthPerDay * worldDays(world));
  return Math.max(1, base + bonus);
}

/** Beyin kayıttaki savaş payıyla birlikte gücü. */
export function lordPowerIn(state, lord) {
  return lordPower(lord, state.world, state.ai?.lords?.[lord.id]?.bonus ?? 0);
}

/** Beyin hisarı, barbar köyleriyle aynı biçimde (saldırılabilir, gözetlenebilir). */
export function lordVillage(state, lord) {
  const growth = lordPowerIn(state, lord);
  const buildings = applyDamage(state, lord.id, barbarianBuildings(growth));
  return {
    id: lord.id,
    kind: 'bey',
    name: `${lord.name} Hisarı`,
    owner: `${lord.name} Bey`,
    personality: lord.personality,
    garrisonFactor: PERSONALITIES[lord.personality].garrisonFactor,
    x: lord.x,
    y: lord.y,
    growth,
    buildings,
    points: villagePoints(buildings),
  };
}

/** Hisarı fethedilmiş bey artık oyunda değildir. */
export function lordDefeated(state, lordId) {
  return !!state.ai?.lords?.[lordId]?.defeated;
}

export function lordAt(state, x, y) {
  if (!lordTiles(state.world.seed).has(`${x}|${y}`)) return null;
  const lord = lordsOf(state.world.seed).find((l) => l.x === x && l.y === y);
  if (lordDefeated(state, lord.id) || ownVillageAt(state, x, y)) return null;
  return lordVillage(state, lord);
}

/** Oyuncuya ait olmayan köy (bey hisarı ya da barbar köyü); yoksa null. */
export function npcAt(state, x, y) {
  return lordAt(state, x, y) ?? barbarianAt(state, x, y);
}

/** Alandaki köy (oyuncunun, beyin ya da barbar); yoksa null. Oyuncu köyleri de aynı biçimde döner. */
export function villageAt(state, x, y) {
  const own = ownVillageAt(state, x, y);
  if (own) {
    return { id: own.id, kind: 'oyuncu', name: own.name, x, y, buildings: own.buildings, points: villagePoints(own.buildings) };
  }
  return npcAt(state, x, y);
}

/** (x, y) çevresinde `radius` alan içindeki barbar köyleri, yakından uzağa. */
export function nearbyBarbarians(state, x, y, radius) {
  const list = [];
  for (let ty = y - radius; ty <= y + radius; ty++) {
    for (let tx = x - radius; tx <= x + radius; tx++) {
      const d = distance(x, y, tx, ty);
      if (d > radius) continue;
      const village = barbarianAt(state, tx, ty);
      if (village) list.push({ ...village, distance: d });
    }
  }
  return list.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
}
