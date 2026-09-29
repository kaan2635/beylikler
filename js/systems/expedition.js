import { EXPEDITION, EXPEDITION_TEXTS } from '../config/expedition.js';
import { UNITS, UNIT_IDS } from '../config/units.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { WORLD } from '../config/world.js';
import { travelSeconds } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { bonusOf } from './bonus.js';
import { grantAkce } from './premium.js';
import { worldDays } from './world.js';
import { resolveBattle } from './combat.js';
import { totalUnits, armySpeed, armyCarry, armyAttack, subtractUnits, addReport, battlePoints } from './army.js';

/**
 * Keşif seferleri. Birlik haritanın kenarındaki bilinmeyen topraklara gider (EXPEDITION.distance
 * alan), seçilen süre kadar oraları dolaşır, sonra bir sonuç belirlenir (tohumdan): kaynak,
 * paralı asker, Akçe, gecikme, erken dönüş, eşkıya pususu ya da kaybolma. Sağ kalanlar
 * bulduklarıyla aynı yoldan döner.
 *
 * Sefer bir ordu hareketidir: { type: 'kesif', mission: 'kesif', holdHours, exploreAt, … }
 * Dönüşte type 'donus' olur ama mission 'kesif' kalır; sefer hakkını dönene kadar kullanır.
 */

const SALT = 0x5eed4e11;
const HOUR = 3_600_000;
export const FRONTIER = Object.freeze({ id: 'kesif', name: 'Bilinmeyen topraklar' });

/** Kervansaraya göre aynı anda düzenlenebilecek sefer sayısı (Kâşif +1). 0: Kervansaray yok. */
export function expeditionSlots(state, village) {
  const level = Math.max(0, ...Object.values(state.villages).map((v) => v.buildings.kervansaray ?? 0));
  if (!level) return 0;
  return EXPEDITION.slotsBase + Math.floor(level / EXPEDITION.slotsEvery) + bonusOf(village).expeditionSlots;
}

/** Yolda ya da dönüşte olan seferler (tüm köyler). */
export function expeditionsUnderway(state) {
  let n = 0;
  for (const village of Object.values(state.villages)) for (const m of village.movements) if (m.mission === 'kesif') n += 1;
  return n;
}

/** Seferin haritada gittiği yer: köyden dünya merkezinin tersine, sınıra doğru (yalnızca çizim). */
function frontierPoint(village) {
  let dx = village.x - WORLD.center;
  let dy = village.y - WORLD.center;
  if (!dx && !dy) dx = 1;
  const len = Math.hypot(dx, dy);
  return { x: Math.round(village.x + (dx / len) * EXPEDITION.distance), y: Math.round(village.y + (dy / len) * EXPEDITION.distance) };
}

/**
 * Seferin yapılıp yapılamayacağını inceler.
 * Dönen `code`: 'count' | 'excluded' | 'hold' | 'empty' | 'units' | 'building' | 'slots'
 */
export function inspectExpedition(state, village, requested, holdHours, now) {
  const units = {};
  for (const id of UNIT_IDS) {
    const n = requested[id] ?? 0;
    if (!Number.isInteger(n) || n < 0) return { ok: false, code: 'count', reason: 'Asker sayıları 0 ya da pozitif tam sayı olmalı', units: {} };
    if (n > 0) units[id] = n;
  }
  const bonus = bonusOf(village);
  const travel = totalUnits(units) ? travelSeconds(EXPEDITION.distance, armySpeed(units), state.world.speed) : 0;
  const seconds = Math.max(1, Math.round(travel * bonus.travel));
  const holdMs = (holdHours * HOUR) / state.world.speed;
  const slots = expeditionSlots(state, village);
  const info = {
    ok: false,
    units,
    seconds,
    holdMs,
    exploreAt: now + seconds * 1000,
    arriveAt: now + seconds * 1000 + holdMs,
    returnAt: now + 2 * seconds * 1000 + holdMs,
    carry: armyCarry(units),
    slots,
    underway: expeditionsUnderway(state),
  };

  const excluded = EXPEDITION.excluded.find((id) => units[id]);
  if (excluded) return { ...info, code: 'excluded', reason: `${UNITS[excluded].name} keşfe çıkmaz` };
  if (!EXPEDITION.holdHours.includes(holdHours)) return { ...info, code: 'hold', reason: 'Geçerli bir keşif süresi seç' };
  if (!totalUnits(units)) return { ...info, code: 'empty', reason: 'Sefere gidecek asker seç' };
  const short = Object.keys(units).find((id) => units[id] > village.units[id]);
  if (short) return { ...info, code: 'units', reason: `Köyde yeterli ${UNITS[short].name} yok` };
  if (!village.buildings.kervansaray) return { ...info, code: 'building', reason: 'Keşif seferi için bu köyde Kervansaray gerekir' };
  if (info.underway >= slots) return { ...info, code: 'slots', reason: `Sefer hakların dolu (${info.underway}/${slots}); bir seferin dönmesini bekle` };
  return { ...info, ok: true };
}

export function sendExpedition(state, village, requested, holdHours, now) {
  const check = inspectExpedition(state, village, requested, holdHours, now);
  if (!check.ok) return check;
  for (const [id, n] of Object.entries(check.units)) village.units[id] -= n;
  const movement = {
    id: state.nextId++,
    type: 'kesif',
    mission: 'kesif',
    target: { ...FRONTIER, ...frontierPoint(village) },
    units: check.units,
    loot: null,
    holdHours,
    departAt: now,
    exploreAt: check.exploreAt,
    arriveAt: check.arriveAt,
  };
  village.movements.push(movement);
  return { ...check, movement };
}

/** Sonuç olasılıkları (0..1); sınıfın tehlike çarpanı ve keşif süresi dahil. */
export function expeditionOdds(village, holdHours) {
  const bonus = bonusOf(village);
  const weights = { ...EXPEDITION.weights };
  for (const key of EXPEDITION.risky) weights[key] *= bonus.expeditionRisk;
  weights.bos *= Math.max(0.2, 1 - EXPEDITION.emptyLessPerHour * (holdHours - 1));
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(weights).map(([key, w]) => [key, w / total]));
}

/** Bulunacak kaynağın ölçeği (taşıma sınırından önce). */
export function expeditionScale(state, village, holdHours) {
  const bonus = bonusOf(village);
  return (
    (EXPEDITION.resourceBase + EXPEDITION.resourcePerDay * worldDays(state.world)) *
    (1 + EXPEDITION.holdBonus * (holdHours - 1)) *
    bonus.expeditionReward
  );
}

function pick(odds, r) {
  let acc = 0;
  for (const [key, p] of Object.entries(odds)) {
    acc += p;
    if (r < acc) return key;
  }
  return Object.keys(odds).at(-1);
}

const between = ([min, max], r) => min + (max - min) * r;

/** Keşif süresi doldu: sonucu belirler, raporu yazar ve sağ kalanları yola çıkarır. */
export function resolveExpedition(state, village, movement) {
  const roll = (k) => mulberry32(hash3(state.world.seed ^ SALT, movement.id, k))();
  const bonus = bonusOf(village);
  const hold = movement.holdHours ?? 1;
  let outcome = pick(expeditionOdds(village, hold), roll(0));
  const scale = expeditionScale(state, village, hold);
  let units = { ...movement.units };
  const loot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  const found = {};
  let lost = {};
  let akce = 0;
  let returnFactor = 1;
  let bandits = null;
  let note = null;

  const fill = (amount) => {
    const shares = RESOURCE_IDS.map((id, i) => EXPEDITION.resourceSplit[id] * (0.8 + 0.4 * roll(10 + i)));
    const sum = shares.reduce((a, b) => a + b, 0);
    RESOURCE_IDS.forEach((id, i) => (loot[id] = Math.floor((amount * shares[i]) / sum)));
  };

  switch (outcome) {
    case 'kaynak': {
      const carry = armyCarry(units);
      const amount = Math.min(carry, scale * between([0.5, 1], roll(2)));
      if (amount < 1) note = 'Ama birlikte yük taşıyabilecek kimse yoktu; her şey orada kaldı.';
      fill(amount);
      break;
    }
    case 'asker': {
      const candidates = Object.keys(units).filter((id) => ['kisla', 'ahir'].includes(UNITS[id].building) && id !== 'gozcu');
      const type = candidates.length ? candidates[Math.floor(roll(2) * candidates.length)] : 'yaya';
      const n = Math.max(1, Math.round(totalUnits(units) * between(EXPEDITION.unitsShare, roll(3)) * bonus.expeditionReward));
      found[type] = n;
      units[type] = (units[type] ?? 0) + n;
      break;
    }
    case 'akce':
      akce = Math.round(between(EXPEDITION.akce, roll(2)) * bonus.expeditionReward);
      grantAkce(state, akce, 'Keşif seferi: hazine', movement.arriveAt);
      break;
    case 'gecikme':
      returnFactor = 1 + between(EXPEDITION.delay, roll(2));
      break;
    case 'erken':
      returnFactor = EXPEDITION.early;
      break;
    case 'eskiya': {
      const strength = Math.max(60, armyAttack(units, village.tech) * bonus.attack * between(EXPEDITION.bandits, roll(2)));
      const army = {
        yaya: Math.max(1, Math.round((strength * 0.4) / UNITS.yaya.attack)),
        okcu: Math.round((strength * 0.3) / UNITS.okcu.attack),
        akinci: Math.round((strength * 0.3) / UNITS.akinci.attack),
      };
      const battle = resolveBattle({
        attackers: army,
        defenders: units,
        luck: between([-0.25, 0.25], roll(3)),
        defenderTech: village.tech,
        defenderBonus: bonus.defense,
      });
      bandits = { units: army, losses: battle.attackerLosses, won: !battle.attackerWins };
      lost = battle.defenderLosses;
      units = subtractUnits(units, lost);
      state.stats.kills += battlePoints(battle.attackerLosses);
      if (battle.attackerWins) outcome = 'eskiyaYenilgi';
      else {
        outcome = 'eskiyaZafer';
        fill(Math.min(armyCarry(units), scale * EXPEDITION.banditLoot));
      }
      break;
    }
    case 'kayip':
      lost = { ...units };
      units = {};
      break;
    default:
      break;
  }

  state.stats.expeditions = (state.stats.expeditions ?? 0) + 1;
  const texts = EXPEDITION_TEXTS[outcome];
  const text = texts[Math.floor(roll(1) * texts.length)];
  const survived = totalUnits(units) > 0;
  const report = addReport(state, {
    type: 'kesif',
    at: movement.arriveAt,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: { ...movement.target },
    outcome,
    text,
    note,
    holdHours: hold,
    attackerWins: survived,
    attackers: movement.units,
    attackerLosses: lost,
    found,
    loot,
    akce,
    returnFactor,
    bandits,
  });

  if (survived) {
    const duration = (movement.exploreAt - movement.departAt) * returnFactor;
    const hasLoot = RESOURCE_IDS.some((id) => loot[id] > 0);
    Object.assign(movement, {
      type: 'donus',
      units,
      loot: hasLoot ? loot : null,
      turnAt: 1,
      departAt: movement.arriveAt,
      arriveAt: movement.arriveAt + duration,
    });
  } else {
    village.movements.splice(village.movements.indexOf(movement), 1);
  }

  return { type: 'expedition-result', villageId: village.id, reportId: report.id, outcome, akce, loot, found, survived, at: report.at };
}
