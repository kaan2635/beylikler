// Oyunun sayısal dengesi. Hepsi saf fonksiyon: aynı girdi her zaman aynı çıktıyı verir.
// Bu yüzden hem tarayıcıda hem Node testlerinde (ileride sunucuda da) aynen çalışır.

/** Tüm üstel eğrilerin ortak şekli: taban × çarpan^(seviye − 1). */
export function growth(base, factor, level) {
  return base * Math.pow(factor, level - 1);
}

/** Bir kaynak binasının saatlik üretimi. Seviye 0'da köy yine de az miktar toplar. */
export function productionPerHour(level, speed = 1) {
  return (level > 0 ? growth(30, 1.163, level) : 5) * speed;
}

/** Ambarın her kaynak için ayrı ayrı saklayabildiği miktar. */
export function storageCapacity(level) {
  return Math.round(growth(1000, 1.2295, level));
}

/** Çiftliğin besleyebildiği toplam nüfus. */
export function populationCapacity(level) {
  return Math.round(growth(240, 1.172, level));
}

/** Gizli depoda yağmacılardan saklanan miktar (her kaynak için). */
export function hiddenCapacity(level) {
  return level > 0 ? Math.round(growth(150, 1.3335, level)) : 0;
}

/** Surun savunmaya kattığı oran (0.2 = %20). */
export function wallBonus(level) {
  return Math.pow(1.037, level) - 1;
}

/** Konak seviyesine göre inşaat süresi çarpanı (1 = indirim yok). */
export function konakTimeFactor(level) {
  return Math.pow(1.05, -level);
}

/** Kışla seviyesine göre asker eğitim süresi çarpanı. */
export function trainingTimeFactor(level) {
  return Math.pow(1.06, -level);
}

/** Bir binayı `level` seviyesine yükseltmenin maliyeti. */
export function upgradeCost(def, level) {
  const cost = {};
  for (const [resource, base] of Object.entries(def.cost)) {
    cost[resource] = Math.round(growth(base, def.costFactor, level));
  }
  return cost;
}

/** Binanın `level` seviyesindeyken kullandığı toplam nüfus. */
export function buildingPopulation(def, level) {
  if (!def.pop || level <= 0) return 0;
  return Math.round(growth(def.pop.base, def.pop.factor, level));
}

/** Binanın `level` seviyesinde köye kattığı puan. */
export function buildingPoints(def, level) {
  return level > 0 ? Math.round(growth(def.points, 1.2, level)) : 0;
}

/**
 * `distance` alanlık yolun kaç saniyede alındığı. `minutesPerField` birimin hızıdır;
 * ordu en yavaş biriminin hızıyla ilerler.
 */
export function travelSeconds(distance, minutesPerField, speed = 1) {
  return Math.round((distance * minutesPerField * 60) / speed);
}

/** Tek bir birimin eğitim süresi (saniye); eğiten binanın seviyesi süreyi kısaltır. */
export function trainDuration(unit, buildingLevel, speed = 1) {
  return Math.max(1, Math.round((unit.trainTime * trainingTimeFactor(buildingLevel)) / speed));
}

/** Binayı `level` seviyesine yükseltme süresi (saniye). */
export function buildDuration(def, level, konakLevel, speed = 1) {
  const seconds = (growth(def.buildTime, def.timeFactor, level) * konakTimeFactor(konakLevel)) / speed;
  return Math.max(1, Math.round(seconds));
}
