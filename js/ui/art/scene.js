import { INK, P, poly, box, tile, cylinder, cone, crenels, tree, cypress, archLeft, flag } from './iso.js';
import { buildingGroup, tierOf } from './buildings.js';

/**
 * Köy sahnesi: tüm binalar kendi arsalarında, seviyelerine göre büyüyerek görünür. Sur, köyü
 * çevreleyen bir halka olarak çizilir. Yapımı süren binaların üstünde iskele durur.
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

// Süs arsaları: ağaçlar, kuyu, gölet.
const DECOR = [
  { at: [4, 0], kind: 'grove' },
  { at: [0, 2], kind: 'pond' },
  { at: [1, 3], kind: 'well' },
  { at: [2, 3], kind: 'square' },
  { at: [3, 3], kind: 'grove2' },
  { at: [4, 3], kind: 'orchard' },
];

const f = (n) => Math.round(n * 10) / 10;

function translate(col, row) {
  const [sx, sy] = P(col * PITCH + 3, row * PITCH + 3, 0);
  return `translate(${f(sx)} ${f(sy)})`;
}

function decor(kind) {
  switch (kind) {
    case 'grove':
      return tree(8, 6, 1.1) + tree(26, 4, 0.9) + tree(16, 22, 1) + cypress(34, 20, 0.9);
    case 'grove2':
      return tree(10, 10, 1) + cypress(28, 14, 1) + tree(22, 30, 0.9);
    case 'orchard': {
      let s = tile(2, 2, 36, 36, '#9db562');
      for (const [x, y] of [[8, 8], [22, 8], [8, 24], [22, 24], [34, 16]]) s += tree(x, y, 0.7, ['#7fa04a', '#62823a']) + `<circle cx="${P(x, y, 9)[0] + 2}" cy="${P(x, y, 9)[1]}" r="1.2" fill="#d6452f"/>`;
      return s;
    }
    case 'pond': {
      const [cx, cy] = P(20, 20, 0);
      return `<ellipse cx="${cx}" cy="${cy}" rx="30" ry="14" fill="#7fb0c8" stroke="${INK}" stroke-width="0.9"/><ellipse cx="${cx - 6}" cy="${cy - 3}" rx="12" ry="4" fill="#a9cfe0" opacity="0.8"/>` + tree(2, 30, 0.8) + tree(34, 4, 0.8);
    }
    case 'well': {
      let s = cylinder(20, 20, 0, 6, 5, ['#d9c7a2', '#b9a57f', '#4f6f86']);
      const [ax, ay] = P(16, 20, 5);
      const [bx, by] = P(24, 20, 5);
      s += `<line x1="${ax}" y1="${ay}" x2="${ax}" y2="${ay - 12}" stroke="${INK}" stroke-width="1.2"/><line x1="${bx}" y1="${by}" x2="${bx}" y2="${by - 12}" stroke="${INK}" stroke-width="1.2"/>`;
      s += `<path d="M${ax - 3},${ay - 11} L${(ax + bx) / 2},${ay - 17} L${bx + 3},${by - 11}Z" fill="#b0532e" stroke="${INK}" stroke-width="0.8"/>`;
      return s + tree(34, 34, 0.8);
    }
    case 'square': {
      // Meydan: taş döşeme ve çınar
      let s = tile(2, 2, 36, 36, '#d8c7a4', { stroke: INK, width: 0.5 });
      s += tree(20, 20, 1.5, ['#6f8f3d', '#56742c']);
      return s;
    }
    default:
      return '';
  }
}

/** Yapımı süren binanın üstündeki iskele. */
function scaffold(level) {
  const h = tierOf(Math.max(1, level)) * 6 + 14;
  let s = '<g class="scaffold">';
  for (const [x, y] of [[2, 38], [38, 38], [38, 2]]) {
    const [sx, sy] = P(x, y, 0);
    s += `<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy - h}" stroke="#8b5d31" stroke-width="1.3"/>`;
  }
  for (const z of [h * 0.45, h * 0.9]) {
    s += `<polyline points="${[[2, 38], [38, 38], [38, 2]].map(([x, y]) => P(x, y, z).join(',')).join(' ')}" fill="none" stroke="#8b5d31" stroke-width="1.1"/>`;
  }
  s += '</g>';
  return s;
}

/** Arsanın önündeki seviye levhası. */
function plate(level, locked) {
  const [sx, sy] = P(40, 40, 0);
  const text = level > 0 ? String(level) : '+';
  return `<g class="scene-plate${level > 0 ? '' : ' empty'}${locked ? ' locked' : ''}"><circle cx="${sx}" cy="${sy - 4}" r="6.5"/><text x="${sx}" y="${sy - 1.3}" text-anchor="middle">${text}</text></g>`;
}

/** Köyü çevreleyen sur halkası: arka duvarlar binalardan önce, ön duvarlar sonra çizilir. */
function walls(level, part) {
  const t = tierOf(level);
  if (!t) return '';
  const m = 10; // arsalardan dışarı pay
  const h = 9 + t * 3;
  const thick = 5;
  const stone = ['#efe4cb', '#d9c7a2', '#b9a57f'];
  const x0 = -m;
  const y0 = -m;
  const x1 = W + m;
  const y1 = D + m;
  const tower = (x, y) =>
    cylinder(x, y, 0, 6, h + 7, stone) + cone(x, y, h + 7, 6.6, t >= 3 ? 12 : 9, ['#c35b34', '#8f4124']);
  if (part === 'back') {
    return (
      box(x0, y0, 0, x1 - x0, thick, h, stone) + crenels(x0, y0, h, x1 - x0, thick, 2.4, stone) +
      box(x0, y0, 0, thick, y1 - y0, h, stone) + crenels(x0, y0, h, thick, y1 - y0, 2.4, stone) +
      tower(x0, y0)
    );
  }
  // Ön duvarlar: sağ (x = x1) ve sol-ön (y = y1); kapı sol-ön duvarın ortasında.
  const gateX = (x0 + x1) / 2;
  let s = tower(x1, y0);
  s += box(x1 - thick, y0, 0, thick, y1 - y0, h, stone) + crenels(x1 - thick, y0, h, thick, y1 - y0, 2.4, stone);
  s += tower(x0, y1);
  s += box(x0, y1 - thick, 0, gateX - 10 - x0, thick, h, stone) + crenels(x0, y1 - thick, h, gateX - 10 - x0, thick, 2.4, stone);
  s += box(gateX + 10, y1 - thick, 0, x1 - gateX - 10, thick, h, stone) + crenels(gateX + 10, y1 - thick, h, x1 - gateX - 10, thick, 2.4, stone);
  // Kapı kulesi
  s += box(gateX - 10, y1 - thick - 2, 0, 20, thick + 4, h + 6, stone) + crenels(gateX - 10, y1 - thick - 2, h + 6, 20, thick + 4, 2.4, stone);
  s += archLeft(y1 + 2, gateX - 5, 0, 10, h - 1, '#3a2716');
  if (t >= 2) s += flag(gateX, y1, h + 6, 14, '#b83f2c', { size: 10 });
  s += tower(x1, y1);
  return s;
}

/** Arka plan: gökyüzü, uzak tepeler, zemin. Ekran koordinatlarında. */
function backdrop(minX, minY, width, height) {
  const [lx, ly] = P(-30, D + 30, 0);
  const [rx, ry] = P(W + 30, -30, 0);
  const [tx, ty] = P(-30, -30, 0);
  const [bx, by] = P(W + 30, D + 30, 0);
  // Geniş ekranda SVG'nin yanlarında kalan boşluk da gökyüzü ve tepelerle dolsun.
  const pad = width * 1.5;
  const left = minX - pad;
  const span = width + 2 * pad;
  const hills = (y, color, amp, seed) => {
    let d = `M${left},${y}`;
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const x = left + (span * i) / steps;
      const h = amp * (0.5 + 0.5 * Math.sin(seed + i * 1.7) * Math.cos(seed * 0.7 + i * 0.9));
      d += ` Q${x - span / (steps * 2)},${y - h - amp * 0.3} ${x},${y - h}`;
    }
    d += ` L${left + span},${minY + height} L${left},${minY + height}Z`;
    return `<path d="${d}" fill="${color}"/>`;
  };
  return (
    `<rect x="${left}" y="${minY}" width="${span}" height="${height}" fill="url(#scene-sky)"/>` +
    hills(ty + 40, 'var(--scene-hill-far)', 28, 1.3) +
    hills(ty + 70, 'var(--scene-hill-near)', 22, 4.1) +
    `<rect x="${left}" y="${ty + 60}" width="${span}" height="${minY + height - ty - 60}" fill="var(--scene-hill-near)"/>` +
    `<polygon points="${tx},${ty} ${rx},${ry} ${bx},${by} ${lx},${ly}" fill="var(--scene-ground)" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.3"/>`
  );
}

/** Arsalar arası toprak yollar. */
function roads() {
  let s = '';
  const road = '#d2b98a';
  for (let c = 1; c < COLS; c++) s += poly([[c * PITCH - 2, -6, 0], [c * PITCH + 2, -6, 0], [c * PITCH + 2, D + 6, 0], [c * PITCH - 2, D + 6, 0]], road, { stroke: 'none', width: 0, opacity: 0.8 });
  for (let r = 1; r < ROWS; r++) s += poly([[-6, r * PITCH - 2, 0], [W + 6, r * PITCH - 2, 0], [W + 6, r * PITCH + 2, 0], [-6, r * PITCH + 2, 0]], road, { stroke: 'none', width: 0, opacity: 0.8 });
  return s;
}

/**
 * Sahnenin SVG'si. `levels`: bina → seviye; `upgrading`: yapımı süren binalar;
 * `locked`: gereksinimi karşılanmamış binalar (boş arsa soluk görünür).
 */
export function sceneSvg(levels, { upgrading = new Set(), locked = new Set(), names = {}, selected = null } = {}) {
  const minX = -D - 30;
  const maxX = W + 30;
  const minY = -80;
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
      buildingGroup(item.id, level) +
      (building ? scaffold(level) : '') +
      '</g>';
    plates += `<g transform="${translate(item.col, item.row)}" data-building="${item.id}" aria-hidden="true">${plate(level, isLocked)}</g>`;
  }

  const sur = levels.sur ?? 0;
  return (
    `<svg class="scene-svg" viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Köy">` +
    `<defs><linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--scene-sky-top)"/><stop offset="1" stop-color="var(--scene-sky-bottom)"/></linearGradient></defs>` +
    backdrop(minX, minY, width, height) +
    roads() +
    walls(sur, 'back') +
    body +
    walls(sur, 'front') +
    `<g class="scene-plates">${plates}</g>` +
    '</svg>'
  );
}
