import { EDICTS } from '../config/edicts.js';
import { seasonOf } from './seasons.js';
import { syncBonuses } from './premium.js';

/** Bu mevsimde yürürlükte olan ferman; eski mevsimden kalan seçim bonus vermez. */
export function activeEdict(state) {
  const selection = state.player?.edict;
  if (!seasonOf(state.world) || !selection || selection.season !== (state.world.season ?? 0)) return null;
  return EDICTS[selection.id] ? selection : null;
}

/** Oyuncu, her mevsimde en fazla bir ferman seçebilir. Seçim tüm köylere hemen işler. */
export function chooseEdict(state, id, now) {
  const edict = EDICTS[id];
  if (!edict) return { ok: false, code: 'edict', reason: 'Geçerli bir ferman seç' };
  if (!seasonOf(state.world)) return { ok: false, code: 'season', reason: 'Bu dünyada mevsimler kapalı; ferman seçilemez' };
  const season = state.world.season ?? 0;
  if (state.player.edict?.season === season) {
    const chosen = EDICTS[state.player.edict.id];
    return { ok: false, code: 'chosen', reason: `Bu mevsimde ${chosen?.name ?? 'bir ferman'} zaten yürürlükte` };
  }
  state.player.edict = { id, season, chosenAt: now };
  syncBonuses(state);
  return { ok: true, id, edict, season };
}
