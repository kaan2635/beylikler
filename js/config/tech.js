// Demirci geliştirmeleri ve pazar ayarları.

export const RESEARCH = Object.freeze({
  maxLevel: 3,
  bonusPerLevel: 0.1, // her seviye birimin saldırı ve savunmasını %10 artırır
  smithyLevelFor: [0, 1, 5, 10], // L. seviye geliştirme için gereken Demirci seviyesi
  costMultiplier: 12, // maliyet = birim maliyeti × 12 × L
  timeMultiplier: 8, // süre = birimin eğitim süresi × 8 × L (Demirci seviyesiyle kısalır)
});

export const MARKET = Object.freeze({
  merchantCapacity: 1000, // bir tüccarın taşıdığı kaynak
  tripSeconds: 1800, // takastan sonra tüccarların dönüş süresi (dünya hızı 1'de)
  feeStart: 0.3, // komisyon: %30'dan başlar
  feePerLevel: 0.0125, // her Pazar seviyesi komisyonu 1,25 puan düşürür
  feeMin: 0.05, // en düşük komisyon %5
  merchantSpeed: 6, // kendi köyleri arasında nakliye: tüccarın bir alanı geçme süresi (dakika)
});
