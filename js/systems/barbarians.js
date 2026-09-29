import { BARBARIAN } from '../config/combat.js';
import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { productionPerHour, storageCapacity, hiddenCapacity } from '../core/formulas.js';

const HOUR = 3_600_000;

/**
 * Barbar köylerinin canlı durumu (askerler ve kaynaklar).
 * Hiç dokunulmamış bir köy saklanmaz: tam garnizonla ve dünya kurulduğundan beri biriken
 * kaynakla hesaplanır. Saldırıya uğrayan köyün yalnızca son hâli state.barbarians'a yazılır;
 * köy oradan itibaren üretmeye ve askerlerini toparlamaya devam eder. Tüm zamanlar dünya
 * saatine (world.clock.time) göredir.
 */

/** Gelişmişliğe göre tam garnizon. */
export function barbarianGarrison(growth) {
  const units = {};
  for (const [id, perGrowth] of Object.entries(BARBARIAN.garrisonPerGrowth)) units[id] = Math.floor(growth * perGrowth);
  return units;
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

/** Savaştan sonra köyün kalan askerlerini ve kaynaklarını kaydeder. */
export function recordBarbarian(state, village, units, resources) {
  state.barbarians[village.id] = { units: { ...units }, resources: { ...resources }, time: state.world.clock.time };
}
