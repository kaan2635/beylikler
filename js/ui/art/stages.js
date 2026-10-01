import { BUILDINGS } from '../../config/buildings.js';
import { P, poly, tile } from './iso.js';
import { buildingImage } from './sprites.js';

/**
 * Binaların görünüş aşamaları. Her bina beş aşamadan geçer (çoğunda 1., 5., 10., 15. ve 20.
 * seviye; en yüksek seviyesi daha düşük binalarda aynı oranda): küçük bir yapıdan başlar,
 * çit ve yan yapılar, taş avlu ve duvar, sancaklar ve fenerler, en sonunda köşe burcu ve altın
 * sancaklarla görkemli bir yapıya dönüşür. Hazır bina görselleri bu süslerle birleştirilir.
 *
 * Çizimler arsa koordinatındadır (0..40 dünya birimi; bkz. scene.js); `stageSvg` aynı çizimi
 * kartlar için tek başına bir SVG olarak verir.
 */

export const STAGE_NAMES = Object.freeze({
  konak: ['Ev', 'Büyük Ev', 'Konak', 'Malikâne', 'Köşk'],
  oduncu: ['Balta Kulübesi', 'Kereste Atölyesi', 'Bıçkıhane', 'Büyük Bıçkıhane', 'Orman Ocağı'],
  kilocagi: ['Kil Çukuru', 'Kil Ocağı', 'Tuğlahane', 'Büyük Tuğlahane', 'Kiremithane'],
  demirmadeni: ['Maden Ağzı', 'Maden Ocağı', 'Maden Galerisi', 'Büyük Maden', 'Maden Hassası'],
  ambar: ['Kiler', 'Ambar', 'Büyük Ambar', 'Erzak Deposu', 'Anbar-ı Âmire'],
  ciftlik: ['Tarla Evi', 'Çiftlik', 'Büyük Çiftlik', 'Malikâne Çiftliği', 'Has Çiftlik'],
  gizlidepo: ['Kuyu', 'Mahzen', 'Gizli Depo', 'Yeraltı Deposu', 'Gizli Hazine'],
  kisla: ['Talimgâh', 'Kışla', 'Büyük Kışla', 'Ordugâh Kışlası', 'Ocak Kışlası'],
  ahir: ['Ağıl', 'Ahır', 'Büyük Ahır', 'Has Ahır', 'Istabl-ı Âmire'],
  atolye: ['Marangozhane', 'Atölye', 'Büyük Atölye', 'Cebehane', 'Baş Cebehane'],
  demirci: ['Nalbant', 'Demirci', 'Silahhane', 'Zırhhane', 'Baş Silahhane'],
  pazar: ['Pazar Yeri', 'Pazar', 'Arasta', 'Bedesten', 'Kapalı Çarşı'],
  kervansaray: ['Han', 'Kervansaray', 'Büyük Kervansaray', 'Sultan Hanı', 'Büyük Sultan Hanı'],
  saray: ['Kasır', 'Saray', 'Büyük Saray', 'Sultan Sarayı', 'Saray-ı Hümayun'],
  sur: ['Çit', 'Palanka', 'Sur', 'Kale Suru', 'Hisar'],
  kule: ['Gözcü Direği', 'Gözetleme Kulesi', 'Taş Kule', 'Burç', 'Kale Burcu'],
});

/** Aşamaların başladığı seviyeler: en yüksek seviyesi 20 ve üstü olanlarda 1, 5, 10, 15, 20. */
export function stageLevels(id) {
  const max = BUILDINGS[id]?.maxLevel ?? 20;
  if (max >= 20) return [1, 5, 10, 15, 20];
  const levels = [1];
  for (const share of [0.25, 0.5, 0.75]) levels.push(Math.max(levels[levels.length - 1] + 1, Math.round(max * share)));
  levels.push(Math.max(levels[3] + 1, max));
  return levels;
}

/** Seviyenin aşaması (0–4); inşa edilmemişse -1. */
export function stageOf(id, level) {
  if (level <= 0) return -1;
  let stage = 0;
  stageLevels(id).forEach((min, i) => {
    if (level >= min) stage = i;
  });
  return stage;
}

export function stageName(id, level) {
  const stage = stageOf(id, level);
  return stage < 0 ? null : (STAGE_NAMES[id] ?? [])[stage] ?? null;
}

/** Bir sonraki görünüş: { level, name } ya da null. */
export function nextStage(id, level) {
  const stage = stageOf(id, level);
  const levels = stageLevels(id);
  if (stage >= levels.length - 1) return null;
  const at = levels[stage + 1];
  if (at > (BUILDINGS[id]?.maxLevel ?? 20)) return null;
  return { level: at, name: (STAGE_NAMES[id] ?? [])[stage + 1] };
}

// ---------- Çizim ----------

const f = (n) => Math.round(n * 10) / 10;

// Görsellerin en-boy oranı (yükseklik / genişlik): süsleri görsele hizalamak için.
const ASPECT = {
  ahir: 0.79, ambar: 0.8, atolye: 1.02, ciftlik: 0.77, demirci: 0.85, demirmadeni: 0.8, gizlidepo: 1.03, kervansaray: 0.73,
  kilocagi: 0.95, kisla: 0.79, konak: 0.79, oduncu: 0.75, pazar: 1.02, saray: 0.84, 'sur-ahsap': 1.48, sur: 1.34,
};

// Binaların görsel boyu (arsa genişliğine oranla)
export const SIZE = { kule: 0.78, saray: 1.18, kisla: 1.06, ahir: 1.04, kervansaray: 1.04, konak: 1.02, demirmadeni: 0.9, oduncu: 0.92, kilocagi: 0.84, gizlidepo: 0.8 };
const STAGE_SCALE = [0.62, 0.74, 0.85, 0.94, 1.02];

// Yan yapılar: aşama 1'den itibaren solda, 3'ten itibaren sağda. Askerî binalarda ahşap/taş
// kuleler, ekonomide işçi evleri, yönetimde konutlar.
const ANNEX = {
  konak: ['ambar', 'ciftlik'],
  oduncu: ['ambar', 'ciftlik'],
  kilocagi: ['ciftlik', 'ambar'],
  demirmadeni: ['ambar', 'ciftlik'],
  ambar: ['ciftlik', 'konak'],
  ciftlik: ['ambar', 'konak'],
  gizlidepo: ['ambar', null],
  kisla: ['ambar', 'ciftlik'],
  ahir: ['ambar', 'ciftlik'],
  atolye: ['ambar', 'ciftlik'],
  demirci: ['ambar', 'ciftlik'],
  pazar: ['ciftlik', 'ambar'],
  kervansaray: ['ambar', 'ciftlik'],
  saray: ['konak', 'konak'],
  kule: [null, null],
};

// Bacası tüten binalar ve bacanın görsel üzerindeki yeri (genişliğe oranla, merkezden)
const SMOKE = { konak: [-0.14, 0.08], ciftlik: [0.08, 0.12], ambar: [-0.08, 0.06], demirci: [0.36, 0.06], kilocagi: [0.1, 0.1], oduncu: [0.05, 0.18], kervansaray: [0.28, 0.1], kisla: [0.1, 0.12], demirmadeni: [0.12, 0.2] };

function image(src, cx, bottom, width, aspectKey) {
  const height = width * (ASPECT[aspectKey] ?? 1);
  return `<image href="${src}" x="${f(cx - width / 2)}" y="${f(bottom - height)}" width="${f(width)}" height="${f(height)}" preserveAspectRatio="xMidYMax meet"/>`;
}

function annexSprite(kind, level, cx, bottom, width) {
  if (!kind) return '';
  if (kind === 'tower') {
    const key = level >= 10 ? 'sur' : 'sur-ahsap';
    return image(buildingImage(key === 'sur' ? 'kule' : 'sur', key === 'sur' ? 5 : 1), cx, bottom, width * 0.62, key);
  }
  return image(buildingImage(kind, 1), cx, bottom, width, kind);
}

/** Ahşap çit: ön iki kenar boyunca kazıklar ve iki sıra kiriş. */
function fence() {
  const wood = '#7a5230';
  let s = '<g class="stage-fence">';
  const rails = (points) => [2, 4.2].map((z) => `<polyline points="${points.map(([x, y]) => P(x, y, z).map(f).join(',')).join(' ')}" fill="none" stroke="${wood}" stroke-width="0.9"/>`).join('');
  const left = [[3, 37], [15, 37]];
  const left2 = [[25, 37], [37, 37]];
  const right = [[37, 37], [37, 3]];
  for (const [[x0, y0], [x1, y1]] of [left, left2, right]) {
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      const [bx, by] = P(x, y, 0);
      const [tx, ty] = P(x, y, 5.5);
      s += `<line x1="${f(bx)}" y1="${f(by)}" x2="${f(tx)}" y2="${f(ty)}" stroke="#5e3d22" stroke-width="1.2" stroke-linecap="round"/>`;
    }
    s += rails([[x0, y0], [x1, y1]]);
  }
  return `${s}</g>`;
}

/** Alçak taş duvar: önde, ortasında kapı aralığı; sağ kenar boyunca. */
function stoneWall(height = 3) {
  const c = ['#e8dfc8', '#cfc3a6', '#b3a688'];
  const t = 1.6;
  const seg = (x, y, w, d) =>
    poly([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, height], [x + w, y, height]], c[2], { stroke: '#7d7058', width: 0.35 }) +
    poly([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, height], [x, y + d, height]], c[1], { stroke: '#7d7058', width: 0.35 }) +
    poly([[x, y, height], [x + w, y, height], [x + w, y + d, height], [x, y + d, height]], c[0], { stroke: '#7d7058', width: 0.35 });
  return `<g class="stage-wall">${seg(37 - t, 2, t, 36)}${seg(2, 38 - t, 13, t)}${seg(25, 38 - t, 13 - t, t)}</g>`;
}

/** Sancak: direk ve dalgalanan bayrak (aşama 4'te altın). */
function banner(x, y, gold, delay = 0) {
  const [sx, sy] = P(x, y, 0);
  const top = sy - 19;
  const color = gold ? '#c99a2e' : '#a3321f';
  const trim = gold ? '#fff0b8' : '#e6c068';
  return (
    `<g class="stage-banner">` +
    `<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(sx)}" y2="${f(top - 2)}" stroke="#3a2a1a" stroke-width="1.1"/>` +
    `<circle cx="${f(sx)}" cy="${f(top - 2.5)}" r="1.3" fill="${trim}"/>` +
    `<path class="banner-cloth" style="animation-delay:${delay}s" d="M${f(sx)},${f(top)} C${f(sx + 3)},${f(top - 1.2)} ${f(sx + 5)},${f(top + 1)} ${f(sx + 7.5)},${f(top + 0.5)} L${f(sx + 6.4)},${f(top + 2.6)} L${f(sx + 7.5)},${f(top + 4.8)} C${f(sx + 5)},${f(top + 5.4)} ${f(sx + 3)},${f(top + 3.4)} ${f(sx)},${f(top + 4.5)}Z" fill="${color}" stroke="#3a2a1a" stroke-width="0.45"/>` +
    `<path d="M${f(sx + 3.4)},${f(top + 1.2)} a1.35,1.35 0 1 0 0.15,2.55 a1.05,1.05 0 1 1 -0.15,-2.55z" fill="${trim}"/>` +
    `</g>`
  );
}

/** Fener direği: gece ışığı yanar (scene CSS'te --night ile). */
function lantern(x, y) {
  const [sx, sy] = P(x, y, 0);
  return (
    `<g class="stage-lantern">` +
    `<circle class="lamp-glow" cx="${f(sx)}" cy="${f(sy - 9)}" r="7" fill="url(#scene-lamp)"/>` +
    `<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(sx)}" y2="${f(sy - 8)}" stroke="#3a2a1a" stroke-width="1"/>` +
    `<rect x="${f(sx - 1.4)}" y="${f(sy - 10.6)}" width="2.8" height="3" rx="0.6" fill="#f2c860" stroke="#3a2a1a" stroke-width="0.5"/>` +
    `</g>`
  );
}

/** Sandık ve saman: küçük yapıların önündeki iş eşyası. */
function crates(x, y) {
  const [sx, sy] = P(x, y, 0);
  return (
    `<g class="stage-crates">` +
    `<rect x="${f(sx - 4)}" y="${f(sy - 3.6)}" width="3.8" height="3.6" fill="#9a6a3a" stroke="#5e3d22" stroke-width="0.5"/>` +
    `<rect x="${f(sx - 0.6)}" y="${f(sy - 3)}" width="3.2" height="3" fill="#a87442" stroke="#5e3d22" stroke-width="0.5"/>` +
    `<ellipse cx="${f(sx + 5)}" cy="${f(sy - 1.4)}" rx="3.2" ry="2.2" fill="#d6b65a" stroke="#9a7a2e" stroke-width="0.5"/>` +
    `</g>`
  );
}

/** Çiçek tarhı */
function flowers(x, y) {
  const [sx, sy] = P(x, y, 0);
  return (
    `<g class="stage-flowers"><ellipse cx="${f(sx)}" cy="${f(sy)}" rx="5" ry="2.2" fill="#4a6d30"/>` +
    `<circle cx="${f(sx - 2.6)}" cy="${f(sy - 0.6)}" r="0.9" fill="#d9534f"/><circle cx="${f(sx)}" cy="${f(sy - 1.2)}" r="0.9" fill="#f0c94a"/><circle cx="${f(sx + 2.4)}" cy="${f(sy - 0.4)}" r="0.9" fill="#e8e0f0"/></g>`
  );
}

/** Baca dumanı: üç halka yükselip kaybolur (CSS animasyonu). */
function smoke(sx, sy) {
  return `<g class="smoke" transform="translate(${f(sx)} ${f(sy)})"><circle r="2.2"/><circle r="2.6"/><circle r="3"/></g>`;
}

/**
 * Bina ve aşamasının süsleri, arsa koordinatında. `animate`: duman ve fenerler (sahnede).
 */
export function composeBuilding(id, level, { animate = true } = {}) {
  const stage = Math.max(0, stageOf(id, level));
  const width = 74 * (SIZE[id] ?? 1) * STAGE_SCALE[stage];
  const [cx, cy] = P(20, 20, 0);
  const bottom = cy + 15;
  const [leftAnnex, rightAnnex] = ANNEX[id] ?? [null, null];
  let ground = '';
  let back = '';
  let front = '';

  // Zemin: önce toprak avlu, sonra taş döşeme; son aşamada altın bir hare.
  if (stage === 1) ground += tile(5, 5, 30, 30, 'url(#scene-dirt)', { opacity: 0.5 });
  if (stage >= 2) ground += tile(3, 3, 34, 34, 'url(#scene-cobble)', { opacity: 0.8 });
  if (stage === 4) ground += `<ellipse class="stage-aura" cx="${cx}" cy="${cy + 4}" rx="40" ry="19" fill="none" stroke="#f0c95a" stroke-width="1.4" opacity="0.55"/>`;

  // Yan yapılar (arkada)
  if (stage >= 1 && leftAnnex) {
    const [ax, ay] = P(9, 29, 0);
    back += annexSprite(leftAnnex, level, ax - 2, ay + 4, width * 0.46);
  }
  if (stage >= 3 && rightAnnex) {
    const [ax, ay] = P(29, 9, 0);
    back += annexSprite(rightAnnex, level, ax + 2, ay + 4, width * 0.44);
  }

  // Ana yapı: aşamayla büyür
  const key = id === 'kule' ? (level >= 5 ? 'sur' : 'sur-ahsap') : id;
  const main = image(buildingImage(id, level), cx, bottom, width, key);
  const mainHeight = width * (ASPECT[key] ?? 1);

  // Önde: iş eşyası, çit, duvar, sancaklar, fenerler, çiçekler
  if (stage <= 1) front += crates(30, 36);
  if (stage === 1) front += fence();
  if (stage >= 3) front += stoneWall(stage === 4 ? 3.6 : 2.8);
  if (stage === 2 || stage === 3) front += banner(4, 37, false, 0);
  if (stage === 4) front += banner(4, 37, true, 0) + banner(37, 4, true, 0.6);
  if (stage >= 3) front += flowers(14, 33) + flowers(33, 14);
  if (stage >= 2 && animate) front += lantern(37, 26);
  if (stage >= 3 && animate) front += lantern(26, 37);

  let fx = '';
  if (animate && SMOKE[id] && stage >= 0) {
    const [dx, dy] = SMOKE[id];
    fx += smoke(cx + dx * width, bottom - mainHeight + dy * width);
  }
  // Gece pencere ışığı: ana yapının ortasında sıcak bir parıltı
  if (animate) fx += `<ellipse class="window-glow" cx="${f(cx)}" cy="${f(bottom - mainHeight * 0.35)}" rx="${f(width * 0.28)}" ry="${f(mainHeight * 0.2)}" fill="url(#scene-lamp)"/>`;

  return `<g class="stage stage-${stage}">${ground}${back}${main}${fx}${front}</g>`;
}

/** Kartlar için tek başına SVG: binanın o aşamadaki görünüşü. */
export function stageSvg(id, level) {
  const built = level > 0;
  const body = composeBuilding(id, Math.max(1, level), { animate: false });
  return (
    `<svg viewBox="-46 -34 92 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${built ? '' : ' class="ghost"'}>` +
    `<defs>` +
    `<pattern id="scene-cobble" width="10" height="8" patternUnits="userSpaceOnUse"><rect width="10" height="8" fill="#8f8573"/><rect x="0.5" y="0.5" width="4" height="3" rx="1" fill="#b0a58f"/><rect x="5.5" y="0.5" width="4" height="3" rx="1" fill="#a39884"/><rect x="3" y="4.5" width="4" height="3" rx="1" fill="#b6ab95"/></pattern>` +
    `<pattern id="scene-dirt" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#a7865a"/><circle cx="3" cy="4" r="1" fill="#8f7049"/><circle cx="10" cy="9" r="1.2" fill="#b89a6c"/></pattern>` +
    `<pattern id="scene-stone" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#8d8779"/><path d="M0 3h8M4 0v3M0 3v3M8 3v3" stroke="#6e695d" stroke-width="0.6"/></pattern>` +
    `<pattern id="scene-stone-dark" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#6f6a5e"/><path d="M0 3h8M4 0v3M0 3v3M8 3v3" stroke="#57534a" stroke-width="0.6"/></pattern>` +
    `<pattern id="scene-stone-top" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a7a092"/></pattern>` +
    `</defs>` +
    body +
    `</svg>`
  );
}
