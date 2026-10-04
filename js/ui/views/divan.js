import { ILIM, ILIM_IDS, ILIM_GROUPS } from '../../config/ilim.js';
import { RESOURCES } from '../../config/resources.js';
import { UNITS } from '../../config/units.js';
import { inspectIlim, ilimDone } from '../../systems/ilim.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';
import { createEdictPanel } from './edict-panel.js';

/**
 * Divan: Konak üzerinden yürütülen araştırmalar (İlim). Kademeler Konak seviyesine göre açılır;
 * her araştırmanın önkoşulları, bedeli, süresi ve etkisi kartında görünür.
 */
export function createDivanView({ game, refresh }) {
  const current = createCurrentPanel();
  const edictPanel = createEdictPanel({ game, refresh });
  const tiers = [...new Set(ILIM_IDS.map((id) => ILIM[id].konak))].sort((a, b) => a - b);
  const cards = ILIM_IDS.map((id) => createIlimCard(id));
  const doneCount = h('span', { class: 'muted' });

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Divan'), doneCount),
    h('p', { class: 'muted page-intro' }, 'Âlimler ve kâtipler beyliğin işlerini düzene sokar. Araştırmalar bütün köylerine işler ve kalıcıdır; aynı anda bir araştırma yürür, bedeli yönettiğin köyden ödenir.'),
    edictPanel.el,
    current.el,
    tiers.map((level, index) =>
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, `${index + 1}. kademe`), h('span', { class: 'muted' }, `Konak ${level}. seviye`)),
        h('div', { class: 'ilim-grid' }, cards.filter((card) => ILIM[card.id].konak === level).map((card) => card.el)),
      ),
    ),
  );

  el.addEventListener('click', (event) => {
    const now = Date.now();
    const start = event.target.closest('button[data-ilim]');
    if (start) {
      const result = game.startIlim(start.dataset.ilim, now);
      if (result.ok) toast(`Divan: ${ILIM[start.dataset.ilim].name} araştırması başladı.`, 'success');
      else toast(result.reason, 'error');
      refresh(now);
      return;
    }
    if (event.target.closest('button[data-action="cancel-ilim"]')) {
      const cancelled = game.cancelIlim(now);
      if (cancelled) toast(`${ILIM[cancelled.id].name} araştırması iptal edildi; bedeli iade edildi.`);
      refresh(now);
    }
  });

  return {
    el,
    update(now) {
      const { state } = game;
      setText(doneCount, `${state.player.ilim?.done?.length ?? 0}/${ILIM_IDS.length} araştırma`);
      edictPanel.update(state, now);
      current.update(state, now);
      for (const card of cards) card.update(state, game.village, now);
    },
  };
}

function createCurrentPanel() {
  const body = h('div', { class: 'queue' });
  const el = h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Süren araştırma')), body);
  let signature = null;
  let parts = null;
  return {
    el,
    update(state, now) {
      const current = state.player.ilim?.current;
      const next = current ? `${current.id}:${current.endAt}` : '';
      if (next !== signature) {
        signature = next;
        if (!current) {
          parts = null;
          body.replaceChildren(h('p', { class: 'muted' }, 'Divan boşta. Aşağıdan bir araştırma seç.'));
        } else {
          const remaining = h('span', { class: 'queue-remaining' });
          const bar = h('span');
          parts = { remaining, bar, current };
          body.replaceChildren(
            h(
              'div',
              { class: 'queue-row' },
              h('div', null, h('strong', null, ILIM[current.id].name), h('span', { class: 'muted' }, ` · ${ILIM[current.id].perks.join(', ')}`)),
              h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `bitiş ${fmtClock(current.endAt, now)}`)),
              h('div', { class: 'queue-actions' }, h('button', { class: 'btn btn-small btn-ghost', type: 'button', dataset: { action: 'cancel-ilim' } }, 'İptal')),
              h('div', { class: 'progress' }, bar),
            ),
          );
        }
      }
      if (parts) {
        const { remaining, bar, current: c } = parts;
        setText(remaining, fmtDuration((c.endAt - now) / 1000));
        bar.style.width = `${Math.min(100, Math.max(0, ((now - c.startAt) / (c.endAt - c.startAt)) * 100))}%`;
      }
    },
  };
}

function createIlimCard(id) {
  const def = ILIM[id];
  const status = h('div', { class: 'card-status' });
  const button = h('button', { type: 'button', class: 'btn btn-small', dataset: { ilim: id } }, 'Araştır');
  const costItems = Object.keys(def.cost).map((resource) => {
    const value = h('span');
    const item = h('span', { class: 'cost-item', title: RESOURCES[resource].name }, icon(resource), value);
    return { resource, item, value };
  });
  const time = h('span');
  const requires = def.requires.map((req) => ({ req, item: h('li', null, ILIM[req].name) }));
  const unlocks = (def.unlocks ?? []).map((unit) => UNITS[unit].name);
  const el = h(
    'article',
    { class: `card ilim-card group-${def.group}` },
    h('div', { class: 'card-head' }, h('h3', null, def.name), h('span', { class: 'badge badge-muted ilim-group' }, ILIM_GROUPS[def.group])),
    h('ul', { class: 'perk-list' }, def.perks.map((perk) => h('li', null, perk))),
    unlocks.length ? h('p', { class: 'unlock-note' }, `Açar: ${unlocks.join(', ')}`) : null,
    requires.length ? h('ul', { class: 'require-list' }, requires.map((r) => r.item)) : null,
    h('div', { class: 'cost' }, costItems.map((c) => c.item), h('span', { class: 'cost-item', title: 'Süre' }, icon('saat'), time)),
    h('div', { class: 'card-actions' }, button, status),
  );
  return {
    id,
    el,
    update(state, village, now) {
      const check = inspectIlim(state, village, state.world, id, now);
      const done = check.code === 'done';
      const running = state.player.ilim?.current?.id === id;
      el.classList.toggle('done', done);
      el.classList.toggle('active', running);
      el.classList.toggle('locked', check.code === 'requires' || check.code === 'konak');
      el.classList.toggle('ready', check.ok);
      for (const { resource, item, value } of costItems) {
        setText(value, fmtInt(check.cost?.[resource] ?? def.cost[resource]));
        item.classList.toggle('short', !done && village.resources[resource] < def.cost[resource]);
      }
      setText(time, fmtDuration(check.duration ?? 0));
      for (const { req, item } of requires) item.classList.toggle('met', ilimDone(state, req));
      button.hidden = done || running;
      button.disabled = !check.ok;
      if (done) setText(status, '✓ Araştırıldı');
      else if (running) setText(status, 'Araştırılıyor…');
      else if (check.ok) setText(status, '');
      else if (check.code === 'resources') setText(status, `Kaynaklar ${fmtClock(check.readyAt, now)} hazır`);
      else setText(status, check.reason);
    },
  };
}
