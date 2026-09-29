import { LORD, PERSONALITIES, DIFFICULTIES } from '../config/lords.js';
import { COMBAT } from '../config/combat.js';
import { UNITS } from '../config/units.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { RESEARCH } from '../config/tech.js';
import { hiddenCapacity, travelSeconds } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { lordsOf, lordPower, lordVillage, distance } from './world.js';
import { resolveBattle, distributeLoot, siegeLevels } from './combat.js';
import { totalUnits, armySpeed, armyCarry, armyAttack, subtractUnits, luckFor, addReport } from './army.js';

/**
 * Rakip beylerin (yapay zekâ) davranışı.
 *
 * Her beyin bir saldırı takvimi vardır: state.ai.lords[id] = { nextAttackAt, attacks }.
 * Zamanı gelince bey, gücüne ve kişiliğine göre bir ordu kurup en yakın oyuncu köyüne yollar;
 * saldırı köyün `incoming` listesine girer ve varınca savaş çözülür. Takvim gerçek zamanlıdır
 * (ms) ama aralıklar oyun saatiyle ölçülür, yani dünya hızıyla ölçeklenir. Tüm rastgelelik
 * tohumdan gelir: aynı kayıt aynı saldırıları üretir.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const AI_SALT = 0x4b1d0f2e;

export function difficultyOf(state) {
  return DIFFICULTIES[state.ai.difficulty] ?? DIFFICULTIES.normal;
}

function roll(state, lord, n) {
  return mulberry32(hash3(state.world.seed ^ AI_SALT, lord.index, n))();
}

/** Oyun süresini (ms) şu anki dünya hızında gerçek süreye çevirir. */
function toReal(world, gameMs) {
  return gameMs / world.speed;
}

/** Beyin `n`. saldırısından sonraki bekleme (oyun ms). */
function attackInterval(state, lord, n) {
  const [min, max] = PERSONALITIES[lord.personality].attackEveryHours;
  return (min + roll(state, lord, n) * (max - min)) * HOUR * difficultyOf(state).intervalFactor;
}

/**
 * Takvimi olmayan beylere ilk saldırı zamanını verir (yeni oyun, eski kayıt, zorluk değişimi).
 * İlk saldırı başlangıç korumasından ve en az `graceHours`tan önce gelmez; beyler aynı anda
 * gelmesin diye her birine rastgele bir gecikme eklenir.
 */
export function ensureLordSchedules(state, now) {
  const difficulty = difficultyOf(state);
  for (const lord of lordsOf(state.world.seed)) {
    const entry = (state.ai.lords[lord.id] ??= { attacks: 0 });
    if (entry.nextAttackAt !== undefined) continue;
    if (!difficulty.attacks) {
      entry.nextAttackAt = null;
      continue;
    }
    const protectionLeft = difficulty.protectionDays * DAY - state.world.clock.time;
    const wait = Math.max(protectionLeft, LORD.graceHours * HOUR);
    const stagger = roll(state, lord, 10_000 + entry.attacks) * attackInterval(state, lord, entry.attacks);
    entry.nextAttackAt = now + toReal(state.world, wait + stagger);
  }
}

/** Zorluğu değiştirir ve tüm takvimi yeniden kurar. */
export function setDifficulty(state, key, now) {
  if (!DIFFICULTIES[key]) return false;
  state.ai.difficulty = key;
  for (const entry of Object.values(state.ai.lords)) delete entry.nextAttackAt;
  ensureLordSchedules(state, now);
  return true;
}

/** Dünya hızı değişince kalan bekleme süreleri de aynı oranda ölçeklenir. */
export function rescaleLordSchedules(state, now, oldSpeed, newSpeed) {
  for (const entry of Object.values(state.ai.lords)) {
    if (entry.nextAttackAt > now) entry.nextAttackAt = now + ((entry.nextAttackAt - now) * oldSpeed) / newSpeed;
  }
}

/** Saldırıya uğrayan bey (kişiliği intikamcıysa) en geç `revengeHours` içinde karşılık verir. */
export function provokeLord(state, lordId, at) {
  const lord = lordsOf(state.world.seed).find((l) => l.id === lordId);
  const entry = state.ai.lords[lordId];
  if (!lord || !entry?.nextAttackAt || !PERSONALITIES[lord.personality].revenge) return;
  const delay = LORD.revengeHours * HOUR * (0.5 + 0.5 * roll(state, lord, 20_000 + entry.attacks));
  entry.nextAttackAt = Math.min(entry.nextAttackAt, at + toReal(state.world, delay));
}

/** Beyin bu güçte ve zorlukta kuracağı saldırı ordusu. */
export function lordArmy(lord, power, difficulty) {
  const personality = PERSONALITIES[lord.personality];
  const strength = LORD.attackBase * power ** LORD.attackExponent * difficulty.attackFactor;
  const units = {};
  for (const [id, share] of Object.entries(personality.army)) {
    const n = Math.round((strength * share) / UNITS[id].attack);
    if (n > 0) units[id] = n;
  }
  if (personality.rams && power >= LORD.ramsFromPower) units.kocbasi = Math.floor(power / 2);
  return units;
}

/** Beyin Demirci seviyesi gücüyle artar (en fazla 3). */
export function lordTech(power, units) {
  const level = Math.min(RESEARCH.maxLevel, Math.floor(power / LORD.techEveryPower));
  return Object.fromEntries(Object.keys(units).map((id) => [id, level]));
}

/** Zamanı gelen beyin saldırısını yola çıkarır ve bir sonrakini takvime yazar. */
export function launchLordAttack(state, lord, at) {
  const entry = state.ai.lords[lord.id];
  const difficulty = difficultyOf(state);
  entry.attacks += 1;
  entry.nextAttackAt = difficulty.attacks ? at + toReal(state.world, attackInterval(state, lord, entry.attacks)) : null;
  if (!difficulty.attacks) return null;

  const villages = Object.values(state.villages);
  const target = villages.reduce((best, v) =>
    distance(lord.x, lord.y, v.x, v.y) < distance(lord.x, lord.y, best.x, best.y) ? v : best,
  );
  const power = lordPower(lord, state.world);
  const units = lordArmy(lord, power, difficulty);
  if (!totalUnits(units)) return null;

  const from = lordVillage(state, lord);
  const seconds = Math.max(1, travelSeconds(distance(lord.x, lord.y, target.x, target.y), armySpeed(units), state.world.speed));
  const attack = {
    id: state.nextId++,
    lordId: lord.id,
    from: { id: from.id, kind: 'bey', name: from.name, owner: from.owner, x: from.x, y: from.y },
    units,
    tech: lordTech(power, units),
    departAt: at,
    arriveAt: at + seconds * 1000,
  };
  target.incoming.push(attack);
  return { type: 'incoming-attack', villageId: target.id, attacker: from.owner, arriveAt: attack.arriveAt, at };
}

/** Gelen saldırının tahmini gücü (yuvarlanmış); oyuncu ordunun tam dökümünü görmez. */
export function incomingEstimate(attack) {
  const exact = armyAttack(attack.units, attack.tech);
  const step = exact < 1000 ? 50 : exact < 10_000 ? 500 : 5000;
  return Math.max(step, Math.round(exact / step) * step);
}

/**
 * Beyin saldırısı köye vardı. Köydeki askerler Demirci geliştirmeleri ve surla savunur.
 * Saldıran kazanırsa gizli depoda olmayan kaynaklar yağmalanır ve koçbaşılar suru yıkar.
 */
export function resolveIncoming(state, village, attack) {
  const defenders = Object.fromEntries(Object.entries(village.units).filter(([, n]) => n > 0));
  const wall = village.buildings.sur;
  const battle = resolveBattle({
    attackers: attack.units,
    defenders,
    wallLevel: wall,
    luck: luckFor(state.world.seed, attack.id),
    attackerTech: attack.tech,
    defenderTech: village.tech,
  });
  for (const [id, n] of Object.entries(battle.defenderLosses)) village.units[id] -= n;

  const survivors = subtractUnits(attack.units, battle.attackerLosses);
  const loot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  const siege = {};
  if (battle.attackerWins) {
    const hidden = hiddenCapacity(village.buildings.gizlidepo);
    const available = Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.max(0, village.resources[id] - hidden)]));
    Object.assign(loot, distributeLoot(available, armyCarry(survivors)));
    for (const id of RESOURCE_IDS) village.resources[id] -= loot[id];
    if (survivors.kocbasi) {
      const down = siegeLevels(survivors.kocbasi, wall, COMBAT.ramsPerLevel);
      village.buildings.sur -= down;
      siege.wall = { from: wall, to: wall - down };
    }
  }
  village.incoming.splice(village.incoming.indexOf(attack), 1);

  const report = addReport(state, {
    type: 'savunma',
    at: attack.arriveAt,
    origin: { ...attack.from },
    target: { id: village.id, kind: 'oyuncu', name: village.name, x: village.x, y: village.y },
    attackerWins: battle.attackerWins,
    luck: battle.luck,
    wallLevel: wall,
    attack: Math.round(battle.attack),
    defense: Math.round(battle.defense),
    attackers: attack.units,
    attackerLosses: battle.attackerLosses,
    defenders,
    defenderLosses: battle.defenderLosses,
    loot,
    siege,
  });

  return {
    type: 'defense-result',
    villageId: village.id,
    reportId: report.id,
    attacker: attack.from.owner,
    defended: !battle.attackerWins,
    loot,
    siege,
    at: attack.arriveAt,
  };
}
