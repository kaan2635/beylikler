import { RESEARCH } from '../config/tech.js';
import { BUILDINGS } from '../config/buildings.js';
import { UNITS } from '../config/units.js';
import { trainingTimeFactor } from '../core/formulas.js';
import { canAfford, spend, refund, timeUntilAffordable } from './economy.js';

/**
 * Demirci geliştirmeleri. Her asker türü 0..3 seviye geliştirilebilir; köyün geliştirme
 * seviyeleri `village.tech`, süren geliştirme `village.research` alanındadır:
 *   { unit, level, cost, startAt, endAt }
 * Demircide aynı anda tek geliştirme yapılır.
 */

/** Geliştirme seviyesinin saldırı ve savunma çarpanı: 0 → 1, 3 → 1,3. */
export function techMultiplier(level = 0) {
  return 1 + RESEARCH.bonusPerLevel * level;
}

export function researchCost(unit, level) {
  const cost = {};
  for (const [id, amount] of Object.entries(unit.cost)) cost[id] = amount * RESEARCH.costMultiplier * level;
  return cost;
}

/** Geliştirme süresi (saniye); Demirci seviyesi kısaltır. */
export function researchDuration(unit, level, smithyLevel, speed = 1) {
  const seconds = (unit.trainTime * RESEARCH.timeMultiplier * level * trainingTimeFactor(smithyLevel)) / speed;
  return Math.max(1, Math.round(seconds));
}

/**
 * Birimin bir sonraki seviyesinin geliştirilip geliştirilemeyeceğini inceler.
 * Dönen `code`: 'max' | 'busy' | 'requires' | 'storage' | 'resources' (ok ise yok)
 */
export function inspectResearch(village, world, unitId, now) {
  const unit = UNITS[unitId];
  const current = village.tech[unitId];
  if (current >= RESEARCH.maxLevel) return { ok: false, code: 'max', reason: 'En yüksek seviyede', level: current };

  const level = current + 1;
  const info = {
    ok: false,
    level,
    cost: researchCost(unit, level),
    duration: researchDuration(unit, level, village.buildings.demirci, world.speed),
  };

  const needs = { ...unit.requires, demirci: RESEARCH.smithyLevelFor[level] };
  const missing = Object.entries(needs).filter(([id, lvl]) => village.buildings[id] < lvl);
  if (missing.length) {
    return { ...info, code: 'requires', reason: `Gerekli: ${missing.map(([id, lvl]) => `${BUILDINGS[id].name} ${lvl}. seviye`).join(', ')}` };
  }
  if (village.research) return { ...info, code: 'busy', reason: 'Demircide başka bir geliştirme sürüyor' };
  if (!canAfford(village, info.cost)) {
    const wait = timeUntilAffordable(village, world, info.cost);
    return wait === Infinity
      ? { ...info, code: 'storage', reason: 'Ambar bu maliyet için çok küçük' }
      : { ...info, code: 'resources', reason: 'Yetersiz kaynak', readyAt: now + wait };
  }
  return { ...info, ok: true };
}

export function startResearch(village, world, unitId, now) {
  const check = inspectResearch(village, world, unitId, now);
  if (!check.ok) return check;
  spend(village, check.cost);
  village.research = { unit: unitId, level: check.level, cost: check.cost, startAt: now, endAt: now + check.duration * 1000 };
  return check;
}

/** Süren geliştirmeyi iptal eder; maliyetin tamamı iade edilir. */
export function cancelResearch(village) {
  const research = village.research;
  if (!research) return null;
  refund(village, research.cost);
  village.research = null;
  return research;
}

/** Süren geliştirmeyi tamamlar ve olayını döndürür. Motor bitiş anında çağırır. */
export function completeResearch(village) {
  const { unit, level, endAt } = village.research;
  village.tech[unit] = level;
  village.research = null;
  return { type: 'research-complete', villageId: village.id, unit, level, at: endAt };
}
