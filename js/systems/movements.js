import { UNITS, UNIT_IDS } from '../config/units.js';
import { COMBAT, CATAPULT_TARGETS, MIN_BUILDING_LEVEL } from '../config/combat.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { travelSeconds } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { barbarianAt, distance } from './world.js';
import { barbarianLive, recordBarbarian, recordDamage } from './barbarians.js';
import { resolveBattle, distributeLoot, siegeLevels } from './combat.js';
import { deposit } from './economy.js';
import { techMultiplier } from './research.js';

/**
 * Ordu hareketleri. Her hareket çıktığı köyün `movements` listesinde durur:
 *   { id, type: 'saldiri' | 'casus' | 'donus', target: { id, name, x, y }, units, loot,
 *     departAt, arriveAt, turnAt?, catapultTarget? }
 * Saldırı hedefe varınca savaş çözülür; yalnız gözcülerden oluşan birlik (casus) savaşmadan
 * köyü gözetler. Sağ kalanlar aynı yoldan geri döner. `turnAt` dönüşün yolun neresinden
 * başladığıdır (1 = hedeften; geri çağrılanlarda daha az). Yoldaki askerler nüfus kullanmaya
 * devam eder.
 */

const LUCK_SALT = 0x3c6ef372;
const OUTBOUND = new Set(['saldiri', 'casus']);

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

/** Hedefe gitmekte olan (henüz dönmeyen) hareket mi? */
export function isOutbound(movement) {
  return OUTBOUND.has(movement.type);
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
 * (x, y)'deki köye birlik gönderilip gönderilemeyeceğini inceler. Yalnız gözcülerden oluşan
 * birlik casusluğa (`mission: 'casus'`), diğerleri saldırıya gider.
 * Dönen `code`: 'count' | 'empty' | 'units' | 'target' | 'catapult' (ok ise yok)
 */
export function inspectAttack(state, village, x, y, requested, now, options = {}) {
  const units = {};
  for (const id of UNIT_IDS) {
    const n = requested[id] ?? 0;
    if (!Number.isInteger(n) || n < 0) return { ok: false, code: 'count', reason: 'Asker sayıları 0 ya da pozitif tam sayı olmalı', units: {} };
    if (n > 0) units[id] = n;
  }
  const speed = armySpeed(units);
  const dist = distance(village.x, village.y, x, y);
  const seconds = Math.max(1, travelSeconds(dist, speed, state.world.speed));
  const attack = armyAttack(units, village.tech);
  const info = {
    ok: false,
    units,
    mission: totalUnits(units) > 0 && attack === 0 ? 'casus' : 'saldiri',
    attack,
    carry: armyCarry(units),
    distance: dist,
    seconds,
    arriveAt: now + seconds * 1000,
    catapultTarget: units.mancinik ? (options.catapultTarget ?? 'konak') : null,
  };

  if (!totalUnits(units)) return { ...info, code: 'empty', reason: 'Göndermek için asker seç' };
  const short = Object.keys(units).find((id) => units[id] > village.units[id]);
  if (short) return { ...info, code: 'units', reason: `Köyde yeterli ${UNITS[short].name} yok` };
  const target = barbarianAt(state, x, y);
  if (!target) return { ...info, code: 'target', reason: 'Burada saldırılabilecek bir köy yok' };
  if (info.catapultTarget && !CATAPULT_TARGETS.includes(info.catapultTarget)) {
    return { ...info, target, code: 'catapult', reason: 'Mancınık için geçerli bir hedef bina seç' };
  }
  return { ...info, target, ok: true };
}

/** Birliği yola çıkarır: askerler köyden ayrılır ve hareket listeye eklenir. */
export function sendAttack(state, village, x, y, requested, now, options = {}) {
  const check = inspectAttack(state, village, x, y, requested, now, options);
  if (!check.ok) return check;
  for (const [id, n] of Object.entries(check.units)) village.units[id] -= n;
  const { target } = check;
  const movement = {
    id: state.nextId++,
    type: check.mission,
    target: { id: target.id, name: target.name, x: target.x, y: target.y },
    units: check.units,
    loot: null,
    departAt: now,
    arriveAt: check.arriveAt,
    ...(check.catapultTarget && { catapultTarget: check.catapultTarget }),
  };
  village.movements.push(movement);
  return { ...check, movement };
}

/**
 * Hedefe giden birliği geri çağırır. Birlik bulunduğu yerden döner; dönüş, o ana kadar yolda
 * geçen süre kadar sürer. Savaş olmaz, rapor yazılmaz.
 */
export function recallAttack(village, movementId, now) {
  const movement = village.movements.find((m) => m.id === movementId);
  if (!movement) return { ok: false, reason: 'Bu hareket artık yok' };
  if (!isOutbound(movement)) return { ok: false, reason: 'Yalnızca hedefe giden birlikler geri çağrılabilir' };
  if (now >= movement.arriveAt) return { ok: false, reason: 'Birlik hedefe çoktan vardı' };
  const elapsed = Math.max(0, now - movement.departAt);
  Object.assign(movement, {
    type: 'donus',
    loot: null,
    turnAt: elapsed / (movement.arriveAt - movement.departAt),
    departAt: now,
    arriveAt: now + elapsed,
  });
  return { ok: true, movement };
}

/** Hareketin varış anında olanları uygular ve olayını döndürür. Motor zaman sırasıyla çağırır. */
export function completeMovement(state, village, movement) {
  if (movement.type === 'donus') return arriveHome(village, movement);
  const target = barbarianAt(state, movement.target.x, movement.target.y);
  if (!target) {
    // Hedef artık yok (ör. yanına köy kuruldu): bir şey yapmadan geri dön.
    turnBack(movement, movement.units, null);
    return null;
  }
  return movement.type === 'casus'
    ? spyOn(state, village, movement, target)
    : attack(state, village, movement, target);
}

function attack(state, village, movement, target) {
  const live = barbarianLive(state, target);
  const battle = resolveBattle({
    attackers: movement.units,
    defenders: live.units,
    wallLevel: target.buildings.sur,
    luck: luckFor(state.world.seed, movement.id),
    attackerTech: village.tech,
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
  const siege = battle.attackerWins ? besiege(state, target, survivors, movement.catapultTarget) : {};

  const report = addReport(state, {
    type: 'saldiri',
    at: movement.arriveAt,
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
    siege,
    ...(movement.catapultTarget && { catapultTarget: movement.catapultTarget }),
  });

  if (totalUnits(survivors) > 0) turnBack(movement, survivors, loot);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return {
    type: 'attack-result',
    villageId: village.id,
    reportId: report.id,
    target: target.name,
    attackerWins: battle.attackerWins,
    loot,
    siege,
    at: movement.arriveAt,
  };
}

/**
 * Kazanılan savaştan sonra sağ kalan koçbaşılar suru, mancınıklar seçilen binayı yıkar.
 * Yıkım barbar köyüne yazılır; köy onu zamanla onarır.
 */
function besiege(state, target, survivors, catapultTarget) {
  const siege = {};
  if (survivors.kocbasi) {
    const from = target.buildings.sur;
    const down = siegeLevels(survivors.kocbasi, from, COMBAT.ramsPerLevel);
    if (down) recordDamage(state, target.id, 'sur', down);
    siege.wall = { from, to: from - down };
  }
  if (survivors.mancinik && catapultTarget) {
    const from = target.buildings[catapultTarget];
    const down = siegeLevels(survivors.mancinik, from, COMBAT.catapultsPerLevel, MIN_BUILDING_LEVEL[catapultTarget] ?? 0);
    if (down) recordDamage(state, target.id, catapultTarget, down);
    siege.catapult = { building: catapultTarget, from, to: from - down };
  }
  return siege;
}

/**
 * Casusluk: saldıran gözcüler savunan gözcülerden fazlaysa köyün askerlerini, kaynaklarını ve
 * binalarını görür; kayıp oranı (savunan / saldıran) ^ 1.5 olur. Azsa tüm gözcüler yakalanır.
 */
function spyOn(state, village, movement, target) {
  const live = barbarianLive(state, target);
  const scouts = movement.units.gozcu;
  const guards = live.units.gozcu ?? 0;
  const success = scouts > guards;
  const lost = success ? Math.min(scouts, Math.round(scouts * (guards / scouts) ** COMBAT.lossExponent)) : scouts;
  const noLoot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));

  const report = addReport(state, {
    type: 'casus',
    at: movement.arriveAt,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: { id: target.id, name: target.name, x: target.x, y: target.y, points: target.points },
    attackerWins: success,
    attackers: movement.units,
    attackerLosses: { gozcu: lost },
    defenders: { gozcu: guards },
    defenderLosses: {},
    loot: noLoot,
    intel: success
      ? {
          units: live.units,
          resources: Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.floor(live.resources[id])])),
          hidden: live.hidden,
          buildings: { ...target.buildings },
        }
      : null,
  });

  if (scouts - lost > 0) turnBack(movement, { gozcu: scouts - lost }, null);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return { type: 'spy-result', villageId: village.id, reportId: report.id, target: target.name, success, at: movement.arriveAt };
}

function addReport(state, fields) {
  const report = { id: state.nextId++, read: false, ...fields };
  state.reports.unshift(report);
  state.reports.length = Math.min(state.reports.length, COMBAT.maxReports);
  return report;
}

/** Hareketi dönüşe çevirir: aynı süreyle geri gelir. */
function turnBack(movement, units, loot) {
  const duration = movement.arriveAt - movement.departAt;
  Object.assign(movement, {
    type: 'donus',
    units,
    loot,
    turnAt: 1,
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
