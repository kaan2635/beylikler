import { GAME } from '../../config/game.js';
import { BUILDINGS, BUILDING_IDS } from '../../config/buildings.js';
import { RESOURCES } from '../../config/resources.js';
import { inspectUpgrade } from '../../systems/construction.js';
import { plannedLevel } from '../../core/village.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock, fmtEffect } from '../format.js';
import { toast } from '../toast.js';

/** Köy ekranı: inşaat kuyruğu ve bina kartları. */
export function createVillageView({ game, refresh }) {
  const name = h('h1', { class: 'village-name' });
  const coords = h('span', { class: 'muted' });
  const queue = createQueuePanel();
  const cards = BUILDING_IDS.map(createBuildingCard);

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, name, coords),
    queue.el,
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', null, 'Binalar')),
      h('div', { class: 'building-grid' }, cards.map((card) => card.el)),
    ),
  );

  // Düğmeler her saniye yeniden oluşturulmadığı için tek bir dinleyici yeterli.
  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const now = Date.now();
    if (button.dataset.action === 'upgrade') {
      const result = game.upgrade(button.dataset.building, now);
      if (!result.ok) toast(result.reason, 'error');
    } else if (button.dataset.action === 'cancel') {
      const job = game.cancelLastUpgrade(now);
      if (job) toast(`${BUILDINGS[job.building].name} yükseltmesi iptal edildi, kaynaklar iade edildi.`);
    }
    refresh(now);
  });

  return {
    el,
    update(now) {
      const village = game.village;
      setText(name, village.name);
      setText(coords, `(${village.x}|${village.y})`);
      queue.update(village, now);
      for (const card of cards) card.update(village, game.state.world, now);
    },
  };
}

function createQueuePanel() {
  const count = h('span', { class: 'muted' });
  const body = h('div', { class: 'queue' });
  const el = h(
    'section',
    { class: 'panel' },
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
      const row = h(
        'div',
        { class: 'queue-row' },
        h('div', null, h('strong', null, BUILDINGS[job.building].name), ` → ${job.level}. seviye`),
        h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `bitiş ${fmtClock(job.endAt, now)}`)),
        isLast ? h('button', { class: 'btn btn-small btn-ghost', dataset: { action: 'cancel' } }, 'İptal') : h('span'),
        index === 0 ? h('div', { class: 'progress' }, bar) : null,
      );
      return { row, remaining, bar, job };
    });
    body.replaceChildren(
      ...(rows.length
        ? rows.map((r) => r.row)
        : [h('p', { class: 'muted' }, 'Şu anda inşaat yok. Aşağıdan bir bina seç.')]),
    );
  }

  return {
    el,
    update(village, now) {
      const jobs = village.buildQueue;
      setText(count, `${jobs.length}/${GAME.maxBuildQueue}`);
      const next = jobs.map((j) => `${j.building}:${j.level}:${j.endAt}`).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(jobs, now);
      }
      rows.forEach(({ remaining, bar, job }, index) => {
        if (index === 0) {
          setText(remaining, fmtDuration((job.endAt - now) / 1000));
          const progress = (now - job.startAt) / (job.endAt - job.startAt);
          bar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
        } else {
          setText(remaining, `sırada · ${fmtDuration((job.endAt - job.startAt) / 1000)}`);
        }
      });
    },
  };
}

function createBuildingCard(buildingId) {
  const def = BUILDINGS[buildingId];
  const badge = h('span', { class: 'badge' });
  const effect = h('div', { class: 'card-effect' });
  const status = h('div', { class: 'card-status' });
  const button = h('button', { class: 'btn', dataset: { action: 'upgrade', building: buildingId } });

  const costItems = {};
  const costRow = h('div', { class: 'cost' });
  for (const resource of Object.keys(def.cost)) {
    const value = h('span');
    const item = h('span', { class: 'cost-item', title: RESOURCES[resource].name }, icon(resource), value);
    costItems[resource] = { item, value };
    costRow.append(item);
  }
  const pop = h('span');
  const time = h('span');
  costRow.append(
    h('span', { class: 'cost-item', title: 'Nüfus' }, icon('nufus'), pop),
    h('span', { class: 'cost-item', title: 'Süre' }, icon('saat'), time),
  );

  const el = h(
    'article',
    { class: 'card', dataset: { building: buildingId } },
    h('div', { class: 'card-head' }, h('h3', null, def.name), badge),
    h('p', { class: 'card-desc' }, def.description),
    effect,
    costRow,
    h('div', { class: 'card-actions' }, button, status),
  );

  return {
    el,
    update(village, world, now) {
      const current = village.buildings[buildingId];
      const planned = plannedLevel(village, buildingId);
      const check = inspectUpgrade(village, world, buildingId, now);

      setText(badge, current > 0 ? `${current}. seviye` : 'Yok');
      badge.classList.toggle('badge-muted', current === 0);
      el.classList.toggle('locked', check.code === 'requires' && current === 0);
      el.classList.toggle('maxed', check.code === 'max');

      // Ok, satın alınacak tek adımı gösterir: kuyruktaki seviye → bir sonraki seviye.
      const currentEffect = planned > 0 ? fmtEffect(def.effect, def.effect.value(planned, world)) : '—';
      const nextEffect = check.code === 'max' ? '' : ` → ${fmtEffect(def.effect, def.effect.value(check.level, world))}`;
      setText(effect, `${def.effect.label}: ${currentEffect}${nextEffect}`);

      if (check.cost) {
        for (const [resource, { item, value }] of Object.entries(costItems)) {
          setText(value, fmtInt(check.cost[resource]));
          item.classList.toggle('short', village.resources[resource] < check.cost[resource]);
        }
        setText(pop, `+${check.popDelta}`);
        setText(time, fmtDuration(check.duration));
      }

      if (check.code === 'max') setText(button, 'Tamamlandı');
      else if (planned === 0) setText(button, 'İnşa et');
      else setText(button, `${check.level}. seviyeye yükselt`);
      button.disabled = !check.ok;

      if (check.ok) setText(status, planned > current ? 'Kuyruğa eklenecek' : '');
      else if (check.code === 'resources') setText(status, `Kaynaklar ${fmtClock(check.readyAt, now)} hazır`);
      else if (check.code === 'max') setText(status, '');
      else setText(status, check.reason);
    },
  };
}
