import { DEFAULT_BONUS } from '../config/classes.js';

/**
 * Köyün geçerli etkisi (sınıf ve görevliler; bkz. premium.js). Motor her olaydan sonra
 * yeniler; henüz yenilenmemiş bir köyde etkisizdir.
 */
export function bonusOf(village) {
  return village.bonus ?? DEFAULT_BONUS;
}
