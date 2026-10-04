import { COMBAT, MIN_BUILDING_LEVEL, CONQUEST } from '../config/combat.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { PREMIUM } from '../config/classes.js';
import { hiddenCapacity, towerDefense, terrainDefense } from '../core/formulas.js';
import { HERO } from '../config/hero.js';
import { heroGuard, woundHero, heroAfterBattle, returnHero } from './hero.js';
import { terrainAt } from './world.js';
import { resolveBattle, distributeLoot, siegeLevels } from './combat.js';
import { FORMATIONS, DEFAULT_FORMATION } from '../config/formations.js';
import { defendersOf, applyDefenderLosses, stationSupport } from './support.js';
import { bonusOf } from './bonus.js';
import { produce } from './economy.js';
import { grantAkce } from './premium.js';
import { loyaltyDrop } from './conquest.js';
import { villagePoints } from './world.js';
import {
  totalUnits,
  armyCarry,
  siegeEngines,
  subtractUnits,
  luckFor,
  addReport,
  addNews,
  battlePoints,
  resourceTotal,
  turnBack,
} from './army.js';

/**
 * Oyuncular arası savaş (çok oyunculu dünya). Saldıran oyuncunun hareketi hedefe varınca
 * savunan oyuncunun gerçek köyü `state.peers.resolve` ile bulunur ve iki tarafın durumu birlikte
 * güncellenir: kayıplar, yağma, kuşatma, elçilerle bağlılık ve fetih; iki tarafa da rapor.
 * Savunanın olayı `others` alanıyla döner; motor onu savunanın olay listesine taşır.
 *
 * Başkent (oyuncunun ilk köyü) fethedilemez: oyuncu hiçbir zaman köysüz kalmaz.
 */

const HOUR = 3_600_000;

/** Oyuncu köyünün bağlılığı: fetihten ya da elçi saldırısından sonra saatte 1 toparlanır. */
export function villageLoyalty(world, village) {
  const value = typeof village.loyalty === 'number' ? village.loyalty : CONQUEST.loyaltyMax;
  const hours = Math.max(0, world.clock.time - (village.loyaltyAt ?? 0)) / HOUR;
  return Math.min(CONQUEST.loyaltyMax, value + hours * CONQUEST.loyaltyRegenPerHour);
}

function ownerName(state) {
  return state.player?.name ?? 'Bey';
}

function place(state, village, kind) {
  return { id: village.id, kind, name: village.name, owner: ownerName(state), x: village.x, y: village.y, points: villagePoints(village.buildings) };
}

function removeIncoming(village, movementId) {
  const index = village.incoming.findIndex((a) => a.id === movementId);
  if (index >= 0) village.incoming.splice(index, 1);
}

/** Hedef köy bulunamadı (sahibi değişti, kayboldu): birlik geri döner. */
function lost(village, movement) {
  turnBack(movement, movement.units, null);
  return null;
}

export function pvpAttack(state, village, movement) {
  const found = state.peers?.resolve(movement.target.id);
  if (!found || found.state === state) return lost(village, movement);
  const { state: defender, village: target } = found;
  const at = movement.arriveAt;
  produce(target, defender.world, at);
  removeIncoming(target, movement.id);

  const defenders = defendersOf(defender, target);
  const wall = target.buildings.sur;
  // İki tarafın kahramanı: saldıranınki orduyla gelir, savunanınki köyündeyse savunur.
  const hero = movement.hero;
  const guard = heroGuard(defender, target, at);
  const battle = resolveBattle({
    attackers: movement.units,
    defenders,
    wallLevel: wall,
    luck: luckFor(state.world.seed, movement.id),
    attackerTech: village.tech,
    defenderTech: target.tech,
    attackerBonus: bonusOf(village).attack * (1 + (hero?.attack ?? 0)),
    defenderBonus: bonusOf(target).defense * (1 + towerDefense(target.buildings.kule ?? 0)) * (1 + terrainDefense(terrainAt(state.world.seed, target.x, target.y))),
    heroAttack: hero?.power ?? 0,
    heroDefense: guard,
    formation: movement.formation ?? DEFAULT_FORMATION,
  });
  if (guard && battle.attackerWins) woundHero(defender, at);
  applyDefenderLosses(defender, target, defenders, battle.defenderLosses);
  const survivors = subtractUnits(movement.units, battle.attackerLosses);

  // Yağma: gizli depodaki pay korunur.
  const loot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  const siege = {};
  if (battle.attackerWins) {
    const hidden = hiddenCapacity(target.buildings.gizlidepo);
    const available = Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.max(0, target.resources[id] - hidden)]));
    Object.assign(
      loot,
      distributeLoot(
        available,
        armyCarry(survivors) * bonusOf(village).carry * (1 + (hero?.carry ?? 0)) * (FORMATIONS[movement.formation] ?? FORMATIONS[DEFAULT_FORMATION]).carry,
      ),
    );
    for (const id of RESOURCE_IDS) target.resources[id] -= loot[id];
    const { rams, catapults } = siegeEngines(survivors, bonusOf(village).siege);
    if (rams) {
      const down = siegeLevels(rams, wall, COMBAT.ramsPerLevel);
      target.buildings.sur -= down;
      siege.wall = { from: wall, to: wall - down };
    }
    const building = movement.catapultTarget;
    if (catapults && building) {
      const from = target.buildings[building];
      const down = siegeLevels(catapults, from, COMBAT.catapultsPerLevel, MIN_BUILDING_LEVEL[building] ?? 0);
      target.buildings[building] = from - down;
      siege.catapult = { building, from, to: from - down };
    }
  }

  // Elçiler: başkent dışında bağlılığı düşürür; sıfırlanırsa köy saldırana geçer.
  let conquest = null;
  const envoys = battle.attackerWins ? (survivors.elci ?? 0) : 0;
  if (envoys) {
    if (target.capital) {
      conquest = { from: CONQUEST.loyaltyMax, to: CONQUEST.loyaltyMax, conquered: false, capital: true };
    } else {
      const from = villageLoyalty(defender.world, target);
      const to = Math.max(0, from - loyaltyDrop(state.world.seed, movement.id, envoys));
      if (to > 0) {
        Object.assign(target, { loyalty: to, loyaltyAt: defender.world.clock.time });
        conquest = { from: Math.floor(from), to: Math.floor(to), conquered: false };
      } else {
        state.peers.transfer(target.id, state);
        Object.assign(target, { loyalty: CONQUEST.loyaltyAfterConquest, loyaltyAt: state.world.clock.time, stationed: {}, capital: false });
        const garrison = Object.fromEntries(Object.entries(survivors).filter(([unit, n]) => unit !== 'elci' && n > 0));
        stationSupport(village, target.id, garrison);
        grantAkce(state, PREMIUM.rewards.conquest, `Fetih: ${target.name}`, at);
        addNews(state, at, `${ownerName(state)} → ${ownerName(defender)}: ${target.name} fethedildi.`);
        conquest = { from: Math.floor(from), to: 0, conquered: true, villageId: target.id };
      }
    }
  }

  const targetPlace = place(defender, target, 'rakip');
  const originPlace = place(state, village, 'rakip');
  const report = addReport(state, {
    type: 'saldiri',
    at,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: targetPlace,
    attackerWins: battle.attackerWins,
    luck: battle.luck,
    wallLevel: wall,
    attack: Math.round(battle.attack),
    defense: Math.round(battle.defense),
    attackers: movement.units,
    attackerLosses: battle.attackerLosses,
    defenders,
    defenderLosses: battle.defenderLosses,
    loot,
    siege,
    formation: movement.formation ?? DEFAULT_FORMATION,
    ...(conquest && { conquest }),
    ...(movement.catapultTarget && { catapultTarget: movement.catapultTarget }),
    ...(hero && { hero: { name: hero.name } }),
  });
  const defense = addReport(defender, {
    type: 'savunma',
    at,
    origin: originPlace,
    target: { id: target.id, kind: 'oyuncu', name: target.name, x: target.x, y: target.y },
    attackerWins: battle.attackerWins,
    luck: battle.luck,
    wallLevel: wall,
    attack: Math.round(battle.attack),
    defense: Math.round(battle.defense),
    attackers: movement.units,
    attackerLosses: battle.attackerLosses,
    defenders,
    defenderLosses: battle.defenderLosses,
    loot,
    siege,
    formation: movement.formation ?? DEFAULT_FORMATION,
    ...(conquest && { conquest: { ...conquest, lostVillage: conquest.conquered } }),
  });

  // Sayaçlar: iki taraf da düşman kayıplarının nüfusu kadar savaş puanı alır.
  state.stats.kills += battlePoints(battle.defenderLosses);
  state.stats.loot += resourceTotal(loot);
  state.stats.attacks = (state.stats.attacks ?? 0) + 1;
  if (battle.attackerWins) state.stats.attacksWon = (state.stats.attacksWon ?? 0) + 1;
  defender.stats.kills += battlePoints(battle.attackerLosses);
  if (!battle.attackerWins) {
    defender.stats.defenses = (defender.stats.defenses ?? 0) + 1;
    grantAkce(defender, PREMIUM.rewards.defense, `Savunma zaferi: ${target.name}`, at);
  }

  const heroEvents = heroAfterBattle(state, village, movement, battle.attackerWins, HERO.xp.lordWin, battlePoints(battle.defenderLosses));
  if (hero && battle.attackerWins && (totalUnits(survivors) === 0 || conquest?.conquered)) returnHero(state);

  if (totalUnits(survivors) > 0 && !conquest?.conquered) turnBack(movement, survivors, loot);
  else village.movements.splice(village.movements.indexOf(movement), 1);

  return {
    also: heroEvents,
    type: 'attack-result',
    villageId: village.id,
    reportId: report.id,
    target: target.name,
    attackerWins: battle.attackerWins,
    loot,
    siege,
    conquest,
    at,
    others: [
      {
        state: defender,
        event: {
          type: 'defense-result',
          villageId: target.id,
          reportId: defense.id,
          attacker: ownerName(state),
          defended: !battle.attackerWins,
          lostVillage: !!conquest?.conquered,
          loot,
          siege,
          at,
        },
      },
    ],
  };
}

export function pvpSpy(state, village, movement) {
  const found = state.peers?.resolve(movement.target.id);
  if (!found || found.state === state) return lost(village, movement);
  const { state: defender, village: target } = found;
  const at = movement.arriveAt;
  produce(target, defender.world, at);
  removeIncoming(target, movement.id);

  const defenders = defendersOf(defender, target);
  const scouts = movement.units.gozcu;
  const guards = defenders.gozcu ?? 0;
  const success = scouts > guards;
  const lostScouts = success ? Math.min(scouts, Math.round(scouts * (guards / scouts) ** COMBAT.lossExponent)) : scouts;
  const noLoot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  const hidden = hiddenCapacity(target.buildings.gizlidepo);

  const report = addReport(state, {
    type: 'casus',
    at,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: place(defender, target, 'rakip'),
    attackerWins: success,
    attackers: movement.units,
    attackerLosses: { gozcu: lostScouts },
    defenders: { gozcu: guards },
    defenderLosses: {},
    loot: noLoot,
    intel: success
      ? {
          units: defenders,
          resources: Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.floor(target.resources[id])])),
          hidden,
          buildings: { ...target.buildings },
        }
      : null,
  });
  if (success) state.stats.spies = (state.stats.spies ?? 0) + 1;

  // Savunan, gözcülerini yakaladığı casusları öğrenir.
  const others = [];
  if (lostScouts > 0) {
    const notice = addReport(defender, {
      type: 'bildirim',
      at,
      origin: place(state, village, 'rakip'),
      target: { id: target.id, kind: 'oyuncu', name: target.name, x: target.x, y: target.y },
      text: `${ownerName(state)} (${village.name}) köyünü gözetlemeye çalıştı; ${lostScouts} gözcüsü yakalandı.${success ? ' Yine de bir kısmı bilgi toplayıp kaçtı.' : ''}`,
    });
    others.push({ state: defender, event: { type: 'spy-caught', villageId: target.id, reportId: notice.id, attacker: ownerName(state), at } });
  }

  if (scouts - lostScouts > 0) turnBack(movement, { gozcu: scouts - lostScouts }, null);
  else village.movements.splice(village.movements.indexOf(movement), 1);
  return { type: 'spy-result', villageId: village.id, reportId: report.id, target: target.name, success, at, others };
}
