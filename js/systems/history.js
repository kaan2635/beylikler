import { UNITS } from '../config/units.js';
import { villagePoints } from './world.js';
import { productionRates } from './economy.js';
import { renownOf } from './renown.js';

/**
 * Beyliğin tarihçesi: her oyun gününün ilk ilerlemesinde bir anlık görüntü kaydedilir
 * (state.history, en fazla HISTORY_MAX gün). Tarihçe sayfası bunlardan grafik çizer.
 * Arada geçen günler (oyun kapalıyken) doldurulmaz; grafik o günleri atlar.
 */

const DAY = 86_400_000;
export const HISTORY_MAX = 120;

export function snapshot(state, day) {
  const villages = Object.values(state.villages);
  let points = 0;
  let production = 0;
  let army = 0;
  for (const village of villages) {
    points += villagePoints(village.buildings);
    const rates = productionRates(village, state.world);
    production += (rates.odun + rates.kil + rates.demir) / state.world.speed; // oyun saati başına
    for (const [id, n] of Object.entries(village.units)) army += n * (UNITS[id]?.pop ?? 0);
    for (const movement of village.movements) for (const [id, n] of Object.entries(movement.units)) army += n * (UNITS[id]?.pop ?? 0);
  }
  return {
    day,
    points,
    production: Math.round(production),
    army,
    renown: renownOf(state),
    akce: Math.floor(state.player?.akce ?? 0),
    villages: villages.length,
  };
}

/** Bugünün görüntüsü henüz yoksa kaydeder. */
export function recordHistory(state) {
  const day = Math.floor(state.world.clock.time / DAY);
  state.history ??= [];
  const last = state.history[state.history.length - 1];
  if (last && last.day >= day) return;
  state.history.push(snapshot(state, day));
  if (state.history.length > HISTORY_MAX) state.history.splice(0, state.history.length - HISTORY_MAX);
}
