import { SEASONS, SEASON_DAYS } from '../config/seasons.js';

/**
 * Mevsimler. Dünya, kurulduğundan beri geçen mevsim sayısını `world.season` olarak tutar
 * (çok oyunculu dünyada herkes için ortak). Mevsim sınırı motorda bir olaydır: üretim eski
 * mevsimin oranıyla o ana kadar yürütülür, sonra etkiler yeni mevsime göre yenilenir.
 * Sayaç saatten değil olaydan ilerlediği için sınırda aynı olay iki kez işlenmez.
 * `world.seasons === false` olan dünyada mevsim yoktur (etkisiz; testler ve sunucu ayarı).
 */

const SEASON_MS = SEASON_DAYS * 86_400_000;

/** Eski kayıtlarda sayacı dünya saatinden kurar. */
export function ensureSeason(world) {
  world.season ??= Math.floor(world.clock.time / SEASON_MS);
}

/** Şu anki mevsim; mevsimsiz dünyada null. */
export function seasonOf(world) {
  if (world.seasons === false) return null;
  return SEASONS[(world.season ?? 0) % SEASONS.length];
}

/** Bir sonraki mevsimin başladığı dünya saati (oyun ms). */
export function nextSeasonGameTime(world) {
  return ((world.season ?? 0) + 1) * SEASON_MS;
}

/** Bir sonraki mevsimin başladığı gerçek an (ms), şu anki dünya hızıyla. */
export function nextSeasonAt(world) {
  if (world.seasons === false) return Infinity;
  return world.clock.at + (nextSeasonGameTime(world) - world.clock.time) / world.speed;
}

/** Mevsimin kalan süresi (oyun ms). */
export function seasonLeft(world, now) {
  const time = world.clock.time + (now - world.clock.at) * world.speed;
  return Math.max(0, nextSeasonGameTime(world) - time);
}

/** Mevsim değişti: sayaç ilerler; motor olaydan sonra etkileri yeniler. */
export function advanceSeason(world, at) {
  world.season = (world.season ?? 0) + 1;
  const season = seasonOf(world);
  return { type: 'season', season: season.id, name: season.name, at };
}
