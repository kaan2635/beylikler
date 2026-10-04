import { RUINS, INVASION } from '../config/sites.js';
import { HERO } from '../config/hero.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { DIFFICULTIES } from '../config/lords.js';
import { UNITS } from '../config/units.js';
import { terrainDefense, travelSeconds } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { worldDays, terrainAt, npcAt, distance, villagePoints, inWorld } from './world.js';
import { resolveBattle, distributeLoot } from './combat.js';
import { subtractUnits, totalUnits, armyCarry, armySpeed, luckFor, addReport, battlePoints, resourceTotal, turnBack, addNews } from './army.js';
import { bonusOf } from './bonus.js';
import { grantAkce } from './premium.js';
import { heroAfterBattle, returnHero, rollItem, giveItem } from './hero.js';
import { attackCap } from './ai.js';
import { FORMATIONS, DEFAULT_FORMATION } from '../config/formations.js';

/**
 * Haritadaki özel yerler: harabeler ve Moğol akını.
 *
 * Harabe: muhafızları dünya günüyle güçlenen eski bir yapı (bkz. world.js ruinAt). Yenilince
 * hazinesi (kaynak, Akçe, eşya) alınır ve harabe RUINS.respawnDays boyunca boş kalır.
 *
 * Moğol akını: state.invasion =
 *   { nextAt, count, phase: 'idle' | 'active', camp: { x, y, units, resources, targetId },
 *     wavesLeft, wavesDefended, nextWaveAt, leaveAt }
 * Ordugâh kurulunca INVASION.prepareHours sonra dalgalar başlar; her dalga köye gelen bir
 * saldırıdır (köyün `incoming` listesinde, `invasion: true`). Ordugâhı dağıtan akını bitirir ve
 * büyük ödül alır; dalgaların hepsi bitince ordugâh çekilir. Saldırı olmayan zorlukta akın yoktur.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SALT = 0x6d0a1c37;

const toReal = (world, gameMs) => gameMs / world.speed;
const between = ([min, max], r) => min + r * (max - min);
const zeroLoot = () => Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));

function rngFor(state, a, b = 0) {
  return mulberry32(hash3(state.world.seed ^ SALT, a, b));
}

// ---------- Harabeler ve ordugâh: savunanlar ----------

/** Özel yerin savunanları ve hazinesi (barbar köylerindeki barbarianLive gibi). */
export function siteLive(state, site) {
  if (site.kind === 'akin') {
    const camp = state.invasion?.camp;
    return { units: { ...(camp?.units ?? {}) }, resources: { ...(camp?.resources ?? zeroLoot()) }, hidden: 0 };
  }
  if (site.empty) return { units: {}, resources: zeroLoot(), hidden: 0 };
  const growth = 1 + RUINS.growthPerDay * worldDays(state.world);
  const units = Object.fromEntries(Object.entries(RUINS.guards).map(([id, n]) => [id, Math.round(n * site.tier * growth)]));
  const amount = Math.round(RUINS.loot * site.tier * growth);
  return { units, resources: Object.fromEntries(RESOURCE_IDS.map((id) => [id, amount])), hidden: 0 };
}

/** Harabeye ya da ordugâha saldırı vardı: savaş, hazine, ödüller ve rapor. */
export function attackSite(state, village, movement, site) {
  const at = movement.arriveAt;
  const live = siteLive(state, site);
  const hero = movement.hero;
  const bonus = bonusOf(village);
  const battle = resolveBattle({
    attackers: movement.units,
    defenders: live.units,
    luck: luckFor(state.world.seed, movement.id),
    attackerTech: village.tech,
    attackerBonus: bonus.attack * (1 + (hero?.attack ?? 0)),
    defenderBonus: 1 + terrainDefense(terrainAt(state.world.seed, site.x, site.y)),
    heroAttack: hero?.power ?? 0,
    formation: movement.formation ?? DEFAULT_FORMATION,
  });
  const won = battle.attackerWins;
  const survivors = subtractUnits(movement.units, battle.attackerLosses);
  const loot = won
    ? distributeLoot(
        live.resources,
        armyCarry(survivors) * bonus.carry * (1 + (hero?.carry ?? 0)) * (FORMATIONS[movement.formation] ?? FORMATIONS[DEFAULT_FORMATION]).carry,
      )
    : zeroLoot();
  const kills = battlePoints(battle.defenderLosses);
  state.stats.kills += kills;
  state.stats.loot += resourceTotal(loot);
  state.stats.attacks = (state.stats.attacks ?? 0) + 1;
  if (won) state.stats.attacksWon = (state.stats.attacksWon ?? 0) + 1;

  const reward = { akce: 0, item: null, sold: 0 };
  const extra = [];
  const rng = rngFor(state, movement.id, 1);
  if (site.kind === 'harabe' && won && !site.empty) {
    reward.akce = RUINS.akce[site.tier - 1];
    grantAkce(state, reward.akce, `Harabe: ${site.name}`, at);
    const given = giveItem(state, rollItem(rng, { quality: RUINS.itemQuality[site.tier - 1] }));
    reward.item = given.item;
    if (!given.stored) {
      reward.sold = given.akce;
      grantAkce(state, given.akce, 'Heybe dolu: eşya satıldı', at);
    }
    state.barbarians ??= {};
    state.barbarians[site.id] = { ...(state.barbarians[site.id] ?? {}), lootedAt: state.world.clock.time };
    state.stats.ruins = (state.stats.ruins ?? 0) + 1;
  }
  if (site.kind === 'akin' && state.invasion?.camp) {
    const camp = state.invasion.camp;
    camp.units = subtractUnits(camp.units, battle.defenderLosses);
    for (const id of RESOURCE_IDS) camp.resources[id] = Math.max(0, camp.resources[id] - loot[id]);
    if (won) extra.push(endInvasion(state, 'destroyed', at, rng));
  }

  const heroXp = site.kind === 'akin' ? HERO.xp.camp : HERO.xp.ruin * (site.tier ?? 1);
  extra.push(...heroAfterBattle(state, village, movement, won, won ? heroXp : 0, kills));
  if (hero && won && totalUnits(survivors) === 0) returnHero(state);

  const report = addReport(state, {
    type: 'saldiri',
    at,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: { id: site.id, kind: site.kind, name: site.name, owner: site.owner, x: site.x, y: site.y },
    attackerWins: won,
    luck: battle.luck,
    wallLevel: 0,
    attack: Math.round(battle.attack),
    defense: Math.round(battle.defense),
    attackers: movement.units,
    attackerLosses: battle.attackerLosses,
    defenders: live.units,
    defenderLosses: battle.defenderLosses,
    loot,
    siege: {},
    formation: movement.formation ?? DEFAULT_FORMATION,
    hero: hero ? { name: hero.name } : null,
    reward,
  });

  if (totalUnits(survivors) > 0) turnBack(movement, survivors, loot);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return {
    also: extra,
    type: 'attack-result',
    villageId: village.id,
    reportId: report.id,
    target: site.name,
    attackerWins: won,
    loot,
    siege: {},
    reward,
    at,
  };
}

// ---------- Moğol akını ----------

function difficultyOf(state) {
  return DIFFICULTIES[state.ai?.difficulty] ?? DIFFICULTIES.normal;
}

function capitalOf(state) {
  return Object.values(state.villages).find((v) => v.capital) ?? Object.values(state.villages)[0];
}

/** Akın takvimini kurar (saldırı olan zorluklarda). İlk akın en erken INVASION.firstDay gününde. */
export function ensureInvasion(state, now) {
  state.invasion ??= { nextAt: null, count: 0, phase: 'idle' };
  const invasion = state.invasion;
  if (invasion.disabled || invasion.phase !== 'idle') return;
  if (!difficultyOf(state).attacks || state.peers) {
    invasion.nextAt = null;
    return;
  }
  if (invasion.nextAt != null) return;
  const days = worldDays(state.world);
  const wait = invasion.count === 0
    ? Math.max(0.5, INVASION.firstDay - days) + rngFor(state, invasion.count, 2)() * 2
    : between(INVASION.everyDays, rngFor(state, invasion.count, 3)());
  invasion.nextAt = now + toReal(state.world, wait * DAY);
}

/** Ordugâh için boş bir yer: başkentin çevresinde, gölde ve başka bir yerin üstünde değil. */
function campSpot(state, capital, rng) {
  for (let tries = 0; tries < 60; tries++) {
    const angle = rng() * Math.PI * 2;
    const dist = between(INVASION.ring, rng());
    const x = Math.round(capital.x + Math.cos(angle) * dist);
    const y = Math.round(capital.y + Math.sin(angle) * dist);
    if (!inWorld(x, y) || terrainAt(state.world.seed, x, y) === 'gol') continue;
    if (npcAt(state, x, y) || Object.values(state.villages).some((v) => v.x === x && v.y === y)) continue;
    return { x, y };
  }
  return null;
}

/** Bir sonraki akının saldıracağı köy: en büyük köy. */
function invasionTarget(state) {
  return Object.values(state.villages).reduce((best, v) => (villagePoints(v.buildings) > villagePoints(best.buildings) ? v : best));
}

/** Moğol ordusu ordugâh kurar (motor `nextAt` anında çağırır). */
export function startInvasion(state, at) {
  const invasion = state.invasion;
  const rng = rngFor(state, invasion.count, 4);
  invasion.nextAt = null;
  const spot = campSpot(state, capitalOf(state), rng);
  if (!spot) {
    invasion.nextAt = at + toReal(state.world, DAY);
    return null;
  }
  const target = invasionTarget(state);
  const strength = attackCap(villagePoints(target.buildings)) * INVASION.campFactor * Math.max(0.6, difficultyOf(state).attackFactor);
  const each = Math.max(2, Math.round(strength / 90));
  const amount = Math.round(1500 + 150 * worldDays(state.world));
  Object.assign(invasion, {
    phase: 'active',
    camp: { ...spot, units: { yaya: each, kilicci: each, okcu: each }, resources: Object.fromEntries(RESOURCE_IDS.map((id) => [id, amount])), targetId: target.id },
    wavesLeft: INVASION.waves,
    wavesDefended: 0,
    nextWaveAt: at + toReal(state.world, INVASION.prepareHours * HOUR),
    leaveAt: null,
  });
  addNews(state, at, `Moğol ordusu (${spot.x}|${spot.y}) yakınına ordugâh kurdu!`);
  return { type: 'invasion-start', x: spot.x, y: spot.y, firstWaveAt: invasion.nextWaveAt, target: target.name, at };
}

/** Bir akın dalgası yola çıkar: hedef köye gelen saldırı olarak yazılır. */
export function launchWave(state, at) {
  const invasion = state.invasion;
  const camp = invasion.camp;
  const target = state.villages[camp.targetId] ?? invasionTarget(state);
  const rng = rngFor(state, invasion.count, 10 + invasion.wavesLeft);
  const difficulty = difficultyOf(state);
  const strength = attackCap(villagePoints(target.buildings)) * INVASION.waveFactor * Math.max(0.6, difficulty.attackFactor) * (0.9 + 0.2 * rng());
  const units = {};
  for (const [id, share] of Object.entries(INVASION.army)) {
    const n = Math.round((strength * share) / UNITS[id].attack);
    if (n > 0) units[id] = n;
  }
  const seconds = Math.max(1, travelSeconds(distance(camp.x, camp.y, target.x, target.y), armySpeed(units), state.world.speed));
  const attack = {
    id: state.nextId++,
    invasion: true,
    from: { id: 'akin', kind: 'akin', name: 'Moğol Ordugâhı', owner: 'Moğol Noyanı', x: camp.x, y: camp.y },
    units,
    tech: {},
    departAt: at,
    arriveAt: at + seconds * 1000,
  };
  target.incoming.push(attack);
  invasion.wavesLeft -= 1;
  if (invasion.wavesLeft > 0) {
    invasion.nextWaveAt = at + toReal(state.world, between(INVASION.waveGapHours, rng()) * HOUR);
  } else {
    invasion.nextWaveAt = null;
    invasion.leaveAt = attack.arriveAt + toReal(state.world, INVASION.leaveHours * HOUR);
  }
  return { type: 'incoming-attack', villageId: target.id, attacker: 'Moğol Noyanı', invasion: true, arriveAt: attack.arriveAt, at };
}

/** Akın dalgası püskürtüldü (ai.js resolveIncoming çağırır). */
export function waveDefended(state) {
  if (state.invasion) state.invasion.wavesDefended = (state.invasion.wavesDefended ?? 0) + 1;
  state.stats.invasionWaves = (state.stats.invasionWaves ?? 0) + 1;
}

/**
 * Akın biter. 'destroyed': ordugâh dağıtıldı (büyük ödül); 'left': dalgalar bitti, ordugâh
 * çekildi (bütün dalgalar püskürtüldüyse küçük ödül). Bir sonraki akın takvime yazılır.
 */
export function endInvasion(state, outcome, at, rng = rngFor(state, state.invasion.count, 20)) {
  const invasion = state.invasion;
  const reward = { akce: 0, item: null };
  if (outcome === 'destroyed') {
    reward.akce = INVASION.rewards.akce;
    grantAkce(state, reward.akce, 'Moğol ordugâhı dağıtıldı', at);
    const given = giveItem(state, rollItem(rng, { quality: INVASION.rewards.itemQuality, minRarity: 'nadir' }));
    reward.item = given.item;
    if (!given.stored) grantAkce(state, given.akce, 'Heybe dolu: eşya satıldı', at);
    state.stats.invasions = (state.stats.invasions ?? 0) + 1;
    addNews(state, at, 'Moğol ordugâhı dağıtıldı; akıncılar geri çekildi.');
  } else {
    const all = (invasion.wavesDefended ?? 0) >= INVASION.waves;
    if (all) {
      reward.akce = INVASION.rewards.survive;
      grantAkce(state, reward.akce, 'Moğol akını püskürtüldü', at);
    }
    addNews(state, at, all ? 'Moğol akını püskürtüldü; ordugâh söküldü.' : 'Moğol ordusu yağmasını tamamlayıp çekildi.');
  }
  Object.assign(invasion, { phase: 'idle', camp: null, wavesLeft: 0, nextWaveAt: null, leaveAt: null, count: invasion.count + 1, nextAt: null });
  invasion.nextAt = at + toReal(state.world, between(INVASION.everyDays, rng()) * DAY);
  return { type: 'invasion-end', outcome, reward, at };
}
