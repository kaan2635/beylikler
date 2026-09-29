import { GAME, START } from '../config/game.js';
import { BUILDING_IDS } from '../config/buildings.js';

export function createVillage({ id, name, x, y, now }) {
  const buildings = {};
  for (const buildingId of BUILDING_IDS) buildings[buildingId] = START.buildings[buildingId] ?? 0;
  return {
    id,
    name,
    x,
    y,
    resources: { ...START.resources },
    buildings,
    buildQueue: [],
    lastUpdate: now,
  };
}

export function createNewGame({ now, speed = GAME.defaultSpeed, seed = randomSeed() }) {
  return {
    version: GAME.saveVersion,
    createdAt: now,
    world: { speed, seed },
    player: { name: 'Bey' },
    activeVillageId: 'v1',
    villages: {
      v1: createVillage({ id: 'v1', name: START.villageName, x: 500, y: 500, now }),
    },
  };
}

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}

// Kayıt şeması değiştiğinde buraya "sürüm N → N+1" dönüştürücüsü eklenir, ör.:
//   1: (data) => { data.villages.v1.units = {}; data.version = 2; return data; },
const MIGRATIONS = {};

/** Kayıttan okunan veriyi doğrular ve güncel şemaya taşır. Geçersizse hata fırlatır. */
export function migrate(data) {
  if (!data || typeof data !== 'object' || !Number.isInteger(data.version)) {
    throw new Error('Geçersiz kayıt verisi');
  }
  if (data.version > GAME.saveVersion) {
    throw new Error('Bu kayıt oyunun daha yeni bir sürümüne ait');
  }
  while (data.version < GAME.saveVersion) {
    const step = MIGRATIONS[data.version];
    if (!step) throw new Error(`Kayıt sürümü ${data.version} taşınamıyor`);
    data = step(data);
  }
  if (!data.villages || !data.villages[data.activeVillageId]) {
    throw new Error('Kayıtta köy bulunamadı');
  }
  // Sonradan eklenen binalar eski kayıtlarda 0. seviyeden başlar.
  for (const village of Object.values(data.villages)) {
    village.buildQueue ??= [];
    for (const buildingId of BUILDING_IDS) village.buildings[buildingId] ??= 0;
  }
  return data;
}
