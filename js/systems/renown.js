import { TITLES, RENOWN } from '../config/titles.js';

/**
 * Şan ve unvan. Şan kayda yazılmaz; beyliğin başarılarından (sayaçlar, köyler, görevler,
 * başarımlar, araştırmalar, kahraman) her seferinde hesaplanır. Böylece eski kayıtlar da
 * hemen doğru şanla açılır. Kazanılan en yüksek unvan `state.player.title`'da durur (düşmez).
 */

export function renownOf(state) {
  const stats = state.stats ?? {};
  const villages = Object.keys(state.villages ?? {}).length;
  const lords = Object.values(state.ai?.lords ?? {}).filter((entry) => entry.defeated).length;
  const tiers = Object.values(state.achievements ?? {}).reduce((sum, tier) => sum + tier, 0);
  return Math.floor(
    (stats.kills ?? 0) / RENOWN.killsPer +
      (stats.attacksWon ?? 0) * RENOWN.attackWin +
      (stats.defenses ?? 0) * RENOWN.defense +
      Math.max(0, villages - 1) * RENOWN.village +
      lords * RENOWN.lord +
      (state.quests?.claimed?.length ?? 0) * RENOWN.quest +
      tiers * RENOWN.achievementTier +
      (state.player?.ilim?.done?.length ?? 0) * RENOWN.ilim +
      (stats.events ?? 0) * RENOWN.event +
      (stats.ruins ?? 0) * RENOWN.ruin +
      (stats.invasions ?? 0) * RENOWN.invasion +
      (stats.invasionWaves ?? 0) * RENOWN.invasionWave +
      Math.max(0, (state.hero?.level ?? 1) - 1) * RENOWN.heroLevel +
      (stats.treaties ?? 0) * RENOWN.treaty +
      (stats.renownBonus ?? 0),
  );
}

/** Şanın hak ettiği unvanın sırası. */
export function earnedTitleIndex(renown) {
  let index = 0;
  TITLES.forEach((title, i) => {
    if (renown >= title.renown) index = i;
  });
  return index;
}

/** Oyuncunun unvanı (kazanılmış en yüksek). */
export function titleOf(state) {
  return TITLES[Math.min(TITLES.length - 1, state.player?.title ?? 0)];
}

export function nextTitle(state) {
  return TITLES[(state.player?.title ?? 0) + 1] ?? null;
}

/** Unvan yükseldiyse kaydeder ve olayını döndürür (motor her ilerlemenin sonunda çağırır). */
export function checkTitle(state, at) {
  if (!state.player) return [];
  const earned = earnedTitleIndex(renownOf(state));
  const current = state.player.title ?? 0;
  if (earned <= current) return [];
  state.player.title = earned;
  const title = TITLES[earned];
  return [{ type: 'title-up', title: title.id, name: title.name, perks: title.perks, at }];
}
