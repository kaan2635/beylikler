import { GAME } from '../../config/game.js';
import { BUILDINGS } from '../../config/buildings.js';
import { RESOURCES } from '../../config/resources.js';
import { UNITS, UNIT_IDS, TRAINING_BUILDINGS, COMBAT_TYPES } from '../../config/units.js';
import { trainingTimeFactor } from '../../core/formulas.js';
import { inspectTraining, maxTrainable } from '../../systems/training.js';
import { isOutbound } from '../../systems/movements.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

/** Ordu ekranı: köydeki birlikler ve her eğitim binası için kuyruk + birim kartları. */
export function createArmyView(ctx) {
  const summary = createSummaryPanel();
  const movements = createMovementsPanel(ctx);
  const panels = TRAINING_BUILDINGS.map((buildingId) => createBuildingPanel(buildingId, ctx));
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Ordu')),
    summary.el,
    movements.el,
    panels.map((panel) => panel.el),
  );

  return {
    el,
    update(now) {
      const village = ctx.game.village;
      summary.update(village);
      movements.update(village, now);
      for (const panel of panels) panel.update(village, ctx.game.state.world, now);
    },
  };
}

function createSummaryPanel() {
  const chips = {};
  const grid = h('div', { class: 'troop-grid' });
  for (const id of UNIT_IDS) {
    const count = h('strong');
    const chip = h('div', { class: 'troop' }, unitIcon(id, true), h('span', null, UNITS[id].name), count);
    chips[id] = { chip, count };
    grid.append(chip);
  }
  const attack = h('span');
  const defense = h('span');
  const carry = h('span');
  const el = h(
    'section',
    { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Köydeki birlikler')),
    grid,
    h(
      'div',
      { class: 'totals' },
      stat('saldiri', 'Toplam saldırı gücü', h('span', { class: 'muted' }, 'Saldırı'), attack),
      stat('savunma', 'Toplam savunma: piyadeye / süvariye / okçuya karşı', h('span', { class: 'muted' }, 'Savunma'), defense),
      stat('tasima', 'Toplam taşıma kapasitesi', h('span', { class: 'muted' }, 'Taşıma'), carry),
    ),
    h(
      'p',
      { class: 'legend muted' },
      stat('saldiri', null, 'saldırı'),
      stat('savunma', null, 'savunma (piyadeye / süvariye / okçuya karşı)'),
      stat('hiz', null, 'hız (dakika / alan)'),
      stat('tasima', null, 'taşıma'),
    ),
  );

  return {
    el,
    update(village) {
      let totalAttack = 0;
      let totalCarry = 0;
      const totalDefense = { piyade: 0, suvari: 0, okcu: 0 };
      for (const id of UNIT_IDS) {
        const n = village.units[id];
        const unit = UNITS[id];
        setText(chips[id].count, fmtInt(n));
        chips[id].chip.classList.toggle('empty', n === 0);
        totalAttack += n * unit.attack;
        totalCarry += n * unit.carry;
        for (const type of Object.keys(totalDefense)) totalDefense[type] += n * unit.defense[type];
      }
      setText(attack, fmtInt(totalAttack));
      setText(defense, `${fmtInt(totalDefense.piyade)} / ${fmtInt(totalDefense.suvari)} / ${fmtInt(totalDefense.okcu)}`);
      setText(carry, fmtInt(totalCarry));
    },
  };
}

const MOVEMENT_KINDS = {
  saldiri: { label: 'Saldırı →', icon: 'saldiri', className: 'is-attack' },
  casus: { label: 'Casusluk →', icon: 'gozcu', className: 'is-spy' },
  donus: { label: 'Dönüş ←', icon: 'donus', className: 'is-return' },
};

/** Yoldaki birlikler: hedefe gidenler ve (ganimetle) dönenler. Hedefe giden birlik geri çağrılabilir. */
function createMovementsPanel({ game, refresh }) {
  const count = h('span', { class: 'muted' });
  const body = h('div', { class: 'queue' });
  const el = h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Yoldaki birlikler'), count), body);
  let signature = null;
  let rows = [];

  body.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-recall]');
    if (!button) return;
    const now = Date.now();
    const result = game.recallAttack(Number(button.dataset.recall), now);
    if (result.ok) toast(`Birlikler geri çağrıldı. Dönüş ${fmtClock(result.movement.arriveAt, now)}.`);
    else toast(result.reason, 'error');
    refresh(now);
  });

  function rebuild(movements, now) {
    rows = movements.map((movement) => {
      const outbound = isOutbound(movement);
      const kind = MOVEMENT_KINDS[movement.type];
      const remaining = h('span', { class: 'queue-remaining' });
      const bar = h('span');
      const units = Object.entries(movement.units)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`)
        .join(', ');
      const loot = movement.loot ? Object.values(movement.loot).reduce((a, b) => a + b, 0) : 0;
      const recalled = movement.type === 'donus' && movement.turnAt < 1;
      const target = movement.target;
      const row = h(
        'div',
        { class: `queue-row movement ${kind.className}` },
        h(
          'div',
          { class: 'queue-unit' },
          h('span', { class: 'unit-icon small' }, icon(kind.icon)),
          h('strong', null, kind.label),
          h('a', { class: 'card-link', href: `#/harita/${target.x}/${target.y}` }, `${target.name} (${target.x}|${target.y})`),
          h('span', { class: 'muted movement-units' }, units + (loot ? ` · ganimet ${fmtInt(loot)}` : '') + (recalled ? ' · geri çağrıldı' : '')),
        ),
        h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `varış ${fmtClock(movement.arriveAt, now)}`)),
        outbound
          ? h('button', { class: 'btn btn-small btn-ghost', type: 'button', dataset: { recall: movement.id } }, 'Geri çağır')
          : h('span'),
        h('div', { class: 'progress' }, bar),
      );
      return { row, remaining, bar, movement };
    });
    body.replaceChildren(
      ...(rows.length ? rows.map((r) => r.row) : [h('p', { class: 'muted' }, 'Yolda birlik yok. Haritadan bir barbar köyü seçip saldırı gönderebilirsin.')]),
    );
  }

  return {
    el,
    update(village, now) {
      const movements = [...village.movements].sort((a, b) => a.arriveAt - b.arriveAt);
      setText(count, movements.length ? String(movements.length) : '');
      const next = movements.map((m) => `${m.id}:${m.type}:${m.arriveAt}`).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(movements, now);
      }
      for (const { remaining, bar, movement } of rows) {
        setText(remaining, fmtDuration((movement.arriveAt - now) / 1000));
        const done = (now - movement.departAt) / (movement.arriveAt - movement.departAt);
        bar.style.width = `${Math.min(100, Math.max(0, done * 100))}%`;
      }
    },
  };
}

function createBuildingPanel(buildingId, { game, refresh }) {
  const badge = h('span', { class: 'badge' });
  const info = h('span', { class: 'muted' });
  const queue = createTrainQueue(buildingId);
  const cards = UNIT_IDS.filter((id) => UNITS[id].building === buildingId).map((id) =>
    createUnitCard(id, { game, refresh }),
  );
  const el = h(
    'section',
    { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h2', null, BUILDINGS[buildingId].name), badge, info),
    queue.el,
    h('div', { class: 'building-grid' }, cards.map((card) => card.el)),
  );

  el.addEventListener('click', (event) => {
    if (!event.target.closest('button[data-action="cancel-train"]')) return;
    const now = Date.now();
    const batch = game.cancelLastTraining(buildingId, now);
    if (batch) toast(`${fmtInt(batch.remaining)} ${UNITS[batch.unit].name} eğitimi iptal edildi, kaynaklar iade edildi.`);
    refresh(now);
  });

  return {
    el,
    update(village, world, now) {
      const level = village.buildings[buildingId];
      setText(badge, level > 0 ? `${level}. seviye` : 'Yok');
      badge.classList.toggle('badge-muted', level === 0);
      setText(info, level > 0 ? `Eğitim süresi %${Math.round(trainingTimeFactor(level) * 100)}` : 'Köy ekranından inşa edebilirsin');
      queue.update(village, now);
      for (const card of cards) card.update(village, world, now);
    },
  };
}

function createTrainQueue(buildingId) {
  const el = h('div', { class: 'queue train-queue' });
  let signature = null;
  let rows = [];

  function rebuild(batches, now) {
    rows = batches.map((batch, index) => {
      const progress = h('span', { class: 'muted' });
      const remaining = h('span', { class: 'queue-remaining' });
      const bar = h('span');
      const isLast = index === batches.length - 1;
      const row = h(
        'div',
        { class: 'queue-row' },
        h('div', { class: 'queue-unit' }, unitIcon(batch.unit, true), h('strong', null, UNITS[batch.unit].name), progress),
        h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `bitiş ${fmtClock(batch.endAt, now)}`)),
        isLast ? h('button', { class: 'btn btn-small btn-ghost', dataset: { action: 'cancel-train' } }, 'İptal') : h('span'),
        index === 0 ? h('div', { class: 'progress' }, bar) : null,
      );
      return { row, progress, remaining, bar };
    });
    el.replaceChildren(
      ...(rows.length ? rows.map((r) => r.row) : [h('p', { class: 'muted' }, 'Eğitimde asker yok.')]),
    );
  }

  return {
    el,
    update(village, now) {
      const batches = village.trainQueues[buildingId];
      const next = batches.map((b) => `${b.unit}:${b.count}:${b.startAt}`).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(batches, now);
      }
      rows.forEach(({ progress, remaining, bar }, index) => {
        const batch = batches[index];
        setText(progress, `${fmtInt(batch.trained)}/${fmtInt(batch.count)}`);
        if (index === 0) {
          setText(remaining, fmtDuration((batch.endAt - now) / 1000));
          const done = (now - batch.startAt) / (batch.endAt - batch.startAt);
          bar.style.width = `${Math.min(100, Math.max(0, done * 100))}%`;
        } else {
          setText(remaining, `sırada · ${fmtDuration((batch.endAt - batch.startAt) / 1000)}`);
        }
      });
    },
  };
}

function createUnitCard(unitId, { game, refresh }) {
  const unit = UNITS[unitId];
  const home = h('span', { class: 'badge' });
  const status = h('div', { class: 'card-status' });
  const input = h('input', {
    type: 'number',
    min: 1,
    max: GAME.maxTrainBatch,
    value: 1,
    inputmode: 'numeric',
    'aria-label': `${unit.name} sayısı`,
  });
  const maxButton = h('button', { type: 'button', class: 'btn btn-small btn-ghost' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Eğit');

  const costItems = {};
  const costRow = h('div', { class: 'cost' });
  for (const resource of Object.keys(unit.cost)) {
    const value = h('span');
    const item = h('span', { class: 'cost-item', title: RESOURCES[resource].name }, icon(resource), value);
    costItems[resource] = { item, value };
    costRow.append(item);
  }
  const pop = h('span');
  const time = h('span');
  const timeItem = h('span', { class: 'cost-item' }, icon('saat'), time);
  costRow.append(h('span', { class: 'cost-item', title: 'Nüfus' }, icon('nufus'), pop), timeItem);

  const d = unit.defense;
  const el = h(
    'article',
    { class: 'card' },
    h(
      'div',
      { class: 'card-head' },
      h('div', { class: 'unit-title' }, unitIcon(unitId), h('div', null, h('h3', null, unit.name), h('span', { class: 'role' }, unit.role))),
      home,
    ),
    h('p', { class: 'card-desc' }, unit.description),
    h(
      'div',
      { class: 'stats' },
      stat('saldiri', `Saldırı gücü (${COMBAT_TYPES[unit.type].toLocaleLowerCase('tr')} saldırısı)`, String(unit.attack)),
      stat('savunma', 'Savunma: piyadeye / süvariye / okçuya karşı', `${d.piyade} / ${d.suvari} / ${d.okcu}`),
      stat('hiz', 'Hız: bir alanı geçme süresi', `${unit.speed} dk`),
      stat('tasima', 'Taşıma kapasitesi', String(unit.carry)),
    ),
    costRow,
    h('form', { class: 'form-row', onsubmit: onTrain }, input, submit, maxButton),
    status,
  );

  // Boş ya da geçersiz giriş NaN/0 olur; inspectTraining bunu 'count' koduyla yakalar.
  const readCount = () => Number(input.value);

  function onTrain(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.train(unitId, readCount(), now);
    if (!result.ok) toast(result.reason, 'error');
    refresh(now);
  }

  maxButton.addEventListener('click', () => {
    input.value = String(Math.max(1, maxTrainable(game.village, unitId)));
    refresh();
  });
  input.addEventListener('input', () => refresh());

  return {
    el,
    update(village, world, now) {
      const check = inspectTraining(village, world, unitId, readCount(), now);
      const max = maxTrainable(village, unitId);

      setText(home, `Köyde: ${fmtInt(village.units[unitId])}`);
      el.classList.toggle('locked', check.code === 'requires');
      for (const [resource, { item, value }] of Object.entries(costItems)) {
        setText(value, fmtInt(check.cost[resource]));
        item.classList.toggle('short', village.resources[resource] < check.cost[resource]);
      }
      setText(pop, fmtInt(check.popNeeded));
      setText(time, fmtDuration(check.duration));
      timeItem.title = `Toplam süre (birim başına ${fmtDuration(check.unitSeconds)})`;

      setText(maxButton, `En fazla ${fmtInt(max)}`);
      maxButton.disabled = max === 0;
      submit.disabled = !check.ok;

      if (check.ok) setText(status, '');
      else if (check.code === 'resources') setText(status, `Kaynaklar ${fmtClock(check.readyAt, now)} hazır`);
      else setText(status, check.reason);
    },
  };
}

function unitIcon(unitId, small = false) {
  return h('span', { class: small ? 'unit-icon small' : 'unit-icon', title: UNITS[unitId].name }, icon(unitId));
}

function stat(iconName, title, ...content) {
  return h('span', { class: 'stat', title }, icon(iconName), ...content);
}
