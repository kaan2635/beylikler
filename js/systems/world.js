import { WORLD, VILLAGE_NAME_PARTS } from '../config/world.js';
import { BUILDINGS } from '../config/buildings.js';
import { buildingPoints } from '../core/formulas.js';
import { hash3, mulberry32, valueNoise } from '../core/random.js';

/**
 * Dünya haritası. Harita kayda yazılmaz: her alanın arazisi ve barbar köyü, dünya tohumundan
 * (world.seed) ve koordinattan her seferinde aynen yeniden üretilir. Kayıtta yalnızca oyuncunun
 * köyleri ve ileride barbar köylerinde değişenler (yağma, kayıplar) tutulur.
 */

// Aynı tohumdan birbirinden bağımsız sayı dizileri almak için her kullanıma ayrı bir tuz.
const SALT = { terrain: 0x51ed270b, forest: 0x2c1b3c6d, village: 0x7a3d9f11, detail: 0x1b873593 };
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
  for (const [id, level] of Object.entries(buildings)) points += buildingPoints(BUILDINGS[id], level);
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

/** Oyuncu köylerinin hemen çevresi boş kalır; barbar köyü kapıya dayanmasın. */
function nearOwnVillage(state, x, y) {
  return Object.values(state.villages).some((village) => distance(x, y, village.x, village.y) < WORLD.ownVillageClearance);
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
  if (terrainAt(seed, x, y) === 'gol' || nearOwnVillage(state, x, y)) return null;

  const { first, second } = VILLAGE_NAME_PARTS;
  const head = first[Math.floor(rng() * first.length)];
  let tail = second[Math.floor(rng() * second.length)];
  if (tail === head.toLocaleLowerCase('tr')) tail = 'köy';

  const fromCenter = distance(x, y, WORLD.center, WORLD.center);
  const start = 1 + rng() * 3 + fromCenter / 20;
  const perDay = 0.15 + rng() * 0.45;
  const growth = Math.min(WORLD.barbarianMaxGrowth, start + perDay * worldDays(state.world));
  const buildings = barbarianBuildings(growth);

  return {
    id: `b${x}_${y}`,
    kind: 'barbar',
    name: head + tail,
    x,
    y,
    growth,
    buildings,
    points: villagePoints(buildings),
  };
}

/** Gelişmişlik değerinden barbar köyünün bina seviyeleri. */
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

/** Alandaki köy (oyuncunun ya da barbar); yoksa null. Oyuncu köyleri de aynı biçimde döner. */
export function villageAt(state, x, y) {
  const own = ownVillageAt(state, x, y);
  if (own) {
    return { id: own.id, kind: 'oyuncu', name: own.name, x, y, buildings: own.buildings, points: villagePoints(own.buildings) };
  }
  return barbarianAt(state, x, y);
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
