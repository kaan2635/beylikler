// Savaş ve barbar köyü ayarları.
export const COMBAT = Object.freeze({
  lossExponent: 1.5, // kazananın kayıp oranı = (kaybeden güç / kazanan güç) ^ lossExponent
  luckRange: 0.25, // şans saldırı gücünü en fazla ±%25 değiştirir
  villageDefense: 20, // köylülerin direnişi: hiç asker yokken bile köy biraz savunur
  wallDefensePerLevel: 30, // sur seviyesi başına sabit savunma (yüzde bonusun yanında)
  maxReports: 50, // saklanan en fazla rapor; eskiler silinir
});

// Barbar köylerinin savunması ve ekonomisi.
export const BARBARIAN = Object.freeze({
  garrisonPerGrowth: { yaya: 1.5, kilicci: 0.5, okcu: 0.4 }, // gelişmişlik başına asker
  troopRegenPerDay: 0.25, // öldürülen garnizon her oyun günü %25 toparlanır
  startResources: 300, // dünya kurulduğunda ambardaki kaynak
});
