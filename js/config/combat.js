// Savaş ve barbar köyü ayarları.
export const COMBAT = Object.freeze({
  lossExponent: 1.5, // kazananın kayıp oranı = (kaybeden güç / kazanan güç) ^ lossExponent
  luckRange: 0.25, // şans saldırı gücünü en fazla ±%25 değiştirir
  villageDefense: 20, // köylülerin direnişi: hiç asker yokken bile köy biraz savunur
  wallDefensePerLevel: 30, // sur seviyesi başına sabit savunma (yüzde bonusun yanında)
  maxReports: 50, // saklanan en fazla rapor; eskiler silinir
  // Kuşatma: bir binayı L seviyesinden L−1'e indirmek (L × perLevel) araç ister.
  // Ör. 10. seviye ambarı bir seviye düşürmek 10 mancınık, 3. seviye suru tamamen yıkmak 3+2+1 = 6 koçbaşı.
  ramsPerLevel: 1, // koçbaşı → sur
  catapultsPerLevel: 1, // mancınık → seçilen bina
});

// Mancınıkla hedeflenebilecek binalar (sur koçbaşının işidir).
export const CATAPULT_TARGETS = Object.freeze(['konak', 'ambar', 'gizlidepo', 'oduncu', 'kilocagi', 'demirmadeni', 'ciftlik']);

// Yıkımla inilebilecek en düşük seviye; listede olmayanlar 0'a kadar yıkılabilir.
export const MIN_BUILDING_LEVEL = Object.freeze({ konak: 1, ambar: 1, ciftlik: 1 });

// Barbar köylerinin savunması ve ekonomisi.
export const BARBARIAN = Object.freeze({
  garrisonPerGrowth: { yaya: 1.5, kilicci: 0.5, okcu: 0.4, gozcu: 0.25 }, // gelişmişlik başına asker
  troopRegenPerDay: 0.25, // öldürülen garnizon her oyun günü %25 toparlanır
  startResources: 300, // dünya kurulduğunda ambardaki kaynak
  rebuildPerDay: 1, // yıkılan binalar her oyun günü bir seviye onarılır
});
