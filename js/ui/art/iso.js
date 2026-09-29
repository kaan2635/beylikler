/**
 * İzometrik çizim yardımcıları (2:1 dimetrik). Tüm bina çizimleri bu ilkellerden kurulur;
 * böylece ışık yönü, çizgi kalınlığı ve renk tonları her yerde aynı kalır.
 *
 * Dünya ekseni: +x sağ-aşağı, +y sol-aşağı, +z yukarı. Görünen yüzler: üst (z), sağ (x = uç),
 * sol (y = uç). Işık soldan-yukarıdan gelir: üst en açık, sol orta, sağ en koyu ton.
 * Fonksiyonlar SVG parçası (metin) döndürür.
 */

export const INK = '#3a2a1a';

/** Dünya noktasını ekrana çevirir. */
export function P(x, y, z = 0) {
  return [x - y, (x + y) / 2 - z];
}

const fmt = (n) => Math.round(n * 10) / 10;

export function pts(list) {
  return list.map(([x, y, z]) => P(x, y, z).map(fmt).join(',')).join(' ');
}

/** Dünya noktalarından çokgen. */
export function poly(list, fill, { stroke = INK, width = 0.9, opacity = 1, extra = '' } = {}) {
  return `<polygon points="${pts(list)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ''}${extra}/>`;
}

/** Ekran koordinatlı çokgen (önceden çevrilmiş noktalar). */
export function spoly(screenPoints, fill, { stroke = INK, width = 0.9 } = {}) {
  return `<polygon points="${screenPoints.map((p) => p.map(fmt).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
}

/**
 * Kutu: (x, y, z) köşesinden w × d × h. `c` = [üst, sol, sağ] tonları.
 * Yalnızca görünen üç yüz çizilir.
 */
export function box(x, y, z, w, d, h, c) {
  const [top, left, right] = c;
  return (
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right) +
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left) +
    poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top)
  );
}

/**
 * x ekseni boyunca uzanan beşik çatı (mahya y ortasında). c = [ön eğim, arka eğim, alın].
 * Saçak yalnızca yanlarda taşar; alın ucu duvarla aynı hizadadır.
 */
export function gableX(x, y, z, w, d, rise, c, overhang = 2) {
  const [front, back, gable] = c;
  const o = overhang;
  const my = y + d / 2;
  return (
    poly([[x, y - o, z - o / 2], [x + w, y - o, z - o / 2], [x + w, my, z + rise], [x, my, z + rise]], back) +
    poly([[x + w, y - o, z - o / 2], [x + w, y + d + o, z - o / 2], [x + w, my, z + rise]], gable) +
    poly([[x, y + d + o, z - o / 2], [x + w, y + d + o, z - o / 2], [x + w, my, z + rise], [x, my, z + rise]], front)
  );
}

/** y ekseni boyunca uzanan beşik çatı (mahya x ortasında). c = [ön eğim, arka eğim, alın]. */
export function gableY(x, y, z, w, d, rise, c, overhang = 2) {
  const [front, back, gable] = c;
  const o = overhang;
  const mx = x + w / 2;
  return (
    poly([[x - o, y, z - o / 2], [mx, y, z + rise], [mx, y + d, z + rise], [x - o, y + d, z - o / 2]], back) +
    poly([[x - o, y + d, z - o / 2], [x + w + o, y + d, z - o / 2], [mx, y + d, z + rise]], gable) +
    poly([[x + w + o, y, z - o / 2], [mx, y, z + rise], [mx, y + d, z + rise], [x + w + o, y + d, z - o / 2]], front)
  );
}

/** Piramit (dört yüzlü) çatı. c = [sol, sağ, arka] tonları. */
export function pyramid(x, y, z, w, d, rise, c, overhang = 2) {
  const [left, right, back] = c;
  const o = overhang;
  const apex = [x + w / 2, y + d / 2, z + rise];
  const a = [x - o, y - o, z];
  const b = [x + w + o, y - o, z];
  const cc = [x + w + o, y + d + o, z];
  const dd = [x - o, y + d + o, z];
  return poly([a, b, apex], back) + poly([dd, a, apex], back) + poly([dd, cc, apex], left) + poly([b, cc, apex], right);
}

/** Kubbe: (cx, cy, z) merkezli, yarıçap r. c = [açık, koyu]. */
export function dome(cx, cy, z, r, c, { finial = true } = {}) {
  const [sx, sy] = P(cx, cy, z);
  const rx = r * 1.414;
  const ry = r * 0.707;
  const h = r * 1.15;
  const [light, dark] = c;
  let svg = `<path d="M${fmt(sx - rx)},${fmt(sy)} C${fmt(sx - rx)},${fmt(sy - h * 1.35)} ${fmt(sx + rx)},${fmt(sy - h * 1.35)} ${fmt(sx + rx)},${fmt(sy)} A${fmt(rx)},${fmt(ry)} 0 0 1 ${fmt(sx - rx)},${fmt(sy)}Z" fill="${light}" stroke="${INK}" stroke-width="0.9"/>`;
  // Gölgeli sağ yarı
  svg += `<path d="M${fmt(sx)},${fmt(sy - h)} C${fmt(sx + rx * 0.7)},${fmt(sy - h)} ${fmt(sx + rx)},${fmt(sy - h * 0.5)} ${fmt(sx + rx)},${fmt(sy)} A${fmt(rx)},${fmt(ry)} 0 0 1 ${fmt(sx)},${fmt(sy + ry)}Z" fill="${dark}" opacity="0.55"/>`;
  if (finial) {
    const top = sy - h * 1.02;
    svg += `<line x1="${fmt(sx)}" y1="${fmt(top)}" x2="${fmt(sx)}" y2="${fmt(top - 7)}" stroke="${INK}" stroke-width="1"/>`;
    svg += `<circle cx="${fmt(sx)}" cy="${fmt(top - 8)}" r="1.8" fill="#d9a441" stroke="${INK}" stroke-width="0.6"/>`;
  }
  return svg;
}

/** Silindir (kule): (cx, cy, z) tabanlı, yarıçap r, yükseklik h. c = [açık, koyu, üst]. */
export function cylinder(cx, cy, z, r, h, c) {
  const [light, dark, top] = c;
  const [sx, sy] = P(cx, cy, z);
  const rx = r * 1.414;
  const ry = r * 0.707;
  const ty = sy - h;
  return (
    `<path d="M${fmt(sx - rx)},${fmt(ty)} L${fmt(sx - rx)},${fmt(sy)} A${fmt(rx)},${fmt(ry)} 0 0 0 ${fmt(sx + rx)},${fmt(sy)} L${fmt(sx + rx)},${fmt(ty)}Z" fill="${light}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M${fmt(sx)},${fmt(ty + ry)} L${fmt(sx)},${fmt(sy + ry)} A${fmt(rx)},${fmt(ry)} 0 0 0 ${fmt(sx + rx)},${fmt(sy)} L${fmt(sx + rx)},${fmt(ty)}Z" fill="${dark}" opacity="0.5"/>` +
    `<ellipse cx="${fmt(sx)}" cy="${fmt(ty)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${top}" stroke="${INK}" stroke-width="0.9"/>`
  );
}

/** Koni çatı (kule üstü). */
export function cone(cx, cy, z, r, rise, c) {
  const [light, dark] = c;
  const [sx, sy] = P(cx, cy, z);
  const rx = r * 1.414;
  const ry = r * 0.707;
  return (
    `<path d="M${fmt(sx - rx)},${fmt(sy)} L${fmt(sx)},${fmt(sy - rise)} L${fmt(sx + rx)},${fmt(sy)} A${fmt(rx)},${fmt(ry)} 0 0 1 ${fmt(sx - rx)},${fmt(sy)}Z" fill="${light}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M${fmt(sx)},${fmt(sy - rise)} L${fmt(sx + rx)},${fmt(sy)} A${fmt(rx)},${fmt(ry)} 0 0 1 ${fmt(sx)},${fmt(sy + ry)}Z" fill="${dark}" opacity="0.55"/>`
  );
}

/** Sol yüzde (y = sabit) dikdörtgen: kapı, pencere. u: x boyunca, v: z boyunca. */
export function onLeft(y, x0, z0, w, h, fill, opts) {
  return poly([[x0, y, z0], [x0 + w, y, z0], [x0 + w, y, z0 + h], [x0, y, z0 + h]], fill, opts);
}

/** Sağ yüzde (x = sabit) dikdörtgen. u: y boyunca, v: z boyunca. */
export function onRight(x, y0, z0, d, h, fill, opts) {
  return poly([[x, y0, z0], [x, y0 + d, z0], [x, y0 + d, z0 + h], [x, y0, z0 + h]], fill, opts);
}

/** Sol yüzde kemerli kapı/pencere. */
export function archLeft(y, x0, z0, w, h, fill) {
  const [ax, ay] = P(x0, y, z0);
  const [bx, by] = P(x0 + w, y, z0);
  const [cx, cy] = P(x0 + w, y, z0 + h - w / 2);
  const [dx, dy] = P(x0, y, z0 + h - w / 2);
  const [tx, ty] = P(x0 + w / 2, y, z0 + h + w * 0.1);
  return `<path d="M${fmt(ax)},${fmt(ay)} L${fmt(bx)},${fmt(by)} L${fmt(cx)},${fmt(cy)} Q${fmt(cx)},${fmt(ty)} ${fmt(tx)},${fmt(ty)} Q${fmt(dx)},${fmt(ty)} ${fmt(dx)},${fmt(dy)}Z" fill="${fill}" stroke="${INK}" stroke-width="0.8"/>`;
}

/** Sağ yüzde kemerli kapı/pencere. */
export function archRight(x, y0, z0, d, h, fill) {
  const [ax, ay] = P(x, y0, z0);
  const [bx, by] = P(x, y0 + d, z0);
  const [cx, cy] = P(x, y0 + d, z0 + h - d / 2);
  const [dx, dy] = P(x, y0, z0 + h - d / 2);
  const [tx, ty] = P(x, y0 + d / 2, z0 + h + d * 0.1);
  return `<path d="M${fmt(ax)},${fmt(ay)} L${fmt(bx)},${fmt(by)} L${fmt(cx)},${fmt(cy)} Q${fmt(cx)},${fmt(ty)} ${fmt(tx)},${fmt(ty)} Q${fmt(dx)},${fmt(ty)} ${fmt(dx)},${fmt(dy)}Z" fill="${fill}" stroke="${INK}" stroke-width="0.8"/>`;
}

/** Direk üstünde dalgalanan sancak. */
export function flag(x, y, z, pole, color, { size = 9 } = {}) {
  const [sx, sy] = P(x, y, z);
  const top = sy - pole;
  return (
    `<line x1="${fmt(sx)}" y1="${fmt(sy)}" x2="${fmt(sx)}" y2="${fmt(top)}" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M${fmt(sx)},${fmt(top)} C${fmt(sx + size * 0.5)},${fmt(top - 2)} ${fmt(sx + size * 0.8)},${fmt(top + 2)} ${fmt(sx + size * 1.3)},${fmt(top + 1)} L${fmt(sx + size * 1.1)},${fmt(top + size * 0.35)} L${fmt(sx + size * 1.3)},${fmt(top + size * 0.7)} C${fmt(sx + size * 0.8)},${fmt(top + size * 0.8)} ${fmt(sx + size * 0.5)},${fmt(top + size * 0.5)} ${fmt(sx)},${fmt(top + size * 0.65)}Z" fill="${color}" stroke="${INK}" stroke-width="0.7"/>`
  );
}

/** Zemin üstünde düz yayılan elips gölge. */
export function shadow(cx, cy, rx, ry = rx / 2, opacity = 0.18) {
  const [sx, sy] = P(cx, cy, 0);
  return `<ellipse cx="${fmt(sx)}" cy="${fmt(sy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="#2a1d10" opacity="${opacity}"/>`;
}

/** Zemin karosu (elmas). */
export function tile(x, y, w, d, fill, opts = {}) {
  return poly([[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]], fill, { stroke: 'none', width: 0, ...opts });
}

/** Mazgallı duvar üstü (sol ve sağ kenar boyunca dişler). */
export function crenels(x, y, z, w, d, size, c) {
  let svg = '';
  const step = size * 2;
  for (let i = 0; i + size <= w + 0.01; i += step) svg += box(x + i, y + d - size, z, size, size, size, c);
  for (let j = 0; j + size <= d - size + 0.01; j += step) svg += box(x + w - size, y + j, z, size, size, size, c);
  return svg;
}

/** Ağaç: gövde + yuvarlak taç. */
export function tree(x, y, scale = 1, c = ['#6f8f3d', '#56742c']) {
  const [sx, sy] = P(x, y, 0);
  const h = 10 * scale;
  const r = 7 * scale;
  return (
    `<ellipse cx="${fmt(sx)}" cy="${fmt(sy)}" rx="${fmt(r * 0.9)}" ry="${fmt(r * 0.4)}" fill="#2a1d10" opacity="0.15"/>` +
    `<rect x="${fmt(sx - 1.2 * scale)}" y="${fmt(sy - h)}" width="${fmt(2.4 * scale)}" height="${fmt(h)}" fill="#6b4423" stroke="${INK}" stroke-width="0.6"/>` +
    `<circle cx="${fmt(sx)}" cy="${fmt(sy - h - r * 0.6)}" r="${fmt(r)}" fill="${c[0]}" stroke="${INK}" stroke-width="0.8"/>` +
    `<path d="M${fmt(sx)},${fmt(sy - h - r * 1.6)} A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(sx)},${fmt(sy - h + r * 0.4)}Z" fill="${c[1]}" opacity="0.55"/>`
  );
}

/** Selvi: ince uzun ağaç. */
export function cypress(x, y, scale = 1) {
  const [sx, sy] = P(x, y, 0);
  const h = 26 * scale;
  const w = 4.5 * scale;
  return (
    `<ellipse cx="${fmt(sx)}" cy="${fmt(sy)}" rx="${fmt(w * 1.2)}" ry="${fmt(w * 0.5)}" fill="#2a1d10" opacity="0.15"/>` +
    `<path d="M${fmt(sx)},${fmt(sy - h)} C${fmt(sx + w * 1.3)},${fmt(sy - h * 0.6)} ${fmt(sx + w)},${fmt(sy - 2)} ${fmt(sx)},${fmt(sy)} C${fmt(sx - w)},${fmt(sy - 2)} ${fmt(sx - w * 1.3)},${fmt(sy - h * 0.6)} ${fmt(sx)},${fmt(sy - h)}Z" fill="#4f6b2f" stroke="${INK}" stroke-width="0.8"/>` +
    `<path d="M${fmt(sx)},${fmt(sy - h)} C${fmt(sx + w * 1.3)},${fmt(sy - h * 0.6)} ${fmt(sx + w)},${fmt(sy - 2)} ${fmt(sx)},${fmt(sy)}Z" fill="#3a5222" opacity="0.6"/>`
  );
}
