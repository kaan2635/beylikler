// Oyuncu sınıfları (OGame'deki Toplayıcı / General / Kâşif benzeri), Akçe ile tutulan
// görevliler ve premium ayarları.
//
// Etkiler köylerin `bonus` alanında birleşir (bkz. systems/premium.js):
//   çarpanlar (production, buildTime, trainTime, researchTime, travel, attack, defense,
//   merchantCapacity, merchantTime, expeditionReward, expeditionRisk) birbiriyle çarpılır;
//   sayılar (buildQueue, trainQueue, expeditionSlots, farmAssistant) toplanır.

export const DEFAULT_BONUS = Object.freeze({
  production: 1,
  buildTime: 1,
  trainTime: 1,
  researchTime: 1,
  travel: 1,
  attack: 1,
  defense: 1,
  merchantCapacity: 1,
  merchantTime: 1,
  expeditionReward: 1,
  expeditionRisk: 1,
  buildQueue: 0,
  trainQueue: 0,
  expeditionSlots: 0,
  farmAssistant: 0,
});

// Toplanan (çarpılmayan) etkiler.
export const ADDITIVE_BONUS = new Set(['buildQueue', 'trainQueue', 'expeditionSlots', 'farmAssistant']);

export const CLASSES = Object.freeze({
  tuccar: {
    name: 'Tüccar Bey',
    motto: 'Bereketli topraklar, dolu ambarlar.',
    description: 'Ekonomiyle büyür. Kaynak üretimi yüksektir, tüccarları daha çok taşır ve daha hızlı gider.',
    perks: ['Kaynak üretimi +%20', 'Tüccar kapasitesi +%50', 'Tüccarlar 2 kat hızlı'],
    bonus: { production: 1.2, merchantCapacity: 1.5, merchantTime: 0.5 },
  },
  serdar: {
    name: 'Serdar',
    motto: 'Kılıç kalemden keskindir.',
    description: 'Savaşla büyür. Orduları hızlı yürür, çabuk yetişir ve sert vurur.',
    perks: ['Ordu yolculuk süresi −%25', 'Asker eğitim süresi −%15', 'Saldırı gücü +%10'],
    bonus: { travel: 0.75, trainTime: 0.85, attack: 1.1 },
  },
  kasif: {
    name: 'Kâşif',
    motto: 'Ufkun ötesinde hazine var.',
    description: 'Keşifle büyür. Bilinmeyen topraklara daha çok sefer düzenler, daha çok bulur, daha az kaybeder.',
    perks: ['Keşif seferi hakkı +1', 'Keşif bulguları +%50', 'Keşif tehlikeleri −%50', 'Demirci geliştirme süresi −%25'],
    bonus: { expeditionSlots: 1, expeditionReward: 1.5, expeditionRisk: 0.5, researchTime: 0.75 },
  },
});

export const CLASS_IDS = Object.keys(CLASSES);

// Görevliler: Akçe ile belirli bir süre için tutulur (gerçek zaman). Süre dolmadan yeniden
// alınırsa süre uzar.
export const OFFICERS = Object.freeze({
  vezir: {
    name: 'Vezir',
    description: 'Divanı düzene sokar: aynı anda daha çok iş yürür.',
    perks: ['İnşaat kuyruğu +1 sıra', 'Eğitim kuyrukları +2 sıra'],
    cost: 200,
    bonus: { buildQueue: 1, trainQueue: 2 },
  },
  defterdar: {
    name: 'Defterdar',
    description: 'Hazineyi ve vergileri yönetir.',
    perks: ['Kaynak üretimi +%10'],
    cost: 250,
    bonus: { production: 1.1 },
  },
  mimarbasi: {
    name: 'Mimarbaşı',
    description: 'Ustaları yönetir, yapılar çabuk yükselir.',
    perks: ['İnşaat süresi −%15'],
    cost: 200,
    bonus: { buildTime: 0.85 },
  },
  serasker: {
    name: 'Serasker',
    description: 'Orduların başkomutanı. Yağma seferlerini tek emirle yönetir.',
    perks: ['Ordu yolculuk süresi −%10', 'Yağma asistanında "Tümüne tekrar saldır"'],
    cost: 250,
    bonus: { travel: 0.9, farmAssistant: 1 },
  },
});

export const OFFICER_IDS = Object.keys(OFFICERS);

export const PREMIUM = Object.freeze({
  startAkce: 250, // yeni oyunda ve Akçe'nin geldiği sürüme geçen kayıtlarda
  officerDays: 7, // görevli süresi (gerçek gün)
  classChangeCost: 500,
  finishGameMinutesPerAkce: 3, // anında bitirme: kalan her 3 oyun dakikası 1 Akçe
  finishMinCost: 5,
  resourcePack: { cost: 100, share: 0.25 }, // her kaynaktan ambar kapasitesinin %25'i
  rewards: { conquest: 100, defense: 20 },
  logMax: 30,
});
