// Kahraman (beyin alpı) ve eşyalar.
//
// Kahramanın seviyesi savaş, görev ve harabelerden gelen tecrübeyle (TP) artar; her seviyede
// özellik puanı kazanır. Köyündeyken üretime ve savunmaya, orduyla birlikteyken saldırıya,
// ganimete ve yolculuğa güç katar. Yenilen ordudaki ya da düşen köydeki kahraman yaralanır,
// bir süre iyileşir. Süreler oyun saatidir.

export const HERO = Object.freeze({
  maxLevel: 30,
  startPoints: 3,
  pointsPerLevel: 3,
  maxAttribute: 40,
  healHours: 20, // yaralı kahramanın iyileşme süresi
  inventoryMax: 16,
  // Kahramanın kendi savaş gücü (atlı sayılır) ve savunması
  attack: { base: 100, perLevel: 30 },
  defense: { base: 80, perLevel: 25 },
  // Tecrübe kaynakları
  xp: { winBase: 15, lordWin: 40, perKillPoint: 1, quest: 25, ruin: 60, camp: 150, defensePerKillPoint: 0.5 },
  attributes: Object.freeze({
    kilic: { name: 'Kılıç', icon: 'saldiri', perPoint: 0.01, effect: 'Yönettiği ordunun saldırısı', unit: '%' },
    kalkan: { name: 'Kalkan', icon: 'savunma', perPoint: 0.01, effect: 'Bulunduğu köyün savunması', unit: '%' },
    bereket: { name: 'Bereket', icon: 'odun', perPoint: 0.01, effect: 'Köyünün kaynak üretimi', unit: '%' },
    akin: { name: 'Akın', icon: 'tasima', perPoint: 0.02, effect: 'Yönettiği ordunun ganimeti', unit: '%' },
  }),
});

/** Bir sonraki seviye için gereken tecrübe. */
export function xpForLevel(level) {
  return Math.round(60 * level ** 1.7);
}

export const RARITIES = Object.freeze({
  siradan: { name: 'Sıradan', weight: 70, akce: 3, scale: 0 },
  nadir: { name: 'Nadir', weight: 25, akce: 10, scale: 1 },
  efsanevi: { name: 'Efsanevi', weight: 5, akce: 30, scale: 2 },
});

export const RARITY_IDS = Object.keys(RARITIES);

// Eşya yuvaları: ad listeleri ve etkiler nadirliğe göre (sıradan, nadir, efsanevi).
export const ITEM_SLOTS = Object.freeze({
  silah: {
    name: 'Silah',
    icon: 'silah',
    names: [['Pala', 'Kılıç', 'Balta', 'Gürz'], ['Şam Çeliği Kılıç', 'Selçuklu Palası', 'Teber'], ['Zülfikâr', "Alparslan'ın Kılıcı"]],
    effects: [{ attack: [0.03, 0.07, 0.12], heroAttack: [40, 100, 220] }],
  },
  zirh: {
    name: 'Zırh',
    icon: 'zirh',
    names: [['Deri Zırh', 'Zincir Zırh', 'Pullu Zırh'], ['Çelik Zırh', 'Kaftan-ı Hassa'], ['Altın İşlemeli Zırh', "Kılıç Arslan'ın Zırhı"]],
    effects: [{ defense: [0.03, 0.07, 0.12], heroDefense: [40, 100, 220] }],
  },
  at: {
    name: 'At',
    icon: 'at',
    names: [['Kır At', 'Doru At', 'Yağız At'], ['Arap Atı', 'Türkmen Atı'], ['Rüzgâr Kuşu', 'Boz At']],
    effects: [{ travel: [0.05, 0.1, 0.18] }],
  },
  nisan: {
    name: 'Nişan',
    icon: 'nisan',
    names: [['Nazar Boncuğu', 'Muska', 'Bakır Yüzük'], ['Gümüş Tılsım', 'Mühür Yüzük'], ['Hüma Nişanı', 'Kut Tılsımı']],
    // Nişanın etkisi bu üçünden biridir.
    effects: [{ production: [0.03, 0.06, 0.1] }, { carry: [0.05, 0.1, 0.18] }, { xp: [0.1, 0.2, 0.35] }],
  },
});

export const SLOT_IDS = Object.keys(ITEM_SLOTS);

// Eşya etkilerinin görünen adları
export const ITEM_EFFECTS = Object.freeze({
  attack: 'Ordu saldırısı',
  defense: 'Köy savunması',
  travel: 'Ordu hızı',
  production: 'Köy üretimi',
  carry: 'Ganimet',
  xp: 'Tecrübe',
  heroAttack: 'Kahraman saldırısı',
  heroDefense: 'Kahraman savunması',
});
