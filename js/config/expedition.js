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
    bos: 22, // bir şey bulunamadı
    kaynak: 30, // terk edilmiş kervan, maden, orman…
    asker: 10, // paralı askerler sancağa katılır
    akce: 9, // hazine
    esya: 6, // kahraman için bir eşya
    hazine: 2, // büyük hazine: Akçe ve taşıma sınırı olmadan kaynak
    kervan: 4, // tüccar kervanı: mallar taşıma sınırı olmadan köye gelir
    kabile: 3, // göçebe oba: atlı paralı askerler ve şan
    at: 3, // yılkı atları: akıncılar
    harita: 3, // kadim harita: şan, kahramana tecrübe
    gecikme: 7, // dönüş gecikir
    erken: 5, // kestirme yol: erken dönüş
    eskiya: 6, // eşkıya pususu (savaş)
    kayip: 2, // fırtına, bataklık: sefer kaybolur
  },
  risky: ['gecikme', 'eskiya', 'kayip'],
  emptyLessPerHour: 0.06, // her ek keşif saati "boş" olasılığını %6 azaltır

  resourceBase: 2000, // bulunan kaynak ölçeği…
  resourcePerDay: 400, // …dünya günüyle büyür
  holdBonus: 0.15, // her ek keşif saati bulguyu %15 artırır
  resourceSplit: { odun: 0.4, kil: 0.35, demir: 0.25 },
  unitsShare: [0.08, 0.25], // bulunan asker: seferdekilerin %8–25'i
  akce: [15, 80],
  treasureAkce: [40, 120], // büyük hazine
  caravan: [0.8, 1.4], // tüccar kervanının getirdiği, kaynak ölçeğine oranla
  horses: [0.1, 0.3], // yılkı atları: seferdekilerin %10–30'u kadar akıncı
  mapRenown: 8, // kadim harita: şan
  mapXp: 80, // kadim harita: kahramana tecrübe
  tribeRenown: 5,
  heroReward: 1.2, // kahraman sefere katılırsa bulgular +%20…
  heroRisk: 0.8, // …tehlikeler −%20
  heroXpPerHour: 25, // kahramanın keşif saati başına tecrübesi
  masteryPer: 0.01, // her tamamlanan sefer bulguları %1 artırır (keşif ustalığı)…
  masteryMax: 0.3, // …en fazla %30
  delay: [0.5, 1], // dönüş %50–100 uzar
  early: 0.5, // dönüş yarıya iner
  bandits: [0.3, 1.1], // eşkıya gücü: seferin saldırı gücünün 0,3–1,1 katı
  banditLoot: 0.5, // eşkıyayı yenen, kaynak ölçeğinin yarısı kadar ganimet alır
});

// Keşif bölgeleri: her birinin uzaklığı, gereken Kervansaray seviyesi ve sonuç olasılıklarına
// etkisi (çarpan) farklıdır. `split` bulunan kaynağın dağılımı, `pool` katılan paralı askerlerin
// türleri, `itemQuality` bulunan eşyanın nadirlik eğilimidir.
export const REGIONS = Object.freeze({
  sinir: {
    name: 'Sınır Boyları',
    description: 'Yerleşimin hemen ötesi. Ne çok tehlikeli ne çok bereketli.',
    kervansaray: 1,
    distance: 15,
    mods: {},
    itemQuality: 1,
  },
  orman: {
    name: 'Kara Ormanlar',
    description: 'Kerestesi bol, yolları dar. Eşkıya pusuya yatar.',
    kervansaray: 1,
    distance: 12,
    mods: { kaynak: 1.4, eskiya: 1.3, at: 0.3, hazine: 0.5, kervan: 0.5 },
    split: { odun: 0.6, kil: 0.2, demir: 0.2 },
    itemQuality: 1,
  },
  bozkir: {
    name: 'Uçsuz Bozkır',
    description: 'Yılkı atları ve göçebe obalar. Ama günlerce hiçbir şey bulunmayabilir.',
    kervansaray: 1,
    distance: 14,
    mods: { at: 3, asker: 1.4, kabile: 2.5, bos: 1.3, kaynak: 0.7 },
    pool: ['akinci', 'atliokcu', 'tatarlisi', 'deli'],
    itemQuality: 1,
  },
  dag: {
    name: 'Dumanlı Dağlar',
    description: 'Demir damarları ve unutulmuş hazineler; çığ ve kar fırtınası da.',
    kervansaray: 3,
    distance: 16,
    mods: { kaynak: 1.2, hazine: 1.8, esya: 1.3, kayip: 1.6, gecikme: 1.6 },
    split: { odun: 0.2, kil: 0.25, demir: 0.55 },
    itemQuality: 1.4,
  },
  harabe: {
    name: 'Kadim Harabeler',
    description: 'Eski uygarlıkların kalıntıları: eşyalar, haritalar, sikkeler… ve onları bekleyen eşkıyalar.',
    kervansaray: 6,
    distance: 18,
    mods: { esya: 2.5, akce: 1.6, harita: 2.5, eskiya: 1.8, kaynak: 0.6 },
    itemQuality: 1.8,
  },
  sahil: {
    name: 'Mavi Kıyılar',
    description: 'Uzak limanlar ve tüccar kervanları; korsanlar da hiç eksik olmaz.',
    kervansaray: 10,
    distance: 22,
    mods: { kervan: 3, hazine: 2.5, akce: 1.5, eskiya: 1.4, kayip: 1.2, bos: 0.8 },
    split: { odun: 0.3, kil: 0.3, demir: 0.4 },
    itemQuality: 2.2,
  },
});

export const REGION_IDS = Object.keys(REGIONS);

// Sefer yaklaşımı sonuçların ağırlığını değiştirir; seçilen bölgeyle birlikte gerçek bir risk/ödül tercihi sunar.
export const EXPEDITION_FOCUSES = Object.freeze({
  dengeli: {
    name: 'Dengeli',
    icon: 'kasif',
    description: 'Her tür bulgu için temel olasılıklar korunur.',
    mods: {},
    risk: 1,
    empty: 1,
    reward: 1,
  },
  kaynak: {
    name: 'Kaynak arayışı',
    icon: 'tasima',
    description: 'Kaynak, kervan ve hazine ihtimali artar; asker ve eşya bulguları azalır.',
    mods: { kaynak: 1.7, kervan: 1.5, hazine: 1.25, asker: 0.7, esya: 0.75, kabile: 0.75, at: 0.75, harita: 0.8 },
    risk: 1,
    empty: 1,
    reward: 1,
  },
  asker: {
    name: 'Levent arayışı',
    icon: 'serdar',
    description: 'Paralı asker, göçebe oba ve yılkı ihtimali artar; pusu riski hafif yükselir.',
    mods: { asker: 1.7, kabile: 1.6, at: 1.5, kaynak: 0.85, kervan: 0.85, hazine: 0.9 },
    risk: 1.1,
    empty: 1,
    reward: 1,
  },
  temkinli: {
    name: 'Tedbirli',
    icon: 'savunma',
    description: 'Pusu, kayıp ve gecikme ağırlığı %45 azalır; boş dönüş artar, bulgular %15 küçülür.',
    mods: {},
    risk: 0.55,
    empty: 1.2,
    reward: 0.85,
  },
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
  esya: { name: 'Eşya bulundu', good: true },
  hazine: { name: 'Büyük hazine', good: true },
  kervan: { name: 'Tüccar kervanı', good: true },
  kabile: { name: 'Göçebe oba', good: true },
  at: { name: 'Yılkı atları', good: true },
  harita: { name: 'Kadim harita', good: true },
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
  esya: [
    'Yıkık bir kulenin dibinde, paslanmamış bir sandık bulundu. İçinden değerli bir eşya çıktı.',
    'Ölmüş bir şövalyenin yanında parlayan bir eşya vardı; birlik onu beyine getirdi.',
    'Bir mağaranın derinliklerinde, kimsenin dokunmadığı bir hazine odası bulundu.',
  ],
  hazine: [
    'Toprağa gömülü bir hazine sandığı! Akçeler ve yük yük mal, katırlarla köye taşınıyor.',
    'Batık bir geminin ambarı kıyıya vurmuş; birlik zenginliği toplayıp dönüyor.',
  ],
  kervan: [
    'Yolda büyük bir tüccar kervanıyla karşılaşıldı; mallarını beyliğe satmak için birlikle geliyorlar.',
    'Limanda yükünü boşaltan tüccarlar, beyliğin korumasında köye mal taşımayı kabul etti.',
  ],
  kabile: [
    'Göçebe bir oba ile dostluk kuruldu; obanın yiğitleri sancağa katıldı.',
    'Bir Türkmen boyunun beyi, birliği ağırladı ve atlı yiğitlerini beyliğe gönderdi.',
  ],
  at: [
    'Bozkırda başıboş bir yılkı sürüsü bulundu; atlar evcilleştirildi, yiğitler atlandı.',
    'Terk edilmiş bir at çiftliğinde semerli atlar vardı. Akıncılar yeni binekleriyle dönüyor.',
  ],
  harita: [
    'Eski bir manastırın kütüphanesinde kadim bir harita bulundu; beyliğin şanı yayılıyor.',
    'Bir dervişin bıraktığı harita, unutulmuş yolları gösteriyor. Kahraman yeni şeyler öğrendi.',
  ],
});
