import { lordsOf, lordVillage, villagePoints } from './world.js';

/**
 * Sıralama: oyuncu ve rakip beyler, puana (eşitlikte savaş puanına) göre.
 * Puan köy binalarından gelir; savaş puanı öldürülen düşman askerlerinin nüfus değeridir.
 */
export function ranking(state) {
  const villages = Object.values(state.villages);
  const player = {
    kind: 'oyuncu',
    id: 'oyuncu',
    name: 'Sen',
    villageName: villages.map((v) => v.name).join(', '),
    villages: villages.length,
    points: villages.reduce((total, v) => total + villagePoints(v.buildings), 0),
    kills: state.stats.kills,
    loot: state.stats.loot,
    x: villages[0].x,
    y: villages[0].y,
  };
  const lords = lordsOf(state.world.seed).map((lord) => {
    const village = lordVillage(state, lord);
    const entry = state.ai.lords[lord.id] ?? {};
    return {
      kind: 'bey',
      id: lord.id,
      name: village.owner,
      villageName: village.name,
      personality: lord.personality,
      villages: 1,
      points: village.points,
      kills: entry.kills ?? 0,
      loot: entry.loot ?? 0,
      x: village.x,
      y: village.y,
    };
  });
  return [player, ...lords]
    .sort((a, b) => b.points - a.points || b.kills - a.kills || (a.kind === 'oyuncu' ? -1 : 1))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
