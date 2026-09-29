import { BUILDINGS, BUILDING_IDS } from '../../config/buildings.js';
import { RESOURCES } from '../../config/resources.js';
import { TRAINING_BUILDINGS } from '../../config/units.js';
import { inspectUpgrade, maxBuildQueue } from '../../systems/construction.js';
import { finishCost } from '../../systems/premium.js';
import { buildingImage, tierOf } from '../art/sprites.js';
import { sceneSvg } from '../art/scene.js';
import { createQuestList } from './quests.js';

// Kendi sayfası olan binalar: kart üzerinde, bina inşa edilince görünen bağlantı.
const BUILDING_PAGES = {
  ...Object.fromEntries(TRAINING_BUILDINGS.map((id) => [id, { href: '#/ordu', label: 'Asker eğit →' }])),
  demirci: { href: '#/demirci', label: 'Geliştirmeler →' },
  pazar: { href: '#/pazar', label: 'Takas yap →' },
  kervansaray: { href: '#/kesif', label: 'Keşif seferi →' },
};
import { plannedLevel } from '../../core/village.js';
import { villagePoints, continentOf } from '../../systems/world.js';
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
  const scene = createScene((id) => {
    const card = cards.find((c) => c.el.dataset.building === id)?.el;
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('flash');
    void card.offsetWidth; // animasyonu yeniden başlat
    card.classList.add('flash');
  });

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
          h('div', { class: 'panel-head' }, h('h2', null, 'Binalar')),
          h('div', { class: 'building-grid' }, cards.map((card) => card.el)),
        ),
      ),
      h('aside', { class: 'village-side' }, queue.el, questPanel),
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
    },
  };
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
        h('div', null, h('strong', null, BUILDINGS[job.building].name), ` → ${job.level}. seviye`),
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

function createBuildingCard(buildingId) {
  const def = BUILDINGS[buildingId];
  const badge = h('span', { class: 'badge' });
  const effect = h('div', { class: 'card-effect' });
  const status = h('div', { class: 'card-status' });
  const button = h('button', { class: 'btn', dataset: { action: 'upgrade', building: buildingId } });
  const page = BUILDING_PAGES[buildingId];
  const pageLink = page ? h('a', { class: 'card-link', href: page.href }, page.label) : null;

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

  const art = h('div', { class: 'building-art' });
  let artTier = null;
  const el = h(
    'article',
    { class: 'card building-card', dataset: { building: buildingId }, id: `bina-${buildingId}` },
    h('div', { class: 'card-head' }, art, h('div', { class: 'card-title' }, h('h3', null, def.name), badge)),
    h('p', { class: 'card-desc' }, def.description),
    effect,
    costRow,
    h('div', { class: 'card-actions' }, button, status, pageLink),
  );

  return {
    el,
    update(village, world, now) {
      const current = village.buildings[buildingId];
      const planned = plannedLevel(village, buildingId);
      const check = inspectUpgrade(village, world, buildingId, now);

      // Görsel yalnızca kademe değişince yenilenir (1–4, 5–14, 15+); inşa edilmemişse soluk.
      const tier = `${tierOf(current)}`;
      if (tier !== artTier) {
        artTier = tier;
        art.replaceChildren(h('img', { src: buildingImage(buildingId, current), alt: '', loading: 'lazy', decoding: 'async', class: current > 0 ? null : 'ghost' }));
      }
      setText(badge, current > 0 ? `${current}. seviye` : 'Yok');
      if (pageLink) pageLink.hidden = current === 0;
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
