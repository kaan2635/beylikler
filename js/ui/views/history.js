import { snapshot } from '../../systems/history.js';
import { renownOf, titleOf } from '../../systems/renown.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt } from '../format.js';

const DAY = 86_400_000;

// Grafikler: her biri tarihçedeki bir alan.
const CHARTS = [
  { key: 'points', title: 'Beylik puanı', icon: 'nav-siralama', color: '#b5852a', note: 'Bütün köylerin bina puanı' },
  { key: 'production', title: 'Üretim', icon: 'odun', color: '#3f6f2e', note: 'Saatlik toplam odun, kil ve demir', unit: '/saat' },
  { key: 'army', title: 'Ordu', icon: 'saldiri', color: '#9c3b22', note: 'Askerlerin nüfusu (seferdekiler dahil)' },
  { key: 'renown', title: 'Şan', icon: 'san', color: '#2c5d9b', note: 'Unvanı belirleyen şan' },
];

// Beyliğin defteri: kayıttaki sayaçlar.
const LEDGER = [
  ['saldiri', 'Kazanılan saldırı', (s) => `${fmtInt(s.stats.attacksWon ?? 0)} / ${fmtInt(s.stats.attacks ?? 0)}`],
  ['savunma', 'Püskürtülen saldırı', (s) => fmtInt(s.stats.defenses ?? 0)],
  ['kupa', 'Savaş puanı', (s) => fmtInt(s.stats.kills ?? 0)],
  ['tasima', 'Toplam ganimet', (s) => fmtInt(s.stats.loot ?? 0)],
  ['nav-kesif', 'Keşif seferi', (s) => fmtInt(s.stats.expeditions ?? 0)],
  ['harabe', 'Yağmalanan harabe', (s) => fmtInt(s.stats.ruins ?? 0)],
  ['ordugah', 'Moğol ordugâhı / dalga', (s) => `${fmtInt(s.stats.invasions ?? 0)} / ${fmtInt(s.stats.invasionWaves ?? 0)}`],
  ['olay', 'Karara bağlanan olay', (s) => fmtInt(s.stats.events ?? 0)],
  ['nav-diplomasi', 'Antlaşma / hediye', (s) => `${fmtInt(s.stats.treaties ?? 0)} / ${fmtInt(s.stats.gifts ?? 0)}`],
  ['nav-gorevler', 'Tamamlanan görev', (s) => fmtInt(s.quests?.claimed?.length ?? 0)],
  ['nav-divan', 'Araştırma', (s) => fmtInt(s.player?.ilim?.done?.length ?? 0)],
  ['nav-koyler', 'Köy', (s) => fmtInt(Object.keys(s.villages).length)],
];

/** Tarihçe: beyliğin günden güne büyümesi (grafikler) ve sayaçlar. */
export function createHistoryView({ game }) {
  const summary = h('span', { class: 'muted' });
  const charts = CHARTS.map((def) => createChart(def));
  const ledger = LEDGER.map(([iconName, label, read]) => {
    const value = h('strong');
    return { read, value, el: h('li', null, h('span', { class: 'ledger-icon' }, icon(iconName)), h('span', { class: 'ledger-label' }, label), value) };
  });
  const empty = h('p', { class: 'muted' }, 'Tarihçe her oyun gününün başında bir sayfa yazar. Yarın ilk karşılaştırmayı burada göreceksin.');
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Tarihçe'), summary),
    h('p', { class: 'muted page-intro' }, 'Vakanüvis beyliğinin her gününü deftere yazar. Grafiklerin üstünde gezinerek o günün değerini görebilirsin.'),
    empty,
    h('div', { class: 'chart-grid' }, charts.map((chart) => chart.el)),
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Beyliğin defteri')), h('ul', { class: 'ledger' }, ledger.map((row) => row.el))),
  );
  let signature = null;
  return {
    el,
    update(now) {
      const { state } = game;
      const today = Math.floor(state.world.clock.time / DAY);
      // Kayıtlı günler ve bugünün canlı değeri (her dakika yenilenir; grafik her saniye çizilmez).
      const minute = Math.floor(now / 60_000);
      const sig = `${state.history?.length ?? 0}|${minute}`;
      if (sig !== signature) {
        signature = sig;
        const days = (state.history ?? []).filter((entry) => entry.day < today);
        const series = [...days, snapshot(state, today)];
        empty.hidden = series.length > 1;
        for (const chart of charts) chart.draw(series);
      }
      setText(summary, `${titleOf(state).name} · ${fmtInt(renownOf(state))} şan · ${today + 1}. gün`);
      for (const row of ledger) setText(row.value, row.read(state));
    },
  };
}

function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  if (n >= 1e4) return `${(n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} B`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B`;
  return fmtInt(n);
}

/** Tek bir alan grafiği: alan, çizgi, ızgara; üzerine gelince o günün değeri. */
function createChart({ key, title, icon: iconName, color, note, unit = '' }) {
  const value = h('strong', { class: 'chart-value' });
  const change = h('span', { class: 'chart-change' });
  const canvas = h('div', { class: 'chart-canvas' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const el = h(
    'section',
    { class: 'panel chart-panel' },
    h('div', { class: 'chart-head' }, h('span', { class: 'chart-icon', style: `color:${color}` }, icon(iconName)), h('div', null, h('h2', null, title), h('span', { class: 'muted' }, note)), h('div', { class: 'chart-now' }, value, change)),
    h('div', { class: 'chart-wrap' }, canvas, tip),
  );
  let points = [];
  let series = [];
  const W = 520;
  const H = 200;
  const pad = { l: 48, r: 14, t: 12, b: 28 };

  canvas.addEventListener('pointermove', (event) => {
    if (series.length < 2) return;
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p[0] - x) < Math.abs(points[best][0] - x)) best = i;
    });
    const [px, py] = points[best];
    const guide = canvas.querySelector('.chart-guide');
    const dot = canvas.querySelector('.chart-hover');
    guide?.setAttribute('x1', px);
    guide?.setAttribute('x2', px);
    guide?.removeAttribute('visibility');
    dot?.setAttribute('cx', px);
    dot?.setAttribute('cy', py);
    dot?.removeAttribute('visibility');
    tip.hidden = false;
    tip.textContent = `${series[best].day + 1}. gün · ${fmtInt(series[best][key])}${unit}`;
    tip.style.left = `${(px / W) * 100}%`;
    tip.style.top = `${(py / H) * 100}%`;
  });
  canvas.addEventListener('pointerleave', () => {
    tip.hidden = true;
    canvas.querySelector('.chart-guide')?.setAttribute('visibility', 'hidden');
    canvas.querySelector('.chart-hover')?.setAttribute('visibility', 'hidden');
  });

  return {
    el,
    draw(next) {
      series = next;
      const values = series.map((entry) => entry[key] ?? 0);
      const last = values[values.length - 1] ?? 0;
      setText(value, `${fmtInt(last)}${unit}`);
      const first = values.length > 1 ? values[Math.max(0, values.length - 8)] : last;
      const diff = last - first;
      setText(change, values.length > 1 ? `${diff >= 0 ? '▲' : '▼'} ${fmtInt(Math.abs(diff))} (7 gün)` : '');
      change.classList.toggle('loss', diff < 0);
      const max = Math.max(1, ...values) * 1.08;
      const n = values.length;
      const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
      const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
      points = values.map((v, i) => [x(i), y(v)]);
      const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('');
      const area = n > 1 ? `${line}L${points[n - 1][0].toFixed(1)} ${H - pad.b}L${points[0][0].toFixed(1)} ${H - pad.b}Z` : '';
      const grid = [0, 0.25, 0.5, 0.75, 1]
        .map((f) => {
          const gy = pad.t + f * (H - pad.t - pad.b);
          return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" class="chart-grid-line"/><text x="${pad.l - 6}" y="${gy + 4}" text-anchor="end" class="chart-axis">${compact(max * (1 - f))}</text>`;
        })
        .join('');
      const step = Math.max(1, Math.ceil(n / 6));
      const ticks = series
        .map((entry, i) => (i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 7}" text-anchor="middle" class="chart-axis">${entry.day + 1}</text>` : ''))
        .join('');
      const id = `g-${key}`;
      const [lx, ly] = points[n - 1] ?? [0, 0];
      canvas.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} grafiği">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>
  ${grid}${ticks}
  ${area ? `<path d="${area}" fill="url(#${id})"/>` : ''}
  <path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${lx}" cy="${ly}" r="4" fill="${color}" stroke="#fff8e6" stroke-width="1.5"/>
  <line class="chart-guide" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" stroke="${color}" stroke-dasharray="3 3" visibility="hidden"/>
  <circle class="chart-hover" r="5" fill="#fff8e6" stroke="${color}" stroke-width="2" visibility="hidden"/>
</svg>`;
    },
  };
}
