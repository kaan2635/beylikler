import { BUILDINGS } from '../config/buildings.js';
import { RESOURCES } from '../config/resources.js';
import { TRAINING_BUILDINGS } from '../config/units.js';
import { inspectUpgrade } from '../systems/construction.js';
import { plannedLevel } from '../core/village.js';
import { stageSvg, stageOf, stageName, nextStage, stageLevels, STAGE_NAMES } from './art/stages.js';
import { h, setText } from './dom.js';
import { icon } from './icons.js';
import { fmtInt, fmtDuration, fmtClock, fmtEffect } from './format.js';
import { toast } from './toast.js';

// Kendi sayfası olan binalar: bina inşa edilince görünen bağlantı.
export const BUILDING_PAGES = {
  ...Object.fromEntries(TRAINING_BUILDINGS.map((id) => [id, { href: '#/ordu', label: 'Asker eğit →' }])),
  demirci: { href: '#/demirci', label: 'Geliştirmeler →' },
  pazar: { href: '#/pazar', label: 'Takas yap →' },
  kervansaray: { href: '#/kesif', label: 'Keşif seferi →' },
  konak: { href: '#/divan', label: 'Divan (araştırma) →' },
  kule: { href: '#/ordu', label: 'Gelen orduları gör →' },
};

// Bina listesindeki süzgeç grupları.
export const BUILDING_GROUPS = {
  kaynak: { label: 'Kaynak', ids: ['oduncu', 'kilocagi', 'demirmadeni', 'ambar', 'ciftlik', 'gizlidepo'] },
  askeri: { label: 'Askerî', ids: ['kisla', 'ahir', 'atolye', 'demirci', 'sur', 'kule'] },
  yonetim: { label: 'Yönetim', ids: ['konak', 'pazar', 'kervansaray', 'saray'] },
};

/**
 * Bina kartı. Listede (`detailed: false`) kısa: görsel, ad, seviye, etki, maliyet ve düğme;
 * görsele ya da ada tıklayınca bina penceresi açılır (`data-open`). Pencerede (`detailed: true`)
 * açıklama, gereksinimler ve kuyruk bilgisi de görünür.
 */
export function createBuildingCard(buildingId, { detailed = false } = {}) {
  const def = BUILDINGS[buildingId];
  const badge = h('span', { class: 'badge' });
  const effect = h('div', { class: 'card-effect' });
  const status = h('div', { class: 'card-status' });
  const button = h('button', { class: 'btn', type: 'button', dataset: { action: 'upgrade', building: buildingId } });
  const page = BUILDING_PAGES[buildingId];
  const pageLink = page ? h('a', { class: detailed ? 'btn btn-ghost' : 'card-link', href: page.href, dataset: { close: '' } }, page.label) : null;

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

  // Pencerede: gereksinimler ve kuyruktaki iş
  const requirements = Object.entries(def.requires).map(([req, lvl]) => {
    // Gereksinime tıklayınca o binanın penceresi açılır.
    const item = h('li', null, h('button', { type: 'button', class: 'req-link', dataset: { open: req } }, `${BUILDINGS[req].name} ${lvl}. seviye`));
    return { req, lvl, item };
  });
  const requireBlock = detailed && requirements.length ? h('div', { class: 'requires' }, h('span', { class: 'eyebrow' }, 'Gereksinimler'), h('ul', { class: 'require-list' }, requirements.map((r) => r.item))) : null;
  const queueNote = detailed ? h('p', { class: 'queue-note' }) : null;

  // Görünüş aşaması: şimdiki adı ve bir sonrakine kalan seviye; pencerede bütün aşamalar.
  const stageLine = h('div', { class: 'stage-line' });
  const stageSteps = detailed
    ? stageLevels(buildingId).map((level, i) => {
        const thumb = h('span', { class: 'stage-thumb' });
        thumb.innerHTML = stageSvg(buildingId, level);
        return { level, el: h('li', null, thumb, h('strong', null, STAGE_NAMES[buildingId]?.[i] ?? ''), h('span', { class: 'muted' }, `${level}. seviye`)) };
      })
    : [];
  const stageBlock = detailed ? h('div', { class: 'stage-block' }, h('span', { class: 'eyebrow' }, 'Görünüş'), h('ol', { class: 'stage-steps' }, stageSteps.map((step) => step.el))) : null;

  const art = h('div', { class: 'building-art' });
  const title = h('h3', null, def.name);
  const openers = detailed
    ? [art, h('div', { class: 'card-title' }, title, badge)]
    : [
        h('button', { type: 'button', class: 'art-button', dataset: { open: buildingId }, 'aria-label': `${def.name} ayrıntıları`, title: def.description }, art),
        h('div', { class: 'card-title' }, h('button', { type: 'button', class: 'title-button', dataset: { open: buildingId }, title: def.description }, title), badge),
      ];
  let artTier = null;
  const el = h(
    'article',
    { class: `card building-card${detailed ? ' detailed' : ''}`, dataset: { building: buildingId }, id: detailed ? null : `bina-${buildingId}` },
    h('div', { class: 'card-head' }, ...openers),
    detailed ? h('p', { class: 'card-desc' }, def.description) : null,
    effect,
    stageLine,
    stageBlock,
    requireBlock,
    costRow,
    queueNote,
    h('div', { class: 'card-actions' }, button, status, pageLink),
  );

  return {
    el,
    update(village, world, now) {
      const current = village.buildings[buildingId];
      const planned = plannedLevel(village, buildingId);
      const check = inspectUpgrade(village, world, buildingId, now);

      // Görsel yalnızca görünüş aşaması değişince yenilenir (bkz. art/stages.js); inşa edilmemişse soluk.
      const tier = `${stageOf(buildingId, current)}`;
      if (tier !== artTier) {
        artTier = tier;
        art.innerHTML = stageSvg(buildingId, current);
      }
      const upcoming = nextStage(buildingId, Math.max(1, current));
      const nowName = current > 0 ? stageName(buildingId, current) : null;
      stageLine.replaceChildren(
        ...(nowName ? [h('span', { class: 'stage-name' }, nowName)] : [h('span', null, 'İnşa edilmedi')]),
        upcoming ? h('span', null, `· ${upcoming.level}. seviyede ${upcoming.name}`) : h('span', null, '· en görkemli hâli'),
      );
      for (const step of stageSteps) {
        step.el.classList.toggle('reached', current >= step.level);
        step.el.classList.toggle('current', current > 0 && stageOf(buildingId, current) === stageOf(buildingId, step.level));
      }
      setText(badge, current > 0 ? `${current}. seviye` : 'Yok');
      if (pageLink) pageLink.hidden = current === 0;
      badge.classList.toggle('badge-muted', current === 0);
      el.classList.toggle('locked', check.code === 'requires' && current === 0);
      el.classList.toggle('maxed', check.code === 'max');
      el.classList.toggle('ready', check.ok);

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

      for (const { req, lvl, item } of requirements) {
        const met = (village.buildings[req] ?? 0) >= lvl;
        item.classList.toggle('met', met);
        item.title = met ? 'Karşılandı' : `Şu an ${village.buildings[req] ?? 0}. seviye`;
      }
      if (queueNote) {
        const jobs = village.buildQueue.filter((job) => job.building === buildingId);
        queueNote.hidden = jobs.length === 0;
        if (jobs.length) {
          const last = jobs[jobs.length - 1];
          setText(queueNote, `Yapımda: ${jobs.map((job) => `${job.level}. seviye`).join(', ')} · ${fmtClock(last.endAt, now)} biter`);
        }
      }
    },
  };
}

/** Kartın "yükselt" düğmesine basıldı: yükseltmeyi başlatır, sonucu bildirir. */
export function upgradeFromButton(game, button, now) {
  const result = game.upgrade(button.dataset.building, now);
  if (!result.ok) toast(result.reason, 'error');
  else toast(`${BUILDINGS[button.dataset.building].name} yükseltmesi kuyruğa eklendi.`, 'success', 2500);
  return result;
}
