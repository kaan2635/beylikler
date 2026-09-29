import { GAME } from '../config/game.js';
import { BUILDINGS } from '../config/buildings.js';
import { UNITS } from '../config/units.js';
import { trainDuration } from '../core/formulas.js';
import {
  canAfford,
  spend,
  refund,
  populationCap,
  populationUsed,
  timeUntilAffordable,
} from './economy.js';

/**
 * Asker eğitimi. Her eğitim binasının (Kışla, Ahır, Atölye) ayrı bir kuyruğu vardır.
 * Kuyruktaki her kayıt bir "parti"dir: aynı türden `count` asker, birer birer yetişir.
 *   { unit, count, trained, unitMs, startAt, endAt }
 * Maliyet ve nüfus eğitime başlarken partinin tamamı için ayrılır.
 */

/** Bir birimin eğitim şartlarından eksik olanları metin olarak döndürür (yoksa null). */
export function missingUnitRequirements(village, unitId) {
  const missing = Object.entries(UNITS[unitId].requires).filter(([id, lvl]) => village.buildings[id] < lvl);
  if (!missing.length) return null;
  return `Gerekli: ${missing.map(([id, lvl]) => `${BUILDINGS[id].name} ${lvl}. seviye`).join(', ')}`;
}

export function totalCost(unit, count) {
  const cost = {};
  for (const [resource, amount] of Object.entries(unit.cost)) cost[resource] = amount * count;
  return cost;
}

/** Kaynak ve boş nüfusla şu an en fazla kaç birim eğitilebileceği. */
export function maxTrainable(village, unitId) {
  const unit = UNITS[unitId];
  if (missingUnitRequirements(village, unitId)) return 0;
  let max = Math.floor((populationCap(village) - populationUsed(village)) / unit.pop);
  for (const [resource, amount] of Object.entries(unit.cost)) {
    max = Math.min(max, Math.floor(village.resources[resource] / amount));
  }
  return Math.max(0, Math.min(max, GAME.maxTrainBatch));
}

/**
 * `count` adet birimin eğitilip eğitilemeyeceğini inceler.
 * Dönen `code`: 'count' | 'requires' | 'queue' | 'population' | 'storage' | 'resources' (ok ise yok)
 */
export function inspectTraining(village, world, unitId, count, now) {
  const unit = UNITS[unitId];
  const unitSeconds = trainDuration(unit, village.buildings[unit.building], world.speed);
  const valid = Number.isInteger(count) && count >= 1 && count <= GAME.maxTrainBatch;
  const n = valid ? count : 1;
  const info = {
    ok: false,
    count: n,
    cost: totalCost(unit, n),
    unitSeconds,
    duration: unitSeconds * n,
    popNeeded: unit.pop * n,
  };

  if (!valid) return { ...info, code: 'count', reason: `1 ile ${GAME.maxTrainBatch} arasında bir sayı gir` };
  const missing = missingUnitRequirements(village, unitId);
  if (missing) return { ...info, code: 'requires', reason: missing };
  if (village.trainQueues[unit.building].length >= GAME.maxTrainQueue) {
    return { ...info, code: 'queue', reason: `${BUILDINGS[unit.building].name} kuyruğu dolu` };
  }
  if (populationUsed(village) + info.popNeeded > populationCap(village)) {
    return { ...info, code: 'population', reason: 'Nüfus yetersiz: Çiftliği yükselt' };
  }
  if (!canAfford(village, info.cost)) {
    const wait = timeUntilAffordable(village, world, info.cost);
    return wait === Infinity
      ? { ...info, code: 'storage', reason: 'Ambar bu miktar için çok küçük' }
      : { ...info, code: 'resources', reason: 'Yetersiz kaynak', readyAt: now + wait };
  }
  return { ...info, ok: true };
}

/** Eğitimi başlatır: kaynağı düşer ve partiyi binanın kuyruğunun sonuna ekler. */
export function startTraining(village, world, unitId, count, now) {
  const check = inspectTraining(village, world, unitId, count, now);
  if (!check.ok) return check;
  spend(village, check.cost);
  const queue = village.trainQueues[UNITS[unitId].building];
  const last = queue.at(-1);
  const startAt = last ? last.endAt : now;
  const unitMs = check.unitSeconds * 1000;
  queue.push({ unit: unitId, count, trained: 0, unitMs, startAt, endAt: startAt + unitMs * count });
  return check;
}

/** Sıradaki birimin yetişeceği an. */
export function nextUnitAt(batch) {
  return batch.startAt + (batch.trained + 1) * batch.unitMs;
}

/**
 * Binanın kuyruğundaki ilk partiden bir birimi yetiştirir.
 * Parti tamamlandıysa kuyruktan çıkarır ve bir olay döndürür; aksi halde null.
 */
export function completeNextUnit(village, buildingId) {
  const queue = village.trainQueues[buildingId];
  const batch = queue[0];
  batch.trained += 1;
  village.units[batch.unit] += 1;
  if (batch.trained < batch.count) return null;
  queue.shift();
  return { type: 'train-complete', villageId: village.id, unit: batch.unit, count: batch.count, at: batch.endAt };
}

/**
 * Binanın kuyruğundaki son partiyi iptal eder. Henüz yetişmemiş birimlerin maliyeti
 * tamamen iade edilir; yetişmiş olanlar köyde kalır.
 */
export function cancelLastTraining(village, buildingId) {
  const batch = village.trainQueues[buildingId].pop();
  if (!batch) return null;
  const remaining = batch.count - batch.trained;
  refund(village, totalCost(UNITS[batch.unit], remaining));
  return { ...batch, remaining };
}
