// Tohumlu, deterministik rastgelelik: aynı tohum her zaman aynı sayıları, dolayısıyla aynı
// haritayı üretir. Harita bu sayede kayda yazılmadan her seferinde yeniden oluşturulabilir.

/** 32 bitlik karıştırıcı (MurmurHash3 son adımı): girdideki küçük farkı tüm bitlere yayar. */
function fmix(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Üç tam sayıdan (ör. tohum, x, y) sabit bir 32 bitlik sayı üretir. */
export function hash3(a, b, c) {
  let h = fmix((c | 0) + 0x9e3779b9);
  h = fmix((h + (b | 0)) | 0);
  return fmix((h + (a | 0)) | 0);
}

/** Tohumdan başlayıp 0 ile 1 arası sayılar üreten küçük ve hızlı üreteç (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 0 ile 1 arası yumuşak gürültü: yakın koordinatlar benzer değer alır. Göllerin, ormanların
 * ve tepelerin tek tek alanlar yerine kümeler hâlinde oluşmasını sağlar.
 */
export function valueNoise(seed, x, y, scale) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const corner = (i, j) => hash3(seed, x0 + i, y0 + j) / 4294967296;
  const top = lerp(corner(0, 0), corner(1, 0), tx);
  const bottom = lerp(corner(0, 1), corner(1, 1), tx);
  return lerp(top, bottom, ty);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
