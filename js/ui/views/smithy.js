import { RESOURCES } from '../../config/resources.js';
import { UNITS, UNIT_IDS } from '../../config/units.js';
import { RESEARCH } from '../../config/tech.js';
import { trainingTimeFactor } from '../../core/formulas.js';
import { inspectResearch } from '../../systems/research.js';
import { finishCost } from '../../systems/premium.js';
import { unitPortrait } from './army.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

const bonusText = (level) => (level ? `+%${Math.round(level * RESEARCH.bonusPerLevel * 100)}` : '—');

/** Demirci sayfası: süren geliştirme ve her asker türü için bir sonraki seviye. */
export function createSmithyView({ game, refresh }) {
  const badge = h('span', { class: 'badge' });
  const info = h('span', { class: 'muted' });
  const notBuilt = h(
    'section',
    { class: 'panel' },
    h('p', null, 'Demirci henüz inşa edilmedi. ', h('a', { class: 'card-link', href: '#/koy' }, 'Köy ekranından inşa et →')),
  );
  const current = createCurrentPanel({ game, refresh });
  const cards = UNIT_IDS.map((id) => createResearchCard(id));
  const grid = h('div', { class: 'building-grid' }, cards.map((card) => card.el));

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Demirci'), badge, info, h('a', { class: 'card-link', href: '#/koy' }, '← Köy')),
    notBuilt,
    current.el,
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', null, 'Geliştirmeler'), h('span', { class: 'muted' }, `Her seviye saldırı ve savunmayı %${Math.round(RESEARCH.bonusPerLevel * 100)} artırır`)),
      grid,
    ),
  );

  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-research]');
    if (!button) return;
    const now = Date.now();
    const result = game.research(button.dataset.research, now);
    if (result.ok) toast(`${UNITS[button.dataset.research].name} geliştirmesi başladı. Bitiş ${fmtClock(now + result.duration * 1000, now)}.`, 'success');
    else toast(result.reason, 'error');
    refresh(now);
  });

  return {
    el,
    update(now) {
      const village = game.village;
      const level = village.buildings.demirci;
      setText(badge, level ? `${level}. seviye` : 'Yok');
      badge.classList.toggle('badge-muted', !level);
      setText(info, level ? `Geliştirme süresi %${Math.round(trainingTimeFactor(level) * 100)}` : '');
      notBuilt.hidden = level > 0;
      current.update(village, now);
      for (const card of cards) card.update(village, game.state.world, now);
    },
  };
}

function createCurrentPanel({ game, refresh }) {
  const text = h('div', { class: 'queue-unit' });
  const remaining = h('span', { class: 'queue-remaining' });
  const finish = h('span', { class: 'muted' });
  const bar = h('span');
  const cancel = h('button', { class: 'btn btn-small btn-ghost', type: 'button' }, 'İptal');
  const speedText = h('span');
  const speed = h('button', { class: 'btn btn-small btn-gold', type: 'button', title: 'Akçe ile anında bitir' }, icon('simsek'), speedText);
  const row = h(
    'div',
    { class: 'queue-row' },
    text,
    h('div', { class: 'queue-time' }, remaining, finish),
    h('div', { class: 'queue-actions' }, speed, cancel),
    h('div', { class: 'progress' }, bar),
  );
  speed.addEventListener('click', () => {
    const now = Date.now();
    const result = game.finishResearch(now);
    if (!result.ok) toast(result.reason, 'error');
    refresh(now);
  });
  const idle = h('p', { class: 'muted' }, 'Demircide şu anda geliştirme yok.');
  const el = h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Süren geliştirme')), row, idle);
  let shown = null;

  cancel.addEventListener('click', () => {
    const now = Date.now();
    const research = game.cancelResearch(now);
    if (research) toast(`${UNITS[research.unit].name} geliştirmesi iptal edildi, kaynaklar iade edildi.`);
    refresh(now);
  });

  return {
    el,
    update(village, now) {
      const research = village.research;
      row.hidden = !research;
      idle.hidden = !!research;
      if (!research) return;
      const key = `${research.unit}:${research.level}`;
      if (key !== shown) {
        shown = key;
        text.replaceChildren(
          h('span', { class: 'unit-icon small' }, icon(research.unit)),
          h('strong', null, UNITS[research.unit].name),
          ` → ${research.level}. seviye`,
        );
        setText(finish, `bitiş ${fmtClock(research.endAt, now)}`);
      }
      setText(remaining, fmtDuration((research.endAt - now) / 1000));
      const cost = finishCost(research.endAt - now, game.state.world);
      setText(speedText, fmtInt(cost));
      speed.disabled = (game.state.player.akce ?? 0) < cost;
      speed.title = `${fmtInt(cost)} Akçe ile anında bitir`;
      const done = (now - research.startAt) / (research.endAt - research.startAt);
      bar.style.width = `${Math.min(100, Math.max(0, done * 100))}%`;
    },
  };
}

function createResearchCard(unitId) {
  const unit = UNITS[unitId];
  const levelBadge = h('span', { class: 'badge' });
  const effect = h('div', { class: 'card-effect' });
  const status = h('div', { class: 'card-status' });
  const button = h('button', { class: 'btn', type: 'button', dataset: { research: unitId } });
  const costItems = {};
  const costRow = h('div', { class: 'cost' });
  for (const resource of Object.keys(unit.cost)) {
    const value = h('span');
    const item = h('span', { class: 'cost-item', title: RESOURCES[resource].name }, icon(resource), value);
    costItems[resource] = { item, value };
    costRow.append(item);
  }
  const time = h('span');
  costRow.append(h('span', { class: 'cost-item', title: 'Süre' }, icon('saat'), time));

  const el = h(
    'article',
    { class: 'card' },
    h(
      'div',
      { class: 'card-head' },
      h('div', { class: 'unit-title' }, unitPortrait(unitId), h('div', null, h('h3', null, unit.name), h('span', { class: 'role' }, unit.role))),
      levelBadge,
    ),
    effect,
    costRow,
    h('div', { class: 'card-actions' }, button, status),
  );

  return {
    el,
    update(village, world, now) {
      const level = village.tech[unitId];
      const check = inspectResearch(village, world, unitId, now);
      const researching = village.research?.unit === unitId;
      setText(levelBadge, `${level}/${RESEARCH.maxLevel}`);
      levelBadge.classList.toggle('badge-muted', level === 0);
      el.classList.toggle('maxed', check.code === 'max');
      el.classList.toggle('locked', check.code === 'requires');
      setText(effect, `Bonus: ${bonusText(level)}${check.code === 'max' ? '' : ` → ${bonusText(check.level)}`}`);

      if (check.cost) {
        for (const [resource, { item, value }] of Object.entries(costItems)) {
          setText(value, fmtInt(check.cost[resource]));
          item.classList.toggle('short', village.resources[resource] < check.cost[resource]);
        }
        setText(time, fmtDuration(check.duration));
      }
      setText(button, check.code === 'max' ? 'Tamamlandı' : `${check.level}. seviyeye geliştir`);
      button.disabled = !check.ok;
      if (researching) setText(status, 'Geliştiriliyor…');
      else if (check.ok || check.code === 'max') setText(status, '');
      else if (check.code === 'resources') setText(status, `Kaynaklar ${fmtClock(check.readyAt, now)} hazır`);
      else setText(status, check.reason);
    },
  };
}
