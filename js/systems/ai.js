import { LORD, PERSONALITIES, DIFFICULTIES } from '../config/lords.js';
import { COMBAT } from '../config/combat.js';
import { UNITS } from '../config/units.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { RESEARCH } from '../config/tech.js';
import { hiddenCapacity, travelSeconds } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { lordsOf, lordPowerIn, lordVillage, distance, nearbyBarbarians } from './world.js';
import { barbarianLive, recordBarbarian } from './barbarians.js';
import { resolveBattle, distributeLoot, siegeLevels } from './combat.js';
import {
  totalUnits,
  armySpeed,
  armyCarry,
  armyAttack,
  subtractUnits,
  luckFor,
  addReport,
  addNews,
  battlePoints,
  resourceTotal,
} from './army.js';

/**
 * Rakip beylerin (yapay zekâ) davranışı.
 *
 * Her beyin kayıtta bir durumu vardır: state.ai.lords[id] =
 *   { nextAttackAt, attacks, nextRaidAt, raids, bonus, kills, loot }
 * - Saldırı takvimi (nextAttackAt): zamanı gelince bey en yakın oyuncu köyüne ordu yollar;
 *   saldırı köyün `incoming` listesine girer, varınca savaş çözülür. Zorluğa bağlıdır.
 * - Hareket takvimi (nextRaidAt): bey barbar köylerini yağmalar ya da başka bir beye savaş açar.
 *   Bunlar anında çözülür; Barış zorluğunda dünya sakindir, hiç olmaz.
 * - `bonus` savaşlarla kazanılan/kaybedilen güç payıdır; `kills` ve `loot` sıralamada görünür.
 * Takvimler gerçek zamanlıdır (ms) ama aralıklar oyun saatiyle ölçülür, yani dünya hızıyla
 * ölçeklenir. Tüm rastgelelik tohumdan gelir: aynı kayıt aynı olayları üretir.
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

function between([min, max], r) {
  return (min + r * (max - min)) * HOUR;
}

/** Beyin `n`. saldırısından sonraki bekleme (oyun ms). */
function attackInterval(state, lord, n) {
  return between(PERSONALITIES[lord.personality].attackEveryHours, roll(state, lord, n)) * difficultyOf(state).intervalFactor;
}

/** Beyin `n`. yağma ya da savaşından sonraki bekleme (oyun ms). */
function raidInterval(state, lord, n) {
  return between(PERSONALITIES[lord.personality].raidEveryHours, roll(state, lord, 40_000 + n));
}

function entryOf(state, lordId) {
  return (state.ai.lords[lordId] ??= { attacks: 0, raids: 0, bonus: 0, kills: 0, loot: 0 });
}

/** Beyin savaş payını değiştirir (sınırlar içinde). */
function adjustBonus(state, lordId, delta) {
  const entry = entryOf(state, lordId);
  entry.bonus = Math.min(LORD.bonusMax, Math.max(LORD.bonusMin, (entry.bonus ?? 0) + delta));
}

/**
 * Takvimi olmayan beylere zaman verir (yeni oyun, eski kayıt, zorluk değişimi).
 * İlk saldırı başlangıç korumasından ve en az `graceHours`tan önce gelmez; beyler aynı anda
 * gelmesin diye her birine rastgele bir gecikme eklenir.
 */
export function ensureLordSchedules(state, now) {
  const difficulty = difficultyOf(state);
  for (const lord of lordsOf(state.world.seed)) {
    const entry = entryOf(state, lord.id);
    entry.raids ??= 0;
    entry.bonus ??= 0;
    entry.kills ??= 0;
    entry.loot ??= 0;
    if (entry.defeated) {
      entry.nextAttackAt = null; // hisarı fethedilen bey artık hareket etmez
      entry.nextRaidAt = null;
      continue;
    }
    if (entry.nextRaidAt === undefined) {
      entry.nextRaidAt = difficulty.raids
        ? now + toReal(state.world, roll(state, lord, 50_000 + entry.raids) * raidInterval(state, lord, entry.raids))
        : null;
    }
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

/** Zorluğu değiştirir ve takvimleri yeniden kurar. */
export function setDifficulty(state, key, now) {
  if (!DIFFICULTIES[key]) return false;
  state.ai.difficulty = key;
  for (const entry of Object.values(state.ai.lords)) {
    delete entry.nextAttackAt;
    delete entry.nextRaidAt;
  }
  ensureLordSchedules(state, now);
  return true;
}

/** Dünya hızı değişince kalan bekleme süreleri de aynı oranda ölçeklenir. */
export function rescaleLordSchedules(state, now, oldSpeed, newSpeed) {
  for (const entry of Object.values(state.ai.lords)) {
    for (const key of ['nextAttackAt', 'nextRaidAt']) {
      if (entry[key] > now) entry[key] = now + ((entry[key] - now) * oldSpeed) / newSpeed;
    }
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

/** Oyuncu bir beyin hisarına saldırdı: sonuç beyin gücünü, savaş puanını ve haberleri etkiler. */
export function recordPlayerAttackOnLord(state, report) {
  const lordId = report.target.id;
  const entry = entryOf(state, lordId);
  entry.kills += battlePoints(report.attackerLosses);
  adjustBonus(state, lordId, report.attackerWins ? LORD.bonus.warLoss : LORD.bonus.defendWin);
  addNews(state, report.at, `${report.origin.name} → ${report.target.owner}: ${report.attackerWins ? 'hisar yenildi' : 'saldırı püskürtüldü'}.`);
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
  const entry = entryOf(state, lord.id);
  const difficulty = difficultyOf(state);
  entry.attacks += 1;
  entry.nextAttackAt = difficulty.attacks ? at + toReal(state.world, attackInterval(state, lord, entry.attacks)) : null;
  if (!difficulty.attacks) return null;

  const villages = Object.values(state.villages);
  const target = villages.reduce((best, v) =>
    distance(lord.x, lord.y, v.x, v.y) < distance(lord.x, lord.y, best.x, best.y) ? v : best,
  );
  const power = lordPowerIn(state, lord);
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

/**
 * Beyin kendi hareketi: çoğunlukla yakındaki bir barbar köyünü yağmalar; kişiliğine göre
 * bazen başka bir beye savaş açar. Anında çözülür; yenilen köyün durumu kayda geçer.
 */
export function lordRaid(state, lord, at) {
  const entry = entryOf(state, lord.id);
  entry.raids += 1;
  entry.nextRaidAt = difficultyOf(state).raids ? at + toReal(state.world, raidInterval(state, lord, entry.raids)) : null;

  const war = roll(state, lord, 30_000 + entry.raids) < PERSONALITIES[lord.personality].warChance;
  const target = war ? pickRival(state, lord, entry.raids) : pickBarbarian(state, lord, entry.raids);
  if (!target) return null;

  const power = lordPowerIn(state, lord);
  const army = lordArmy(lord, power * LORD.raidFactor, DIFFICULTIES.normal);
  const live = barbarianLive(state, target);
  const battle = resolveBattle({
    attackers: army,
    defenders: live.units,
    wallLevel: target.buildings.sur,
    luck: luckFor(state.world.seed, state.nextId++),
    attackerTech: lordTech(power, army),
  });

  const loot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  if (battle.attackerWins) {
    const available = Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.max(0, live.resources[id] - live.hidden)]));
    Object.assign(loot, distributeLoot(available, armyCarry(subtractUnits(army, battle.attackerLosses))));
  }
  const left = Object.fromEntries(RESOURCE_IDS.map((id) => [id, live.resources[id] - loot[id]]));
  recordBarbarian(state, target, subtractUnits(live.units, battle.defenderLosses), left);

  entry.kills += battlePoints(battle.defenderLosses);
  entry.loot += resourceTotal(loot);
  const attacker = `${lord.name} Bey`;
  if (!war) {
    if (battle.attackerWins) adjustBonus(state, lord.id, LORD.bonus.raidWin);
    return null;
  }

  const rival = entryOf(state, target.id);
  rival.kills += battlePoints(battle.attackerLosses);
  adjustBonus(state, lord.id, battle.attackerWins ? LORD.bonus.warWin : LORD.bonus.warLoss);
  adjustBonus(state, target.id, battle.attackerWins ? LORD.bonus.warLoss : LORD.bonus.defendWin);
  addNews(state, at, `${attacker} → ${target.owner}: ${battle.attackerWins ? `zafer, ${target.name} yağmalandı` : 'saldırı püskürtüldü'}.`);
  return null;
}

/** Yakındaki barbar köylerinden birini seçer (en yakın altı köy arasından). */
function pickBarbarian(state, lord, n) {
  const nearby = nearbyBarbarians(state, lord.x, lord.y, LORD.raidRadius).slice(0, 6);
  if (!nearby.length) return null;
  return nearby[Math.floor(roll(state, lord, 60_000 + n) * nearby.length)];
}

/** Savaşılacak beyi seçer; yakındakiler daha olasıdır. */
function pickRival(state, lord, n) {
  const others = lordsOf(state.world.seed)
    .filter((other) => other.id !== lord.id && !state.ai.lords[other.id]?.defeated)
    .sort((a, b) => distance(lord.x, lord.y, a.x, a.y) - distance(lord.x, lord.y, b.x, b.y));
  if (!others.length) return null;
  const index = Math.floor(roll(state, lord, 70_000 + n) ** 2 * others.length);
  return lordVillage(state, others[index]);
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

  // Sıralama ve haberler: iki tarafın savaş puanı, beyin gücü.
  state.stats.kills += battlePoints(battle.attackerLosses);
  const entry = entryOf(state, attack.lordId);
  entry.kills += battlePoints(battle.defenderLosses);
  entry.loot += resourceTotal(loot);
  adjustBonus(state, attack.lordId, battle.attackerWins ? LORD.bonus.raidWin : LORD.bonus.warLoss);
  addNews(state, attack.arriveAt, `${attack.from.owner} → ${village.name}: ${battle.attackerWins ? 'köy yağmalandı' : 'saldırı püskürtüldü'}.`);

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
