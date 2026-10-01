// Mevsimler: dünya saatiyle döner (her mevsim SEASON_DAYS oyun günü). Etkileri bütün
// oyuncuların köylerine aynı anda işler; köy sahnesi de mevsimin rengini alır.

export const SEASON_DAYS = 4;

export const SEASONS = Object.freeze([
  {
    id: 'ilkbahar',
    name: 'İlkbahar',
    description: 'Toprak uyanır, çiftler sürülür.',
    perks: ['Kaynak üretimi +%10'],
    bonus: { production: 1.1 },
  },
  {
    id: 'yaz',
    name: 'Yaz',
    description: 'Yollar kuru, ormanlar gür.',
    perks: ['Ordular %10 hızlı', 'Odun üretimi +%15'],
    bonus: { travel: 0.9, prodOdun: 1.15 },
  },
  {
    id: 'sonbahar',
    name: 'Sonbahar',
    description: 'Hasat zamanı; kervanlar yollarda.',
    perks: ['Kil üretimi +%15', 'Keşif bulguları +%20', 'Tüccarlar %20 hızlı'],
    bonus: { prodKil: 1.15, expeditionReward: 1.2, merchantTime: 0.8 },
  },
  {
    id: 'kis',
    name: 'Kış',
    description: 'Kar yolları kapar, ayaz saldıranı yorar.',
    perks: ['Kaynak üretimi −%15', 'Ordular %20 yavaş', 'Savunma +%10'],
    bonus: { production: 0.85, travel: 1.2, defense: 1.1 },
  },
]);
