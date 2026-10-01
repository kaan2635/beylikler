// Olaylar ve kararlar: ara sıra beyliğe bir olay gelir (gezgin kervan, kıtlık, haydutlar…);
// oyuncu seçeneklerden birini seçer. Süresi içinde karar verilmezse olay kendi seyrine bırakılır
// (`fallback` seçeneği). Olayların içeriği systems/events.js'dedir.
// Süreler oyun saatidir; dünya hızıyla kısalır.

export const EVENTS = Object.freeze({
  firstHours: [10, 20], // yeni oyunda (ve bu sürüme geçen kayıtlarda) ilk olaya kadar
  intervalHours: [20, 40], // bir olay çözüldükten sonra yenisine kadar
  expiryHours: 16, // karar için süre; dolunca olay kendi seyrine bırakılır
  historyMax: 20, // saklanan son olay sayısı
});
