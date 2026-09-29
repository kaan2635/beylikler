import { UNITS, UNIT_IDS } from '../config/units.js';
import { COMBAT } from '../config/combat.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { travelSeconds } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { barbarianAt, distance } from './world.js';
import { barbarianLive, recordBarbarian } from './barbarians.js';
import { resolveBattle, distributeLoot } from './combat.js';
import { deposit } from './economy.js';

/**
 * Ordu hareketleri. Her hareket çıktığı köyün `movements` listesinde durur:
 *   { id, type: 'saldiri' | 'donus', target: { id, name, x, y }, units, loot, departAt, arriveAt }
 * Saldırı hedefe varınca savaş çözülür; sağ kalanlar aynı yoldan ganimetle geri döner.
 * Yoldaki askerler nüfus kullanmaya devam eder.
 */

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

export function armyAttack(units) {
  return Object.entries(units).reduce((total, [id, n]) => total + n * UNITS[id].attack, 0);
}

function subtractUnits(units, losses) {
  const result = {};
  for (const [id, n] of Object.entries(units)) result[id] = n - (losses[id] ?? 0);
  return result;
}

/** Saldırı şansı tohumdan ve hareket numarasından gelir: aynı kayıt hep aynı sonucu verir. */
export function luckFor(seed, movementId) {
  const roll = mulberry32(hash3(seed ^ LUCK_SALT, movementId, 0))();
  return (roll * 2 - 1) * COMBAT.luckRange;
}

/**
 * (x, y)'deki köye saldırı gönderilip gönderilemeyeceğini inceler.
 * Dönen `code`: 'count' | 'empty' | 'units' | 'target' | 'scouts' (ok ise yok)
 */
export function inspectAttack(state, village, x, y, requested, now) {
  const units = {};
  for (const id of UNIT_IDS) {
    const n = requested[id] ?? 0;
    if (!Number.isInteger(n) || n < 0) return { ok: false, code: 'count', reason: 'Asker sayıları 0 ya da pozitif tam sayı olmalı', units: {} };
    if (n > 0) units[id] = n;
  }
  const speed = armySpeed(units);
  const dist = distance(village.x, village.y, x, y);
  const seconds = Math.max(1, travelSeconds(dist, speed, state.world.speed));
  const info = {
    ok: false,
    units,
    attack: armyAttack(units),
    carry: armyCarry(units),
    distance: dist,
    seconds,
    arriveAt: now + seconds * 1000,
  };

  if (!totalUnits(units)) return { ...info, code: 'empty', reason: 'Göndermek için asker seç' };
  const short = Object.keys(units).find((id) => units[id] > village.units[id]);
  if (short) return { ...info, code: 'units', reason: `Köyde yeterli ${UNITS[short].name} yok` };
  const target = barbarianAt(state, x, y);
  if (!target) return { ...info, code: 'target', reason: 'Burada saldırılabilecek bir köy yok' };
  if (info.attack === 0) {
    return { ...info, target, code: 'scouts', reason: 'Gözcüler tek başına saldıramaz; casusluk sonraki adımlarda eklenecek' };
  }
  return { ...info, target, ok: true };
}

/** Saldırıyı başlatır: askerler köyden çıkar ve hareket listeye eklenir. */
export function sendAttack(state, village, x, y, requested, now) {
  const check = inspectAttack(state, village, x, y, requested, now);
  if (!check.ok) return check;
  for (const [id, n] of Object.entries(check.units)) village.units[id] -= n;
  const { target } = check;
  const movement = {
    id: state.nextId++,
    type: 'saldiri',
    target: { id: target.id, name: target.name, x: target.x, y: target.y },
    units: check.units,
    loot: null,
    departAt: now,
    arriveAt: check.arriveAt,
  };
  village.movements.push(movement);
  return { ...check, movement };
}

/** Hareketin varış anında olanları uygular ve olayını döndürür. Motor zaman sırasıyla çağırır. */
export function completeMovement(state, village, movement) {
  return movement.type === 'saldiri' ? arriveAtTarget(state, village, movement) : arriveHome(village, movement);
}

function arriveAtTarget(state, village, movement) {
  const target = barbarianAt(state, movement.target.x, movement.target.y);
  if (!target) {
    // Hedef artık yok (ör. yanına köy kuruldu): savaşmadan geri dön.
    turnBack(movement, movement.units, null);
    return null;
  }

  const live = barbarianLive(state, target);
  const battle = resolveBattle({
    attackers: movement.units,
    defenders: live.units,
    wallLevel: target.buildings.sur,
    luck: luckFor(state.world.seed, movement.id),
  });
  const survivors = subtractUnits(movement.units, battle.attackerLosses);
  const available = {};
  for (const id of RESOURCE_IDS) available[id] = Math.max(0, live.resources[id] - live.hidden);
  const loot = battle.attackerWins
    ? distributeLoot(available, armyCarry(survivors))
    : Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));

  const leftResources = {};
  for (const id of RESOURCE_IDS) leftResources[id] = live.resources[id] - loot[id];
  recordBarbarian(state, target, subtractUnits(live.units, battle.defenderLosses), leftResources);

  const report = {
    id: state.nextId++,
    type: 'saldiri',
    at: movement.arriveAt,
    read: false,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: { id: target.id, name: target.name, x: target.x, y: target.y, points: target.points },
    attackerWins: battle.attackerWins,
    luck: battle.luck,
    wallLevel: target.buildings.sur,
    attack: Math.round(battle.attack),
    defense: Math.round(battle.defense),
    attackers: movement.units,
    attackerLosses: battle.attackerLosses,
    defenders: live.units,
    defenderLosses: battle.defenderLosses,
    loot,
  };
  state.reports.unshift(report);
  state.reports.length = Math.min(state.reports.length, COMBAT.maxReports);

  if (totalUnits(survivors) > 0) turnBack(movement, survivors, loot);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return {
    type: 'attack-result',
    villageId: village.id,
    reportId: report.id,
    target: target.name,
    attackerWins: battle.attackerWins,
    loot,
    at: movement.arriveAt,
  };
}

/** Saldırıyı dönüşe çevirir: aynı süreyle geri gelir. */
function turnBack(movement, units, loot) {
  const duration = movement.arriveAt - movement.departAt;
  Object.assign(movement, {
    type: 'donus',
    units,
    loot,
    departAt: movement.arriveAt,
    arriveAt: movement.arriveAt + duration,
  });
}

function arriveHome(village, movement) {
  for (const [id, n] of Object.entries(movement.units)) village.units[id] += n;
  const stored = deposit(village, movement.loot ?? {});
  village.movements.splice(village.movements.indexOf(movement), 1);
  return {
    type: 'return',
    villageId: village.id,
    target: movement.target.name,
    units: movement.units,
    loot: movement.loot,
    stored,
    at: movement.arriveAt,
  };
}
