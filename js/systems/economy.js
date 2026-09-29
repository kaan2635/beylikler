import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { BUILDINGS, BUILDING_IDS } from '../config/buildings.js';
import { UNITS, UNIT_IDS } from '../config/units.js';
import {
  productionPerHour,
  storageCapacity,
  populationCapacity,
  buildingPopulation,
} from '../core/formulas.js';
import { plannedLevel } from '../core/village.js';

const HOUR = 3_600_000;

/** Kaynak başına saatlik üretim. */
export function productionRates(village, world) {
  const rates = {};
  for (const id of RESOURCE_IDS) {
    rates[id] = productionPerHour(village.buildings[RESOURCES[id].producer], world.speed);
  }
  return rates;
}

export function storageCap(village) {
  return storageCapacity(village.buildings.ambar);
}

export function populationCap(village) {
  return populationCapacity(village.buildings.ciftlik);
}

/**
 * Kullanılan nüfus: binalar + askerler. Kuyruktaki işler de sayılır (binalar hedef
 * seviyeleriyle, eğitimdeki askerler henüz yetişmemiş olanlarıyla); yani yer önceden ayrılır.
 */
export function populationUsed(village) {
  let used = 0;
  for (const id of BUILDING_IDS) used += buildingPopulation(BUILDINGS[id], plannedLevel(village, id));
  for (const id of UNIT_IDS) used += village.units[id] * UNITS[id].pop;
  for (const queue of Object.values(village.trainQueues)) {
    for (const batch of queue) used += (batch.count - batch.trained) * UNITS[batch.unit].pop;
  }
  return used;
}

/**
 * Kaynakları `until` anına kadar üretir. Bu aralıkta oranların sabit olduğu varsayılır;
 * bu yüzden motor, oranları değiştiren her olaydan önce bu fonksiyonu çağırır.
 */
export function produce(village, world, until) {
  const hours = (until - village.lastUpdate) / HOUR;
  if (hours <= 0) return;
  const cap = storageCap(village);
  const rates = productionRates(village, world);
  for (const id of RESOURCE_IDS) {
    const current = village.resources[id];
    if (current < cap) village.resources[id] = Math.min(cap, current + rates[id] * hours);
  }
  village.lastUpdate = until;
}

export function canAfford(village, cost) {
  return Object.entries(cost).every(([id, amount]) => village.resources[id] >= amount);
}

export function spend(village, cost) {
  for (const [id, amount] of Object.entries(cost)) village.resources[id] -= amount;
}

/** İade ambar sınırını aşabilir; fazlası harcanana kadar korunur, o sırada üretim durur. */
export function refund(village, cost) {
  for (const [id, amount] of Object.entries(cost)) village.resources[id] += amount;
}

/**
 * Mevcut üretimle maliyetin kaç ms sonra karşılanacağı.
 * 0: şimdi yeterli. Infinity: ambar bu maliyeti hiç alamaz.
 */
export function timeUntilAffordable(village, world, cost) {
  const cap = storageCap(village);
  const rates = productionRates(village, world);
  let wait = 0;
  for (const [id, amount] of Object.entries(cost)) {
    const missing = amount - village.resources[id];
    if (missing <= 0) continue;
    if (amount > cap || rates[id] <= 0) return Infinity;
    wait = Math.max(wait, (missing / rates[id]) * HOUR);
  }
  return Math.ceil(wait);
}
