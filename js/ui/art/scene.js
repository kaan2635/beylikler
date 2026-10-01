import { P, poly, tile } from './iso.js';
import { buildingImage, tierOf } from './sprites.js';
import { composeBuilding, stageOf } from './stages.js';

/**
 * Köy sahnesi: binalar kendi arsalarında, gerçekçi (önceden işlenmiş) görsellerle ve seviyelerine
 * göre aşama aşama büyüyerek görünür (bkz. stages.js). Sahne canlıdır: gökte güneş ya da ay,
 * bulutlar ve kuşlar; yollarda köylüler; bacalarda duman; mevsime göre kar, yaprak ya da çiçek
 * yağar. Gece ve gündüz oyun saatine göre --night değişkeniyle (CSS) değişir. Zemin dokulu çimen, yollar toprak; sur köyü taş bir halka olarak
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
  kule: [4, 0],
};

// Süs arsaları: koru, gölet, meydan, bahçe.
const DECOR = [
  { at: [0, 2], kind: 'pond' },
  { at: [1, 3], kind: 'grove2' },
  { at: [2, 3], kind: 'square' },
  { at: [3, 3], kind: 'grove3' },
  { at: [4, 3], kind: 'orchard' },
];

const f = (n) => Math.round(n * 10) / 10;

// Mevsimlere göre renkler: çimen [zemin, çizgi, açık, koyu], yapraklar [koyu, orta, açık],
// selvi, tarla, toprak ve yol; kışın yaprak tepeleri ve zemin kar tutar, göl buz olur.
const PALETTES = {
  ilkbahar: {
    grass: ['#83a24f', '#6f8f40', '#9cbc63', '#6a853b'],
    leaf: ['#355124', '#4a6d30', '#6b8f40'],
    leaf2: ['#3f5a2a', '#557a36', '#789c4a'],
    cypress: ['#2f4a22', '#46663a'],
    field: ['#8a8a43', '#a7a04e'],
    dirt: ['#a7865a', '#8f7049', '#b89a6c'],
    road: ['#b59a6e', '#a08658', '#c6ad80'],
    water: ['#8dbad0', '#3f6f86'],
  },
  yaz: {
    grass: ['#8f9f48', '#7b8c3c', '#a8b660', '#768636'],
    leaf: ['#3a5222', '#4f6e2c', '#73923f'],
    leaf2: ['#45602a', '#5d7d33', '#82a246'],
    cypress: ['#2f4a22', '#46663a'],
    field: ['#c2a64a', '#dcc062'],
    dirt: ['#b08c5a', '#987349', '#c2a06c'],
    road: ['#c0a372', '#a98d5c', '#d0b685'],
    water: ['#86b6cc', '#3a6a82'],
  },
  sonbahar: {
    grass: ['#9a9352', '#857d42', '#b3a45f', '#7d7240'],
    leaf: ['#7a3e18', '#a8581e', '#d4862c'],
    leaf2: ['#6e4a1a', '#9a6a22', '#c99a34'],
    cypress: ['#3a4a24', '#556638'],
    field: ['#9c7f3e', '#b8964c'],
    dirt: ['#9d7d52', '#856644', '#ae9064'],
    road: ['#ad9168', '#977c55', '#bea27a'],
    water: ['#7aa4b8', '#365d72'],
  },
  kis: {
    grass: ['#e3e9ec', '#cdd7dc', '#ffffff', '#bac7cd'],
    leaf: ['#2c4026', '#3c5534', '#eef3f5'],
    leaf2: ['#344a2c', '#46613c', '#f5f8fa'],
    cypress: ['#2a3f24', '#3d5634'],
    field: ['#d6dee2', '#eef2f4'],
    dirt: ['#c8beae', '#b2a894', '#d8d0c3'],
    road: ['#d2c9ba', '#bcb2a0', '#e1dacd'],
    water: ['#dceaf0', '#9dbccb'],
  },
};
let pal = PALETTES.ilkbahar; // sceneSvg her çizimde mevsime göre seçer

function translate(col, row) {
  const [sx, sy] = P(col * PITCH + 3, row * PITCH + 3, 0);
  return `translate(${f(sx)} ${f(sy)})`;
}

/** Doğal ağaç: çizgisiz, gölgeli, üst üste binen yapraklar. */
function tree(x, y, scale = 1, hue = 0) {
  const [sx, sy] = P(x, y, 0);
  const k = scale;
  const [dark, mid, light] = hue ? pal.leaf2 : pal.leaf;
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
    `<path d="M${f(sx)},${f(sy - h)} C${f(sx + w * 1.3)},${f(sy - h * 0.6)} ${f(sx + w)},${f(sy - 2)} ${f(sx)},${f(sy)} C${f(sx - w)},${f(sy - 2)} ${f(sx - w * 1.3)},${f(sy - h * 0.6)} ${f(sx)},${f(sy - h)}Z" fill="${pal.cypress[0]}"/>` +
    `<path d="M${f(sx)},${f(sy - h)} C${f(sx - w * 1.3)},${f(sy - h * 0.6)} ${f(sx - w)},${f(sy - 2)} ${f(sx)},${f(sy)}Z" fill="${pal.cypress[1]}" opacity="0.8"/>`
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

/** Palanka (surun ilk aşaması): sivri ahşap kazıklardan çit, köşelerde ahşap kuleler. */
function palisade(part) {
  const m = 12;
  const x0 = -m;
  const y0 = -m;
  const x1 = W + m;
  const y1 = D + m;
  const stakes = (ax, ay, bx, by) => {
    let out = '';
    const n = Math.round(Math.hypot(bx - ax, by - ay) / 3.2);
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const y = ay + ((by - ay) * i) / n;
      const [sx, sy] = P(x, y, 0);
      const hgt = 7 + ((i * 7) % 3);
      out += `<path d="M${f(sx - 1.3)},${f(sy)} L${f(sx - 1.3)},${f(sy - hgt)} L${f(sx)},${f(sy - hgt - 2.2)} L${f(sx + 1.3)},${f(sy - hgt)} L${f(sx + 1.3)},${f(sy)}Z" fill="${i % 2 ? '#8a5e34' : '#7a5230'}" stroke="#4a3320" stroke-width="0.4"/>`;
    }
    return out;
  };
  const tower = (x, y) => {
    const [sx, sy] = P(x, y, 0);
    const size = 26;
    return `<image href="${buildingImage('sur', 1)}" x="${f(sx - size / 2)}" y="${f(sy + 6 - size * 1.45)}" width="${f(size)}" height="${f(size * 1.45)}" preserveAspectRatio="xMidYMax meet"/>`;
  };
  if (part === 'back') return stakes(x0, y0, x1, y0) + stakes(x0, y0, x0, y1) + tower(x0 + 2, y0 + 2);
  const gateX = (x0 + x1) / 2;
  return stakes(x1, y0, x1, y1) + stakes(x0, y1, gateX - 8, y1) + stakes(gateX + 8, y1, x1, y1) + tower(x1 - 2, y0 + 2) + tower(x0 + 2, y1 - 2) + tower(x1 - 2, y1 - 2);
}

// ---------- Canlı sahne ----------

// Basit, tekrarlanabilir rastgele sayı (sahne her çizimde aynı görünsün).
function rnd(i) {
  const x = Math.sin(i * 91.17 + 7.3) * 43758.5453;
  return x - Math.floor(x);
}

/** Gök: güneş ve ay (konumları CSS değişkenleriyle), yıldızlar, süzülen bulutlar, kuşlar. */
function sky(minX, minY, width, season) {
  let stars = '';
  for (let i = 0; i < 26; i++) stars += `<circle cx="${f(minX + rnd(i) * width)}" cy="${f(minY + 4 + rnd(i + 40) * 60)}" r="${f(0.5 + rnd(i + 80) * 0.8)}"/>`;
  let clouds = '';
  for (let i = 0; i < 4; i++) {
    const cx = minX + rnd(i + 120) * width;
    const cy = minY + 12 + rnd(i + 130) * 34;
    const k = 0.7 + rnd(i + 140) * 0.7;
    clouds +=
      `<g class="cloud" style="animation-duration:${f(90 + rnd(i + 150) * 80)}s;animation-delay:-${f(rnd(i + 160) * 120)}s">` +
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(18 * k)}" ry="${f(5 * k)}"/><ellipse cx="${f(cx - 8 * k)}" cy="${f(cy - 3 * k)}" rx="${f(9 * k)}" ry="${f(5 * k)}"/><ellipse cx="${f(cx + 6 * k)}" cy="${f(cy - 4 * k)}" rx="${f(10 * k)}" ry="${f(6 * k)}"/></g>`;
  }
  let birds = '';
  if (season !== 'kis') {
    for (let i = 0; i < 3; i++) {
      const by = minY + 16 + rnd(i + 200) * 30;
      birds += `<path class="bird" style="animation-duration:${f(24 + rnd(i + 210) * 14)}s;animation-delay:-${f(rnd(i + 220) * 30)}s" d="M${f(minX - 10)},${f(by)} q2.5,-2.5 5,0 q2.5,-2.5 5,0"/>`;
    }
  }
  return (
    `<g class="scene-stars">${stars}</g>` +
    `<g class="scene-sun"><circle r="9" fill="#fff3c4" opacity="0.5"/><circle r="6" fill="#fde7a0"/></g>` +
    `<g class="scene-moon"><circle r="11" fill="#fff6d8" opacity="0.18"/><path d="M1.5,-6.8 A7,7 0 1,0 6.4,3.8 A5.6,5.6 0 1,1 1.5,-6.8Z" fill="#fff8e4"/></g>` +
    `<g class="scene-clouds">${clouds}</g>` +
    `<g class="scene-birds">${birds}</g>`
  );
}

/** Yollarda gidip gelen köylüler ve bir atlı (SMIL hareketi). */
function villagers() {
  const colors = [['#8f2f1d', '#e2b688'], ['#2f5f9e', '#d9a878'], ['#5d7a2e', '#e6bc90'], ['#7a5a2e', '#c99064'], ['#a3375f', '#e2b688'], ['#3d3d3d', '#d9a878']];
  const routes = [];
  for (let c = 1; c < COLS; c++) routes.push([[c * PITCH, -4], [c * PITCH, D + 4]]);
  for (let r = 1; r < ROWS; r++) routes.push([[-4, r * PITCH], [W + 4, r * PITCH]]);
  let out = '';
  for (let i = 0; i < 6; i++) {
    const [[ax, ay], [bx, by]] = routes[(i * 3) % routes.length];
    const [sx0, sy0] = P(ax, ay, 0);
    const [sx1, sy1] = P(bx, by, 0);
    const [body, skin] = colors[i];
    const dur = f(38 + rnd(i + 300) * 30);
    const delay = f(rnd(i + 310) * 30);
    const rider = i === 5;
    const figure = rider
      ? `<ellipse cx="0" cy="-3" rx="4.2" ry="2.2" fill="#6b4423"/><path d="M-3.2,-1.5v2.6M3.2,-1.5v2.6" stroke="#4a2e17" stroke-width="0.9"/><path d="M3.6,-4l2.2,-2.2" stroke="#6b4423" stroke-width="1.6" stroke-linecap="round"/><rect x="-1.2" y="-8.4" width="2.4" height="4" rx="1" fill="${body}"/><circle cx="0" cy="-9.4" r="1.3" fill="${skin}"/>`
      : `<ellipse cx="0" cy="0.4" rx="2" ry="0.8" fill="#000" opacity="0.2"/><path d="M-1.6,0 L-1.2,-4.6 L1.2,-4.6 L1.6,0Z" fill="${body}"/><circle cx="0" cy="-5.8" r="1.3" fill="${skin}"/>`;
    out +=
      `<g class="villager">${figure}<animateMotion dur="${dur}s" begin="-${delay}s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" path="M${f(sx0)},${f(sy0)} L${f(sx1)},${f(sy1)}"/></g>`;
  }
  return `<g class="scene-life">${out}</g>`;
}

/** Mevsimlik yağış: kışın kar, sonbaharda yaprak, ilkbaharda çiçek yaprağı, yazın kelebek. */
function weather(minX, minY, width, height, season) {
  const kinds = { kis: 'snow', sonbahar: 'leaf', ilkbahar: 'petal', yaz: 'butterfly' };
  const kind = kinds[season] ?? 'petal';
  const count = { snow: 46, leaf: 16, petal: 14, butterfly: 6 }[kind];
  const fills = { snow: ['#ffffff'], leaf: ['#c9702a', '#a8581e', '#d9a03a'], petal: ['#f6d6e0', '#ffffff', '#f2c3d1'], butterfly: ['#f2c94c', '#ffffff', '#e8923a'] }[kind];
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = f(minX + rnd(i + 400) * width);
    const y = kind === 'butterfly' ? f(minY + height * (0.45 + rnd(i + 410) * 0.4)) : f(minY - 10);
    const dur = f((kind === 'snow' ? 9 : kind === 'butterfly' ? 7 : 12) + rnd(i + 420) * 8);
    const delay = f(rnd(i + 430) * 20);
    const fill = fills[i % fills.length];
    const shape =
      kind === 'snow'
        ? `<circle r="${f(0.7 + rnd(i + 440) * 1.1)}" fill="${fill}"/>`
        : kind === 'leaf'
          ? `<path d="M0,-2.2 C1.6,-1 1.6,1 0,2.2 C-1.6,1 -1.6,-1 0,-2.2Z" fill="${fill}"/>`
          : kind === 'petal'
            ? `<ellipse rx="1.3" ry="0.8" fill="${fill}"/>`
            : `<path class="wings" d="M0,0 C-2.4,-2.6 -3.4,0.4 0,0.4 C3.4,0.4 2.4,-2.6 0,0Z" fill="${fill}"/>`;
    out += `<g class="flake ${kind}" style="animation-duration:${dur}s;animation-delay:-${delay}s"><g transform="translate(${x} ${y})">${shape}</g></g>`;
  }
  return `<g class="weather weather-${kind}">${out}</g>`;
}

/** Sur: taş örgülü halka; köşelerde kule görselleri. Arka duvarlar binalardan önce, ön duvarlar sonra. */
function walls(level, part) {
  const t = tierOf(level);
  if (!t) return '';
  const stage = stageOf('sur', level);
  if (stage === 0) return palisade(part);
  const m = 12;
  const h = 6 + stage * 2.6;
  const thick = 4;
  const stone = ['url(#scene-stone-top)', 'url(#scene-stone)', 'url(#scene-stone-dark)'];
  const tooth = 3; // mazgal dişi
  const x0 = -m;
  const y0 = -m;
  const x1 = W + m;
  const y1 = D + m;
  const tower = (x, y) => {
    const [sx, sy] = P(x, y, 0);
    const size = 28 + stage * 3.5;
    const img = `<image href="${buildingImage('sur', level)}" x="${f(sx - size / 2)}" y="${f(sy + 6 - size * 1.45)}" width="${f(size)}" height="${f(size * 1.45)}" preserveAspectRatio="xMidYMax meet"/>`;
    if (stage < 3) return img;
    // Kale suru ve hisar: kule tepelerinde sancak (hisarda altın)
    const top = sy + 6 - size * 1.45 + 2;
    const color = stage === 4 ? '#c99a2e' : '#a3321f';
    return (
      img +
      `<line x1="${f(sx)}" y1="${f(top)}" x2="${f(sx)}" y2="${f(top - 12)}" stroke="#3a2a1a" stroke-width="1"/>` +
      `<path class="banner-cloth" d="M${f(sx)},${f(top - 12)} l8,1.5 -1.5,2.5 1.5,2.5 -8,1z" fill="${color}" stroke="#3a2a1a" stroke-width="0.4"/>`
    );
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
    <radialGradient id="scene-water" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="${pal.water[0]}"/><stop offset="1" stop-color="${pal.water[1]}"/></radialGradient>
    <filter id="scene-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
      <feColorMatrix type="saturate" values="0" in="n" result="g"/>
      <feComponentTransfer in="g" result="a"><feFuncA type="table" tableValues="0 0.22"/></feComponentTransfer>
      <feComposite in="a" in2="SourceGraphic" operator="in"/>
    </filter>
    <pattern id="scene-grass" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${pal.grass[0]}"/><path d="M2 20l2-5M9 8l1-4M15 18l2-5M20 6l1-4M5 11l1-3M18 13l2-4" stroke="${pal.grass[1]}" stroke-width="1"/><circle cx="12" cy="4" r="1" fill="${pal.grass[2]}"/><circle cx="3" cy="3" r="0.8" fill="${pal.grass[2]}"/><circle cx="20" cy="20" r="1" fill="${pal.grass[3]}"/></pattern>
    <pattern id="scene-dirt" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="${pal.dirt[0]}"/><circle cx="3" cy="4" r="1" fill="${pal.dirt[1]}"/><circle cx="10" cy="9" r="1.2" fill="${pal.dirt[2]}"/><circle cx="6" cy="12" r="0.8" fill="${pal.dirt[1]}"/></pattern>
    <pattern id="scene-road" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${pal.road[0]}"/><circle cx="3" cy="3" r="1" fill="${pal.road[1]}"/><circle cx="9" cy="8" r="1.1" fill="${pal.road[2]}"/></pattern>
    <pattern id="scene-cobble" width="10" height="8" patternUnits="userSpaceOnUse"><rect width="10" height="8" fill="#8f8573"/><rect x="0.5" y="0.5" width="4" height="3" rx="1" fill="#b0a58f"/><rect x="5.5" y="0.5" width="4" height="3" rx="1" fill="#a39884"/><rect x="3" y="4.5" width="4" height="3" rx="1" fill="#b6ab95"/></pattern>
    <pattern id="scene-field" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${pal.field[0]}"/><path d="M0 2h8M0 6h8" stroke="${pal.field[1]}" stroke-width="1.6"/></pattern>
    <pattern id="scene-stone" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#8d8779"/><path d="M0 3h8M4 0v3M0 3v3M8 3v3" stroke="#6e695d" stroke-width="0.6"/></pattern>
    <pattern id="scene-stone-dark" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#6f6a5e"/><path d="M0 3h8M4 0v3M0 3v3M8 3v3" stroke="#57534a" stroke-width="0.6"/></pattern>
    <pattern id="scene-stone-top" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a7a092"/></pattern>
    <radialGradient id="scene-lamp"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.95"/><stop offset="0.45" stop-color="#ffb347" stop-opacity="0.35"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>
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
 * Oyun saatine göre ışık: { hour, night (0..1), sun: [x, y], moon: [x, y] } (sahne koordinatı).
 * Dünya sabah 08.00'de başlar; saat dünya hızıyla işler.
 */
export function skyState(world) {
  const hour = ((world.clock.time / 3_600_000) + 8) % 24;
  const night = hour >= 20 || hour < 5 ? 1 : hour >= 18 ? (hour - 18) / 2 : hour < 7 ? (7 - hour) / 2 : 0;
  const arc = (t) => [-190 + 430 * t, -24 - 56 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))];
  const sun = arc((hour - 6) / 14);
  const moon = arc(((hour - 19 + 24) % 24) / 12);
  return { hour, night, sun, moon };
}

/**
 * Sahnenin SVG'si. `levels`: bina → seviye; `upgrading`: yapımı süren binalar;
 * `locked`: gereksinimi karşılanmamış binalar (boş arsa soluk görünür).
 */
export function sceneSvg(levels, { upgrading = new Set(), locked = new Set(), names = {}, selected = null, season = null } = {}) {
  pal = PALETTES[season] ?? PALETTES.ilkbahar;
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
      (level ? `<ellipse cx="0" cy="${P(20, 20, 0)[1] + 6}" rx="30" ry="12" fill="#1e2a10" opacity="0.18"/>` + composeBuilding(item.id, level) : plot()) +
      (building ? scaffold(level) : '') +
      '</g>';
    plates += `<g transform="${translate(item.col, item.row)}" data-building="${item.id}" aria-hidden="true">${plate(level, isLocked)}</g>`;
  }

  const sur = levels.sur ?? 0;
  return (
    `<svg class="scene-svg" viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Köy">` +
    defs() +
    backdrop(minX, minY, width, height) +
    sky(minX, minY, width, season) +
    roads() +
    villagers() +
    walls(sur, 'back') +
    body +
    walls(sur, 'front') +
    weather(minX, minY, width, height, season) +
    `<rect class="scene-night" x="${minX}" y="${minY}" width="${width}" height="${height}"/>` +
    `<g class="scene-plates">${plates}</g>` +
    '</svg>'
  );
}
