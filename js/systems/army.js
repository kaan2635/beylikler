import { UNITS } from '../config/units.js';
import { COMBAT } from '../config/combat.js';
import { LORD } from '../config/lords.js';
import { hash3, mulberry32 } from '../core/random.js';
import { techMultiplier } from './research.js';

// Ordu hesapları: hem oyuncunun hareketleri hem de rakip beylerin saldırıları kullanır.

const LUCK_SALT = 0x3c6ef372;

export function totalUnits(units) {
  return Object.values(units).reduce((total, n) => total + n, 0);
}

/** Ordu en yavaş biriminin hızıyla ilerler (dakika / alan). */
export function armySpeed(units) {
  return Math.max(0, ...Object.entries(units).filter(([, n]) => n > 0).map(([id]) => UNITS[id].speed));
}

export function armyCarry(units) {
  return Object.entries(units).reduce((total, [id, n]) => total + n * UNITS[id].carry, 0);
}

/** Ordunun toplam saldırı gücü; `tech` verilirse Demirci geliştirmeleri dahil. */
export function armyAttack(units, tech = {}) {
  return Object.entries(units).reduce((total, [id, n]) => total + n * UNITS[id].attack * techMultiplier(tech[id]), 0);
}

export function subtractUnits(units, losses) {
  const result = {};
  for (const [id, n] of Object.entries(units)) result[id] = n - (losses[id] ?? 0);
  return result;
}

/** Savaş şansı tohumdan ve hareket numarasından gelir: aynı kayıt hep aynı sonucu verir. */
export function luckFor(seed, movementId) {
  const roll = mulberry32(hash3(seed ^ LUCK_SALT, movementId, 0))();
  return (roll * 2 - 1) * COMBAT.luckRange;
}

/** Savaş puanı: öldürülen askerlerin nüfus değeri (Sipahi 6, Yaya 1…). Sıralamada kullanılır. */
export function battlePoints(units) {
  return Object.entries(units).reduce((total, [id, n]) => total + n * UNITS[id].pop, 0);
}

export function resourceTotal(resources) {
  return Object.values(resources).reduce((total, n) => total + n, 0);
}

/** Dünya olaylarına (Sıralama sayfasındaki haber akışı) bir satır ekler. */
export function addNews(state, at, text) {
  state.news.unshift({ at, text });
  state.news.length = Math.min(state.news.length, LORD.newsMax);
}

/** Raporu en başa ekler; en fazla COMBAT.maxReports rapor saklanır. */
export function addReport(state, fields) {
  const report = { id: state.nextId++, read: false, ...fields };
  state.reports.unshift(report);
  state.reports.length = Math.min(state.reports.length, COMBAT.maxReports);
  return report;
}
