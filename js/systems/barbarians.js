import { BARBARIAN } from '../config/combat.js';
import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { productionPerHour, storageCapacity, hiddenCapacity } from '../core/formulas.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Barbar köylerinin canlı durumu (askerler, kaynaklar, yıkılan binalar).
 * Hiç dokunulmamış bir köy saklanmaz: tam garnizonla ve dünya kurulduğundan beri biriken
 * kaynakla hesaplanır. Saldırıya uğrayan köyün yalnızca son hâli state.barbarians'a yazılır:
 *   { units, resources, time, damage?: { bina: { levels, time } } }
 * Köy oradan itibaren üretmeye, askerlerini toparlamaya ve yıkılan binalarını onarmaya
 * devam eder. Tüm zamanlar dünya saatine (world.clock.time) göredir.
 */

/** Gelişmişliğe göre tam garnizon. */
export function barbarianGarrison(growth) {
  const units = {};
  for (const [id, perGrowth] of Object.entries(BARBARIAN.garrisonPerGrowth)) units[id] = Math.floor(growth * perGrowth);
  return units;
}

/** Yıkımın bugün hâlâ onarılmamış kısmı (seviye). */
export function remainingDamage(entry, clockTime) {
  if (!entry) return 0;
  const repaired = Math.floor(((clockTime - entry.time) / DAY) * BARBARIAN.rebuildPerDay);
  return Math.max(0, entry.levels - repaired);
}

/** Barbar köyünün şu anki askerleri, kaynakları, ambar sınırı ve gizli depo koruması. */
export function barbarianLive(state, village) {
  const saved = state.barbarians[village.id];
  const hours = Math.max(0, state.world.clock.time - (saved?.time ?? 0)) / HOUR;
  const cap = storageCapacity(village.buildings.ambar);
  const garrison = barbarianGarrison(village.growth);

  const resources = {};
  for (const id of RESOURCE_IDS) {
    const start = saved ? saved.resources[id] : BARBARIAN.startResources;
    const rate = productionPerHour(village.buildings[RESOURCES[id].producer]);
    resources[id] = Math.min(cap, start + rate * hours);
  }

  let units = garrison;
  if (saved) {
    const regen = BARBARIAN.troopRegenPerDay * (hours / 24);
    units = {};
    for (const [id, full] of Object.entries(garrison)) {
      units[id] = Math.min(full, Math.floor((saved.units[id] ?? 0) + full * regen));
    }
  }
  return { units, resources, cap, hidden: hiddenCapacity(village.buildings.gizlidepo) };
}

/** Savaştan sonra köyün kalan askerlerini ve kaynaklarını kaydeder (önceki yıkım bilgisi korunur). */
export function recordBarbarian(state, village, units, resources) {
  const damage = state.barbarians[village.id]?.damage;
  state.barbarians[village.id] = {
    units: { ...units },
    resources: { ...resources },
    time: state.world.clock.time,
    ...(damage && { damage }),
  };
}

/** Köyün bir binasından `levels` seviye yıkıldığını kaydeder; onarılmamış eski yıkıma eklenir. */
export function recordDamage(state, villageId, building, levels) {
  const entry = state.barbarians[villageId];
  const now = state.world.clock.time;
  entry.damage ??= {};
  entry.damage[building] = { levels: remainingDamage(entry.damage[building], now) + levels, time: now };
}
