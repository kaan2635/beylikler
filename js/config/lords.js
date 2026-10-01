// Rakip beyler (yapay zekâ) ve zorluk ayarları.

// Tarihî Anadolu beyliklerinden adlar: köy "Germiyan Hisarı", sahibi "Germiyan Bey".
export const LORD_NAMES = Object.freeze([
  'Karaman', 'Germiyan', 'Aydın', 'Saruhan', 'Menteşe', 'Candar',
  'Hamit', 'Eşref', 'Karesi', 'Dulkadir', 'Ramazan', 'Pervane',
]);

export const LORD = Object.freeze({
  count: 6, // dünyadaki rakip bey sayısı (her kişilikten ikişer)
  ringMin: 9, // merkezden en yakın ve en uzak konum (alan)
  ringMax: 26,
  startPower: [2, 4], // başlangıç gücü aralığı; güç gelişmişlik gibi işler (barbarlarda en fazla 20)
  maxPower: 25,
  attackBase: 50, // saldırı gücü = attackBase × güç ^ attackExponent × zorluk çarpanı
  attackExponent: 1.5,
  // Saldırı köyün büyüklüğüyle sınırlıdır: en fazla capBase + capPerPoint × hedef köyün puanı
  // (zorluk çarpanıyla). Yeni kurulan küçük bir köye küçük, gelişmiş köye ciddi ordular gelir.
  capBase: 60,
  capPerPoint: 2,
  techEveryPower: 8, // her 8 güç puanında bir Demirci seviyesi (en fazla 3)
  ramsFromPower: 6, // koçbaşı getiren beyler bu güçten sonra getirir
  graceHours: 12, // mevcut kayıtlar ve zorluk değişiminde ilk saldırıdan önceki en az süre (oyun saati)
  revengeHours: 6, // saldırılan bey intikam için en geç bu kadar sonra saldırır (oyun saati)

  // Beylerin kendi aralarındaki ve barbarlara karşı hareketleri (zorluktan bağımsız sürer).
  raidFactor: 0.7, // yağma ve savaş ordusu, oyuncuya gönderilen ordunun bu kadarı
  raidRadius: 8, // bey bu uzaklıktaki barbar köylerini yağmalar
  bonusMin: -3, // savaşlarla kazanılan/kaybedilen güç payının sınırları; pay temel gücün
  bonusMax: 4, //   üstüne eklenir, yani güçlü beyler geç oyunda maxPower'ı aşıp ayrışır
  bonus: {
    raidWin: 0.03, // barbar köyünü yağmalayan bey
    warWin: 0.4, // başka beyi yenen bey
    warLoss: -0.4, // yenilen bey (saldıran ya da savunan)
    defendWin: 0.2, // saldırıyı püskürten bey
  },
  newsMax: 30, // saklanan en fazla dünya olayı
});

export const PERSONALITIES = Object.freeze({
  saldirgan: {
    name: 'Saldırgan',
    description: 'Sık ve sert saldırır; güçlenince koçbaşıyla surunu yıkmaya çalışır.',
    growthPerDay: 0.3,
    garrisonFactor: 1,
    attackEveryHours: [48, 84],
    raidEveryHours: [16, 30], // barbar yağması ya da başka beye savaş
    warChance: 0.25, // bir hareketin başka beye savaş olma olasılığı
    army: { baltaci: 0.6, akinci: 0.4 }, // saldırı gücünün birimlere dağılımı
    rams: true,
    revenge: true,
  },
  tuccar: {
    name: 'Tüccar',
    description: 'Hızlı büyür; akıncılarıyla ganimet peşinde koşar.',
    growthPerDay: 0.4,
    garrisonFactor: 0.7,
    attackEveryHours: [84, 132],
    raidEveryHours: [10, 20],
    warChance: 0.05,
    army: { akinci: 0.8, baltaci: 0.2 },
    rams: false,
    revenge: false,
  },
  savunmaci: {
    name: 'Savunmacı',
    description: 'Güçlü bir garnizon besler; nadiren ama kalabalık saldırır.',
    growthPerDay: 0.25,
    garrisonFactor: 2,
    attackEveryHours: [144, 240],
    raidEveryHours: [24, 40],
    warChance: 0.1,
    army: { kilicci: 0.5, baltaci: 0.5 },
    rams: false,
    revenge: true,
  },
});

export const DIFFICULTIES = Object.freeze({
  baris: {
    name: 'Barış',
    description: 'Rakip beyler kimseye saldırmaz; dünya sakin kalır. Sen yine onlara saldırabilirsin.',
    attacks: false,
    raids: false, // beyler barbar yağmalamaz, birbirine savaş açmaz
    attackFactor: 0,
    intervalFactor: 1,
    protectionDays: 0,
  },
  // minGapHours: bir saldırı yola çıktıktan sonra bir sonrakine kadar en az bu kadar oyun saati
  // geçer; altı bey sırayla gelir, köye üst üste yüklenmez. (İntikam saldırısı bu sırayı beklemez.)
  kolay: {
    name: 'Kolay',
    description: 'Saldırılar seyrek (en az 3 oyun günü arayla) ve hafif; ilk 5 oyun günü koruma.',
    attacks: true,
    raids: true,
    attackFactor: 0.6,
    intervalFactor: 2,
    minGapHours: 72,
    protectionDays: 5,
  },
  normal: {
    name: 'Normal',
    description: 'Dengeli: saldırılar en az 40 oyun saati arayla gelir, köyünün büyüklüğüyle ölçülür; ilk 3 oyun günü koruma.',
    attacks: true,
    raids: true,
    attackFactor: 1,
    intervalFactor: 1,
    minGapHours: 40,
    protectionDays: 3,
  },
  zor: {
    name: 'Zor',
    description: 'Sık (en az 20 oyun saati arayla) ve güçlü saldırılar; ilk 1,5 oyun günü koruma.',
    attacks: true,
    raids: true,
    attackFactor: 1.5,
    intervalFactor: 0.6,
    minGapHours: 20,
    protectionDays: 1.5,
  },
  // Çok oyunculu dünya: rakipler gerçek oyunculardır. Beyler oyunculara saldırmaz ama dünyada
  // yaşamaya devam eder (barbar yağmalar, birbirine savaş açar) ve fethedilebilir.
  cok: {
    name: 'Çok oyunculu',
    description: 'Beyler oyunculara saldırmaz; rakiplerin gerçek oyunculardır.',
    attacks: false,
    raids: true,
    attackFactor: 0,
    intervalFactor: 1,
    protectionDays: 0,
    hidden: true, // Ayarlar'daki zorluk listesinde görünmez
  },
});

// Çok oyunculu dünyada yeni oyuncunun saldırıya karşı korunduğu süre (oyun günü).
export const NEWBIE_PROTECTION_DAYS = 3;

// Diplomasi: oyuncunun her beyle ilişkisi (−100..100). İlişki her oyun günü sıfıra doğru
// `decayPerDay` kadar yaklaşır; hediye ve antlaşmayla yükselir, hisarına saldırınca düşer.
export const DIPLOMACY = Object.freeze({
  decayPerDay: 2,
  attackPenalty: -25, // beyin hisarına saldırınca
  spyPenalty: -8, // hisarını gözetleyince
  // Hediye: ambar kapasitesinin `share` kadarı her kaynaktan; ilişkiyi `relation` artırır.
  gifts: Object.freeze([
    { id: 'kucuk', name: 'Küçük hediye', share: 0.05, relation: 8 },
    { id: 'degerli', name: 'Değerli hediye', share: 0.12, relation: 20 },
    { id: 'gorkemli', name: 'Görkemli hediye', share: 0.25, relation: 40 },
  ]),
  // Barış antlaşması: ilişki en az minRelation olmalı; bedeli Akçe + kaynak; süresince bey saldırmaz.
  peace: Object.freeze({ minRelation: 20, days: 4, akce: 15, share: 0.1, relation: 10 }),
  // İlişkiye göre saldırı sıklığı: saldırılar arası bekleme bu kadarla çarpılır.
  // Müttefik bey (Infinity) hiç saldırmaz; ilişki düşünce yeniden saldırabilir.
  levels: Object.freeze([
    { min: 70, id: 'muttefik', name: 'Müttefik', interval: Infinity },
    { min: 40, id: 'dost', name: 'Dost', interval: 1.8 },
    { min: 15, id: 'ilimli', name: 'Ilımlı', interval: 1.3 },
    { min: -15, id: 'tarafsiz', name: 'Tarafsız', interval: 1 },
    { min: -50, id: 'soguk', name: 'Soğuk', interval: 0.9 },
    { min: -Infinity, id: 'dusman', name: 'Düşman', interval: 0.75 },
  ]),
});
