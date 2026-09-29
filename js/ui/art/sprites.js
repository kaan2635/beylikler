import { GAME_ICONS } from './game-icons.js';

/**
 * Hazır görseller (ücretsiz lisanslı; bkz. docs/EMEGI_GECENLER.md):
 * - Binalar: OpenGameArt — feudalwars (CC0), Bleed (CC-BY 3.0/4.0), yd (CC0). Önceden
 *   işlenmiş (kırpılmış, küçültülmüş, WebP) hâlleri assets/gorsel/binalar/ altında.
 * - Simgeler: game-icons.net (CC BY 3.0), bkz. game-icons.js.
 */

const BASE = new URL('../../../assets/gorsel/binalar/', import.meta.url).href;

/** Binanın görseli; seviyeye göre değişenler (sur: ahşap kule → taş kule). */
export function buildingImage(id, level = 1) {
  if (id === 'sur' && level > 0 && level < 5) return `${BASE}sur-ahsap.webp`;
  return `${BASE}${id}.webp`;
}

/** Seviye kademesi (1–4, 5–14, 15+): sahnede bina bu kademeye göre büyür. */
export function tierOf(level) {
  if (level <= 0) return 0;
  if (level < 5) return 1;
  if (level < 15) return 2;
  return 3;
}

// Haritadaki köy imleri: tür → kademe (1–3) → seçenekler. Aynı türden köyler tek tip görünmesin
// diye köyün konumundan türeyen `variant` seçeneklerden birini seçer.
const VILLAGE_IMAGES = {
  barbar: [['kilocagi', 'oduncu'], ['oduncu', 'demirmadeni', 'kilocagi'], ['ciftlik', 'ambar']],
  rakip: [['ambar', 'ciftlik'], ['ciftlik', 'konak'], ['kisla']],
  oyuncu: [['konak'], ['konak'], ['saray']],
  bey: [['saray'], ['saray'], ['saray']],
};

/** Haritada köy imi olarak kullanılan görsel. */
export function villageImage(kind, tier, variant = 0) {
  const options = (VILLAGE_IMAGES[kind] ?? VILLAGE_IMAGES.oyuncu)[Math.min(3, Math.max(1, tier)) - 1];
  return `${BASE}${options[Math.abs(variant) % options.length]}.webp`;
}

/** game-icons.net simgesi (512 × 512 yol) → SVG metni. */
export function gameIconSvg(key, fill = 'currentColor') {
  const d = GAME_ICONS[key];
  if (!d) return '';
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="${fill}" d="${d}"/></svg>`;
}
