import { EDICTS, EDICT_IDS } from '../../config/edicts.js';
import { activeEdict } from '../../systems/edicts.js';
import { seasonOf, seasonLeft } from '../../systems/seasons.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtDuration } from '../format.js';
import { toast } from '../toast.js';

/** Mevsim başına tek seçim: beyliğin tüm köylerine yayılan üç stratejik ferman. */
export function createEdictPanel({ game, refresh }) {
  const seasonLabel = h('span', { class: 'badge badge-gold' });
  const status = h('p', { class: 'muted edict-status' });
  const cards = EDICT_IDS.map((id) => {
    const edict = EDICTS[id];
    const button = h('button', { type: 'button', class: 'btn btn-small', dataset: { edict: id } }, 'Bu fermanı seç');
    const card = h(
      'article',
      { class: `edict-card edict-${id}` },
      h('div', { class: 'edict-card-head' }, h('span', { class: 'edict-icon' }, icon(edict.icon)), h('h3', null, edict.name)),
      h('p', { class: 'muted' }, edict.description),
      h('strong', { class: 'edict-effect' }, edict.effect),
      button,
    );
    return { id, card, button };
  });
  const el = h(
    'section',
    { class: 'panel stack-sm edict-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Mevsim fermanı'), seasonLabel),
    h('p', { class: 'muted' }, 'Her mevsimde bir kez karar ver. Seçtiğin ferman mevsim bitene kadar tüm köylerine işler; seçim geri alınamaz.'),
    status,
    h('div', { class: 'edict-grid' }, cards.map(({ card }) => card)),
  );

  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-edict]');
    if (!button) return;
    const now = Date.now();
    const result = game.chooseEdict(button.dataset.edict, now);
    if (result.ok) toast(`${EDICTS[result.id].name} bu mevsim için yürürlüğe girdi.`, 'success');
    else toast(result.reason, 'error');
    refresh(now);
  });

  return {
    el,
    update(state, now) {
      const season = seasonOf(state.world);
      const chosen = activeEdict(state);
      const seasonIndex = state.world.season ?? 0;
      if (!season) {
        setText(seasonLabel, 'Mevsimler kapalı');
        setText(status, 'Bu dünyada mevsim sistemi kapalı olduğu için ferman seçilemez.');
      } else {
        setText(seasonLabel, season.name);
        const remaining = seasonLeft(state.world, now) / state.world.speed / 1000;
        setText(
          status,
          chosen
            ? `${EDICTS[chosen.id].name} yürürlükte · ${fmtDuration(remaining)} sonra yeni mevsim ve yeni ferman hakkı.`
            : `${season.name} sonuna ${fmtDuration(remaining)} kaldı. Bu mevsim için henüz ferman seçmedin.`,
        );
      }
      for (const { id, card, button } of cards) {
        const selected = chosen?.id === id;
        card.classList.toggle('is-selected', selected);
        button.disabled = !season || !!chosen;
        setText(button, selected ? 'Yürürlükte' : chosen ? 'Seçim yapıldı' : 'Bu fermanı seç');
        button.setAttribute('aria-pressed', String(selected));
        button.title = `Mevsim ${seasonIndex + 1}: ${EDICTS[id].effect}`;
      }
    },
  };
}
