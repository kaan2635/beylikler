import { UNITS } from '../config/units.js';
import { COMBAT } from '../config/combat.js';
import { wallBonus } from '../core/formulas.js';
import { techMultiplier } from './research.js';
import { DEFAULT_FORMATION, FORMATIONS } from '../config/formations.js';

const TYPES = ['piyade', 'suvari', 'okcu'];

function sum(values) {
  return Object.values(values).reduce((total, n) => total + n, 0);
}

/** Ordunun saldırı gücü, türlere (piyade / süvari / okçu) göre ayrı ayrı. `tech`: Demirci seviyeleri. */
export function attackByType(units, tech = {}) {
  const power = { piyade: 0, suvari: 0, okcu: 0 };
  for (const [id, n] of Object.entries(units)) power[UNITS[id].type] += n * UNITS[id].attack * techMultiplier(tech[id]);
  return power;
}

/**
 * Savunanların gücü, saldıranın tür karışımına göre ağırlıklı: süvari ağırlıklı bir saldırıya
 * karşı süvari savunması, piyade ağırlıklıya karşı piyade savunması öne çıkar.
 */
export function weightedDefense(units, attackPower, tech = {}) {
  const total = sum(attackPower);
  if (total === 0) return 0;
  let defense = 0;
  for (const [id, n] of Object.entries(units)) {
    const multiplier = techMultiplier(tech[id]);
    for (const type of TYPES) defense += (n * UNITS[id].defense[type] * multiplier * attackPower[type]) / total;
  }
  return defense;
}

function scaleUnits(units, ratio) {
  const result = {};
  for (const [id, n] of Object.entries(units)) result[id] = Math.min(n, Math.round(n * ratio));
  return result;
}

/**
 * Tek hamlede savaş sonucu. Güçlü taraf kazanır; kaybedenin tüm askerleri ölür, kazananın
 * kayıp oranı (kaybeden güç / kazanan güç) ^ 1.5 olur. `luck` (−0.25..0.25) saldırı gücünü değiştirir;
 * `attackerTech` / `defenderTech` Demirci geliştirmeleridir; `attackerBonus` / `defenderBonus`
 * sınıf, görevli, unvan ve arazi çarpanlarıdır. `heroAttack` / `heroDefense` kahramanın gücüdür.
 */
export function resolveBattle({ attackers, defenders, wallLevel = 0, luck = 0, attackerTech = {}, defenderTech = {}, attackerBonus = 1, defenderBonus = 1, heroAttack = 0, heroDefense = 0, formation = DEFAULT_FORMATION }) {
  const power = attackByType(attackers, attackerTech);
  power.suvari += heroAttack; // orduyu yöneten kahraman atlı savaşır
  const plan = FORMATIONS[formation] ?? FORMATIONS[DEFAULT_FORMATION];
  const attack = sum(power) * attackerBonus * plan.attack * (1 + luck);
  const defense =
    (weightedDefense(defenders, power, defenderTech) + heroDefense) * defenderBonus * (1 + wallBonus(wallLevel)) +
    COMBAT.villageDefense +
    COMBAT.wallDefensePerLevel * wallLevel;
  const attackerWins = attack > defense;
  const ratio = attackerWins ? (defense / attack) ** COMBAT.lossExponent : (attack / defense) ** COMBAT.lossExponent;
  return {
    attackerWins,
    attack,
    defense,
    luck,
    attackerLosses: attackerWins ? scaleUnits(attackers, ratio * plan.losses) : { ...attackers },
    defenderLosses: attackerWins ? { ...defenders } : scaleUnits(defenders, ratio),
  };
}

/**
 * `count` kuşatma aracıyla bir binadan kaç seviye yıkıldığı. Bina L seviyesindeyken bir seviye
 * indirmek (L × perLevel) araç ister; yüksek seviyeleri yıkmak daha zordur.
 */
export function siegeLevels(count, level, perLevel, minLevel = 0) {
  let left = count;
  let current = level;
  while (current > minLevel && left >= perLevel * current) {
    left -= perLevel * current;
    current -= 1;
  }
  return level - current;
}

/** Taşıma kapasitesini kaynaklara olabildiğince eşit dağıtır; bir kaynak bitince pay diğerlerine kalır. */
export function distributeLoot(available, capacity) {
  const loot = Object.fromEntries(Object.keys(available).map((id) => [id, 0]));
  let left = Math.floor(capacity);
  let open = Object.keys(available).filter((id) => available[id] >= 1);
  while (left > 0 && open.length) {
    const share = Math.max(1, Math.floor(left / open.length));
    for (const id of open) {
      const take = Math.min(share, Math.floor(available[id] - loot[id]), left);
      loot[id] += take;
      left -= take;
    }
    open = open.filter((id) => available[id] - loot[id] >= 1);
  }
  return loot;
}
