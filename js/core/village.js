// Köy verisi üzerinde küçük yardımcılar.

export function getVillage(state, id = state.activeVillageId) {
  return state.villages[id];
}

/** Binanın, kuyruktaki işler de tamamlandığında ulaşacağı seviye. */
export function plannedLevel(village, buildingId) {
  let level = village.buildings[buildingId] ?? 0;
  for (const job of village.buildQueue) {
    if (job.building === buildingId && job.level > level) level = job.level;
  }
  return level;
}
