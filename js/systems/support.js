import { UNIT_IDS } from '../config/units.js';
import { travelSeconds } from '../core/formulas.js';
import { distance } from './world.js';
import { armySpeed, totalUnits } from './army.js';

/**
 * Destek: oyuncunun askerleri kendi başka köyünde durup onu savunur.
 *
 * Başka köyde duran askerler geldikleri köyün kaydında tutulur:
 *   village.stationed = { [ev sahibi köy id]: { birim: sayı } }
 * Böylece nüfusları, Elçi hakları ve geri çağrılmaları kendi köylerine bağlı kalır. Ev sahibi
 * köyün savunmasında kendi askerleriyle birlikte sayılırlar ve kayıpları oranla paylaşırlar.
 */

/** `hostId` köyünde duran destek birlikleri: [{ home, units }] */
export function supportAt(state, hostId) {
  const list = [];
  for (const home of Object.values(state.villages)) {
    const units = home.stationed?.[hostId];
    if (units && totalUnits(units) > 0) list.push({ home, units });
  }
  return list;
}

/** Köyü savunan tüm askerler: kendi askerleri + destek. */
export function defendersOf(state, village) {
  const total = {};
  for (const id of UNIT_IDS) if (village.units[id] > 0) total[id] = village.units[id];
  for (const { units } of supportAt(state, village.id)) {
    for (const [id, n] of Object.entries(units)) if (n > 0) total[id] = (total[id] ?? 0) + n;
  }
  return total;
}

/**
 * Savunma kayıplarını köyün kendi askerleri ile destek birlikleri arasında, sayılarıyla orantılı
 * paylaştırır. Yuvarlamadan kalan kayıp önce köyün kendi askerlerine yazılır.
 */
export function applyDefenderLosses(state, village, defenders, losses) {
  const groups = [{ units: village.units }, ...supportAt(state, village.id).map((s) => ({ units: s.units }))];
  for (const [id, lost] of Object.entries(losses)) {
    if (!lost) continue;
    const total = defenders[id];
    let left = lost;
    // Önce destek birliklerinin payı (aşağı yuvarlanır), sonra kalan köyün kendi askerlerinden.
    for (const group of groups.slice(1)) {
      const n = group.units[id] ?? 0;
      if (!n) continue;
      const share = Math.min(n, Math.floor((lost * n) / total));
      group.units[id] = n - share;
      left -= share;
    }
    const own = Math.min(village.units[id], left);
    village.units[id] -= own;
    left -= own;
    for (const group of groups.slice(1)) {
      if (left <= 0) break;
      const take = Math.min(group.units[id] ?? 0, left);
      if (take) group.units[id] -= take;
      left -= take;
    }
  }
  // Tamamen yok olan destek kayıtlarını temizle.
  for (const home of Object.values(state.villages)) {
    const units = home.stationed?.[village.id];
    if (units && totalUnits(units) === 0) delete home.stationed[village.id];
  }
}

/** Köyün başka köylerde duran askerleri: [{ host, units }] */
export function stationedAway(state, home) {
  return Object.entries(home.stationed ?? {})
    .filter(([, units]) => totalUnits(units) > 0)
    .map(([hostId, units]) => ({ host: state.villages[hostId], hostId, units }));
}

/** Destek birliği ev sahibi köye yerleşir. */
export function stationSupport(home, hostId, units) {
  home.stationed ??= {};
  const entry = (home.stationed[hostId] ??= {});
  for (const [id, n] of Object.entries(units)) if (n > 0) entry[id] = (entry[id] ?? 0) + n;
}

/**
 * `home` köyünün `hostId` köyünde duran askerlerini eve çağırır. Askerler ev sahibi köyden
 * yola çıkar; yolculuk en yavaş birimin hızıyla sürer.
 */
export function withdrawSupport(state, home, hostId, now) {
  const units = home.stationed?.[hostId];
  const host = state.villages[hostId];
  if (!units || !totalUnits(units) || !host) return { ok: false, reason: 'Bu köyde destek askerin yok' };
  const moving = Object.fromEntries(Object.entries(units).filter(([, n]) => n > 0));
  delete home.stationed[hostId];
  const seconds = Math.max(1, travelSeconds(distance(host.x, host.y, home.x, home.y), armySpeed(moving), state.world.speed));
  const movement = {
    id: state.nextId++,
    type: 'donus',
    target: { id: host.id, name: host.name, x: host.x, y: host.y },
    units: moving,
    loot: null,
    turnAt: 1,
    departAt: now,
    arriveAt: now + seconds * 1000,
  };
  home.movements.push(movement);
  return { ok: true, movement, home, host };
}
