import { GAME, START } from '../config/game.js';
import { BUILDING_IDS } from '../config/buildings.js';
import { UNIT_IDS, TRAINING_BUILDINGS } from '../config/units.js';
import { PREMIUM } from '../config/classes.js';

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

export function createNewGame({ now, speed = GAME.defaultSpeed, seed = randomSeed(), difficulty = GAME.defaultDifficulty }) {
  return {
    version: GAME.saveVersion,
    createdAt: now,
    // clock: dünya saati (oyun zamanı, ms); dünya hızıyla işler. Barbar köylerinin büyümesi buna bağlıdır.
    world: { speed, seed, clock: { time: 0, at: now } },
    player: newPlayer(),
    activeVillageId: 'v1',
    villages: {
      v1: createVillage({ id: 'v1', name: START.villageName, x: 500, y: 500, now }),
    },
    barbarians: {}, // yalnızca saldırıya uğramış barbar köylerinin ve bey hisarlarının son durumu
    reports: [], // en yeni başta
    nextId: 1, // hareket ve rapor numaraları için sayaç
    ai: { difficulty, lords: {} }, // rakip beylerin saldırı takvimi (motor ilk ilerlemede kurar)
    stats: { kills: 0, loot: 0 }, // oyuncunun savaş puanı ve toplam ganimeti (sıralama)
    news: [], // dünya olayları, en yeni başta
  };
}

/** Oyuncu: sınıf oyun başında seçilir (null iken arayüz seçim penceresini açar). */
function newPlayer(name = 'Bey') {
  return { name, class: null, akce: PREMIUM.startAkce, officers: {}, akceLog: [] };
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
  village.movements ??= [];
  village.tech ??= {}; // Demirci geliştirme seviyeleri (birim → 0..3)
  for (const id of UNIT_IDS) village.tech[id] ??= 0;
  village.research ??= null; // süren geliştirme
  village.merchants ??= []; // yoldaki tüccarlar
  village.incoming ??= []; // köye gelen bey saldırıları
  village.stationed ??= {}; // başka köylerde destek olarak duran askerler (köy id → birlikler)
  return village;
}

// Kayıt şeması değiştiğinde buraya "sürüm N → N+1" dönüştürücüsü eklenir.
// Yalnızca yeni alan eklenen değişikliklerde normalizeVillage yeterlidir; dönüştürücü
// alanları yeniden adlandırmak ya da veriyi dönüştürmek gerektiğinde işe yarar.
const MIGRATIONS = {
  // Adım 3: köylere asker sayıları (units) ve eğitim kuyrukları (trainQueues) eklendi.
  1: (data) => ({ ...data, version: 2 }),
  // Adım 4: dünya saati eklendi. Kuruluştan bu yana geçen süre ilk ilerlemede eklenir.
  2: (data) => ({ ...data, world: { ...data.world, clock: { time: 0, at: data.createdAt } }, version: 3 }),
  // Adım 5: ordu hareketleri, raporlar ve barbar köylerinin değişen durumu eklendi.
  3: (data) => ({ ...data, barbarians: {}, reports: [], nextId: 1, version: 4 }),
  // Adım 6b: Demirci geliştirmeleri ve pazar tüccarları (alanları normalizeVillage doldurur).
  4: (data) => ({ ...data, version: 5 }),
  // Adım 7: rakip beyler. Mevcut kayıtlarda ilk saldırı en az 12 oyun saati sonra gelir.
  5: (data) => ({ ...data, ai: { difficulty: 'normal', lords: {} }, version: 6 }),
  // Adım 7b: sıralama istatistikleri ve dünya olayları; beylerin hareket takvimi motorca kurulur.
  6: (data) => ({ ...data, stats: { kills: 0, loot: 0 }, news: [], version: 7 }),
  // Adım 9: sınıf ve Akçe. Mevcut oyuncular da sınıflarını seçer ve başlangıç Akçesini alır.
  7: (data) => ({ ...data, player: newPlayer(data.player?.name), version: 8 }),
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
  data.player ??= newPlayer();
  data.player.officers ??= {};
  data.player.akceLog ??= [];
  data.player.akce ??= 0;
  return data;
}
