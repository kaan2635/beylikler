import { P, poly, tile } from './iso.js';
import { buildingImage, tierOf } from './sprites.js';

/**
 * Köy sahnesi: binalar kendi arsalarında, gerçekçi (önceden işlenmiş) görsellerle ve seviyelerine
 * göre büyüyerek görünür. Zemin dokulu çimen, yollar toprak; sur köyü taş bir halka olarak
 * çevirir, köşelerinde kuleler durur. Yapımı süren binanın önünde iskele vardır.
 * Sahne tek bir SVG metnidir; tıklanabilir binalar `data-building` taşır.
 */

const PITCH = 46; // arsa aralığı (dünya birimi)
const COLS = 5;
const ROWS = 4;
const W = COLS * PITCH;
const D = ROWS * PITCH;

// Arsalar: [sütun (x), satır (y)] — kaynak binaları kıyıda, konak ortada, askeriye önde.
export const SLOTS = {
  oduncu: [0, 0],
  demirmadeni: [1, 0],
  kilocagi: [2, 0],
  ciftlik: [3, 0],
  gizlidepo: [0, 1],
  ambar: [1, 1],
  konak: [2, 1],
  demirci: [3, 1],
  ahir: [4, 1],
  pazar: [1, 2],
  saray: [2, 2],
  kisla: [3, 2],
  atolye: [4, 2],
  kervansaray: [0, 3],
};

// Süs arsaları: koru, gölet, meydan, bahçe.
const DECOR = [
  { at: [4, 0], kind: 'grove' },
  { at: [0, 2], kind: 'pond' },
  { at: [1, 3], kind: 'grove2' },
  { at: [2, 3], kind: 'square' },
  { at: [3, 3], kind: 'grove3' },
  { at: [4, 3], kind: 'orchard' },
];

// Binaların görsel boyu (arsa genişliğine oranla) ve kademe çarpanı.
const SIZE = { saray: 1.18, kisla: 1.06, ahir: 1.04, kervansaray: 1.04, konak: 1.02, demirmadeni: 0.9, oduncu: 0.92, kilocagi: 0.84, gizlidepo: 0.8 };
const TIER_SCALE = [0.72, 0.74, 0.87, 1];

const f = (n) => Math.round(n * 10) / 10;

function translate(col, row) {
  const [sx, sy] = P(col * PITCH + 3, row * PITCH + 3, 0);
  return `translate(${f(sx)} ${f(sy)})`;
}

/** Doğal ağaç: çizgisiz, gölgeli, üst üste binen yapraklar. */
function tree(x, y, scale = 1, hue = 0) {
  const [sx, sy] = P(x, y, 0);
  const k = scale;
  const dark = hue ? '#3f5a2a' : '#355124';
  const mid = hue ? '#557a36' : '#4a6d30';
  const light = hue ? '#789c4a' : '#6b8f40';
  return (
    `<ellipse cx="${f(sx + 3 * k)}" cy="${f(sy)}" rx="${f(9 * k)}" ry="${f(3.6 * k)}" fill="#1e2a10" opacity="0.28"/>` +
    `<rect x="${f(sx - 1.2 * k)}" y="${f(sy - 9 * k)}" width="${f(2.4 * k)}" height="${f(9 * k)}" fill="#5a3d22"/>` +
    `<circle cx="${f(sx - 3 * k)}" cy="${f(sy - 12 * k)}" r="${f(6 * k)}" fill="${dark}"/>` +
    `<circle cx="${f(sx + 3.5 * k)}" cy="${f(sy - 13 * k)}" r="${f(6.2 * k)}" fill="${dark}"/>` +
    `<circle cx="${f(sx)}" cy="${f(sy - 17 * k)}" r="${f(6.6 * k)}" fill="${mid}"/>` +
    `<circle cx="${f(sx - 2 * k)}" cy="${f(sy - 19 * k)}" r="${f(3.6 * k)}" fill="${light}" opacity="0.9"/>` +
    `<circle cx="${f(sx + 2.8 * k)}" cy="${f(sy - 15 * k)}" r="${f(2.6 * k)}" fill="${light}" opacity="0.7"/>`
  );
}

function cypress(x, y, scale = 1) {
  const [sx, sy] = P(x, y, 0);
  const h = 24 * scale;
  const w = 4.4 * scale;
  return (
    `<ellipse cx="${f(sx + 2)}" cy="${f(sy)}" rx="${f(w * 1.4)}" ry="${f(w * 0.5)}" fill="#1e2a10" opacity="0.28"/>` +
    `<path d="M${f(sx)},${f(sy - h)} C${f(sx + w * 1.3)},${f(sy - h * 0.6)} ${f(sx + w)},${f(sy - 2)} ${f(sx)},${f(sy)} C${f(sx - w)},${f(sy - 2)} ${f(sx - w * 1.3)},${f(sy - h * 0.6)} ${f(sx)},${f(sy - h)}Z" fill="#2f4a22"/>` +
    `<path d="M${f(sx)},${f(sy - h)} C${f(sx - w * 1.3)},${f(sy - h * 0.6)} ${f(sx - w)},${f(sy - 2)} ${f(sx)},${f(sy)}Z" fill="#46663a" opacity="0.8"/>`
  );
}

function decor(kind) {
  switch (kind) {
    case 'grove':
      return tree(8, 6, 1.1) + tree(26, 4, 0.9, 1) + tree(16, 22, 1) + cypress(34, 20, 0.9);
    case 'grove2':
      return tree(10, 10, 0.9, 1) + cypress(30, 12, 1) + tree(22, 30, 1);
    case 'grove3':
      return tree(10, 10, 1) + cypress(28, 14, 1) + tree(24, 30, 0.9, 1) + cypress(8, 32, 0.8);
    case 'orchard': {
      let s = tile(2, 2, 36, 36, 'url(#scene-field)', { opacity: 0.9 });
      for (const [x, y] of [[8, 8], [22, 8], [8, 24], [22, 24], [34, 16]]) s += tree(x, y, 0.7, 1);
      return s;
    }
    case 'pond': {
      const [cx, cy] = P(20, 20, 0);
      return (
        `<ellipse cx="${cx}" cy="${cy + 1}" rx="31" ry="15" fill="#5b6b3a" opacity="0.6"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="29" ry="13.5" fill="url(#scene-water)"/>` +
        `<ellipse cx="${cx - 8}" cy="${cy - 4}" rx="11" ry="3" fill="#cfe5ee" opacity="0.45"/>` +
        tree(2, 32, 0.8) +
        tree(36, 2, 0.8, 1)
      );
    }
    case 'square':
      return tile(2, 2, 36, 36, 'url(#scene-cobble)') + tree(20, 20, 1.4);
    default:
      return '';
  }
}

/** Arsa: inşa edilmemiş bina için sürülmüş toprak. */
function plot() {
  return tile(4, 4, 32, 32, 'url(#scene-dirt)', { opacity: 0.85 }) + poly([[4, 4, 0], [36, 4, 0], [36, 36, 0], [4, 36, 0]], 'none', { stroke: '#7a5a36', width: 0.7, extra: ' stroke-dasharray="3 2"' });
}

/** Bina görseli: arsanın ortasına, tabanı arsaya oturacak biçimde. */
function buildingSprite(id, level) {
  const size = 74 * (SIZE[id] ?? 1) * TIER_SCALE[tierOf(level)];
  const height = size * 1.3;
  const [cx, cy] = P(20, 20, 0);
  const bottom = cy + 15;
  return `<image href="${buildingImage(id, level)}" x="${f(cx - size / 2)}" y="${f(bottom - height)}" width="${f(size)}" height="${f(height)}" preserveAspectRatio="xMidYMax meet"/>`;
}

/** Yapımı süren binanın önündeki iskele. */
function scaffold(level) {
  const h = tierOf(Math.max(1, level)) * 6 + 16;
  let s = '<g class="scaffold">';
  for (const [x, y] of [[4, 38], [38, 38], [38, 4]]) {
    const [sx, sy] = P(x, y, 0);
    s += `<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy - h}" stroke="#7a5230" stroke-width="1.4"/>`;
  }
  for (const z of [h * 0.45, h * 0.9]) {
    s += `<polyline points="${[[4, 38], [38, 38], [38, 4]].map(([x, y]) => P(x, y, z).join(',')).join(' ')}" fill="none" stroke="#8c6239" stroke-width="1.2"/>`;
  }
  return `${s}</g>`;
}

/** Arsanın önündeki seviye levhası. */
function plate(level, locked) {
  const [sx, sy] = P(40, 40, 0);
  const text = level > 0 ? String(level) : '+';
  return `<g class="scene-plate${level > 0 ? '' : ' empty'}${locked ? ' locked' : ''}"><circle cx="${sx}" cy="${sy - 4}" r="6.5"/><text x="${sx}" y="${sy - 1.3}" text-anchor="middle">${text}</text></g>`;
}

const STONE_LINE = { stroke: '#4d483e', width: 0.5 };

/** Taş kutu: yalnızca görünen üç yüz, ince ve yumuşak çizgiyle. */
function box(x, y, z, w, d, h, [top, left, right]) {
  return (
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right, STONE_LINE) +
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left, STONE_LINE) +
    poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top, STONE_LINE)
  );
}

/** Mazgallar: duvarın dış kenarı boyunca dişler. */
function crenels(x, y, z, w, d, size, c) {
  let s = '';
  const step = size * 2;
  for (let i = 0; i + size <= w + 0.01; i += step) s += box(x + i, y + d - size, z, size, size, size, c);
  for (let j = 0; j + size <= d - size + 0.01; j += step) s += box(x + w - size, y + j, z, size, size, size, c);
  return s;
}

/** Sur: taş örgülü halka; köşelerde kule görselleri. Arka duvarlar binalardan önce, ön duvarlar sonra. */
function walls(level, part) {
  const t = tierOf(level);
  if (!t) return '';
  const m = 12;
  const h = 7 + t * 2.5;
  const thick = 4;
  const stone = ['url(#scene-stone-top)', 'url(#scene-stone)', 'url(#scene-stone-dark)'];
  const tooth = 3; // mazgal dişi
  const x0 = -m;
  const y0 = -m;
  const x1 = W + m;
  const y1 = D + m;
  const tower = (x, y) => {
    const [sx, sy] = P(x, y, 0);
    const size = 30 + t * 4;
    return `<image href="${buildingImage('sur', level)}" x="${f(sx - size / 2)}" y="${f(sy + 6 - size * 1.45)}" width="${f(size)}" height="${f(size * 1.45)}" preserveAspectRatio="xMidYMax meet"/>`;
  };
  if (part === 'back') {
    return (
      box(x0, y0, 0, x1 - x0, thick, h, stone) + crenels(x0, y0, h, x1 - x0, thick, tooth, stone) +
      box(x0, y0, 0, thick, y1 - y0, h, stone) + crenels(x0, y0, h, thick, y1 - y0, tooth, stone) +
      tower(x0 + 2, y0 + 2)
    );
  }
  const gateX = (x0 + x1) / 2;
  let s = tower(x1 - 2, y0 + 2);
  s += box(x1 - thick, y0, 0, thick, y1 - y0, h, stone) + crenels(x1 - thick, y0, h, thick, y1 - y0, tooth, stone);
  s += tower(x0 + 2, y1 - 2);
  s += box(x0, y1 - thick, 0, gateX - 9 - x0, thick, h, stone) + crenels(x0, y1 - thick, h, gateX - 9 - x0, thick, tooth, stone);
  s += box(gateX + 9, y1 - thick, 0, x1 - gateX - 9, thick, h, stone) + crenels(gateX + 9, y1 - thick, h, x1 - gateX - 9, thick, tooth, stone);
  // Kapı: iki kule arasında ahşap kapı
  const [gx, gy] = P(gateX, y1, 0);
  s += `<path d="M${f(gx - 7)},${f(gy - 3.5)} L${f(gx - 7)},${f(gy - 3.5 - h)} L${f(gx + 7)},${f(gy + 3.5 - h)} L${f(gx + 7)},${f(gy + 3.5)}Z" fill="#4a3320"/>`;
  s += tower(gateX - 11, y1 - 1) + tower(gateX + 11, y1 - 1);
  s += tower(x1 - 2, y1 - 2);
  return s;
}

/** Doku ve renk tanımları: çimen, toprak, taş, su (SVG desenleri ve süzgeçleri). */
function defs() {
  return `<defs>
    <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--scene-sky-top)"/><stop offset="1" stop-color="var(--scene-sky-bottom)"/></linearGradient>
    <radialGradient id="scene-water" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#8dbad0"/><stop offset="1" stop-color="#3f6f86"/></radialGradient>
    <filter id="scene-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
      <feColorMatrix type="saturate" values="0" in="n" result="g"/>
      <feComponentTransfer in="g" result="a"><feFuncA type="table" tableValues="0 0.22"/></feComponentTransfer>
      <feComposite in="a" in2="SourceGraphic" operator="in"/>
    </filter>
    <pattern id="scene-grass" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#7f9a4c"/><path d="M2 20l2-5M9 8l1-4M15 18l2-5M20 6l1-4M5 11l1-3M18 13l2-4" stroke="#6c8a3d" stroke-width="1"/><circle cx="12" cy="4" r="1" fill="#93ad5c"/><circle cx="3" cy="3" r="0.8" fill="#93ad5c"/><circle cx="20" cy="20" r="1" fill="#6a853b"/></pattern>
    <pattern id="scene-dirt" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#a7865a"/><circle cx="3" cy="4" r="1" fill="#8f7049"/><circle cx="10" cy="9" r="1.2" fill="#b89a6c"/><circle cx="6" cy="12" r="0.8" fill="#8f7049"/></pattern>
    <pattern id="scene-road" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#b59a6e"/><circle cx="3" cy="3" r="1" fill="#a08658"/><circle cx="9" cy="8" r="1.1" fill="#c6ad80"/></pattern>
    <pattern id="scene-cobble" width="10" height="8" patternUnits="userSpaceOnUse"><rect width="10" height="8" fill="#8f8573"/><rect x="0.5" y="0.5" width="4" height="3" rx="1" fill="#b0a58f"/><rect x="5.5" y="0.5" width="4" height="3" rx="1" fill="#a39884"/><rect x="3" y="4.5" width="4" height="3" rx="1" fill="#b6ab95"/></pattern>
    <pattern id="scene-field" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#8a8a43"/><path d="M0 2h8M0 6h8" stroke="#a7a04e" stroke-width="1.6"/></pattern>
    <pattern id="scene-stone" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#8d8779"/><path d="M0 3h8M4 0v3M0 3v3M8 3v3" stroke="#6e695d" stroke-width="0.6"/></pattern>
    <pattern id="scene-stone-dark" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#6f6a5e"/><path d="M0 3h8M4 0v3M0 3v3M8 3v3" stroke="#57534a" stroke-width="0.6"/></pattern>
    <pattern id="scene-stone-top" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a7a092"/></pattern>
  </defs>`;
}

/** Arka plan: gökyüzü, uzak tepeler, dokulu çimen zemin. Ekran koordinatlarında. */
function backdrop(minX, minY, width, height) {
  const [lx, ly] = P(-30, D + 30, 0);
  const [rx, ry] = P(W + 30, -30, 0);
  const [tx, ty] = P(-30, -30, 0);
  const [bx, by] = P(W + 30, D + 30, 0);
  const pad = width * 1.5;
  const left = minX - pad;
  const span = width + 2 * pad;
  const hills = (y, color, amp, seed) => {
    let d = `M${left},${y}`;
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const x = left + (span * i) / steps;
      const hh = amp * (0.5 + 0.5 * Math.sin(seed + i * 1.7) * Math.cos(seed * 0.7 + i * 0.9));
      d += ` Q${x - span / (steps * 2)},${y - hh - amp * 0.3} ${x},${y - hh}`;
    }
    d += ` L${left + span},${minY + height} L${left},${minY + height}Z`;
    return `<path d="${d}" fill="${color}"/>`;
  };
  const ground = `<polygon points="${tx},${ty} ${rx},${ry} ${bx},${by} ${lx},${ly}"`;
  return (
    `<rect x="${left}" y="${minY}" width="${span}" height="${height}" fill="url(#scene-sky)"/>` +
    hills(ty + 40, 'var(--scene-hill-far)', 28, 1.3) +
    hills(ty + 70, 'var(--scene-hill-near)', 22, 4.1) +
    `<rect x="${left}" y="${ty + 60}" width="${span}" height="${minY + height - ty - 60}" fill="var(--scene-hill-near)"/>` +
    `${ground} fill="url(#scene-grass)"/>` +
    `${ground} fill="#000" filter="url(#scene-grain)" opacity="0.6"/>`
  );
}

/** Arsalar arası toprak yollar. */
function roads() {
  let s = '';
  for (let c = 1; c < COLS; c++) s += poly([[c * PITCH - 2.5, -6, 0], [c * PITCH + 2.5, -6, 0], [c * PITCH + 2.5, D + 6, 0], [c * PITCH - 2.5, D + 6, 0]], 'url(#scene-road)', { stroke: 'none', width: 0, opacity: 0.9 });
  for (let r = 1; r < ROWS; r++) s += poly([[-6, r * PITCH - 2.5, 0], [W + 6, r * PITCH - 2.5, 0], [W + 6, r * PITCH + 2.5, 0], [-6, r * PITCH + 2.5, 0]], 'url(#scene-road)', { stroke: 'none', width: 0, opacity: 0.9 });
  return s;
}

/**
 * Sahnenin SVG'si. `levels`: bina → seviye; `upgrading`: yapımı süren binalar;
 * `locked`: gereksinimi karşılanmamış binalar (boş arsa soluk görünür).
 */
export function sceneSvg(levels, { upgrading = new Set(), locked = new Set(), names = {}, selected = null } = {}) {
  const minX = -D - 30;
  const maxX = W + 30;
  const minY = -90;
  const maxY = (W + D) / 2 + 24;
  const width = maxX - minX;
  const height = maxY - minY;

  const items = [];
  for (const [id, [col, row]] of Object.entries(SLOTS)) items.push({ id, col, row });
  for (const d of DECOR) items.push({ decor: d.kind, col: d.at[0], row: d.at[1] });
  items.sort((a, b) => a.col + a.row - (b.col + b.row) || a.col - b.col);

  let body = '';
  let plates = '';
  for (const item of items) {
    if (item.decor) {
      body += `<g transform="${translate(item.col, item.row)}">${decor(item.decor)}</g>`;
      continue;
    }
    const level = levels[item.id] ?? 0;
    const isLocked = !level && locked.has(item.id);
    const building = upgrading.has(item.id);
    const classes = ['scene-building', level ? '' : 'empty', isLocked ? 'locked' : '', selected === item.id ? 'selected' : ''].filter(Boolean).join(' ');
    const label = `${names[item.id] ?? item.id}: ${level ? `${level}. seviye` : isLocked ? 'kilitli' : 'inşa edilebilir'}${building ? ' · yapım sürüyor' : ''}`;
    body +=
      `<g class="${classes}" data-building="${item.id}" transform="${translate(item.col, item.row)}" tabindex="0" role="button" aria-label="${label}">` +
      `<title>${label}</title>` +
      `<polygon class="scene-hit" points="${[[0, 0], [40, 0], [40, 40], [0, 40]].map(([x, y]) => P(x, y, 0).join(',')).join(' ')}"/>` +
      (level ? `<ellipse cx="0" cy="${P(20, 20, 0)[1] + 6}" rx="30" ry="12" fill="#1e2a10" opacity="0.18"/>` + buildingSprite(item.id, level) : plot()) +
      (building ? scaffold(level) : '') +
      '</g>';
    plates += `<g transform="${translate(item.col, item.row)}" data-building="${item.id}" aria-hidden="true">${plate(level, isLocked)}</g>`;
  }

  const sur = levels.sur ?? 0;
  return (
    `<svg class="scene-svg" viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Köy">` +
    defs() +
    backdrop(minX, minY, width, height) +
    roads() +
    walls(sur, 'back') +
    body +
    walls(sur, 'front') +
    `<g class="scene-plates">${plates}</g>` +
    '</svg>'
  );
}
