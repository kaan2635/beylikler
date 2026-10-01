import { ILIM, ILIM_IDS } from '../config/ilim.js';
import { konakTimeFactor } from '../core/formulas.js';
import { canAfford, spend, refund, timeUntilAffordable } from './economy.js';

/**
 * Divan araştırmaları (İlim). Oyuncunun kaydında: state.player.ilim =
 *   { done: [araştırma…], current: { id, villageId, cost, startAt, endAt } | null }
 * Araştırma bütün beyliğe işler; etkileri sınıf ve görevlilerle aynı `bonus`ta birleşir
 * (bkz. premium.js syncBonuses). Aynı anda tek araştırma yürür.
 */

export function ilimOf(state) {
  state.player.ilim ??= { done: [], current: null };
  return state.player.ilim;
}

export function ilimDone(state, id) {
  return !!state.player?.ilim?.done?.includes(id);
}

/** Araştırma süresi (saniye): oyun saati, Konak seviyesi ve dünya hızıyla. */
export function ilimDuration(id, konakLevel, speed = 1) {
  return Math.max(1, Math.round((ILIM[id].hours * 3600 * konakTimeFactor(konakLevel)) / speed));
}

/**
 * Araştırmanın şu an başlatılıp başlatılamayacağı. Dönen `code`:
 * 'unknown' | 'done' | 'busy' | 'konak' | 'requires' | 'storage' | 'resources' (ok ise yok)
 */
export function inspectIlim(state, village, world, id, now) {
  const def = ILIM[id];
  if (!def) return { ok: false, code: 'unknown', reason: 'Böyle bir araştırma yok' };
  const info = { ok: false, cost: { ...def.cost }, duration: ilimDuration(id, village.buildings.konak, world.speed) };
  if (ilimDone(state, id)) return { ...info, code: 'done', reason: 'Araştırıldı' };
  const missing = def.requires.filter((req) => !ilimDone(state, req));
  if (missing.length) return { ...info, code: 'requires', reason: `Önce: ${missing.map((req) => ILIM[req].name).join(', ')}`, missing };
  if (village.buildings.konak < def.konak) return { ...info, code: 'konak', reason: `Bu köyde Konak ${def.konak}. seviye gerekir` };
  if (state.player.ilim?.current) return { ...info, code: 'busy', reason: 'Divanda başka bir araştırma sürüyor' };
  if (!canAfford(village, info.cost)) {
    const wait = timeUntilAffordable(village, world, info.cost);
    return wait === Infinity
      ? { ...info, code: 'storage', reason: 'Ambar bu maliyet için çok küçük' }
      : { ...info, code: 'resources', reason: 'Yetersiz kaynak', readyAt: now + wait };
  }
  return { ...info, ok: true };
}

export function startIlim(state, village, world, id, now) {
  const check = inspectIlim(state, village, world, id, now);
  if (!check.ok) return check;
  spend(village, check.cost);
  ilimOf(state).current = { id, villageId: village.id, cost: check.cost, startAt: now, endAt: now + check.duration * 1000 };
  return check;
}

/** Süren araştırmayı iptal eder; maliyet araştırmayı başlatan köye iade edilir. */
export function cancelIlim(state) {
  const current = state.player.ilim?.current;
  if (!current) return null;
  const village = state.villages[current.villageId] ?? state.villages[state.activeVillageId];
  refund(village, current.cost);
  state.player.ilim.current = null;
  return current;
}

/** Süren araştırmayı tamamlar. Motor bitiş anında çağırır; ardından etkiler yenilenir. */
export function completeIlim(state) {
  const ilim = ilimOf(state);
  const { id, villageId, endAt } = ilim.current;
  ilim.current = null;
  if (!ilim.done.includes(id)) ilim.done.push(id);
  return { type: 'ilim-complete', villageId, ilim: id, name: ILIM[id].name, at: endAt };
}

/** Araştırmaların açtığı birimler. */
export function unlockedUnits(state) {
  const units = new Set();
  for (const id of state.player?.ilim?.done ?? []) for (const unit of ILIM[id]?.unlocks ?? []) units.add(unit);
  return units;
}

/** Bitmiş araştırmaların etkileri (bonus kaynakları). */
export function ilimBonuses(state) {
  return (state.player?.ilim?.done ?? []).filter((id) => ILIM[id]).map((id) => ILIM[id].bonus);
}

export { ILIM_IDS };
