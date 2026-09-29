// Oyun ve dünya ayarları. Dünya hızı tüm üretim ve inşaat sürelerini ölçekler.
export const GAME = Object.freeze({
  title: 'Beylikler',
  saveVersion: 5,
  saveKey: 'beylikler:kayit',
  defaultSpeed: 1,
  speedOptions: [1, 2, 5, 10, 50, 100],
  maxBuildQueue: 2,
  maxTrainQueue: 5, // her eğitim binası için ayrı
  maxTrainBatch: 9999,
  tickMs: 1000,
});

// Yeni oyunun başlangıç durumu. Listede olmayan binalar 0. seviyeden başlar.
export const START = Object.freeze({
  villageName: 'Beyliğim',
  resources: { odun: 500, kil: 500, demir: 500 },
  buildings: { konak: 1, oduncu: 1, kilocagi: 1, demirmadeni: 1, ambar: 1, ciftlik: 1 },
});
