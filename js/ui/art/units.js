/**
 * Birim portreleri (özgün, vektör). Her asker aynı parçalardan kurulur: gövde (kaftan), başlık
 * (börk, miğfer, sarık, kalpak, kukuleta), silah ve gerekirse at. Böylece 14 birim aynı elden
 * çıkmış gibi görünür. `unitArt(id)` 64 × 64'lük bir <svg> döndürür.
 */

const INK = '#3a2a1a';
const SKIN = '#e6b88a';
const SW = 'stroke="#3a2a1a" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"';

const SPECS = {
  yaya: { tunic: '#b0532e', hat: 'bork', weapon: 'spear' },
  kilicci: { tunic: '#2f5f9e', hat: 'migfer', weapon: 'sword' },
  baltaci: { tunic: '#6b7a3a', hat: 'kalpak', weapon: 'axe' },
  okcu: { tunic: '#3f7d4e', hat: 'sarik', weapon: 'bow' },
  muhafiz: { tunic: '#6d7480', hat: 'migfer', weapon: 'tower' },
  serdengecti: { tunic: '#8f1d1d', hat: 'bork', plume: true, weapon: 'twin' },
  gozcu: { tunic: '#5b4a38', hat: 'hood', weapon: 'spyglass', mount: '#a57a4e' },
  deli: { tunic: '#c9a06a', spots: true, hat: 'kalpak', wings: true, weapon: 'spear', mount: '#3d2a1a' },
  akinci: { tunic: '#b0532e', hat: 'kalpak', weapon: 'sword', mount: '#7a4e2d' },
  atliokcu: { tunic: '#3f7d4e', hat: 'sarik', weapon: 'bow', mount: '#d8c7a6' },
  sipahi: { tunic: '#6d7480', hat: 'migfer', plume: true, weapon: 'lance', mount: '#5b3b24', barding: '#9b2c1c' },
  elci: { tunic: '#5b3a86', robe: true, hat: 'kavuk', weapon: 'scroll' },
};

function hat(kind, x, y, plume) {
  switch (kind) {
    case 'bork': // yeniçeri börkü: arkaya düşen uzun keçe
      return `${plume ? `<path d="M${x - 1},${y - 11} C${x - 3},${y - 18} ${x - 9},${y - 22} ${x - 12},${y - 20} C${x - 8},${y - 18} ${x - 5},${y - 15} ${x - 3},${y - 10}Z" fill="#d9a441" ${SW}/>` : ''}<path d="M${x - 6},${y - 3} C${x - 6},${y - 12} ${x + 4},${y - 16} ${x + 10},${y - 9} L${x + 13},${y + 4} L${x + 9},${y + 5} L${x + 5},${y - 3}Z" fill="#f4ecd8" ${SW}/><path d="M${x - 6.5},${y - 3} L${x + 6},${y - 3}" stroke="#d9a441" stroke-width="2.2"/>`;
    case 'migfer': // sivri miğfer ve zincir peçe
      return `<path d="M${x - 6.5},${y - 1} C${x - 6.5},${y - 8} ${x - 2},${y - 11} ${x},${y - 15} C${x + 2},${y - 11} ${x + 6.5},${y - 8} ${x + 6.5},${y - 1}Z" fill="#9aa3ab" ${SW}/><path d="M${x - 6.5},${y - 1} L${x - 7},${y + 5} M${x + 6.5},${y - 1} L${x + 7},${y + 5}" stroke="#7d858e" stroke-width="2"/><path d="M${x - 7},${y - 1.5} L${x + 7},${y - 1.5}" stroke="#d9a441" stroke-width="1.6"/>${plume ? `<path d="M${x},${y - 15} C${x + 6},${y - 20} ${x + 11},${y - 17} ${x + 12},${y - 12}" fill="none" stroke="#b83f2c" stroke-width="2.4"/>` : ''}`;
    case 'sarik': // sarık
      return `<ellipse cx="${x}" cy="${y - 4}" rx="7.5" ry="5" fill="#f4ecd8" ${SW}/><path d="M${x - 6},${y - 6} C${x - 2},${y - 3} ${x + 2},${y - 9} ${x + 6},${y - 5}" fill="none" stroke="#c9b48b" stroke-width="1"/><circle cx="${x}" cy="${y - 9}" r="1.6" fill="#b83f2c" ${SW}/>`;
    case 'kavuk': // elçinin büyük kavuğu
      return `<ellipse cx="${x}" cy="${y - 5}" rx="9" ry="6.5" fill="#f7f1e3" ${SW}/><path d="M${x - 8},${y - 6} C${x - 3},${y - 2} ${x + 3},${y - 10} ${x + 8},${y - 5}" fill="none" stroke="#cbbfa6" stroke-width="1.1"/><rect x="${x - 2.5}" y="${y - 15}" width="5" height="5" rx="1.5" fill="#5b3a86" ${SW}/>`;
    case 'kalpak': // kürk kalpak
      return `<path d="M${x - 7},${y - 1} C${x - 8},${y - 10} ${x + 8},${y - 12} ${x + 7},${y - 1}Z" fill="#5a3b22" ${SW}/><path d="M${x - 7},${y - 1.5} C${x - 3},${y + 0.5} ${x + 3},${y + 0.5} ${x + 7},${y - 1.5}" fill="none" stroke="#8c6239" stroke-width="2.2"/>`;
    case 'hood': // kukuleta
      return `<path d="M${x - 7.5},${y + 5} C${x - 9},${y - 6} ${x - 3},${y - 12} ${x + 3},${y - 10} C${x + 8},${y - 8} ${x + 8},${y - 1} ${x + 7},${y + 5}Z" fill="#6f5b43" ${SW}/>`;
    default:
      return '';
  }
}

function head(x, y, spec) {
  let s = '';
  if (spec.hat === 'hood') s += hat('hood', x, y);
  s += `<circle cx="${x}" cy="${y}" r="5.6" fill="${SKIN}" ${SW}/>`;
  // Bıyık ve göz
  s += `<path d="M${x - 3.2},${y + 2.4} C${x - 1.4},${y + 1.2} ${x - 0.6},${y + 1.6} ${x},${y + 2} C${x + 0.6},${y + 1.6} ${x + 1.4},${y + 1.2} ${x + 3.2},${y + 2.4}" fill="none" stroke="#4a3120" stroke-width="1.1"/>`;
  s += `<circle cx="${x - 2}" cy="${y - 0.6}" r="0.7" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 0.6}" r="0.7" fill="${INK}"/>`;
  if (spec.hat !== 'hood') s += hat(spec.hat, x, y - 1.5, spec.plume);
  if (spec.wings) {
    s += `<path d="M${x + 5},${y - 6} C${x + 12},${y - 16} ${x + 18},${y - 14} ${x + 19},${y - 8} C${x + 15},${y - 10} ${x + 11},${y - 8} ${x + 6},${y - 3}Z" fill="#f4ecd8" ${SW}/><path d="M${x - 5},${y - 6} C${x - 11},${y - 15} ${x - 16},${y - 13} ${x - 17},${y - 8} C${x - 13},${y - 10} ${x - 10},${y - 8} ${x - 6},${y - 3}Z" fill="#f4ecd8" ${SW}/>`;
  }
  return s;
}

/** Ayaktaki asker gövdesi (kaftan, kuşak, bacaklar). */
function body(x, y, spec) {
  const hem = spec.robe ? y + 26 : y + 20;
  let s = '';
  if (!spec.robe) {
    s += `<rect x="${x - 5}" y="${y + 17}" width="4" height="11" rx="1.5" fill="#4d3b28" ${SW}/><rect x="${x + 1}" y="${y + 17}" width="4" height="11" rx="1.5" fill="#4d3b28" ${SW}/>`;
    s += `<path d="M${x - 6},${y + 27} h5 v2 h-6z M${x + 1},${y + 27} h5.5 v2 h-6z" fill="#2b1f14"/>`;
  }
  s += `<path d="M${x - 8},${y} L${x + 8},${y} L${x + 10.5},${hem} L${x - 10.5},${hem}Z" fill="${spec.tunic}" ${SW}/>`;
  if (spec.spots) for (const [dx, dy] of [[-4, 5], [3, 8], [-2, 13], [5, 15], [-6, 16]]) s += `<circle cx="${x + dx}" cy="${y + dy}" r="1.1" fill="#6b4423"/>`;
  s += `<path d="M${x},${y} L${x},${hem}" stroke="${INK}" stroke-width="0.6" opacity="0.5"/>`;
  s += `<rect x="${x - 8.6}" y="${y + 8}" width="17.2" height="3" fill="#d9a441" ${SW}/>`;
  return s;
}

/** Silah ve kollar; (x, y) omuz hizası. */
function weapon(kind, x, y) {
  const arm = (x1, y1, x2, y2, color = '#00000000') => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M${x1},${y1} L${x2},${y2}" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`;
  const hand = (hx, hy) => `<circle cx="${hx}" cy="${hy}" r="2" fill="${SKIN}" ${SW}/>`;
  switch (kind) {
    case 'spear':
      return `<path d="M${x + 11},${y + 30} L${x + 11},${y - 22}" stroke="#7a5230" stroke-width="2"/><path d="M${x + 11},${y - 30} l2.6,7 h-5.2z" fill="#c9d1d8" ${SW}/>` + hand(x + 11, y + 8);
    case 'lance':
      return `<path d="M${x + 13},${y + 20} L${x + 13},${y - 26}" stroke="#7a5230" stroke-width="2"/><path d="M${x + 13},${y - 34} l2.6,7 h-5.2z" fill="#c9d1d8" ${SW}/><path d="M${x + 13},${y - 24} l9,3 l-9,3z" fill="#b83f2c" ${SW}/>` + hand(x + 13, y + 6);
    case 'sword':
      return `<circle cx="${x - 11}" cy="${y + 10}" r="8" fill="#9b2c1c" ${SW}/><circle cx="${x - 11}" cy="${y + 10}" r="4.6" fill="none" stroke="#d9a441" stroke-width="1.4"/><circle cx="${x - 11}" cy="${y + 10}" r="1.6" fill="#d9a441"/>` + `<path d="M${x + 10},${y + 9} C${x + 13},${y - 1} ${x + 17},${y - 8} ${x + 22},${y - 12}" fill="none" stroke="#c9d1d8" stroke-width="2.6" stroke-linecap="round"/><path d="M${x + 8},${y + 10} l5,-2" stroke="#d9a441" stroke-width="2"/>` + hand(x + 9, y + 10);
    case 'axe':
      return `<path d="M${x + 10},${y + 18} L${x + 14},${y - 18}" stroke="#7a5230" stroke-width="2.2"/><path d="M${x + 14},${y - 18} C${x + 22},${y - 22} ${x + 25},${y - 12} ${x + 20},${y - 6} C${x + 18},${y - 10} ${x + 16},${y - 12} ${x + 13},${y - 12}Z" fill="#aeb6bd" ${SW}/>` + hand(x + 11.5, y + 6);
    case 'bow':
      return `<path d="M${x - 13},${y - 12} C${x - 20},${y - 6} ${x - 20},${y + 18} ${x - 13},${y + 24}" fill="none" stroke="#6b4423" stroke-width="2.4" stroke-linecap="round"/><path d="M${x - 13},${y - 12} L${x - 13},${y + 24}" stroke="#e8dcc0" stroke-width="0.8"/>` + hand(x - 16.5, y + 6) + `<path d="M${x + 8},${y - 2} l3,-10 M${x + 10},${y - 2} l3,-10" stroke="#8c6239" stroke-width="1.2"/><rect x="${x + 6}" y="${y - 2}" width="6" height="12" rx="1.5" fill="#6b4423" ${SW}/>`;
    case 'tower':
      // Uzun kalkan: altın çerçeve ve ortada sekiz köşeli yıldız
      return `<path d="M${x + 12},${y + 26} L${x + 12},${y - 22}" stroke="#7a5230" stroke-width="2"/><path d="M${x + 12},${y - 28} l2.4,6 h-4.8z" fill="#c9d1d8" ${SW}/><path d="M${x - 15},${y - 2} h20 v22 c0,6 -10,9 -10,9 c0,0 -10,-3 -10,-9z" fill="#8f2d1c" ${SW}/><path d="M${x - 13},${y} h16 v19 c0,5 -8,7.5 -8,7.5 c0,0 -8,-2.5 -8,-7.5z" fill="none" stroke="#d9a441" stroke-width="1.1"/><g transform="translate(${x - 5} ${y + 11})" fill="#d9a441"><rect x="-3.4" y="-3.4" width="6.8" height="6.8"/><rect x="-3.4" y="-3.4" width="6.8" height="6.8" transform="rotate(45)"/></g><circle cx="${x - 5}" cy="${y + 11}" r="1.6" fill="#8f2d1c"/>`;
    case 'twin':
      return `<path d="M${x - 10},${y + 12} C${x - 14},${y + 2} ${x - 18},${y - 6} ${x - 22},${y - 10}" fill="none" stroke="#c9d1d8" stroke-width="2.6" stroke-linecap="round"/><path d="M${x + 10},${y + 12} C${x + 14},${y + 2} ${x + 18},${y - 6} ${x + 22},${y - 10}" fill="none" stroke="#c9d1d8" stroke-width="2.6" stroke-linecap="round"/>` + hand(x - 10, y + 12) + hand(x + 10, y + 12);
    case 'scroll':
      return `<rect x="${x + 4}" y="${y + 6}" width="12" height="6" rx="3" fill="#f3e2bb" ${SW}/><circle cx="${x + 16}" cy="${y + 9}" r="3" fill="#e6d2a3" ${SW}/><path d="M${x + 8},${y + 12} v5" stroke="#b83f2c" stroke-width="1.6"/><circle cx="${x + 8}" cy="${y + 18}" r="1.8" fill="#b83f2c"/>` + hand(x + 4, y + 9);
    case 'spyglass':
      return `<path d="M${x + 4},${y + 2} L${x + 16},${y - 5}" stroke="#8c6239" stroke-width="3.2" stroke-linecap="round"/><path d="M${x + 12},${y - 3} L${x + 18},${y - 6.4}" stroke="#d9a441" stroke-width="3.8" stroke-linecap="round"/>` + hand(x + 5, y + 2);
    default:
      return '';
  }
}

/** Yandan at (sola bakar); (x, y) sırt ortası. */
function horseBody(x, y, color, barding) {
  // Uzaktaki iki bacak koyu tonda, gövdenin arkasında
  let s = `<path d="M${x - 11},${y + 9} L${x - 11},${y + 22} M${x + 5},${y + 9} L${x + 6},${y + 22}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${x - 11},${y + 9} L${x - 11},${y + 21} M${x + 5},${y + 9} L${x + 6},${y + 21}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>`;
  s += `<path d="M${x - 14},${y + 2} C${x - 15},${y - 4} ${x - 20},${y - 10} ${x - 22},${y - 16} L${x - 25},${y - 18} L${x - 29},${y - 14} L${x - 27},${y - 11} L${x - 23},${y - 9} C${x - 21},${y - 3} ${x - 20},${y + 4} ${x - 18},${y + 8} L${x - 18},${y + 22} L${x - 15},${y + 22} L${x - 14},${y + 11} L${x + 8},${y + 11} L${x + 9},${y + 22} L${x + 12},${y + 22} L${x + 13},${y + 9} C${x + 16},${y + 6} ${x + 17},${y} ${x + 14},${y - 2}Z" fill="${color}" ${SW}/>`;
  s += `<path d="M${x + 14},${y - 1} C${x + 20},${y + 1} ${x + 21},${y + 10} ${x + 19},${y + 15}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  s += `<path d="M${x - 22},${y - 16} C${x - 19},${y - 12} ${x - 17},${y - 7} ${x - 15},${y - 2}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  s += `<circle cx="${x - 25}" cy="${y - 14}" r="0.8" fill="${INK}"/>`;
  if (barding) s += `<path d="M${x - 16},${y - 1} L${x + 13},${y - 1} L${x + 12},${y + 10} L${x - 15},${y + 10}Z" fill="${barding}" ${SW}/><path d="M${x - 15},${y + 7} L${x + 12},${y + 7}" stroke="#d9a441" stroke-width="1.4"/>`;
  else s += `<path d="M${x - 8},${y - 1} L${x + 6},${y - 1} L${x + 5},${y + 6} L${x - 7},${y + 6}Z" fill="#9b2c1c" ${SW}/>`;
  return s;
}

function footSoldier(spec) {
  const x = 30;
  const y = 28;
  let s = `<ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#2a1d10" opacity="0.18"/>`;
  s += body(x, y, spec);
  s += weapon(spec.weapon, x, y);
  s += head(x, y - 6, spec);
  return s;
}

function rider(spec) {
  const hx = 34;
  const hy = 38;
  let s = `<ellipse cx="32" cy="61" rx="22" ry="3" fill="#2a1d10" opacity="0.18"/>`;
  s += horseBody(hx, hy, spec.mount, spec.barding);
  // Binicinin gövdesi (bel üstü)
  const x = hx - 2;
  const y = hy - 16;
  s += `<path d="M${x - 7},${y} L${x + 7},${y} L${x + 8},${y + 14} L${x - 8},${y + 14}Z" fill="${spec.tunic}" ${SW}/>`;
  if (spec.spots) for (const [dx, dy] of [[-3, 4], [3, 8], [-4, 10]]) s += `<circle cx="${x + dx}" cy="${y + dy}" r="1" fill="#6b4423"/>`;
  s += `<rect x="${x - 7.6}" y="${y + 9}" width="15.2" height="2.6" fill="#d9a441" ${SW}/>`;
  s += `<path d="M${x + 2},${y + 13} L${x + 6},${y + 22}" stroke="#4d3b28" stroke-width="3.4" stroke-linecap="round"/>`;
  s += weapon(spec.weapon, x, y - 1);
  s += head(x, y - 6, spec);
  return s;
}

function ram() {
  return (
    `<ellipse cx="32" cy="55" rx="26" ry="4" fill="#2a1d10" opacity="0.18"/>` +
    `<path d="M8,30 L32,16 L56,30Z" fill="#8f4124" ${SW}/><path d="M12,30 h40 v18 h-40z" fill="#8c6239" ${SW}/>` +
    `<path d="M16,30 v18 M24,30 v18 M32,30 v18 M40,30 v18 M48,30 v18" stroke="#6f4b2a" stroke-width="1"/>` +
    `<rect x="4" y="36" width="52" height="6" rx="3" fill="#a8733f" ${SW}/><path d="M2,33 l-2,6 l2,6 l6,-3 v-6z" fill="#7d858e" ${SW}/>` +
    `<circle cx="18" cy="50" r="6" fill="#6f4b2a" ${SW}/><circle cx="18" cy="50" r="1.6" fill="${INK}"/><circle cx="46" cy="50" r="6" fill="#6f4b2a" ${SW}/><circle cx="46" cy="50" r="1.6" fill="${INK}"/>`
  );
}

function trebuchet() {
  return (
    `<ellipse cx="32" cy="57" rx="24" ry="3.5" fill="#2a1d10" opacity="0.18"/>` +
    `<path d="M10,54 h44" stroke="#6f4b2a" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M18,54 L32,24 L46,54" fill="none" stroke="#8c6239" stroke-width="3.2" stroke-linejoin="round"/>` +
    `<path d="M10,12 L48,34" stroke="#a8733f" stroke-width="3.4" stroke-linecap="round"/><circle cx="32" cy="24" r="2.4" fill="#d9a441" ${SW}/>` +
    `<rect x="42" y="33" width="11" height="10" rx="1.5" fill="#6f4b2a" ${SW}/><path d="M10,12 C8,20 10,26 14,28" fill="none" stroke="${INK}" stroke-width="1"/><circle cx="15" cy="29" r="3.4" fill="#9a9285" ${SW}/>`
  );
}

/**
 * Birimin çizimi (tam SVG). `portrait: true` baş ve gövdeye yakınlaşır (yuvarlak madalyonlar
 * için); aksi hâlde 64 × 64'lük tam boy.
 */
export function unitArt(id, { portrait = false } = {}) {
  let inner;
  let crop = '0 0 64 64';
  if (id === 'kocbasi') {
    inner = ram();
    if (portrait) crop = '0 10 64 52';
  } else if (id === 'mancinik') {
    inner = trebuchet();
    if (portrait) crop = '2 4 58 56';
  } else {
    const spec = SPECS[id] ?? SPECS.yaya;
    inner = spec.mount ? rider(spec) : footSoldier(spec);
    if (portrait) crop = spec.mount ? '4 2 56 56' : '8 -2 44 46';
  }
  return `<svg viewBox="${crop}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}
