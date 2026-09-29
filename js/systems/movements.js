import { UNITS, UNIT_IDS } from '../config/units.js';
import { COMBAT, CATAPULT_TARGETS, MIN_BUILDING_LEVEL } from '../config/combat.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { travelSeconds } from '../core/formulas.js';
import { npcAt, targetAt, distance } from './world.js';
import { barbarianLive, recordBarbarian, recordDamage } from './barbarians.js';
import { resolveBattle, distributeLoot, siegeLevels } from './combat.js';
import { deposit } from './economy.js';
import { provokeLord, recordPlayerAttackOnLord } from './ai.js';
import { applyEnvoys } from './conquest.js';
import { deliverTransport } from './market.js';
import { stationSupport } from './support.js';
import { bonusOf } from './bonus.js';
import { resolveExpedition } from './expedition.js';
import { pvpAttack, pvpSpy } from './pvp.js';
import {
  totalUnits,
  armySpeed,
  armyCarry,
  armyAttack,
  subtractUnits,
  luckFor,
  addReport,
  battlePoints,
  resourceTotal,
  turnBack,
} from './army.js';

// Önceki sürümlerle uyum: bu yardımcılar artık army.js'te.
export { totalUnits, armySpeed, armyCarry, armyAttack, luckFor };

/**
 * Oyuncunun ordu hareketleri. Her hareket çıktığı köyün `movements` listesinde durur:
 *   { id, type: 'saldiri' | 'casus' | 'destek' | 'nakliye' | 'donus', target: { id, name, x, y },
 *     units, loot, departAt, arriveAt, turnAt?, catapultTarget?, resources?, merchants? }
 * Saldırı ve casusluğun hedefi barbar köyü ya da bey hisarıdır. Saldırı hedefe varınca savaş
 * çözülür; yalnız gözcülerden oluşan birlik (casus) savaşmadan köyü gözetler. Sağ kalanlar aynı
 * yoldan geri döner. Destek ve nakliye oyuncunun kendi başka köyüne gider (bkz. support.js ve
 * market.js). `turnAt` dönüşün yolun neresinden başladığıdır (1 = hedeften; geri çağrılanlarda
 * daha az). Yoldaki askerler nüfus kullanmaya devam eder.
 */

const OUTBOUND = new Set(['saldiri', 'casus', 'destek']);

/** Hedefe gitmekte olan (henüz dönmeyen) hareket mi? Geri çağrılabilir. */
export function isOutbound(movement) {
  return OUTBOUND.has(movement.type);
}

/** Saldırı ya da casusluk mu (bir düşman köyüne giden)? */
export function isHostile(movement) {
  return movement.type === 'saldiri' || movement.type === 'casus';
}

function ownVillageAt(state, x, y) {
  return Object.values(state.villages).find((v) => v.x === x && v.y === y) ?? null;
}

/**
 * (x, y)'deki köye birlik gönderilip gönderilemeyeceğini inceler. Hedef oyuncunun başka bir
 * köyüyse birlik destek olarak gider (`mission: 'destek'`); yoksa yalnız gözcülerden oluşan
 * birlik casusluğa (`'casus'`), diğerleri saldırıya (`'saldiri'`) gider.
 * Dönen `code`: 'count' | 'empty' | 'units' | 'target' | 'self' | 'catapult' (ok ise yok)
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
  const bonus = bonusOf(village);
  const seconds = Math.max(1, Math.round(travelSeconds(dist, speed, state.world.speed) * bonus.travel));
  const attack = armyAttack(units, village.tech) * bonus.attack;
  const own = ownVillageAt(state, x, y);
  const info = {
    ok: false,
    units,
    mission: own ? 'destek' : totalUnits(units) > 0 && attack === 0 ? 'casus' : 'saldiri',
    attack,
    carry: armyCarry(units),
    distance: dist,
    seconds,
    arriveAt: now + seconds * 1000,
    catapultTarget: units.mancinik && !own ? (options.catapultTarget ?? 'konak') : null,
  };

  if (!totalUnits(units)) return { ...info, code: 'empty', reason: 'Göndermek için asker seç' };
  const short = Object.keys(units).find((id) => units[id] > village.units[id]);
  if (short) return { ...info, code: 'units', reason: `Köyde yeterli ${UNITS[short].name} yok` };
  if (own) {
    if (own.id === village.id) return { ...info, code: 'self', reason: 'Askerler zaten bu köyde' };
    return { ...info, target: { id: own.id, kind: 'oyuncu', name: own.name, x: own.x, y: own.y }, ok: true };
  }
  const target = targetAt(state, x, y);
  if (!target) return { ...info, code: 'target', reason: 'Burada saldırılabilecek bir köy yok' };
  if (target.kind === 'rakip' && target.protected) {
    return { ...info, target, code: 'protected', reason: `${target.owner} yeni bir oyuncu; koruma süresi bitene kadar saldırılamaz` };
  }
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
  const pvp = target.kind === 'rakip';
  const movement = {
    id: state.nextId++,
    type: check.mission,
    target: { id: target.id, name: target.name, x: target.x, y: target.y, ...(pvp && { kind: 'rakip', owner: target.owner, ownerId: target.ownerId }) },
    units: check.units,
    loot: null,
    departAt: now,
    arriveAt: check.arriveAt,
    ...(check.catapultTarget && { catapultTarget: check.catapultTarget }),
  };
  village.movements.push(movement);
  if (pvp) {
    // Saldıran oyuncunun yeni oyuncu koruması biter; savunan, gelen saldırıyı görür.
    if (state.player) state.player.protectUntil = 0;
    state.peers?.notifyIncoming(target.id, incomingNotice(state, village, movement));
  }
  return { ...check, movement };
}

/** Savunan oyuncunun göreceği gelen saldırı kaydı (ordunun tam dökümü görünmez). */
function incomingNotice(state, village, movement) {
  return {
    id: movement.id,
    pvp: true,
    spy: movement.type === 'casus',
    from: { id: village.id, kind: 'rakip', name: village.name, owner: state.player?.name ?? 'Bey', x: village.x, y: village.y },
    units: movement.type === 'casus' ? { gozcu: movement.units.gozcu } : movement.units,
    tech: village.tech,
    departAt: movement.departAt,
    arriveAt: movement.arriveAt,
  };
}

/**
 * Hedefe giden birliği geri çağırır. Birlik bulunduğu yerden döner; dönüş, o ana kadar yolda
 * geçen süre kadar sürer. Savaş olmaz, rapor yazılmaz.
 */
export function recallAttack(village, movementId, now, state = null) {
  const movement = village.movements.find((m) => m.id === movementId);
  if (!movement) return { ok: false, reason: 'Bu hareket artık yok' };
  if (!isOutbound(movement)) return { ok: false, reason: 'Yalnızca hedefe giden birlikler geri çağrılabilir' };
  if (now >= movement.arriveAt) return { ok: false, reason: 'Birlik hedefe çoktan vardı' };
  if (movement.target.kind === 'rakip') state?.peers?.cancelIncoming(movement.target.id, movement.id);
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
  if (movement.type === 'nakliye') return deliverTransport(state, village, movement);
  if (movement.type === 'destek') return arriveSupport(state, village, movement);
  if (movement.type === 'kesif') return resolveExpedition(state, village, movement);
  if (movement.target.kind === 'rakip') {
    return movement.type === 'casus' ? pvpSpy(state, village, movement) : pvpAttack(state, village, movement);
  }
  const target = npcAt(state, movement.target.x, movement.target.y);
  if (!target) {
    // Hedef artık yok (ör. yanına köy kuruldu): bir şey yapmadan geri dön.
    turnBack(movement, movement.units, null);
    return null;
  }
  return movement.type === 'casus'
    ? spyOn(state, village, movement, target)
    : attack(state, village, movement, target);
}

/** Destek birliği kendi köyüne vardı: orada durur ve köyü savunur. */
function arriveSupport(state, village, movement) {
  const host = state.villages[movement.target.id];
  if (!host) {
    turnBack(movement, movement.units, null);
    return null;
  }
  stationSupport(village, host.id, movement.units);
  village.movements.splice(village.movements.indexOf(movement), 1);
  return { type: 'support-arrived', villageId: village.id, targetId: host.id, target: host.name, units: movement.units, at: movement.arriveAt };
}

function attack(state, village, movement, target) {
  const live = barbarianLive(state, target);
  const battle = resolveBattle({
    attackers: movement.units,
    defenders: live.units,
    wallLevel: target.buildings.sur,
    luck: luckFor(state.world.seed, movement.id),
    attackerTech: village.tech,
    attackerBonus: bonusOf(village).attack,
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

  // Elçiler: bağlılığı düşürür, sıfırlanırsa köy fethedilir (birlikler ve ganimet köyde kalır).
  const afterSiege = {
    ...target.buildings,
    ...(siege.wall && { sur: siege.wall.to }),
    ...(siege.catapult && { [siege.catapult.building]: siege.catapult.to }),
  };
  const conquest = battle.attackerWins ? applyEnvoys(state, village, movement, target, survivors, afterSiege, live.resources) : null;

  if (target.kind === 'bey' && !conquest?.conquered) provokeLord(state, target.id, movement.arriveAt);

  const report = addReport(state, {
    type: 'saldiri',
    at: movement.arriveAt,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: reportTarget(target),
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
    ...(conquest && { conquest }),
    ...(movement.catapultTarget && { catapultTarget: movement.catapultTarget }),
  });
  state.stats.kills += battlePoints(battle.defenderLosses);
  state.stats.loot += resourceTotal(loot);
  state.stats.attacks = (state.stats.attacks ?? 0) + 1;
  if (battle.attackerWins) state.stats.attacksWon = (state.stats.attacksWon ?? 0) + 1;
  if (target.kind === 'bey' && !conquest?.conquered) recordPlayerAttackOnLord(state, report);

  // Fetihte birlikler yeni köyde kalır; aksi halde sağ kalanlar ganimetle döner.
  if (totalUnits(survivors) > 0 && !conquest?.conquered) turnBack(movement, survivors, loot);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return {
    type: 'attack-result',
    villageId: village.id,
    reportId: report.id,
    target: target.name,
    attackerWins: battle.attackerWins,
    loot,
    siege,
    conquest,
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
    target: reportTarget(target),
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

  if (success) state.stats.spies = (state.stats.spies ?? 0) + 1;
  if (scouts - lost > 0) turnBack(movement, { gozcu: scouts - lost }, null);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return { type: 'spy-result', villageId: village.id, reportId: report.id, target: target.name, success, at: movement.arriveAt };
}

/** Rapora yazılan hedef bilgisi; bey hisarlarında sahibinin adı da. */
function reportTarget(target) {
  return {
    id: target.id,
    kind: target.kind,
    name: target.name,
    x: target.x,
    y: target.y,
    points: target.points,
    ...(target.owner && { owner: target.owner }),
  };
}

/** Hareketi dönüşe çevirir: aynı süreyle geri gelir. */
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
