// Haritadaki özel yerlerin ve hareketlerin tuval çizimleri: harabeler, Moğol ordugâhı,
// bey toprakları ve yürüyen ordular. Hepsi el yapımı (görsel dosyası gerekmez).

const STONE = '#e6dcc3';
const STONE_SHADE = '#b5a888';
const STONE_DARK = '#8e8268';

// Bey topraklarının renkleri (beyin sırasına göre)
export const LORD_COLORS = ['#b23a2a', '#2f5f9e', '#3d7a3a', '#8a4fa0', '#c07a1e', '#1f7a80', '#7a5a2e', '#a3375f', '#4b5d7a', '#6f7d2a'];

function rand(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Harabe: taş bir sekinin üstünde yıkık sütunlar, devrik bir sütun ve moloz; ikinci ve üçüncü
 * kademede kırık bir kemer. Dolu harabede altın bir parıltı yanıp söner, yağmalanmış olan soluk
 * görünür. Altındaki küçük elmaslar kademeyi gösterir.
 */
export function drawRuin(ctx, ruin, sx, sy, t, now) {
  const seed = ruin.x * 31 + ruin.y * 17;
  const cx = sx + t / 2;
  const base = sy + t * 0.8;
  if (t < 24) {
    ctx.fillStyle = ruin.empty ? STONE_DARK : STONE;
    ctx.fillRect(cx - t * 0.3, base - t * 0.5, t * 0.16, t * 0.5);
    ctx.fillRect(cx + t * 0.12, base - t * 0.36, t * 0.16, t * 0.36);
    ctx.fillStyle = STONE_SHADE;
    ctx.fillRect(cx - t * 0.36, base - t * 0.06, t * 0.72, t * 0.1);
    if (!ruin.empty) {
      ctx.fillStyle = '#e8b93c';
      ctx.fillRect(cx - t * 0.06, base - t * 0.2, t * 0.12, t * 0.12);
    }
    return;
  }
  const u = t * (1.02 + ruin.tier * 0.1);
  ctx.save();
  if (ruin.empty) ctx.globalAlpha = 0.55;
  // gölge ve taş seki (iki basamak)
  ctx.fillStyle = 'rgb(40 30 15 / 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx + u * 0.04, base + u * 0.04, u * 0.5, u * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  const step = (w, h, lift, top, side) => {
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(cx - w, base - lift);
    ctx.lineTo(cx, base - lift + h);
    ctx.lineTo(cx + w, base - lift);
    ctx.lineTo(cx + w, base - lift - u * 0.05);
    ctx.lineTo(cx, base - lift + h - u * 0.05);
    ctx.lineTo(cx - w, base - lift - u * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(cx - w, base - lift - u * 0.05);
    ctx.lineTo(cx, base - lift - h - u * 0.05);
    ctx.lineTo(cx + w, base - lift - u * 0.05);
    ctx.lineTo(cx, base - lift + h - u * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgb(80 70 50 / 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  step(u * 0.46, u * 0.17, 0, '#d4c8a8', '#9c8f72');
  step(u * 0.36, u * 0.13, u * 0.05, '#e4d9bd', '#a99c7e');
  const floor = base - u * 0.1;
  // sütunlar: arka sıra önce
  const column = (px, py, height, broken) => {
    const w = u * 0.15;
    const grad = ctx.createLinearGradient(px - w / 2, 0, px + w / 2, 0);
    grad.addColorStop(0, '#fbf5e4');
    grad.addColorStop(0.55, STONE);
    grad.addColorStop(1, STONE_SHADE);
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#6e6450';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.rect(px - w / 2, py - height, w, height);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgb(110 100 80 / 0.45)';
    ctx.beginPath();
    ctx.moveTo(px - w * 0.12, py - height + 2);
    ctx.lineTo(px - w * 0.12, py - 2);
    ctx.moveTo(px + w * 0.2, py - height + 2);
    ctx.lineTo(px + w * 0.2, py - 2);
    ctx.stroke();
    ctx.fillStyle = STONE;
    ctx.strokeStyle = '#6e6450';
    if (broken) {
      ctx.beginPath();
      ctx.moveTo(px - w / 2, py - height);
      ctx.lineTo(px - w * 0.1, py - height - u * 0.06);
      ctx.lineTo(px + w * 0.15, py - height - u * 0.02);
      ctx.lineTo(px + w / 2, py - height - u * 0.05);
      ctx.lineTo(px + w / 2, py - height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(px - w * 0.85, py - height - u * 0.05, w * 1.7, u * 0.05);
      ctx.fill();
      ctx.stroke();
    }
  };
  const back = [
    [cx - u * 0.24, floor - u * 0.08, u * (0.46 + 0.28 * rand(seed, 1)), rand(seed, 2) > 0.4],
    [cx + u * 0.16, floor - u * 0.1, u * (0.54 + 0.25 * rand(seed, 3)), rand(seed, 4) > 0.6],
  ];
  if (ruin.tier >= 2) back.push([cx + u * 0.3, floor - u * 0.02, u * (0.3 + 0.2 * rand(seed, 5)), true]);
  for (const [px, py, height, broken] of back) column(px, py, height, broken);
  // kırık kemer: iki arka sütunun arasında
  if (ruin.tier >= 2) {
    ctx.strokeStyle = '#cfc3a5';
    ctx.lineWidth = Math.max(2.5, u * 0.07);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    const ax = (back[0][0] + back[1][0]) / 2;
    const ay = Math.min(back[0][1] - back[0][2], back[1][1] - back[1][2]) + u * 0.02;
    ctx.arc(ax, ay + u * 0.1, (back[1][0] - back[0][0]) / 2, Math.PI * 1.02, Math.PI * 1.62);
    ctx.stroke();
  }
  // ön sıra: alçak, kırık
  column(cx - u * 0.32, floor + u * 0.06, u * (0.18 + 0.12 * rand(seed, 6)), true);
  if (ruin.tier >= 3) column(cx + u * 0.02, floor + u * 0.1, u * (0.22 + 0.1 * rand(seed, 7)), true);
  // devrik sütun
  ctx.save();
  ctx.translate(cx + u * 0.18, floor + u * 0.08);
  ctx.rotate(-0.42);
  ctx.fillStyle = STONE;
  ctx.strokeStyle = '#6e6450';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.rect(-u * 0.16, -u * 0.05, u * 0.32, u * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // moloz
  ctx.fillStyle = STONE_DARK;
  for (let i = 0; i < 5; i++) {
    const px = cx - u * 0.42 + rand(seed, i + 20) * u * 0.84;
    const py = floor + u * (0.06 + rand(seed, i + 30) * 0.08);
    ctx.fillRect(px, py - u * 0.035, u * 0.07, u * 0.045);
  }
  ctx.restore();
  // hazine parıltısı
  if (!ruin.empty) {
    const pulse = 0.55 + 0.45 * Math.sin(now / 420 + seed);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd766';
    ctx.shadowColor = '#ffcf4a';
    ctx.shadowBlur = 8;
    const gx = cx - u * 0.04;
    const gy = floor - u * 0.02;
    const r = u * 0.07;
    ctx.beginPath();
    ctx.moveTo(gx, gy - r * 1.8);
    ctx.lineTo(gx + r * 0.4, gy - r * 0.4);
    ctx.lineTo(gx + r * 1.8, gy);
    ctx.lineTo(gx + r * 0.4, gy + r * 0.4);
    ctx.lineTo(gx, gy + r * 1.8);
    ctx.lineTo(gx - r * 0.4, gy + r * 0.4);
    ctx.lineTo(gx - r * 1.8, gy);
    ctx.lineTo(gx - r * 0.4, gy - r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // kademe: altında küçük elmaslar
  ctx.fillStyle = ruin.empty ? STONE_DARK : '#c9a24a';
  ctx.strokeStyle = 'rgb(60 40 10 / 0.6)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < ruin.tier; i++) {
    const px = cx + (i - (ruin.tier - 1) / 2) * t * 0.15;
    const py = sy + t * 1.0;
    ctx.beginPath();
    ctx.moveTo(px, py - t * 0.055);
    ctx.lineTo(px + t * 0.055, py);
    ctx.lineTo(px, py + t * 0.055);
    ctx.lineTo(px - t * 0.055, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Moğol ordugâhı: çadırlar, tuğ (at kılı sancak), kamp ateşi ve atan kırmızı bir halka. */
export function drawCamp(ctx, sx, sy, t, now) {
  const cx = sx + t / 2;
  const base = sy + t * 0.82;
  const pulse = (now % 1600) / 1600;
  ctx.save();
  ctx.strokeStyle = `rgb(200 40 30 / ${0.7 * (1 - pulse)})`;
  ctx.lineWidth = Math.max(2, t / 16);
  ctx.beginPath();
  ctx.ellipse(cx, base, t * (0.62 + pulse * 0.55), t * (0.24 + pulse * 0.2), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgb(60 30 10 / 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, base, t * 0.55, t * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  const yurt = (x, size, roof) => {
    ctx.fillStyle = '#e2d3ae';
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = Math.max(1, t / 40);
    ctx.beginPath();
    ctx.moveTo(x - size, base);
    ctx.lineTo(x - size, base - size * 0.7);
    ctx.quadraticCurveTo(x, base - size * 1.7, x + size, base - size * 0.7);
    ctx.lineTo(x + size, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.98, base - size * 0.72);
    ctx.quadraticCurveTo(x, base - size * 1.7, x + size * 0.98, base - size * 0.72);
    ctx.quadraticCurveTo(x, base - size * 1.05, x - size * 0.98, base - size * 0.72);
    ctx.fill();
    ctx.fillStyle = '#4a2e17';
    ctx.fillRect(x - size * 0.22, base - size * 0.5, size * 0.44, size * 0.5);
  };
  yurt(cx - t * 0.36, t * 0.2, '#8a5a32');
  yurt(cx + t * 0.38, t * 0.19, '#8a5a32');
  yurt(cx - t * 0.02, t * 0.3, '#a3321f');
  // tuğ
  const poleX = cx + t * 0.16;
  const top = sy - t * 0.2;
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = Math.max(1.5, t / 26);
  ctx.beginPath();
  ctx.moveTo(poleX, base - t * 0.36);
  ctx.lineTo(poleX, top);
  ctx.stroke();
  const sway = Math.sin(now / 300) * t * 0.03;
  ctx.fillStyle = '#1d140c';
  ctx.beginPath();
  ctx.moveTo(poleX - t * 0.04, top + t * 0.06);
  ctx.quadraticCurveTo(poleX + sway - t * 0.06, top + t * 0.3, poleX + sway, top + t * 0.38);
  ctx.quadraticCurveTo(poleX + sway + t * 0.06, top + t * 0.3, poleX + t * 0.04, top + t * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d4a63a';
  ctx.beginPath();
  ctx.arc(poleX, top, t * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // kamp ateşi
  const flicker = 0.7 + 0.3 * Math.sin(now / 90);
  ctx.fillStyle = `rgb(255 150 40 / ${flicker})`;
  ctx.beginPath();
  ctx.arc(cx - t * 0.12, base + t * 0.04, t * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

/** Bey toprakları: hisarın çevresinde beyin renginde yumuşak bir alan ve kesikli sınır. */
export function drawTerritory(ctx, cx, cy, radius, color) {
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  gradient.addColorStop(0, `${color}55`);
  gradient.addColorStop(0.7, `${color}30`);
  gradient.addColorStop(1, `${color}0a`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = `${color}cc`;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 6]);
  ctx.stroke();
  ctx.restore();
}

/** Beyin adı: hisarın üstünde küçük bir sancak şeridi. */
export function drawLordLabel(ctx, text, cx, top, color) {
  ctx.save();
  ctx.font = '600 11px system-ui, sans-serif';
  const width = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgb(28 20 12 / 0.78)';
  ctx.beginPath();
  ctx.roundRect?.(cx - width / 2, top - 15, width, 15, 4);
  if (!ctx.roundRect) ctx.rect(cx - width / 2, top - 15, width, 15);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(cx - width / 2, top - 15, 3, 15);
  ctx.fillStyle = '#f6e7c1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx + 1, top - 7.5);
  ctx.restore();
}

/**
 * Yürüyen ordu: yolu kesikli çizgi, ordu kendisi renkli bir kalkan ve yönünü gösteren sancak.
 * Yürüdükçe hafifçe sallanır (`now`).
 */
export function drawMarcher(ctx, from, to, color, progress, t, now, kind) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -((now / 60) % 11);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 1;
  const x = from[0] + (to[0] - from[0]) * progress;
  const y = from[1] + (to[1] - from[1]) * progress + Math.sin(now / 160) * Math.max(0.6, t / 40);
  const r = Math.max(5, t / 6);
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  // gölge
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // kalkan
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff4dc';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y - r * 0.7);
  ctx.lineTo(x + r * 0.8, y - r * 0.7);
  ctx.lineTo(x + r * 0.8, y + r * 0.05);
  ctx.quadraticCurveTo(x + r * 0.7, y + r * 0.8, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.8, x - r * 0.8, y + r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // simge: saldırıda çapraz kılıç, dönüşte ok, diğerlerinde nokta
  ctx.strokeStyle = '#fff4dc';
  ctx.lineWidth = Math.max(1.2, r / 5);
  ctx.beginPath();
  if (kind === 'saldiri') {
    ctx.moveTo(x - r * 0.4, y - r * 0.35);
    ctx.lineTo(x + r * 0.4, y + r * 0.45);
    ctx.moveTo(x + r * 0.4, y - r * 0.35);
    ctx.lineTo(x - r * 0.4, y + r * 0.45);
  } else {
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
  }
  ctx.stroke();
  // yön sancağı
  ctx.save();
  ctx.translate(x, y - r * 0.7);
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.9);
  ctx.stroke();
  const dir = Math.cos(angle) >= 0 ? 1 : -1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);
  ctx.lineTo(dir * r * 0.75, -r * 0.7 + Math.sin(now / 200) * r * 0.08);
  ctx.lineTo(0, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
