// Keşif seferleri (OGame'deki "expedition" benzeri). Birlik, haritanın bilinmeyen kenar
// topraklarına gider, seçilen süre boyunca oraları dolaşır ve bir şey bulursa getirir.

export const EXPEDITION = Object.freeze({
  distance: 15, // köyden bilinmeyen topraklara yolculuk (alan); en yavaş birimin hızıyla
  holdHours: [1, 2, 3, 4, 6, 8], // keşif süresi seçenekleri (oyun saati)
  slotsBase: 1, // Kervansaray 1. seviyede bir sefer hakkı…
  slotsEvery: 5, // …her 5 seviyede bir hak daha
  excluded: ['elci'], // sefere gidemeyen birimler

  // Sonuç olasılıkları (ağırlık). Tehlikeli olanlar Kâşif sınıfında yarıya iner; uzun keşif
  // boşa dönme olasılığını azaltır.
  weights: {
    bos: 28, // bir şey bulunamadı
    kaynak: 32, // terk edilmiş kervan, maden, orman…
    asker: 10, // paralı askerler sancağa katılır
    akce: 9, // hazine
    gecikme: 8, // dönüş gecikir
    erken: 5, // kestirme yol: erken dönüş
    eskiya: 6, // eşkıya pususu (savaş)
    kayip: 2, // fırtına, bataklık: sefer kaybolur
  },
  risky: ['gecikme', 'eskiya', 'kayip'],
  emptyLessPerHour: 0.06, // her ek keşif saati "boş" olasılığını %6 azaltır

  resourceBase: 1500, // bulunan kaynak ölçeği…
  resourcePerDay: 300, // …dünya günüyle büyür
  holdBonus: 0.15, // her ek keşif saati bulguyu %15 artırır
  resourceSplit: { odun: 0.4, kil: 0.35, demir: 0.25 },
  unitsShare: [0.05, 0.2], // bulunan asker: seferdekilerin %5–20'si
  akce: [10, 60],
  delay: [0.5, 1], // dönüş %50–100 uzar
  early: 0.5, // dönüş yarıya iner
  bandits: [0.3, 1.1], // eşkıya gücü: seferin saldırı gücünün 0,3–1,1 katı
  banditLoot: 0.5, // eşkıyayı yenen, kaynak ölçeğinin yarısı kadar ganimet alır
});

// Sonuçların arayüzdeki adları; `good` rapor rozetinin rengini belirler.
export const EXPEDITION_OUTCOMES = Object.freeze({
  bos: { name: 'Boş dönüş', good: null },
  kaynak: { name: 'Kaynak', good: true },
  asker: { name: 'Paralı asker', good: true },
  akce: { name: 'Akçe hazinesi', good: true },
  gecikme: { name: 'Gecikme', good: false },
  erken: { name: 'Erken dönüş', good: true },
  eskiya: { name: 'Eşkıya pususu', good: false },
  eskiyaZafer: { name: 'Eşkıya püskürtüldü', good: true },
  eskiyaYenilgi: { name: 'Eşkıyaya yenildi', good: false },
  kayip: { name: 'Sefer kayboldu', good: false },
});

// Rapor metinleri: her sonuç için birkaç anlatım; tohumdan biri seçilir.
export const EXPEDITION_TEXTS = Object.freeze({
  bos: [
    'Birlik günlerce bozkırı dolaştı; rüzgârdan ve tozdan başka bir şey bulamadı.',
    'Haritacı yolunu şaşırdı. Birlik eli boş, ama sağ salim döndü.',
    'Terk edilmiş bir han bulundu; içinde örümcek ağından başka bir şey yoktu.',
    'Sisli vadide uzun süre dolaşıldı; ne kervan ne köy, ne de bir iz.',
  ],
  kaynak: [
    'Eşkıyaların saldırıp bıraktığı bir kervan bulundu. Yükler sırtlanıp yola çıkıldı.',
    'Unutulmuş bir maden ağzında işlenmeye hazır cevher yığınları vardı.',
    'Yıkık bir kalenin mahzeninde kereste ve tuğla istif edilmişti.',
    'Göçmüş bir obanın bıraktığı ambarlar hâlâ doluydu.',
  ],
  asker: [
    'Yolda karşılaşılan başıboş levendler sancağa katılmak istedi.',
    'Efendisini kaybetmiş bir bölük, yeni bir bey arıyordu. Artık senin askerlerin.',
    'Bir köyü eşkıyadan kurtaran birliğe köyün gençleri katıldı.',
  ],
  akce: [
    'Bir çeşmenin dibinde eski sikkelerle dolu bir küp bulundu.',
    'Batık bir kayığın sandığından akçe keseleri çıktı.',
    'Bir derviş, yol gösterdiği için hediye olarak bir kese akçe verdi.',
  ],
  gecikme: [
    'Sel yolları kesti; birlik dönüş için uzun bir yol aramak zorunda kaldı.',
    'Kılavuz birliği yanlış geçide soktu. Dönüş gecikecek.',
    'Kar fırtınası dağ geçidini kapattı; birlik geçidin açılmasını bekliyor.',
  ],
  erken: [
    'Yerli bir çoban kestirme bir patika gösterdi. Birlik erken dönüyor.',
    'Rüzgâr arkadan esti, yollar kuruydu: dönüş kısa sürecek.',
  ],
  eskiyaZafer: [
    'Eşkıyalar pusu kurdu ama püskürtüldü; ganimetleri de alındı.',
    'Dar bir boğazda eşkıyalarla çarpışıldı. Zafer kazanıldı.',
  ],
  eskiyaYenilgi: [
    'Kalabalık bir eşkıya çetesi birliği pusuya düşürdü. Kimse dönemedi.',
    'Eşkıyalar gece baskını yaptı; birlik dağıldı.',
  ],
  kayip: [
    'Birlik bataklığa saplandı; bir daha haber alınamadı.',
    'Kum fırtınası birliği yuttu. Geriye yalnızca izleri kaldı.',
  ],
});
