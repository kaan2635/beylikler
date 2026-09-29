// Dünya haritası ayarları.
export const WORLD = Object.freeze({
  size: 1000, // koordinatlar 0..999; 100×100'lük her bölge bir "kıta"dır (K55 gibi)
  center: 500,
  settledRadius: 70, // merkezden bu uzaklığın ötesi yabani topraklar: köy yok
  barbarianChance: { inner: 0.1, outer: 0.03 }, // merkezde ve yerleşim sınırında bir alanda köy olasılığı
  barbarianMaxGrowth: 20, // barbar köyünün ulaşabileceği en yüksek gelişmişlik
  ownVillageClearance: 2, // oyuncu köyüne bundan yakın barbar köyü olmaz
});

export const TERRAIN = Object.freeze({
  cayir: { name: 'Çayır' },
  orman: { name: 'Orman' },
  tepe: { name: 'Tepelik' },
  gol: { name: 'Göl' }, // köy kurulamaz
});

// Barbar köyü adları iki parçadan oluşur: Kara + pınar → Karapınar.
export const VILLAGE_NAME_PARTS = Object.freeze({
  first: [
    'Kara', 'Ak', 'Kızıl', 'Yeşil', 'Gök', 'Demir', 'Taş', 'Eski', 'Yeni', 'Uzun', 'Sarı', 'Boz',
    'Çam', 'Kuru', 'Kaya', 'Kurt', 'Ulu', 'Yassı', 'Çakır', 'Alaca', 'Ilıca', 'Dere', 'Bey', 'Söğüt',
  ],
  second: [
    'köy', 'ova', 'pınar', 'dere', 'tepe', 'yurt', 'oba', 'kent', 'hisar', 'yazı', 'alan', 'bük',
    'kaya', 'su', 'çay', 'bel', 'kuyu', 'viran',
  ],
});
