/**
 * Birim tanımları. Nesnedeki sıra, arayüzdeki sıradır.
 *
 * building      birimi eğiten bina; o binanın seviyesi eğitimi hızlandırır.
 * requires      eğitim için gereken (tamamlanmış) bina seviyeleri.
 * cost, pop     tek birimin maliyeti ve kullandığı nüfus.
 * trainTime     tek birimin eğitim süresi (saniye; dünya hızı 1, bina seviyesi 0).
 * attack, type  saldırı gücü ve türü ('piyade' | 'suvari' | 'okcu'); savunan bu türe göre savunur.
 * defense       piyadeye, süvariye ve okçuya karşı savunma gücü.
 * speed         bir alanı geçme süresi (dakika); ordu en yavaş biriminin hızıyla ilerler.
 * carry         yağmada taşıyabildiği kaynak.
 */
export const UNITS = {
  yaya: {
    name: 'Yaya',
    role: 'Savunma',
    description: 'Mızraklı piyade. Ucuzdur, özellikle süvariye karşı sağlam savunur.',
    building: 'kisla',
    requires: { kisla: 1 },
    cost: { odun: 50, kil: 30, demir: 10 },
    pop: 1,
    trainTime: 1000,
    attack: 10,
    type: 'piyade',
    defense: { piyade: 15, suvari: 40, okcu: 20 },
    speed: 18,
    carry: 25,
  },
  kilicci: {
    name: 'Kılıççı',
    role: 'Savunma',
    description: 'Kalkanlı kılıç ustası. Piyadeye ve okçuya karşı güçlü bir savunmacıdır.',
    building: 'kisla',
    requires: { kisla: 2 },
    cost: { odun: 30, kil: 30, demir: 70 },
    pop: 1,
    trainTime: 1400,
    attack: 25,
    type: 'piyade',
    defense: { piyade: 45, suvari: 15, okcu: 40 },
    speed: 22,
    carry: 15,
  },
  baltaci: {
    name: 'Baltacı',
    role: 'Saldırı',
    description: 'Ağır baltalı saldırı piyadesi. Savunması zayıf, saldırısı güçlüdür.',
    building: 'kisla',
    requires: { kisla: 3 },
    cost: { odun: 60, kil: 30, demir: 40 },
    pop: 1,
    trainTime: 1300,
    attack: 40,
    type: 'piyade',
    defense: { piyade: 10, suvari: 5, okcu: 10 },
    speed: 18,
    carry: 10,
  },
  okcu: {
    name: 'Okçu',
    role: 'Savunma',
    description: 'Uzaktan vuran okçu. Piyadeye ve süvariye karşı iyi savunur.',
    building: 'kisla',
    requires: { kisla: 5 },
    cost: { odun: 100, kil: 30, demir: 60 },
    pop: 1,
    trainTime: 1700,
    attack: 15,
    type: 'okcu',
    defense: { piyade: 45, suvari: 40, okcu: 10 },
    speed: 18,
    carry: 10,
  },
  gozcu: {
    name: 'Gözcü',
    role: 'Keşif',
    description: 'Düşman köyünü gizlice gözetler. Savaşta işe yaramaz ama bilgi altından değerlidir.',
    building: 'ahir',
    requires: { ahir: 1 },
    cost: { odun: 50, kil: 50, demir: 20 },
    pop: 2,
    trainTime: 900,
    attack: 0,
    type: 'suvari',
    defense: { piyade: 2, suvari: 1, okcu: 2 },
    speed: 9,
    carry: 0,
  },
  akinci: {
    name: 'Akıncı',
    role: 'Saldırı',
    description: 'Hızlı hafif süvari. Yağma akınları için idealdir, çok ganimet taşır.',
    building: 'ahir',
    requires: { ahir: 3 },
    cost: { odun: 125, kil: 100, demir: 250 },
    pop: 4,
    trainTime: 1800,
    attack: 130,
    type: 'suvari',
    defense: { piyade: 30, suvari: 40, okcu: 30 },
    speed: 10,
    carry: 80,
  },
  sipahi: {
    name: 'Sipahi',
    role: 'Çok yönlü',
    description: 'Zırhlı ağır süvari. Hem saldırıda hem savunmada güçlüdür ama pahalıdır.',
    building: 'ahir',
    requires: { ahir: 10 },
    cost: { odun: 200, kil: 150, demir: 600 },
    pop: 6,
    trainTime: 3600,
    attack: 150,
    type: 'suvari',
    defense: { piyade: 190, suvari: 80, okcu: 170 },
    speed: 11,
    carry: 50,
  },
  kocbasi: {
    name: 'Koçbaşı',
    role: 'Kuşatma',
    description: 'Ağır kütükle sur döver. Saldırıda düşman surunu düşürür.',
    building: 'atolye',
    requires: { atolye: 1 },
    cost: { odun: 300, kil: 200, demir: 200 },
    pop: 5,
    trainTime: 4800,
    attack: 2,
    type: 'piyade',
    defense: { piyade: 20, suvari: 50, okcu: 20 },
    speed: 30,
    carry: 0,
  },
  mancinik: {
    name: 'Mancınık',
    role: 'Kuşatma',
    description: 'Taş fırlatır. Saldırıda düşman binalarına hasar verir.',
    building: 'atolye',
    requires: { atolye: 2 },
    cost: { odun: 320, kil: 400, demir: 100 },
    pop: 8,
    trainTime: 7200,
    attack: 100,
    type: 'piyade',
    defense: { piyade: 100, suvari: 50, okcu: 100 },
    speed: 30,
    carry: 0,
  },
};

export const UNIT_IDS = Object.keys(UNITS);

/** Asker eğiten binalar (her birinin ayrı eğitim kuyruğu vardır). */
export const TRAINING_BUILDINGS = [...new Set(UNIT_IDS.map((id) => UNITS[id].building))];

/** Saldırı/savunma türlerinin görünen adları. */
export const COMBAT_TYPES = { piyade: 'Piyade', suvari: 'Süvari', okcu: 'Okçu' };
