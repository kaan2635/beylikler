import {
  INK,
  P,
  poly,
  box,
  gableX,
  gableY,
  pyramid,
  dome,
  cylinder,
  cone,
  onLeft,
  onRight,
  archLeft,
  archRight,
  flag,
  shadow,
  tile,
  crenels,
  tree,
  cypress,
} from './iso.js';

/**
 * Bina çizimleri (özgün, vektör). Her bina 40 × 40'lık bir zemin karesine oturur; ekranda
 * (0, 20) merkezlidir. Seviye üç kademede görünür: 1–4 küçük, 5–14 gelişmiş, 15+ görkemli.
 * `buildingArt(id, level)` tam bir <svg> döndürür; `buildingGroup` sahne için yalnız çizimi.
 */

const C = {
  stone: ['#efe4cb', '#d9c7a2', '#b9a57f'],
  sand: ['#f3e2bb', '#dfc794', '#c0a473'],
  white: ['#f7f1e3', '#e6dcc6', '#cbbfa6'],
  wood: ['#cf9b67', '#ae7a45', '#8b5d31'],
  darkwood: ['#8c6239', '#6f4b2a', '#57391f'],
  brick: ['#d98a5f', '#bf6d45', '#9c5433'],
  slate: ['#8f98a3', '#7a838e', '#646c76'],
  roof: ['#c35b34', '#d97a4d', '#a6472a'], // ön eğim, arka eğim, (gerekirse) koyu
  roofDark: ['#9b4a2e', '#b65f3b', '#7d3a23'],
  thatch: ['#d2ac62', '#e3c57f', '#b38e47'],
  turq: ['#58b1b3', '#2f7f84'],
  lead: ['#9aa9b3', '#6f7e88'],
  window: '#3b2c1c',
  lit: '#f2c65c',
  gold: '#d9a441',
  red: '#b83f2c',
  cream: '#f5ead0',
  blue: '#2f5f9e',
  green: '#3f7d4e',
  grass: '#a9ba70',
  grass2: '#95a95e',
  dirt: '#cfb183',
  dirt2: '#b9976a',
  rock: ['#b7b0a3', '#9a9285', '#7f786c'],
  iron: '#6f767e',
};

export function tierOf(level) {
  if (level <= 0) return 0;
  if (level < 5) return 1;
  if (level < 15) return 2;
  return 3;
}

/** İnşa edilmemiş arsa: kazıklar ve iple çevrili toprak. */
function plot() {
  let s = tile(4, 4, 32, 32, C.dirt, { opacity: 0.8 });
  s += poly([[4, 4, 0], [36, 4, 0], [36, 36, 0], [4, 36, 0]], 'none', { stroke: '#8b6b45', width: 0.8, extra: ' stroke-dasharray="3 2"' });
  for (const [x, y] of [[4, 4], [36, 4], [36, 36], [4, 36]]) {
    const [sx, sy] = P(x, y, 0);
    s += `<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy - 7}" stroke="${INK}" stroke-width="1.2"/>`;
  }
  return s;
}

/** Sol yüze pencere dizisi. */
function windowsLeft(y, x0, z, count, gap, w = 3, h = 4, fill = C.window) {
  let s = '';
  for (let i = 0; i < count; i++) s += onLeft(y, x0 + i * gap, z, w, h, fill, { width: 0.6 });
  return s;
}

function windowsRight(x, y0, z, count, gap, w = 3, h = 4, fill = C.window) {
  let s = '';
  for (let i = 0; i < count; i++) s += onRight(x, y0 + i * gap, z, w, h, fill, { width: 0.6 });
  return s;
}

/** Duman: yükselen yarı saydam halkalar. */
function smoke(x, y, z, n = 3, color = '#cfc6b8') {
  const [sx, sy] = P(x, y, z);
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${sx + i * 2.5}" cy="${sy - 4 - i * 6}" r="${2.4 + i * 1.3}" fill="${color}" opacity="${0.75 - i * 0.18}"/>`;
  }
  return s;
}

/** Yandan görünen at silueti (ekran koordinatı, sola bakar). */
function horse(sx, sy, scale = 1, fill = '#7a4e2d') {
  const k = scale;
  const t = `transform="translate(${sx} ${sy}) scale(${k})"`;
  return (
    `<path ${t} d="M-13,-15 L-10,-17 L-8,-16 L-5,-11 C-2,-11 3,-11 6,-11 C8,-11 9,-10 9.5,-8 L9.5,-5 L9,0 L7.6,0 L7.4,-5 L6,-6 L5.4,0 L4,0 L3.6,-6 L-2,-6 L-2.6,0 L-4,0 L-4.2,-6 L-5,-6 L-5.6,0 L-7,0 L-6.8,-7 L-8,-10 L-11,-12.6 L-13.4,-12.2Z" fill="${fill}" stroke="${INK}" stroke-width="${0.7 / k}" stroke-linejoin="round"/>` +
    `<path ${t} d="M-9,-16 C-7,-15 -6,-13 -5,-11" fill="none" stroke="${INK}" stroke-width="${1.3 / k}"/>` +
    `<path ${t} d="M9.5,-8 C12,-7 12,-3 11,-1" fill="none" stroke="${INK}" stroke-width="${1.4 / k}" stroke-linecap="round"/>`
  );
}

/** Deve silueti. */
function camel(sx, sy, scale = 1) {
  const k = scale;
  return `<path transform="translate(${sx} ${sy}) scale(${k})" d="M-12,-14 L-13,-17 L-10,-16 L-8,-12 L-6,-12 C-5,-17 -1,-18 0,-13 C1,-17 5,-17 6,-12 L8,-10 L8,-6 L7,0 L6,0 L5.5,-5 L3,-5 L2.5,0 L1.5,0 L1,-5 L-3,-6 L-3.5,0 L-4.5,0 L-5,-7 L-8,-8 L-9,-12Z" fill="#c9a06a" stroke="${INK}" stroke-width="${0.7 / k}"/>`;
}

/** Kütük yığını (ekranda sola yatık). */
function logs(x, y, count = 3) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const row = i < 2 ? 0 : 1;
    const col = row ? 0.5 : i;
    const [sx, sy] = P(x + col * 4.2, y, row * 3.4);
    s += `<rect x="${sx - 1}" y="${sy - 5.2}" width="10" height="3.6" rx="1.8" fill="${C.wood[1]}" stroke="${INK}" stroke-width="0.6" transform="rotate(26 ${sx} ${sy})"/>`;
    s += `<ellipse cx="${sx - 0.6}" cy="${sy - 3.4}" rx="1.6" ry="1.8" fill="#e9c592" stroke="${INK}" stroke-width="0.6"/>`;
  }
  return s;
}

function crate(x, y, z = 0, size = 5) {
  return box(x, y, z, size, size, size, C.wood) + onLeft(y + size, x + 1, z + 1, size - 2, size - 2, 'none', { stroke: INK, width: 0.4 });
}

function barrel(x, y, z = 0) {
  return cylinder(x, y, z, 2.3, 6, ['#b07a45', '#7d5230', '#d0a06a']);
}

function sack(x, y) {
  const [sx, sy] = P(x, y, 0);
  return (
    `<path d="M${sx - 3.4},${sy - 0.5} C${sx - 4.6},${sy - 4} ${sx - 3},${sy - 6.6} ${sx - 1.2},${sy - 6.8} L${sx + 1.2},${sy - 6.8} C${sx + 3},${sy - 6.6} ${sx + 4.6},${sy - 4} ${sx + 3.4},${sy - 0.5} C${sx + 1.5},${sy + 0.8} ${sx - 1.5},${sy + 0.8} ${sx - 3.4},${sy - 0.5}Z" fill="#e2cfa5" stroke="${INK}" stroke-width="0.6"/>` +
    `<path d="M${sx - 1.4},${sy - 6.8} L${sx},${sy - 8.6} L${sx + 1.4},${sy - 6.8}" fill="#d4bd8c" stroke="${INK}" stroke-width="0.6"/>`
  );
}

/** Tarla: toprak zemin üstünde sıra sıra ekin. */
function field(x, y, w, d, color = '#d9bb5b') {
  let s = tile(x, y, w, d, '#a88752', { stroke: INK, width: 0.6 });
  for (let i = 1; i + 1.4 < w; i += 2.8) {
    s += poly([[x + i, y + 1, 0], [x + i + 1.6, y + 1, 0], [x + i + 1.6, y + d - 1, 0], [x + i, y + d - 1, 0]], color, { stroke: 'none', width: 0 });
    s += poly([[x + i, y + 1, 0.9], [x + i + 1.6, y + 1, 0.9], [x + i + 1.6, y + d - 1, 0.9], [x + i, y + d - 1, 0.9]], color, { stroke: '#8b6b35', width: 0.3, opacity: 0.85 });
  }
  return s;
}

/** Kaya: ekranda düzensiz, gölgeli taş. */
function boulder(x, y, size = 1) {
  const [sx, sy] = P(x, y, 0);
  const k = size;
  return (
    `<path d="M${sx - 7 * k},${sy} L${sx - 8 * k},${sy - 4 * k} L${sx - 4 * k},${sy - 9 * k} L${sx + 2 * k},${sy - 10 * k} L${sx + 7 * k},${sy - 6 * k} L${sx + 8 * k},${sy - 1 * k} L${sx + 3 * k},${sy + 2 * k}Z" fill="${C.rock[0]}" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<path d="M${sx + 2 * k},${sy - 10 * k} L${sx + 7 * k},${sy - 6 * k} L${sx + 8 * k},${sy - 1 * k} L${sx + 3 * k},${sy + 2 * k} L${sx + 1 * k},${sy - 4 * k}Z" fill="${C.rock[2]}" opacity="0.8"/>`
  );
}

function fence(x0, y0, x1, y1, posts = 5) {
  let s = '';
  const pts = [];
  for (let i = 0; i <= posts; i++) pts.push(P(x0 + ((x1 - x0) * i) / posts, y0 + ((y1 - y0) * i) / posts, 0));
  s += `<polyline points="${pts.map(([a, b]) => `${a},${b - 4}`).join(' ')}" fill="none" stroke="${C.darkwood[1]}" stroke-width="1"/>`;
  s += `<polyline points="${pts.map(([a, b]) => `${a},${b - 2}`).join(' ')}" fill="none" stroke="${C.darkwood[1]}" stroke-width="1"/>`;
  for (const [a, b] of pts) s += `<line x1="${a}" y1="${b}" x2="${a}" y2="${b - 5.5}" stroke="${INK}" stroke-width="1.1"/>`;
  return s;
}

// ---------- Binalar ----------

const ART = {
  konak(t) {
    let s = shadow(20, 20, 30, 15);
    if (t >= 2) {
      s += box(24, 4, 0, 12, 14, 12, C.white) + windowsRight(36, 7, 5, 2, 5);
      s += pyramid(24, 4, 12, 12, 14, 8, [C.roof[0], C.roofDark[0], C.roof[1]], 1.5);
    }
    const h = t >= 2 ? 20 : 16;
    s += box(4, 10, 0, 24, 24, h, C.white);
    // Ahşap hatıllar (Anadolu konağı)
    s += onLeft(34, 4, h * 0.5, 24, 0.9, C.darkwood[1], { width: 0.3 }) + onRight(28, 10, h * 0.5, 24, 0.9, C.darkwood[2], { width: 0.3 });
    s += archLeft(34, 13, 0, 6, 9.5, C.darkwood[2]);
    s += windowsLeft(34, 6, h - 7, 1, 0) + windowsRight(28, 14, h - 7, 3, 6);
    if (t >= 2) {
      // Cumba: üst katta sokağa taşan kapalı çıkma
      s += box(20, 34, h * 0.55, 6, 4, h * 0.4, C.white) + onLeft(38, 21, h * 0.62, 4, h * 0.22, C.window, { width: 0.5 });
    } else {
      s += windowsLeft(34, 22, h - 7, 1, 0);
    }
    s += pyramid(4, 10, h, 24, 24, t >= 2 ? 18 : 14, [C.roof[0], C.roofDark[0], C.roof[1]]);
    s += flag(16, 22, h + (t >= 2 ? 18 : 14), t >= 3 ? 16 : 10, C.red, { size: t >= 3 ? 11 : 8 });
    if (t >= 3) s += cypress(0, 36, 0.85) + cypress(36, 38, 0.7);
    return s;
  },

  oduncu(t) {
    let s = '';
    s += tree(6, 2, 1.1) + (t >= 2 ? tree(14, 0, 0.9) + tree(0, 10, 1) : '');
    s += shadow(22, 24, 20, 10);
    s += box(16, 12, 0, 16, 14, 10, C.wood);
    s += onLeft(26, 20, 0, 5, 7, C.darkwood[2]) + onRight(32, 16, 4, 3, 3, C.window, { width: 0.6 });
    s += gableX(16, 12, 10, 16, 14, 8, [C.thatch[0], C.thatch[1], C.wood[2]]);
    s += logs(4, 30, t >= 2 ? 3 : 2);
    if (t >= 3) s += logs(24, 36, 3);
    // Kesme kütüğü ve balta
    s += cylinder(34, 32, 0, 2.6, 3.5, ['#b07a45', '#7d5230', '#e9c592']);
    const [ax, ay] = P(34, 32, 3.5);
    s += `<line x1="${ax}" y1="${ay}" x2="${ax + 5}" y2="${ay - 7}" stroke="${C.darkwood[2]}" stroke-width="1.3"/><path d="M${ax + 3.4},${ay - 8.6} l3.4,1.6 l-1.2,2.6 z" fill="#9aa3ab" stroke="${INK}" stroke-width="0.5"/>`;
    return s;
  },

  kilocagi(t) {
    let s = shadow(20, 20, 28, 14);
    // Kil çukuru
    s += tile(2, 22, 16, 14, '#a36b45') + tile(4, 24, 12, 10, '#8a5638');
    // Fırın: tuğla kubbe ve baca
    s += cylinder(26, 14, 0, 9, 6, [C.brick[1], C.brick[2], C.brick[0]]);
    s += dome(26, 14, 6, 9, [C.brick[0], C.brick[2]], { finial: false });
    const [fx, fy] = P(26, 23, 3);
    s += `<path d="M${fx - 3},${fy + 2} L${fx - 3},${fy - 2} Q${fx},${fy - 6} ${fx + 3},${fy - 2} L${fx + 3},${fy + 2}Z" fill="#3a1d10" stroke="${INK}" stroke-width="0.6"/><circle cx="${fx}" cy="${fy - 0.5}" r="1.6" fill="#f08a3c"/>`;
    s += box(30, 10, 10, 3, 3, 12, C.brick) + smoke(31.5, 11.5, 22, t >= 2 ? 4 : 3);
    // Tuğla istifleri
    s += box(4, 4, 0, 8, 6, 4, C.brick) + (t >= 2 ? box(4, 4, 4, 8, 6, 3, C.brick) : '');
    if (t >= 3) s += box(30, 30, 0, 8, 6, 5, C.brick) + box(30, 30, 5, 8, 6, 3, C.brick);
    return s;
  },

  demirmadeni(t) {
    let s = shadow(20, 20, 30, 15);
    // Kayalık tepe: ekranda çizilmiş, basamaklı taş yüzler
    const [bx, by] = P(20, 20, 0);
    s += `<path d="M${bx - 38},${by + 2} L${bx - 30},${by - 14} L${bx - 20},${by - 20} L${bx - 12},${by - 34} L${bx - 2},${by - 38} L${bx + 8},${by - 30} L${bx + 18},${by - 32} L${bx + 28},${by - 16} L${bx + 38},${by} L${bx + 20},${by + 14} L${bx - 20},${by + 14}Z" fill="${C.rock[1]}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`;
    s += `<path d="M${bx - 2},${by - 38} L${bx + 8},${by - 30} L${bx + 18},${by - 32} L${bx + 28},${by - 16} L${bx + 38},${by} L${bx + 20},${by + 14} L${bx + 6},${by - 8} L${bx + 2},${by - 26}Z" fill="${C.rock[2]}" stroke="${INK}" stroke-width="0.7" stroke-linejoin="round"/>`;
    s += `<path d="M${bx - 12},${by - 34} L${bx - 2},${by - 38} L${bx + 2},${by - 26} L${bx - 8},${by - 22}Z" fill="${C.rock[0]}" stroke="${INK}" stroke-width="0.6" stroke-linejoin="round"/>`;
    s += `<path d="M${bx - 30},${by - 14} L${bx - 20},${by - 20} L${bx - 16},${by - 10} L${bx - 26},${by - 6}Z" fill="${C.rock[0]}" stroke="${INK}" stroke-width="0.6" stroke-linejoin="round"/>`;
    // Yamaçta çalılar
    s += `<ellipse cx="${bx - 24}" cy="${by + 4}" rx="5" ry="3" fill="#7d9443" stroke="${INK}" stroke-width="0.6"/><ellipse cx="${bx + 26}" cy="${by + 3}" rx="4" ry="2.6" fill="#7d9443" stroke="${INK}" stroke-width="0.6"/>`;
    // Maden ağzı ve ahşap çatkı
    const [mx, my] = P(18, 26, 0);
    s += `<path d="M${mx - 7},${my} L${mx - 7},${my - 9} Q${mx},${my - 16} ${mx + 7},${my - 9} L${mx + 7},${my}Z" fill="#1f160e" stroke="${INK}" stroke-width="0.8"/>`;
    s += `<path d="M${mx - 8},${my} L${mx - 8},${my - 11} L${mx + 8},${my - 11} L${mx + 8},${my}" fill="none" stroke="${C.darkwood[0]}" stroke-width="2.2"/>`;
    // Raylar ve vagon
    const [r1x, r1y] = P(18, 28, 0);
    const [r2x, r2y] = P(18, 40, 0);
    s += `<line x1="${r1x - 3}" y1="${r1y}" x2="${r2x - 3}" y2="${r2y}" stroke="#5b4a38" stroke-width="1"/><line x1="${r1x + 3}" y1="${r1y}" x2="${r2x + 3}" y2="${r2y}" stroke="#5b4a38" stroke-width="1"/>`;
    s += box(15, 32, 1, 7, 5, 4, [C.iron, '#5d646b', '#4b5157']);
    s += poly([[15.5, 33, 5], [21.5, 33, 5], [21.5, 36.5, 7], [15.5, 36.5, 7]], '#8c6b5a', { width: 0.5 });
    // Cevher yığını
    const [ox, oy] = P(32, 32, 0);
    s += `<path d="M${ox - 7},${oy} Q${ox},${oy - 9} ${ox + 7},${oy}Z" fill="#8c6b5a" stroke="${INK}" stroke-width="0.7"/>`;
    if (t >= 2) s += `<circle cx="${ox - 2}" cy="${oy - 3}" r="1" fill="#c9d1d8"/><circle cx="${ox + 2}" cy="${oy - 2}" r="1" fill="#c9d1d8"/>`;
    if (t >= 3) {
      const [fx, fy] = P(20, 20, 0);
      s += `<line x1="${fx - 2}" y1="${fy - 38}" x2="${fx - 2}" y2="${fy - 52}" stroke="${INK}" stroke-width="1.1"/><path d="M${fx - 2},${fy - 52} l9,2 l-9,4z" fill="${C.red}" stroke="${INK}" stroke-width="0.6"/>`;
    }
    return s;
  },

  ambar(t) {
    let s = shadow(20, 20, 32, 16);
    if (t >= 3) {
      s += box(26, 0, 0, 12, 12, 10, C.wood) + gableY(26, 0, 10, 12, 12, 7, [C.roofDark[0], C.roof[1], C.wood[2]]);
    }
    const h = t >= 2 ? 16 : 13;
    s += box(2, 10, 0, 28, 24, h, C.wood);
    // Tahta çizgileri
    for (let i = 4; i < 28; i += 4) s += onLeft(34, 2 + i, 0, 0.01, h, 'none', { stroke: '#8b5d31', width: 0.5 });
    s += onLeft(34, 11, 0, 10, 10, C.darkwood[2]);
    s += `<g stroke="${C.wood[0]}" stroke-width="0.8">${[0, 1].map((k) => { const [a, b] = P(11 + k * 10, 34, 0); const [c2, d2] = P(21 - k * 10, 34, 10); return `<line x1="${a}" y1="${b}" x2="${c2}" y2="${d2}"/>`; }).join('')}</g>`;
    s += windowsRight(30, 16, h - 6, 2, 8);
    s += gableX(2, 10, h, 28, 24, 14, [C.roofDark[0], C.roof[1], C.wood[2]]);
    s += sack(34, 30) + sack(36, 26) + crate(33, 18) + (t >= 2 ? crate(33, 18, 5) + barrel(8, 38) : '');
    return s;
  },

  ciftlik(t) {
    let s = '';
    s += field(-2, -2, 20, 18) + field(22, -2, 18, 14, '#9fc05a');
    if (t >= 2) s += field(-2, 20, 14, 20, '#d9bb5b');
    s += shadow(28, 26, 18, 9);
    s += box(18, 16, 0, 20, 16, 13, C.white);
    s += onLeft(32, 22, 6.5, 14, 0.8, C.darkwood[1], { width: 0.3 });
    s += onLeft(32, 26, 0, 4.5, 7.5, C.darkwood[2]) + onLeft(32, 20, 8, 2.6, 3, C.window, { width: 0.5 }) + onLeft(32, 33, 8, 2.6, 3, C.window, { width: 0.5 });
    s += windowsRight(38, 20, 8, 2, 6, 2.6, 3);
    s += gableY(18, 16, 13, 20, 16, 9, [C.roofDark[0], C.roof[1], C.white[2]]);
    // Saman yığınları
    s += cone(12, 34, 0, 5, 12, [C.thatch[0], C.thatch[2]]);
    if (t >= 3) s += cone(4, 40, 0, 4, 9, [C.thatch[0], C.thatch[2]]) + fence(18, 40, 40, 40, 4);
    return s;
  },

  gizlidepo(t) {
    let s = '';
    s += tree(4, 6, 0.9) + (t >= 2 ? tree(32, 2, 0.8) : '');
    s += shadow(20, 22, 22, 11, 0.12);
    // Kaya ve çalılar
    s += boulder(28, 12, 1.1);
    // Mahzen kapağı
    s += tile(12, 18, 14, 12, '#6f4b2a');
    s += poly([[13, 19, 0.5], [25, 19, 0.5], [25, 29, 0.5], [13, 29, 0.5]], C.darkwood[0], { width: 0.7 });
    for (let i = 16; i < 25; i += 3) s += poly([[i, 19, 0.6], [i + 0.3, 19, 0.6], [i + 0.3, 29, 0.6], [i, 29, 0.6]], INK, { stroke: 'none', width: 0 });
    const [rx, ry] = P(19, 24, 0.6);
    s += `<circle cx="${rx}" cy="${ry}" r="1.6" fill="none" stroke="${C.gold}" stroke-width="0.9"/>`;
    s += barrel(30, 30) + (t >= 2 ? barrel(34, 26) : '');
    const bush = (x, y) => { const [bx, by] = P(x, y, 0); return `<ellipse cx="${bx}" cy="${by - 3}" rx="6" ry="4" fill="#6f8f3d" stroke="${INK}" stroke-width="0.7"/>`; };
    s += bush(8, 30) + bush(28, 36) + (t >= 3 ? bush(14, 36) : '');
    return s;
  },

  kisla(t) {
    let s = shadow(20, 20, 32, 16);
    const h = t >= 2 ? 14 : 12;
    s += box(2, 12, 0, 34, 20, h, C.stone);
    s += crenels(2, 12, h, 34, 20, 2.4, C.stone);
    s += archLeft(32, 15, 0, 6, 9, C.darkwood[2]);
    s += windowsLeft(32, 5, h - 6, 2, 5, 2.5, 3.5) + windowsLeft(32, 25, h - 6, 2, 5, 2.5, 3.5);
    s += windowsRight(36, 15, h - 6, 3, 5, 2.5, 3.5);
    if (t >= 2) s += box(28, 4, 0, 10, 10, h + 8, C.stone) + crenels(28, 4, h + 8, 10, 10, 2.2, C.stone);
    s += flag(t >= 2 ? 33 : 20, t >= 2 ? 9 : 22, t >= 2 ? h + 10 : h + 2, 14, C.red, { size: 10 });
    // Mızrak sehpası
    const [sx, sy] = P(10, 38, 0);
    s += `<g stroke="${C.darkwood[2]}" stroke-width="1">${[0, 3, 6].map((d) => `<line x1="${sx + d}" y1="${sy}" x2="${sx + d - 2}" y2="${sy - 14}"/>`).join('')}</g>`;
    s += `<g fill="#aeb6bd" stroke="${INK}" stroke-width="0.4">${[0, 3, 6].map((d) => `<path d="M${sx + d - 2},${sy - 14} l-1,-3 l2,0z"/>`).join('')}</g>`;
    if (t >= 3) {
      // İkinci kule ve talim alanında kalkanlar
      s += box(2, 30, 0, 8, 8, h + 6, C.stone) + crenels(2, 30, h + 6, 8, 8, 2, C.stone);
      const [qx, qy] = P(30, 38, 0);
      s += `<circle cx="${qx}" cy="${qy - 4}" r="3.2" fill="${C.red}" stroke="${INK}" stroke-width="0.7"/><circle cx="${qx}" cy="${qy - 4}" r="1.1" fill="${C.gold}"/>`;
    }
    return s;
  },

  ahir(t) {
    let s = '';
    s += shadow(20, 18, 30, 14);
    s += box(4, 4, 0, 30, 16, 12, C.wood);
    for (let i = 0; i < 3; i++) s += archLeft(20, 7 + i * 9, 0, 6, 9, '#2a1d12');
    s += gableX(4, 4, 12, 30, 16, 9, [C.roofDark[0], C.roof[1], C.wood[2]]);
    s += fence(2, 24, 38, 24, 6) + fence(38, 24, 38, 40, 3);
    const [hx, hy] = P(18, 32, 0);
    s += horse(hx, hy, 1);
    if (t >= 2) { const [h2x, h2y] = P(30, 34, 0); s += horse(h2x, h2y, 0.9, '#3d2a1a'); }
    if (t >= 3) { const [h3x, h3y] = P(10, 38, 0); s += horse(h3x, h3y, 0.85, '#d8c7a6'); }
    s += cone(36, 8, 0, 3.5, 8, [C.thatch[0], C.thatch[2]]);
    return s;
  },

  atolye(t) {
    let s = shadow(20, 20, 30, 15);
    // Direkli sundurma
    for (const [x, y] of [[4, 6], [26, 6], [4, 20], [26, 20]]) s += box(x, y, 0, 1.6, 1.6, 12, C.darkwood);
    s += gableX(3, 5, 12, 26, 17, 7, [C.roofDark[0], C.roof[1], C.darkwood[1]]);
    s += box(8, 10, 0, 12, 6, 3, C.wood);
    // Mancınık iskeleti
    const [bx, by] = P(26, 32, 0);
    s += `<g stroke="${C.darkwood[2]}" stroke-width="1.6" stroke-linecap="round"><line x1="${bx - 8}" y1="${by}" x2="${bx + 8}" y2="${by}"/><line x1="${bx - 6}" y1="${by}" x2="${bx}" y2="${by - 14}"/><line x1="${bx + 6}" y1="${by}" x2="${bx}" y2="${by - 14}"/></g>`;
    s += `<line x1="${bx - 12}" y1="${by - 20}" x2="${bx + 8}" y2="${by - 8}" stroke="${C.wood[1]}" stroke-width="2" stroke-linecap="round"/><circle cx="${bx - 12}" cy="${by - 20}" r="2" fill="#8f877a" stroke="${INK}" stroke-width="0.6"/>`;
    s += `<rect x="${bx + 5}" y="${by - 9}" width="5" height="5" fill="${C.darkwood[0]}" stroke="${INK}" stroke-width="0.6"/>`;
    if (t >= 2) {
      // Koçbaşı
      s += box(4, 30, 1.5, 12, 5, 4, C.darkwood);
      const [w1x, w1y] = P(6, 35, 1.5);
      const [w2x, w2y] = P(14, 35, 1.5);
      s += `<circle cx="${w1x}" cy="${w1y}" r="2.2" fill="${C.wood[1]}" stroke="${INK}" stroke-width="0.6"/><circle cx="${w2x}" cy="${w2y}" r="2.2" fill="${C.wood[1]}" stroke="${INK}" stroke-width="0.6"/>`;
      s += box(16, 31.5, 3, 4, 2, 2, [C.iron, '#5d646b', '#4b5157']);
    }
    if (t >= 3) s += logs(30, 12, 3);
    return s;
  },

  demirci(t) {
    let s = shadow(20, 20, 28, 14);
    s += box(6, 6, 0, 22, 20, 12, C.stone);
    s += onLeft(26, 10, 0, 8, 7, '#2a1a10');
    s += onLeft(26.01, 11, 1, 6, 4, '#f08a3c', { width: 0.3 });
    s += windowsRight(28, 10, 6, 2, 7);
    s += gableX(6, 6, 12, 22, 20, 9, [C.slate[0], C.slate[1], C.stone[2]]);
    s += box(22, 8, 10, 4, 4, 14, C.brick);
    s += smoke(24, 10, 24, 3, '#a8a097');
    // Tente
    s += poly([[8, 26, 9], [22, 26, 9], [22, 32, 6], [8, 32, 6]], C.red);
    s += `<g stroke="${INK}" stroke-width="0.8">${[[8, 32], [22, 32]].map(([x, y]) => { const [a, b] = P(x, y, 0); const [, d] = P(x, y, 6); return `<line x1="${a}" y1="${b}" x2="${a}" y2="${d}"/>`; }).join('')}</g>`;
    // Örs
    const [ax, ay] = P(28, 34, 0);
    s += `<path d="M${ax - 5},${ay - 5} L${ax + 5},${ay - 5} L${ax + 3},${ay - 3} L${ax + 1.5},${ay - 3} L${ax + 2},${ay} L${ax - 2},${ay} L${ax - 1.5},${ay - 3} L${ax - 4},${ay - 3}Z" fill="#555c63" stroke="${INK}" stroke-width="0.6"/>`;
    if (t >= 2) s += barrel(34, 26);
    if (t >= 3) {
      const [kx, ky] = P(14, 36, 0);
      s += `<g stroke="#9aa3ab" stroke-width="1.2"><line x1="${kx}" y1="${ky}" x2="${kx - 3}" y2="${ky - 12}"/><line x1="${kx + 3}" y1="${ky}" x2="${kx + 5}" y2="${ky - 12}"/></g>`;
    }
    return s;
  },

  pazar(t) {
    let s = shadow(20, 20, 32, 16, 0.12);
    s += tile(2, 2, 36, 36, '#d9c49c');
    const stall = (x, y, color) => {
      let v = box(x, y, 0, 10, 8, 4, C.wood);
      for (const [px, py] of [[x, y + 8], [x + 10, y + 8], [x + 10, y]]) {
        const [a, b] = P(px, py, 4);
        const [, d] = P(px, py, 11);
        v += `<line x1="${a}" y1="${b}" x2="${a}" y2="${d}" stroke="${INK}" stroke-width="0.9"/>`;
      }
      // Çizgili tente
      for (let i = 0; i < 5; i++) {
        v += poly([[x - 1 + i * 2.4, y - 1, 12], [x + 1.4 + i * 2.4, y - 1, 12], [x + 1.4 + i * 2.4, y + 10, 9], [x - 1 + i * 2.4, y + 10, 9]], i % 2 ? C.cream : color, { width: 0.5 });
      }
      const [gx, gy] = P(x + 3, y + 5, 4);
      v += `<circle cx="${gx}" cy="${gy}" r="1.5" fill="#e0662f"/><circle cx="${gx + 3}" cy="${gy + 1}" r="1.5" fill="#86a33c"/><circle cx="${gx + 6}" cy="${gy + 2}" r="1.5" fill="#e8b93a"/>`;
      return v;
    };
    s += stall(4, 4, C.red);
    if (t >= 2) s += stall(24, 4, C.blue);
    s += stall(4, 24, t >= 2 ? C.green : C.red);
    if (t >= 3) s += stall(24, 24, C.red);
    else s += crate(28, 28) + sack(34, 22);
    return s;
  },

  kervansaray(t) {
    let s = shadow(20, 20, 32, 16);
    // Avlu duvarları
    s += box(2, 2, 0, 34, 6, 12, C.sand);
    s += box(2, 8, 0, 6, 28, 12, C.sand);
    s += tile(8, 8, 28, 28, '#e3cfa2');
    s += box(30, 8, 0, 6, 28, 12, C.sand);
    s += box(8, 30, 0, 22, 6, 12, C.sand);
    // Kapı kulesi
    s += box(14, 30, 0, 10, 7, 17, C.sand);
    s += archLeft(37, 16, 0, 6, 12, '#3a2716');
    s += onLeft(37.01, 14, 15, 10, 1.3, C.turq[0], { width: 0.3 });
    // Revak kemerleri
    for (let i = 0; i < 3; i++) s += archRight(36, 12 + i * 8, 0, 4, 8, '#8a6a45');
    s += dome(19, 33, 17, 4.5, C.turq);
    if (t >= 2) s += dome(5, 5, 12, 3.5, C.turq, { finial: false }) + dome(33, 5, 12, 3.5, C.turq, { finial: false });
    const [cx, cy] = P(42, 24, 0);
    s += camel(cx, cy, 0.85);
    if (t >= 3) {
      const [dx, dy] = P(44, 34, 0);
      s += camel(dx, dy, 0.8);
    }
    return s;
  },

  saray(t) {
    let s = shadow(20, 20, 34, 17);
    const h = t >= 2 ? 18 : 15;
    const tower = t >= 2 ? h + 14 : h + 10;
    // Arka köşedeki kule
    s += cylinder(6, 8, 0, 3.6, tower, C.white) + cone(6, 8, tower, 4, 12, [C.turq[0], C.turq[1]]);
    s += box(6, 8, 0, 28, 26, h, C.white);
    s += onLeft(34, 6, h - 3, 28, 1.4, C.turq[0], { width: 0.3 });
    s += onRight(34, 8, h - 3, 26, 1.4, C.turq[0], { width: 0.3 });
    s += archLeft(34, 16, 0, 8, 12, '#3a2716');
    for (const x of [8, 27]) s += archLeft(34, x, 5, 4, 7, C.window);
    for (const y of [11, 19, 27]) s += archRight(34, y, 5, 3.5, 7, C.window);
    s += dome(20, 21, h, 10, C.turq);
    // Sol ve sağ köşe kuleleri kapıyı çevreler
    s += cylinder(6, 34, 0, 3.6, tower, C.white) + cone(6, 34, tower, 4, 12, [C.turq[0], C.turq[1]]);
    s += cylinder(34, 8, 0, 3.6, tower, C.white) + cone(34, 8, tower, 4, 12, [C.turq[0], C.turq[1]]);
    if (t >= 2) s += flag(20, 21, h + 23, 12, C.red, { size: 9 });
    if (t >= 3) s += cypress(-2, 40, 0.8) + cypress(40, -2, 0.8);
    return s;
  },

  sur(t) {
    let s = shadow(20, 26, 34, 12);
    const h = t >= 2 ? 14 : 11;
    s += box(0, 22, 0, 40, 7, h, C.stone);
    s += crenels(0, 22, h, 40, 7, 2.2, C.stone);
    s += archLeft(29, 16, 0, 8, 10, '#3a2716');
    s += onLeft(29.01, 17, 1, 6, 7, 'none', { stroke: C.iron, width: 0.6 });
    const towerR = t >= 2 ? 5.5 : 4.5;
    s += cylinder(2, 26, 0, towerR, h + 7, C.stone) + cone(2, 26, h + 7, towerR + 0.6, t >= 3 ? 12 : 9, [C.roof[0], C.roofDark[2]]);
    s += cylinder(38, 26, 0, towerR, h + 7, C.stone) + cone(38, 26, h + 7, towerR + 0.6, t >= 3 ? 12 : 9, [C.roof[0], C.roofDark[2]]);
    if (t >= 3) s += flag(20, 25, h + 2, 12, C.red, { size: 8 });
    return s;
  },
};

// ---------- Harita imleri ----------

/** Barbar obası: saz damlı kulübeler, büyüdükçe çit. */
function hamlet(t) {
  let s = shadow(20, 20, 30, 15);
  const hut = (x, y, w = 12) => box(x, y, 0, w, w * 0.8, 7, C.wood) + onLeft(y + w * 0.8, x + w / 2 - 1.5, 0, 3, 4.5, C.darkwood[2], { width: 0.5 }) + gableX(x, y, 7, w, w * 0.8, 6, [C.thatch[0], C.thatch[1], C.wood[2]], 1.5);
  if (t >= 2) s += hut(22, 4, 11);
  s += hut(6, 10, 13);
  if (t >= 3) s += hut(24, 20, 11) + fence(0, 38, 38, 38, 6);
  s += hut(14, 22, t >= 2 ? 12 : 10);
  return s;
}

/** Bey hisarı: mazgallı taş kale, köşe kuleleri ve beyin sancağı. */
function keep(t, banner) {
  let s = shadow(20, 20, 32, 16);
  const h = 12 + t * 3;
  s += box(4, 4, 0, 32, 32, h - 4, C.stone) + crenels(4, 4, h - 4, 32, 32, 2.4, C.stone);
  s += archLeft(36, 16, 0, 8, 10, '#3a2716');
  s += box(14, 14, 0, 12, 12, h + 8, C.stone) + crenels(14, 14, h + 8, 12, 12, 2.2, C.stone);
  for (const [x, y] of [[4, 36], [36, 4], [36, 36]]) s += cylinder(x, y, 0, 4, h + 2, C.stone) + cone(x, y, h + 2, 4.6, 8, [C.slate[0], C.slate[2]]);
  s += flag(20, 20, h + 10, 14, banner, { size: 11 });
  return s;
}

/** Haritadaki köy imi (tam SVG). kind: 'oyuncu' | 'bey' | 'barbar'; tier 1..3. */
export function mapSpriteSvg(kind, tier) {
  const inner = kind === 'bey' ? keep(tier, '#7c4dbb') : kind === 'oyuncu' ? ART.konak(tier) : hamlet(tier);
  return `<svg viewBox="-46 -56 92 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/** Bina çizimi (yalnız grup; 40 × 40 zemin, ekranda (0, 20) merkezli). */
export function buildingGroup(id, level) {
  const t = tierOf(level);
  if (!t) return plot();
  return (ART[id] ?? ART.konak)(t);
}

/** Kart ve simge için tam SVG. Seviye 0'da binanın kendisi soluk gösterilir. */
export function buildingArt(id, level, { ghost = false } = {}) {
  const shown = level > 0 ? level : 1;
  const inner = (ART[id] ?? ART.konak)(tierOf(shown));
  return `<svg viewBox="-43 -47 86 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${ghost || level <= 0 ? ' class="ghost"' : ''}>${inner}</svg>`;
}

export const BUILDING_ART_IDS = Object.keys(ART);
