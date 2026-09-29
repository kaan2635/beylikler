import { GAME, START } from '../config/game.js';
import { BUILDING_IDS } from '../config/buildings.js';
import { UNIT_IDS, TRAINING_BUILDINGS } from '../config/units.js';

export function createVillage({ id, name, x, y, now }) {
  return normalizeVillage({
    id,
    name,
    x,
    y,
    resources: { ...START.resources },
    buildings: { ...START.buildings },
    lastUpdate: now,
  });
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

/**
 * Eksik alanları varsayılanlarla doldurur. Sonradan eklenen binalar, birimler ve kuyruklar
 * eski kayıtlarda böylece 0 / boş olarak başlar.
 */
function normalizeVillage(village) {
  village.buildings ??= {};
  for (const id of BUILDING_IDS) village.buildings[id] ??= 0;
  village.buildQueue ??= [];
  village.units ??= {};
  for (const id of UNIT_IDS) village.units[id] ??= 0;
  village.trainQueues ??= {};
  for (const id of TRAINING_BUILDINGS) village.trainQueues[id] ??= [];
  return village;
}

// Kayıt şeması değiştiğinde buraya "sürüm N → N+1" dönüştürücüsü eklenir.
// Yalnızca yeni alan eklenen değişikliklerde normalizeVillage yeterlidir; dönüştürücü
// alanları yeniden adlandırmak ya da veriyi dönüştürmek gerektiğinde işe yarar.
const MIGRATIONS = {
  // Adım 3: köylere asker sayıları (units) ve eğitim kuyrukları (trainQueues) eklendi.
  1: (data) => ({ ...data, version: 2 }),
};

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
  for (const village of Object.values(data.villages)) normalizeVillage(village);
  return data;
}
