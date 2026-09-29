import { UNITS, UNIT_IDS } from '../../config/units.js';
import { TERRAIN, WORLD } from '../../config/world.js';
import { PERSONALITIES } from '../../config/lords.js';
import { travelSeconds } from '../../core/formulas.js';
import {
  villageAt,
  terrainAt,
  tileDetail,
  inWorld,
  distance,
  continentOf,
  nearbyBarbarians,
  lordsOf,
  lordVillage,
} from '../../systems/world.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { inspectAttack, isOutbound } from '../../systems/movements.js';
import { fmtInt, fmtDecimal, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';
import { createAttackForm } from './attack-form.js';

const ZOOMS = [16, 24, 32, 44, 60, 80]; // alan başına piksel
const DEFAULT_ZOOM = 3;
const NEARBY_RADIUS = 15;
const NEARBY_LIMIT = 25;
const RULER = 18; // üst ve sol kenardaki koordinat şeridinin kalınlığı (px)

/** Harita ekranı: tuval üzerinde sürüklenebilir dünya, seçili alanın bilgisi ve yakın köyler. */
export function createMapView({ game, refresh }) {
  const attackForm = createAttackForm({ game, refresh });
  const canvas = h('canvas', {
    class: 'map-canvas',
    tabindex: 0,
    role: 'img',
    'aria-label': 'Dünya haritası. Sürükleyerek ya da ok tuşlarıyla gezin, bir alana tıklayarak bilgisini gör.',
  });
  const ctx = canvas.getContext('2d');
  const position = h('span', { class: 'muted' });
  const coordInput = h('input', {
    type: 'text',
    id: 'map-coord',
    class: 'coord-input',
    placeholder: '500|500',
    inputmode: 'numeric',
    autocomplete: 'off',
    'aria-label': 'Gidilecek koordinat',
  });
  const info = h('div', { class: 'stack-sm' });
  const nearbyBody = h('tbody');
  const lordsBody = h('tbody');
  let lordsSignature = null;

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Harita'), position),
    h(
      'div',
      { class: 'map-layout' },
      h(
        'section',
        { class: 'panel map-panel' },
        h(
          'form',
          { class: 'form-row', onsubmit: onJump },
          h('label', { for: 'map-coord' }, 'Koordinata git'),
          coordInput,
          h('button', { class: 'btn btn-small', type: 'submit' }, 'Git'),
        ),
        h(
          'div',
          { class: 'map-wrap' },
          canvas,
          h(
            'div',
            { class: 'map-controls' },
            mapButton('+', 'Yakınlaştır', () => zoomBy(1)),
            mapButton('−', 'Uzaklaştır', () => zoomBy(-1)),
            mapButton(icon('konum'), 'Köyüme dön', () => centerOnOwn()),
          ),
        ),
      ),
      h('section', { class: 'panel map-side' }, h('h2', null, 'Seçili alan'), info, attackForm.el),
    ),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel-head' },
        h('h2', null, 'Yakındaki barbar köyleri'),
        h('span', { class: 'muted' }, `${NEARBY_RADIUS} alan içinde, en yakın ${NEARBY_LIMIT} · "Tekrar" son orduyu yeniden gönderir`),
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, 'Köy'),
              h('th', { class: 'num' }, 'Puan'),
              h('th', { class: 'num' }, 'Mesafe'),
              h('th', null, 'Son saldırı'),
              h('th', null, h('span', { class: 'visually-hidden' }, 'Tekrar saldır')),
            ),
          ),
          nearbyBody,
        ),
      ),
    ),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel-head' },
        h('h2', null, 'Rakip beyler'),
        h('span', { class: 'muted' }, 'Zamanla güçlenir ve sana saldırırlar; sen de onlara saldırabilirsin'),
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data-table' },
          h(
            'thead',
            null,
            h('tr', null, h('th', null, 'Bey'), h('th', null, 'Kişilik'), h('th', { class: 'num' }, 'Puan'), h('th', { class: 'num' }, 'Mesafe')),
          ),
          lordsBody,
        ),
      ),
    ),
  );

  lordsBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-x]');
    if (!button) return;
    const x = Number(button.dataset.x);
    const y = Number(button.dataset.y);
    centerOn(x, y);
    select({ x, y });
    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const cam = { cx: WORLD.center + 0.5, cy: WORLD.center + 0.5, zoom: DEFAULT_ZOOM };
  let selected = null;
  let hover = null;
  let drag = null;
  let centered = false;
  let frame = 0;
  let infoSignature = null;
  let nearbySignature = null;
  let nearbyRows = []; // { report, repeat } — "Tekrar" düğmeleri her saniye güncellenir

  // ---------- Kamera ----------

  const tileSize = () => ZOOMS[cam.zoom];

  function centerOn(x, y) {
    cam.cx = x + 0.5;
    cam.cy = y + 0.5;
    clampCamera();
    requestDraw();
  }

  function centerOnOwn() {
    const own = game.village;
    centerOn(own.x, own.y);
    select({ x: own.x, y: own.y });
  }

  function clampCamera() {
    cam.cx = Math.min(WORLD.size, Math.max(0, cam.cx));
    cam.cy = Math.min(WORLD.size, Math.max(0, cam.cy));
    setText(position, `Merkez (${Math.floor(cam.cx)}|${Math.floor(cam.cy)}) · ${continentOf(Math.floor(cam.cx), Math.floor(cam.cy))}`);
  }

  /** Yakınlaştırırken imlecin altındaki nokta yerinde kalsın. */
  function zoomBy(step, px = canvas.clientWidth / 2, py = canvas.clientHeight / 2) {
    const next = Math.min(ZOOMS.length - 1, Math.max(0, cam.zoom + step));
    if (next === cam.zoom) return;
    const before = tileSize();
    const wx = cam.cx + (px - canvas.clientWidth / 2) / before;
    const wy = cam.cy + (py - canvas.clientHeight / 2) / before;
    cam.zoom = next;
    cam.cx = wx - (px - canvas.clientWidth / 2) / tileSize();
    cam.cy = wy - (py - canvas.clientHeight / 2) / tileSize();
    clampCamera();
    requestDraw();
  }

  function tileAtPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const t = tileSize();
    return {
      x: Math.floor(cam.cx + (clientX - rect.left - rect.width / 2) / t),
      y: Math.floor(cam.cy + (clientY - rect.top - rect.height / 2) / t),
    };
  }

  function select(tile) {
    selected = tile;
    infoSignature = null;
    renderInfo();
    const village = villageAt(game.state, tile.x, tile.y);
    attackForm.setTarget(village && village.kind !== 'oyuncu' ? village : null);
    requestDraw();
  }

  // ---------- Girdi ----------

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, cx: cam.cx, cy: cam.cy, moved: false };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      cam.cx = drag.cx - dx / tileSize();
      cam.cy = drag.cy - dy / tileSize();
      clampCamera();
    } else if (event.pointerType === 'mouse') {
      hover = tileAtPoint(event.clientX, event.clientY);
    }
    requestDraw();
  });

  canvas.addEventListener('pointerup', (event) => {
    if (drag && !drag.moved) select(tileAtPoint(event.clientX, event.clientY));
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => (drag = null));
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    requestDraw();
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1 : -1, event.clientX - rect.left, event.clientY - rect.top);
    },
    { passive: false },
  );

  canvas.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 5 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      cam.cx += moves[event.key][0];
      cam.cy += moves[event.key][1];
      clampCamera();
      requestDraw();
    } else if (event.key === '+' || event.key === '=') zoomBy(1);
    else if (event.key === '-') zoomBy(-1);
    else if (event.key === 'Enter' || event.key === ' ') select({ x: Math.floor(cam.cx), y: Math.floor(cam.cy) });
    else return;
    event.preventDefault();
  });

  function onJump(event) {
    event.preventDefault();
    const match = coordInput.value.match(/^\s*(\d{1,3})\s*[|,;\s]\s*(\d{1,3})\s*$/);
    if (!match) {
      toast('Koordinatı 500|500 biçiminde yaz.', 'error');
      return;
    }
    const x = Number(match[1]);
    const y = Number(match[2]);
    centerOn(x, y);
    select({ x, y });
  }

  nearbyBody.addEventListener('click', (event) => {
    const repeat = event.target.closest('button[data-repeat]');
    if (repeat) {
      const now = Date.now();
      const result = game.repeatAttack(Number(repeat.dataset.repeat), now);
      if (result.ok) toast(`${armyText(result.units)} ${result.target.name} köyüne yola çıktı. Varış ${fmtClock(result.arriveAt, now)}.`, 'success');
      else toast(result.reason, 'error');
      refresh(now);
      return;
    }
    const button = event.target.closest('button[data-x]');
    if (!button) return;
    const x = Number(button.dataset.x);
    const y = Number(button.dataset.y);
    centerOn(x, y);
    select({ x, y });
    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  new ResizeObserver(() => resize()).observe(canvas);

  // ---------- Çizim ----------

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    draw();
  }

  function requestDraw() {
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    }
  }

  function draw() {
    const w = canvas.clientWidth;
    const hgt = canvas.clientHeight;
    if (!w || !hgt || !canvas.width) return;
    const dpr = canvas.width / w;
    const state = game.state;
    const seed = state.world.seed;
    const colors = readColors(canvas);
    const t = tileSize();
    const toScreenX = (x) => (x - cam.cx) * t + w / 2;
    const toScreenY = (y) => (y - cam.cy) * t + hgt / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.outside;
    ctx.fillRect(0, 0, w, hgt);

    const x0 = Math.floor(cam.cx - w / 2 / t);
    const x1 = Math.floor(cam.cx + w / 2 / t);
    const y0 = Math.floor(cam.cy - hgt / 2 / t);
    const y1 = Math.floor(cam.cy + hgt / 2 / t);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inWorld(x, y)) continue;
        const sx = toScreenX(x);
        const sy = toScreenY(y);
        const village = villageAt(state, x, y);
        drawTerrain(ctx, colors, village ? 'cayir' : terrainAt(seed, x, y), tileDetail(seed, x, y), sx, sy, t);
        if (village) drawVillage(ctx, colors, village, sx, sy, t);
      }
    }

    if (t >= 24) {
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) {
        const sx = Math.round(toScreenX(x)) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, hgt);
      }
      for (let y = y0; y <= y1 + 1; y++) {
        const sy = Math.round(toScreenY(y)) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
      }
      ctx.stroke();
    }

    if (hover && !drag) {
      ctx.fillStyle = colors.hover;
      ctx.fillRect(toScreenX(hover.x), toScreenY(hover.y), t, t);
    }
    if (selected) {
      ctx.strokeStyle = colors.select;
      ctx.lineWidth = 3;
      ctx.strokeRect(toScreenX(selected.x) + 1.5, toScreenY(selected.y) + 1.5, t - 3, t - 3);
    }

    // Yoldaki ordular: köyden hedefe kesikli çizgi ve ordunun şu anki yeri.
    const own = game.village;
    const now = Date.now();
    const home = [toScreenX(own.x) + t / 2, toScreenY(own.y) + t / 2];
    const drawArmy = (from, to, color, departAt, arriveAt) => {
      const progress = Math.min(1, Math.max(0, (now - departAt) / (arriveAt - departAt)));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress, Math.max(4, t / 7), 0, Math.PI * 2);
      ctx.fill();
    };
    for (const movement of own.movements) {
      const away = [toScreenX(movement.target.x) + t / 2, toScreenY(movement.target.y) + t / 2];
      // Geri çağrılan ordu hedefe varmadan, yolun `turnAt` kadarından döner.
      const turn = movement.turnAt ?? 1;
      const turnPoint = [home[0] + (away[0] - home[0]) * turn, home[1] + (away[1] - home[1]) * turn];
      const [from, to] = isOutbound(movement) ? [home, away] : [turnPoint, home];
      const color = { saldiri: colors.attack, casus: colors.spy, donus: colors.return }[movement.type];
      drawArmy(from, to, color, movement.departAt, movement.arriveAt);
    }
    // Köye gelen bey orduları.
    for (const attack of own.incoming) {
      const from = [toScreenX(attack.from.x) + t / 2, toScreenY(attack.from.y) + t / 2];
      drawArmy(from, home, colors.lordFlag, attack.departAt, attack.arriveAt);
    }

    drawRulers(ctx, colors, { x0, x1, y0, y1, t, w, hgt, toScreenX, toScreenY });
  }

  // ---------- Bilgi paneli ----------

  function renderInfo() {
    if (!selected) {
      info.replaceChildren(h('p', { class: 'muted' }, 'Bilgi için haritada bir alana tıkla.'));
      return;
    }
    const state = game.state;
    const own = game.village;
    const { x, y } = selected;
    const village = villageAt(state, x, y);
    const signature = `${x}|${y}|${village?.points}|${state.world.speed}|${own.id}`;
    if (signature === infoSignature) return;
    infoSignature = signature;

    const rows = [['Koordinat', `(${x}|${y}) · ${continentOf(x, y)}`]];
    let title;
    if (!inWorld(x, y)) {
      title = 'Dünyanın sınırı';
    } else if (village) {
      title = village.name;
      const owner = { oyuncu: 'Sen', bey: village.owner, barbar: 'Barbar köyü' }[village.kind];
      rows.push(['Sahibi', owner], ['Puan', fmtInt(village.points)]);
      if (village.kind === 'bey') rows.push(['Kişilik', PERSONALITIES[village.personality].name]);
    } else {
      title = TERRAIN[terrainAt(state.world.seed, x, y)].name;
      rows.push(['Durum', 'Boş arazi']);
    }
    const dist = distance(own.x, own.y, x, y);
    if (dist > 0) rows.push(['Mesafe', `${fmtDecimal(dist)} alan (${own.name} köyünden)`]);

    const children = [
      h('h3', { class: 'info-title' }, title),
      h('dl', { class: 'kv' }, rows.flatMap(([key, value]) => [h('dt', null, key), h('dd', null, value)])),
    ];
    if (dist > 0 && inWorld(x, y)) {
      children.push(
        h('h4', { class: 'info-subtitle' }, 'Yolculuk süresi'),
        h(
          'ul',
          { class: 'travel-list' },
          UNIT_IDS.map((id) =>
            h(
              'li',
              null,
              h('span', { class: 'unit-icon small' }, icon(id)),
              UNITS[id].name,
              h('span', { class: 'time' }, fmtDuration(travelSeconds(dist, UNITS[id].speed, state.world.speed))),
            ),
          ),
        ),
      );
    }
    if (village?.kind === 'oyuncu') {
      children.push(h('a', { class: 'btn btn-small', href: '#/koy' }, 'Köye git'));
    } else if (village?.kind === 'bey') {
      children.push(h('p', { class: 'muted' }, `Rakip bey. ${PERSONALITIES[village.personality].description}`));
    } else if (inWorld(x, y) && !village && terrainAt(state.world.seed, x, y) === 'gol') {
      children.push(h('p', { class: 'muted' }, 'Göle köy kurulamaz.'));
    }
    info.replaceChildren(...children);
  }

  /** Rakip beyler: yakından uzağa. */
  function renderLords() {
    const own = game.village;
    const lords = lordsOf(game.state.world.seed)
      .map((lord) => lordVillage(game.state, lord))
      .map((v) => ({ ...v, distance: distance(own.x, own.y, v.x, v.y) }))
      .sort((a, b) => a.distance - b.distance);
    const signature = lords.map((v) => `${v.id}:${v.points}`).join('|');
    if (signature === lordsSignature) return;
    lordsSignature = signature;
    lordsBody.replaceChildren(
      ...lords.map((v) =>
        h(
          'tr',
          null,
          h(
            'td',
            { class: 'wrap' },
            h('button', { type: 'button', class: 'link-btn', dataset: { x: v.x, y: v.y } }, v.owner),
            h('span', { class: 'cell-sub' }, `${v.name} (${v.x}|${v.y})`),
          ),
          h('td', { class: 'wrap' }, PERSONALITIES[v.personality].name),
          h('td', { class: 'num' }, fmtInt(v.points)),
          h('td', { class: 'num' }, fmtDecimal(v.distance)),
        ),
      ),
    );
  }

  /**
   * Yağma asistanı: yakın köyler, her birine yapılan son saldırının sonucu ve aynı orduyu
   * tek tıkla yeniden gönderen "Tekrar" düğmesi.
   */
  function renderNearby(now) {
    const state = game.state;
    const own = game.village;
    const list = nearbyBarbarians(state, own.x, own.y, NEARBY_RADIUS).slice(0, NEARBY_LIMIT);
    const lastReports = new Map();
    for (const report of state.reports) {
      if (report.type === 'saldiri' && !lastReports.has(report.target.id)) lastReports.set(report.target.id, report);
    }
    const underway = new Set(own.movements.filter(isOutbound).map((m) => m.target.id));

    const signature = list
      .map((v) => `${v.id}:${v.points}:${lastReports.get(v.id)?.id ?? ''}:${underway.has(v.id)}`)
      .join('|');
    if (signature !== nearbySignature) {
      nearbySignature = signature;
      nearbyRows = [];
      nearbyBody.replaceChildren(
        ...list.map((v) => {
          const report = lastReports.get(v.id);
          const repeat = report
            ? h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { repeat: report.id } }, 'Tekrar')
            : null;
          if (repeat) nearbyRows.push({ report, repeat });
          return h(
            'tr',
            null,
            h(
              'td',
              null,
              h('button', { type: 'button', class: 'link-btn', dataset: { x: v.x, y: v.y } }, v.name),
              h('span', { class: 'cell-sub' }, `(${v.x}|${v.y})`),
            ),
            h('td', { class: 'num' }, fmtInt(v.points)),
            h('td', { class: 'num' }, fmtDecimal(v.distance)),
            h('td', { class: 'wrap' }, lastAttackCell(report, underway.has(v.id), now)),
            h('td', null, repeat),
          );
        }),
      );
    }
    for (const { report, repeat } of nearbyRows) {
      const check = inspectAttack(state, own, report.target.x, report.target.y, report.attackers, now);
      repeat.disabled = !check.ok;
      repeat.title = check.ok ? `Gönder: ${armyText(report.attackers)}` : check.reason;
    }
  }

  return {
    el,
    /** `#/harita/503/500` adresiyle açılırsa o alanı ortalar ve seçer. */
    onShow([x, y] = []) {
      if (!centered) {
        centered = true;
        if (canvas.clientWidth < 500) cam.zoom = DEFAULT_ZOOM - 1; // dar ekranda daha geniş alan göster
        centerOnOwn();
      }
      if (Number.isInteger(x) && Number.isInteger(y)) {
        centerOn(x, y);
        select({ x, y });
      }
      clampCamera();
      resize();
    },
    update(now) {
      renderInfo();
      renderNearby(now);
      renderLords();
      attackForm.update(now);
      requestDraw(); // barbar köyleri büyür, ordular yol alır
    },
  };
}

function lastAttackCell(report, underway, now) {
  if (underway) return h('span', { class: 'result result-underway' }, 'Yolda');
  if (!report) return h('span', { class: 'muted' }, '—');
  const loot = Object.values(report.loot).reduce((a, b) => a + b, 0);
  return h(
    'span',
    { class: `result ${report.attackerWins ? 'result-win' : 'result-loss'}`, title: fmtClock(report.at, now) },
    report.attackerWins ? `Zafer · ${fmtInt(loot)}` : 'Yenilgi',
  );
}

function armyText(units) {
  return Object.entries(units)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`)
    .join(', ');
}

function mapButton(content, label, onClick) {
  return h('button', { type: 'button', class: 'map-btn', title: label, 'aria-label': label, onclick: onClick }, content);
}

/** Harita renkleri CSS değişkenlerinden okunur; açık/koyu tema kendiliğinden uyar. */
function readColors(el) {
  const style = getComputedStyle(el);
  const v = (name) => style.getPropertyValue(`--map-${name}`).trim();
  return {
    outside: v('outside'),
    cayir: v('cayir'),
    cayir2: v('cayir-2'),
    orman: v('orman'),
    agac: v('agac'),
    tepe: v('tepe'),
    tepe2: v('tepe-2'),
    gol: v('gol'),
    gol2: v('gol-2'),
    grid: v('grid'),
    hover: v('hover'),
    select: v('select'),
    own: v('own'),
    ownRoof: v('own-roof'),
    flag: v('flag'),
    barbar: v('barbar'),
    barbarRoof: v('barbar-roof'),
    door: v('door'),
    rulerBg: v('ruler-bg'),
    rulerInk: v('ruler-ink'),
    lord: v('lord'),
    lordRoof: v('lord-roof'),
    lordFlag: v('lord-flag'),
    attack: v('attack'),
    spy: v('spy'),
    return: v('return'),
  };
}

function drawTerrain(ctx, c, kind, detail, sx, sy, t) {
  const fill = { gol: c.gol, tepe: c.tepe, orman: c.orman, cayir: detail & 1 ? c.cayir : c.cayir2 };
  ctx.fillStyle = fill[kind];
  ctx.fillRect(sx, sy, t + 0.5, t + 0.5);
  if (t < 24) return;

  if (kind === 'orman') {
    ctx.fillStyle = c.agac;
    for (let i = 0; i < 3; i++) {
      const px = sx + t * (0.2 + 0.6 * (((detail >>> (i * 8)) & 255) / 255));
      const py = sy + t * (0.2 + 0.6 * (((detail >>> (i * 8 + 4)) & 255) / 255));
      ctx.beginPath();
      ctx.arc(px, py, t * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'tepe') {
    ctx.fillStyle = c.tepe2;
    ctx.beginPath();
    ctx.moveTo(sx + t * 0.15, sy + t * 0.78);
    ctx.lineTo(sx + t * 0.45, sy + t * 0.3);
    ctx.lineTo(sx + t * 0.75, sy + t * 0.78);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'gol' && detail & 2) {
    ctx.strokeStyle = c.gol2;
    ctx.lineWidth = Math.max(1, t / 24);
    ctx.beginPath();
    ctx.moveTo(sx + t * 0.25, sy + t * 0.5);
    ctx.quadraticCurveTo(sx + t * 0.375, sy + t * 0.4, sx + t * 0.5, sy + t * 0.5);
    ctx.quadraticCurveTo(sx + t * 0.625, sy + t * 0.6, sx + t * 0.75, sy + t * 0.5);
    ctx.stroke();
  }
}

/**
 * Köy simgesi: puanı büyüdükçe ev de büyür. Oyuncunun köyü ve bey hisarları bayraklıdır;
 * her biri kendi rengindedir.
 */
function drawVillage(ctx, c, village, sx, sy, t) {
  const palette = {
    oyuncu: { body: c.own, roof: c.ownRoof, flag: c.flag },
    bey: { body: c.lord, roof: c.lordRoof, flag: c.lordFlag },
    barbar: { body: c.barbar, roof: c.barbarRoof, flag: null },
  }[village.kind];
  const tier = village.points < 150 ? 0 : village.points < 500 ? 1 : 2;
  const size = t * (0.46 + tier * 0.12);
  const cx = sx + t / 2;
  const base = sy + t * 0.82;
  const bodyH = size * 0.55;

  ctx.fillStyle = palette.body;
  ctx.fillRect(cx - size / 2, base - bodyH, size, bodyH);
  ctx.fillStyle = palette.roof;
  ctx.beginPath();
  ctx.moveTo(cx - size / 2 - size * 0.1, base - bodyH);
  ctx.lineTo(cx, base - bodyH - size * 0.45);
  ctx.lineTo(cx + size / 2 + size * 0.1, base - bodyH);
  ctx.closePath();
  ctx.fill();
  if (t >= 24) {
    ctx.fillStyle = c.door;
    ctx.fillRect(cx - size * 0.1, base - bodyH * 0.6, size * 0.2, bodyH * 0.6);
  }
  if (palette.flag) {
    const top = base - bodyH - size * 0.45;
    ctx.strokeStyle = c.door;
    ctx.lineWidth = Math.max(1, t / 30);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top - size * 0.4);
    ctx.stroke();
    ctx.fillStyle = palette.flag;
    ctx.beginPath();
    ctx.moveTo(cx, top - size * 0.4);
    ctx.lineTo(cx + size * 0.32, top - size * 0.3);
    ctx.lineTo(cx, top - size * 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

/** Üst ve sol kenarda koordinat cetveli. */
function drawRulers(ctx, c, { x0, x1, y0, y1, t, w, hgt, toScreenX, toScreenY }) {
  const step = t < 24 ? 10 : t < 44 ? 5 : 1;
  ctx.fillStyle = c.rulerBg;
  ctx.fillRect(0, 0, w, RULER);
  ctx.fillRect(0, RULER, RULER + 12, hgt - RULER);
  ctx.fillStyle = c.rulerInk;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = x0; x <= x1; x++) {
    if (x % step !== 0 || !inWorld(x, 0)) continue;
    const sx = toScreenX(x) + t / 2;
    if (sx > RULER + 20) ctx.fillText(String(x), sx, RULER / 2);
  }
  for (let y = y0; y <= y1; y++) {
    if (y % step !== 0 || !inWorld(0, y)) continue;
    const sy = toScreenY(y) + t / 2;
    if (sy > RULER + 8) ctx.fillText(String(y), (RULER + 12) / 2, sy);
  }
}
