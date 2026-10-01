// Şan ve unvanlar. Şan, beyliğin başarılarından hesaplanır (bkz. systems/renown.js); belli
// eşikleri aşınca unvan yükselir ve unvanın ayrıcalıkları bütün köylere işler. Unvan bir kez
// kazanılınca düşmez. Sultanlık ayrıca oyunun sonudur (bütün beyleri fethetmek).

export const TITLES = Object.freeze([
  { id: 'bey', name: 'Bey', renown: 0, perks: [], bonus: {} },
  { id: 'sancakbeyi', name: 'Sancakbeyi', renown: 250, perks: ['Kaynak üretimi +%3'], bonus: { production: 1.03 } },
  { id: 'beylerbeyi', name: 'Beylerbeyi', renown: 800, perks: ['Kaynak üretimi +%5', 'İnşaat kuyruğu +1'], bonus: { production: 1.05, buildQueue: 1 } },
  {
    id: 'pasa',
    name: 'Paşa',
    renown: 2000,
    perks: ['Kaynak üretimi +%6', 'İnşaat kuyruğu +1', 'Saldırı ve savunma +%5'],
    bonus: { production: 1.06, buildQueue: 1, attack: 1.05, defense: 1.05 },
  },
  {
    id: 'hunkar',
    name: 'Hünkâr',
    renown: 4500,
    perks: ['Kaynak üretimi +%10', 'İnşaat kuyruğu +1', 'Eğitim kuyrukları +2', 'Saldırı ve savunma +%8', 'Keşif hakkı +1'],
    bonus: { production: 1.1, buildQueue: 1, trainQueue: 2, attack: 1.08, defense: 1.08, expeditionSlots: 1 },
  },
]);

// Şanın kaynakları (her biri kaç şan getirir)
export const RENOWN = Object.freeze({
  killsPer: 10, // her 10 savaş puanı 1 şan
  attackWin: 2,
  defense: 8,
  village: 60, // başkent dışındaki her köy
  lord: 150, // fethedilen her bey hisarı
  quest: 8,
  achievementTier: 15,
  ilim: 10,
  event: 2,
  ruin: 15,
  invasion: 120, // dağıtılan Moğol ordugâhı
  invasionWave: 10, // püskürtülen akın dalgası
  heroLevel: 10,
  treaty: 5,
});
