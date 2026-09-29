import { GAME } from '../config/game.js';
import { BUILDINGS } from '../config/buildings.js';
import { upgradeCost, buildDuration, buildingPopulation } from '../core/formulas.js';
import { plannedLevel } from '../core/village.js';
import {
  canAfford,
  spend,
  refund,
  populationCap,
  populationUsed,
  timeUntilAffordable,
} from './economy.js';

/**
 * Binanın bir sonraki seviyesine yükseltilip yükseltilemeyeceğini inceler.
 * Arayüz bu sonucu doğrudan gösterir; startUpgrade de aynı kontrolü kullanır.
 *
 * Dönen `code`: 'max' | 'requires' | 'queue' | 'population' | 'storage' | 'resources' (ok ise yok)
 */
export function inspectUpgrade(village, world, buildingId, now) {
  const def = BUILDINGS[buildingId];
  const current = plannedLevel(village, buildingId);
  if (current >= def.maxLevel) {
    return { ok: false, code: 'max', reason: 'Azami seviyeye ulaşıldı', level: current };
  }

  const level = current + 1;
  const info = {
    ok: false,
    level,
    cost: upgradeCost(def, level),
    duration: buildDuration(def, level, village.buildings.konak, world.speed),
    popDelta: buildingPopulation(def, level) - buildingPopulation(def, current),
  };

  const missing = Object.entries(def.requires).filter(([id, lvl]) => (village.buildings[id] ?? 0) < lvl);
  if (missing.length) {
    const list = missing.map(([id, lvl]) => `${BUILDINGS[id].name} ${lvl}. seviye`).join(', ');
    return { ...info, code: 'requires', reason: `Gerekli: ${list}` };
  }
  if (village.buildQueue.length >= GAME.maxBuildQueue) {
    return { ...info, code: 'queue', reason: 'İnşaat kuyruğu dolu' };
  }
  // Nüfus kullanmayan binalar (Çiftlik, Ambar) nüfus dolu olsa da yapılabilmeli, yoksa oyun kilitlenir.
  if (info.popDelta > 0 && populationUsed(village) + info.popDelta > populationCap(village)) {
    return { ...info, code: 'population', reason: 'Nüfus yetersiz: Çiftliği yükselt' };
  }
  if (!canAfford(village, info.cost)) {
    const wait = timeUntilAffordable(village, world, info.cost);
    return wait === Infinity
      ? { ...info, code: 'storage', reason: 'Ambar bu maliyet için çok küçük' }
      : { ...info, code: 'resources', reason: 'Yetersiz kaynak', readyAt: now + wait };
  }
  return { ...info, ok: true };
}

/** Yükseltmeyi başlatır: kaynağı düşer ve işi kuyruğun sonuna ekler. */
export function startUpgrade(village, world, buildingId, now) {
  const check = inspectUpgrade(village, world, buildingId, now);
  if (!check.ok) return check;
  spend(village, check.cost);
  const last = village.buildQueue.at(-1);
  const startAt = last ? last.endAt : now;
  village.buildQueue.push({
    building: buildingId,
    level: check.level,
    cost: check.cost,
    startAt,
    endAt: startAt + check.duration * 1000,
  });
  return check;
}

/** Yalnızca kuyruğun son işi iptal edilebilir; maliyetin tamamı iade edilir. */
export function cancelLastUpgrade(village) {
  const job = village.buildQueue.pop();
  if (!job) return null;
  refund(village, job.cost);
  return job;
}

/** Kuyruğun ilk işini tamamlar ve olayını döndürür. */
export function completeNextUpgrade(village) {
  const job = village.buildQueue.shift();
  village.buildings[job.building] = job.level;
  return { type: 'build-complete', villageId: village.id, building: job.building, level: job.level, at: job.endAt };
}
