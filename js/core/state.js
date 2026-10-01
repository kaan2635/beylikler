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

/**
 * Yeni oyun. Çok oyunculu dünyada sunucu her oyuncu için `idPrefix` (köy numaraları dünyada
 * benzersiz olsun), başlangıç yeri ve paylaşılan dünya nesnelerini verir.
 */
export function createNewGame({
  now,
  speed = GAME.defaultSpeed,
  seed = randomSeed(),
  difficulty = GAME.defaultDifficulty,
  idPrefix = 'v',
  x = 500,
  y = 500,
  playerName,
}) {
  const startId = `${idPrefix}1`;
  const start = createVillage({ id: startId, name: START.villageName, x, y, now });
  start.capital = true; // başkent: fethedilemez
  return {
    version: GAME.saveVersion,
    createdAt: now,
    idPrefix,
    // clock: dünya saati (oyun zamanı, ms); dünya hızıyla işler. Barbar köylerinin büyümesi buna bağlıdır.
    world: { speed, seed, clock: { time: 0, at: now } },
    player: newPlayer(playerName),
    activeVillageId: startId,
    villages: { [startId]: start },
    barbarians: {}, // yalnızca saldırıya uğramış barbar köylerinin ve bey hisarlarının son durumu
    reports: [], // en yeni başta
    nextId: 2, // hareket, rapor ve yeni köy numaraları için sayaç (1 başkentin)
    ai: { difficulty, lords: {} }, // rakip beylerin saldırı takvimi (motor ilk ilerlemede kurar)
    stats: newStats(), // savaş puanı, ganimet ve görev/başarım sayaçları
    news: [], // dünya olayları, en yeni başta
    quests: { claimed: [] }, // ödülü alınan görevler
    achievements: {}, // başarım → ulaşılan kademe
    victory: null, // Sultanlık ilan edildiyse { at }
    diplomacy: {}, // beylerle ilişkiler (bkz. systems/diplomacy.js)
    // events: olaylar ve kararlar; motor ilk ilerlemede kurar (bkz. systems/events.js)
  };
}

/** Oyuncu: sınıf oyun başında seçilir (null iken arayüz seçim penceresini açar). */
function newPlayer(name = 'Bey') {
  return { name, class: null, akce: PREMIUM.startAkce, officers: {}, akceLog: [], ilim: { done: [], current: null }, modifiers: [] };
}

function newStats() {
  return { kills: 0, loot: 0, attacks: 0, attacksWon: 0, spies: 0, expeditions: 0, defenses: 0, events: 0, gifts: 0, treaties: 0 };
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
  // Adım 12: görevler, başarımlar ve Sultanlık. Sayaçlar sıfırdan başlar; ödülü alınmamış
  // görevler, şartları zaten sağlanıyorsa hemen tamamlanmış görünür.
  8: (data) => ({ ...data, stats: { ...newStats(), ...data.stats }, quests: { claimed: [] }, achievements: {}, victory: null, version: 9 }),
  // 1.4 denge: beyler daha seyrek saldırır. Eski takvimler silinir; motor yenisini kurar
  // (ilk saldırı en az 12 oyun saati sonra). Yoldaki saldırılar olduğu gibi kalır.
  9: (data) => {
    const lords = {};
    for (const [id, entry] of Object.entries(data.ai?.lords ?? {})) {
      const { nextAttackAt, ...rest } = entry;
      lords[id] = entry.defeated ? entry : rest;
    }
    return { ...data, ai: { ...data.ai, lords }, version: 10 };
  },
  // 1.5 içerik: Divan araştırmaları, olaylardan geçici etkiler ve beylerle diplomasi.
  // Mevsim sayacı ve olay takvimi motorca kurulur.
  10: (data) => ({
    ...data,
    player: { ...data.player, ilim: data.player?.ilim ?? { done: [], current: null }, modifiers: data.player?.modifiers ?? [] },
    diplomacy: data.diplomacy ?? {},
    version: 11,
  }),
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
  data.player.ilim ??= { done: [], current: null };
  data.player.modifiers ??= [];
  data.diplomacy ??= {};
  data.stats = { ...newStats(), ...data.stats };
  data.quests ??= { claimed: [] };
  data.achievements ??= {};
  data.victory ??= null;
  return data;
}
