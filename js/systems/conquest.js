import { CONQUEST } from '../config/combat.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { hash3, mulberry32 } from '../core/random.js';
import { createVillage } from '../core/state.js';
import { loyaltyOf, setLoyalty } from './barbarians.js';
import { addNews } from './army.js';
import { stationSupport } from './support.js';

/**
 * Fetih. Kazanılan bir saldırıda hayatta kalan her Elçi köyün bağlılığını 20–35 düşürür
 * (tohumdan belirlenir). Bağlılık zamanla toparlanır. Sıfıra inerse köy oyuncunun olur:
 * binaları ve kaynakları korunur, saldıran birlikler destek olarak köyde kalır, elçiler görevini
 * tamamlayıp köye yerleşir. Hisarı fethedilen bey oyundan çıkar.
 */

const LOYALTY_SALT = 0x2f6b9a13;

/** `count` elçinin bağlılıktan düşürdüğü toplam puan. */
export function loyaltyDrop(seed, movementId, count) {
  const [min, max] = CONQUEST.loyaltyDrop;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.round(min + mulberry32(hash3(seed ^ LOYALTY_SALT, movementId, i))() * (max - min));
  return total;
}

/**
 * Elçili saldırı kazanıldı. Bağlılığı düşürür; sıfırlanırsa köyü fetheder.
 * `buildings` kuşatmadan sonraki bina seviyeleri, `resources` köyde kalan tüm kaynaklardır.
 * Dönen: null (elçi yok) | { from, to, conquered, villageId? }
 */
export function applyEnvoys(state, origin, movement, target, survivors, buildings, resources) {
  const envoys = survivors.elci ?? 0;
  if (!envoys) return null;
  const from = loyaltyOf(state, target.id);
  const to = Math.max(0, from - loyaltyDrop(state.world.seed, movement.id, envoys));
  if (to > 0) {
    setLoyalty(state, target.id, to);
    return { from: Math.floor(from), to: Math.floor(to), conquered: false };
  }
  const village = conquer(state, origin, target, survivors, buildings, resources, movement.arriveAt);
  return { from: Math.floor(from), to: 0, conquered: true, villageId: village.id };
}

function conquer(state, origin, target, survivors, buildings, resources, at) {
  const id = `v${state.nextId++}`;
  const village = createVillage({ id, name: target.name, x: target.x, y: target.y, now: at });
  Object.assign(village.buildings, buildings);
  village.resources = Object.fromEntries(RESOURCE_IDS.map((r) => [r, Math.max(0, Math.floor(resources[r]))]));
  village.loyalty = CONQUEST.loyaltyAfterConquest;
  state.villages[id] = village;
  // Sağ kalan saldırganlar yeni köyde destek olarak kalır: nüfusları geldikleri köyde sayılır,
  // istendiğinde geri çağrılabilir. Elçiler görevini tamamladı.
  const garrison = Object.fromEntries(Object.entries(survivors).filter(([unit, n]) => unit !== 'elci' && n > 0));
  stationSupport(origin, id, garrison);
  delete state.barbarians[target.id];

  if (target.kind === 'bey') {
    const entry = state.ai.lords[target.id];
    Object.assign(entry, { defeated: true, nextAttackAt: null, nextRaidAt: null });
    addNews(state, at, `${origin.name} → ${target.owner}: ${target.name} fethedildi, ${target.owner} oyundan çekildi.`);
  } else {
    addNews(state, at, `${origin.name} → ${target.name}: köy fethedildi.`);
  }
  return village;
}
