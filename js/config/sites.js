// Haritadaki özel yerler: harabeler ve Moğol akını.

// Harabeler: yerleşim alanına dağılmış, eşkıyaların tuttuğu eski yapılar. Ordu gönderip
// muhafızları yenen; kaynak, Akçe ve bir eşya bulur. Yağmalanan harabe bir süre boş kalır.
// Uzaklık kademesi (merkezden): 1 yakın, 2 orta, 3 uzak — uzaktakiler daha güçlü ve daha zengindir.
export const RUINS = Object.freeze({
  chance: 0.0045, // yerleşim alanındaki bir alanın harabe olma olasılığı
  respawnDays: 5, // yağmalanan harabenin yeniden dolması (oyun günü)
  tierDistance: [25, 50], // merkezden bu uzaklıklarda 2. ve 3. kademe başlar
  names: [
    'Bizans Kalesi Harabesi',
    'Eski Kervansaray',
    'Yıkık Manastır',
    'Hitit Tapınağı',
    'Roma Hamamı Kalıntısı',
    'Unutulmuş Türbe',
    'Selçuklu Hanı Harabesi',
    'Kayıp Şehir',
  ],
  guards: { yaya: 8, kilicci: 5, okcu: 4 }, // kademe başına muhafız
  growthPerDay: 0.06, // muhafızlar ve hazine dünya günüyle büyür
  loot: 300, // kademe başına her kaynaktan hazine
  akce: [4, 9, 16],
  itemQuality: [1.2, 1.8, 2.6], // eşyanın nadirlik eğilimi (kademeye göre)
});

// Moğol akını: ara sıra bir Moğol ordusu başkentin yakınına ordugâh kurar ve dalgalar hâlinde
// saldırır. Ordugâhı dağıtan akını erken bitirir ve büyük ödül alır. Süreler oyun saatidir.
export const INVASION = Object.freeze({
  firstDay: 7, // ilk akın en erken bu dünya gününde
  everyDays: [8, 12], // bir akın bittikten sonra yenisine kadar
  prepareHours: 16, // ordugâh kurulduktan sonra ilk dalgaya kadar
  waves: 3,
  waveGapHours: [8, 14],
  ring: [9, 14], // ordugâhın başkente uzaklığı (alan)
  waveFactor: 1.3, // dalga gücü = köyün saldırı sınırı × bu × zorluk çarpanı
  campFactor: 1.4, // ordugâh muhafızı
  leaveHours: 8, // son dalga vardıktan sonra ordugâh çekilir
  army: { akinci: 0.5, atliokcu: 0.3, baltaci: 0.2 },
  rewards: { akce: 40, survive: 15, xp: 150, itemQuality: 3 },
});
