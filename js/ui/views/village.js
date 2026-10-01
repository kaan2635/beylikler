import { BUILDINGS, BUILDING_IDS } from '../../config/buildings.js';
import { maxBuildQueue } from '../../systems/construction.js';
import { finishCost } from '../../systems/premium.js';
import { sceneSvg } from '../art/scene.js';
import { createQuestList } from './quests.js';
import { createBuildingCard, upgradeFromButton, BUILDING_GROUPS } from '../building-card.js';
import { openBuildingDialog } from '../building-dialog.js';
import { villagePoints, continentOf } from '../../systems/world.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

const FILTER_KEY = 'beylikler:bina-suzgeci';

function readFilter() {
  try {
    const value = localStorage.getItem(FILTER_KEY);
    return value === 'hazir' || BUILDING_GROUPS[value] ? value : 'tumu';
  } catch {
    return 'tumu';
  }
}

/** Köy ekranı: inşaat kuyruğu ve bina kartları. */
export function createVillageView({ game, refresh }) {
  const name = h('h1', { class: 'village-name' });
  const coords = h('span', { class: 'muted' });
  const queue = createQueuePanel();
  const cards = BUILDING_IDS.map((id) => createBuildingCard(id));
  const open = (id) => openBuildingDialog({ game, refresh }, id);
  const scene = createScene(open);
  const filter = createBuildingFilter(cards);

  const quests = createQuestList({ game, refresh, compact: true });
  const questPanel = h(
    'section',
    { class: 'panel quest-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Görevler'), h('a', { class: 'card-link', href: '#/gorevler' }, 'Tüm görevler ve başarımlar →')),
    quests.el,
  );

  // Geniş ekranda sahne ve binalar solda, kuyruk ve görevler sağ sütunda; dar ekranda
  // hepsi alt alta (sahne, kuyruk, görevler, binalar) dizilir (bkz. .village-layout).
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, name, coords),
    h(
      'div',
      { class: 'village-layout' },
      h(
        'div',
        { class: 'village-main' },
        scene.el,
        h(
          'section',
          { class: 'panel buildings-panel' },
          h('div', { class: 'panel-head' }, h('h2', null, 'Binalar'), filter.el),
          h('div', { class: 'building-grid' }, cards.map((card) => card.el)),
          filter.empty,
        ),
      ),
      h('aside', { class: 'village-side' }, queue.el, questPanel),
    ),
  );

  // Düğmeler her saniye yeniden oluşturulmadığı için tek bir dinleyici yeterli.
  el.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open]');
    if (opener) {
      open(opener.dataset.open);
      return;
    }
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const now = Date.now();
    if (button.dataset.action === 'upgrade') {
      upgradeFromButton(game, button, now);
    } else if (button.dataset.action === 'cancel') {
      const job = game.cancelLastUpgrade(now);
      if (job) toast(`${BUILDINGS[job.building].name} yükseltmesi iptal edildi, kaynaklar iade edildi.`);
    } else if (button.dataset.action === 'finish') {
      const result = game.finishBuilding(now);
      if (!result.ok) toast(result.reason, 'error');
    }
    refresh(now);
  });

  return {
    el,
    update(now) {
      const village = game.village;
      setText(name, village.name);
      const points = fmtInt(villagePoints(village.buildings));
      setText(coords, `(${village.x}|${village.y}) · ${continentOf(village.x, village.y)} · ${points} puan`);
      scene.update(village);
      quests.update();
      queue.update(village, now, game.state);
      for (const card of cards) card.update(village, game.state.world, now);
      filter.update();
    },
  };
}

/**
 * Bina listesinin süzgeci: Tümü, şimdi yükseltilebilenler ya da gruplar (kaynak, askerî, yönetim).
 * Seçim tarayıcıda hatırlanır.
 */
function createBuildingFilter(cards) {
  let active = readFilter();
  const options = [['tumu', 'Tümü'], ['hazir', 'Yükseltilebilir'], ...Object.entries(BUILDING_GROUPS).map(([id, g]) => [id, g.label])];
  const counts = {};
  const buttons = options.map(([id, label]) => {
    counts[id] = h('span', { class: 'segment-count' });
    return h('button', { type: 'button', class: 'segment', dataset: { filter: id }, 'aria-pressed': 'false' }, label, counts[id]);
  });
  const el = h('div', { class: 'segmented building-filter', role: 'group', 'aria-label': 'Binaları süz' }, buttons);
  const empty = h('p', { class: 'muted filter-empty' }, 'Şu anda yükseltilebilecek bina yok; kaynaklar birikince burada görünür.');

  const matches = (card, id) => {
    if (id === 'tumu') return true;
    if (id === 'hazir') return card.el.classList.contains('ready');
    return BUILDING_GROUPS[id].ids.includes(card.el.dataset.building);
  };
  const update = () => {
    let shown = 0;
    for (const card of cards) {
      const visible = matches(card, active);
      card.el.hidden = !visible;
      if (visible) shown += 1;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === active));
    for (const button of buttons) button.classList.toggle('active', button.dataset.filter === active);
    setText(counts.hazir, String(cards.filter((card) => matches(card, 'hazir')).length));
    empty.hidden = shown > 0;
  };
  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    active = button.dataset.filter;
    try {
      localStorage.setItem(FILTER_KEY, active);
    } catch {
      // gizli pencere: seçim hatırlanmaz
    }
    update();
  });
  return { el, empty, update };
}

/** Köy sahnesi: binalar seviyelerine göre çizilir; tıklanan binanın kartına gidilir. */
function createScene(onSelect) {
  const el = h('section', { class: 'scene-panel', 'aria-label': 'Köy görünümü' });
  let signature = null;
  const pick = (event) => {
    const target = event.target.closest('[data-building]');
    if (target) onSelect(target.dataset.building);
  };
  el.addEventListener('click', pick);
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    pick(event);
  });
  const names = Object.fromEntries(BUILDING_IDS.map((id) => [id, BUILDINGS[id].name]));

  return {
    el,
    update(village) {
      const upgrading = new Set(village.buildQueue.map((job) => job.building));
      const locked = new Set(
        BUILDING_IDS.filter((id) => Object.entries(BUILDINGS[id].requires).some(([req, lvl]) => (village.buildings[req] ?? 0) < lvl)),
      );
      const next = JSON.stringify([village.id, village.buildings, [...upgrading], [...locked]]);
      if (next === signature) return;
      signature = next;
      el.innerHTML = sceneSvg(village.buildings, { upgrading, locked, names });
    },
  };
}

function createQueuePanel() {
  const count = h('span', { class: 'muted' });
  const body = h('div', { class: 'queue' });
  const el = h(
    'section',
    { class: 'panel queue-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'İnşaat kuyruğu'), count),
    body,
  );
  let signature = null;
  let rows = [];

  function rebuild(jobs, now) {
    rows = jobs.map((job, index) => {
      const remaining = h('span', { class: 'queue-remaining' });
      const bar = h('span');
      const isLast = index === jobs.length - 1;
      const finishText = h('span');
      const finish =
        index === 0
          ? h('button', { class: 'btn btn-small btn-gold', dataset: { action: 'finish' }, title: 'Akçe ile anında bitir' }, icon('simsek'), finishText)
          : null;
      const row = h(
        'div',
        { class: 'queue-row' },
        h('div', null, h('button', { type: 'button', class: 'title-button', dataset: { open: job.building } }, h('strong', null, BUILDINGS[job.building].name)), ` → ${job.level}. seviye`),
        h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `bitiş ${fmtClock(job.endAt, now)}`)),
        h(
          'div',
          { class: 'queue-actions' },
          finish,
          isLast ? h('button', { class: 'btn btn-small btn-ghost', dataset: { action: 'cancel' } }, 'İptal') : null,
        ),
        index === 0 ? h('div', { class: 'progress' }, bar) : null,
      );
      return { row, remaining, bar, job, finish, finishText };
    });
    body.replaceChildren(
      ...(rows.length
        ? rows.map((r) => r.row)
        : [h('p', { class: 'muted' }, 'Şu anda inşaat yok. Aşağıdan bir bina seç.')]),
    );
  }

  return {
    el,
    update(village, now, state) {
      const jobs = village.buildQueue;
      setText(count, `${jobs.length}/${maxBuildQueue(village)}`);
      const next = jobs.map((j) => `${j.building}:${j.level}:${j.endAt}`).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(jobs, now);
      }
      rows.forEach(({ remaining, bar, job, finish, finishText }, index) => {
        if (index === 0) {
          setText(remaining, fmtDuration((job.endAt - now) / 1000));
          const progress = (now - job.startAt) / (job.endAt - job.startAt);
          bar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
          const cost = finishCost(job.endAt - now, state.world);
          setText(finishText, `${fmtInt(cost)}`);
          finish.disabled = (state.player.akce ?? 0) < cost;
          finish.title = `${fmtInt(cost)} Akçe ile anında bitir`;
        } else {
          setText(remaining, `sırada · ${fmtDuration((job.endAt - job.startAt) / 1000)}`);
        }
      });
    },
  };
}
