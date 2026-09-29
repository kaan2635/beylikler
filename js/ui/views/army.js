import { GAME } from '../../config/game.js';
import { BUILDINGS } from '../../config/buildings.js';
import { RESOURCES } from '../../config/resources.js';
import { UNITS, UNIT_IDS, TRAINING_BUILDINGS, COMBAT_TYPES } from '../../config/units.js';
import { trainingTimeFactor, wallBonus } from '../../core/formulas.js';
import { inspectTraining, maxTrainable } from '../../systems/training.js';
import { isOutbound } from '../../systems/movements.js';
import { techMultiplier } from '../../systems/research.js';
import { incomingEstimate } from '../../systems/ai.js';
import { defendersOf, supportAt, stationedAway } from '../../systems/support.js';
import { gameIconSvg } from '../art/sprites.js';
import { COMBAT } from '../../config/combat.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

/** Ordu ekranı: köydeki birlikler ve her eğitim binası için kuyruk + birim kartları. */
export function createArmyView(ctx) {
  const incoming = createIncomingPanel();
  const summary = createSummaryPanel();
  const movements = createMovementsPanel(ctx);
  const support = createSupportPanel(ctx);
  const panels = TRAINING_BUILDINGS.map((buildingId) => createBuildingPanel(buildingId, ctx));
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Ordu')),
    incoming.el,
    summary.el,
    movements.el,
    support.el,
    panels.map((panel) => panel.el),
  );

  return {
    el,
    update(now) {
      const village = ctx.game.village;
      incoming.update(ctx.game.state, village, now);
      summary.update(village);
      movements.update(village, now);
      support.update(ctx.game.state, village);
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
        const forged = techMultiplier(village.tech[id]); // Demirci bonusu
        totalAttack += n * unit.attack * forged;
        totalCarry += n * unit.carry;
        for (const type of Object.keys(totalDefense)) totalDefense[type] += n * unit.defense[type] * forged;
      }
      setText(attack, fmtInt(totalAttack));
      setText(defense, `${fmtInt(totalDefense.piyade)} / ${fmtInt(totalDefense.suvari)} / ${fmtInt(totalDefense.okcu)}`);
      setText(carry, fmtInt(totalCarry));
    },
  };
}

/** Köyün savunma gücü; destek, sur, köylüler ve Demirci dahil. Bey saldırısının tahminiyle karşılaştırmak için. */
function villageDefense(state, village) {
  const defense = { piyade: 0, suvari: 0, okcu: 0 };
  const defenders = defendersOf(state, village);
  for (const id of UNIT_IDS) {
    const n = defenders[id] ?? 0;
    if (!n) continue;
    for (const type of Object.keys(defense)) defense[type] += n * UNITS[id].defense[type] * techMultiplier(village.tech[id]);
  }
  const wall = village.buildings.sur;
  for (const type of Object.keys(defense)) {
    defense[type] = defense[type] * (1 + wallBonus(wall)) + COMBAT.villageDefense + COMBAT.wallDefensePerLevel * wall;
  }
  return defense;
}

/** Köye gelen bey saldırıları; yalnızca varsa görünür. */
function createIncomingPanel() {
  const defense = h('p', { class: 'muted' });
  const body = h('div', { class: 'queue' });
  const el = h(
    'section',
    { class: 'panel incoming-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Gelen saldırılar')),
    defense,
    body,
  );
  let signature = null;
  let rows = [];

  return {
    el,
    /** Tüm köylere gelen saldırılar; savunma özeti yönetilen köy içindir. */
    update(state, village, now) {
      const villages = Object.values(state.villages);
      const attacks = villages
        .flatMap((v) => v.incoming.map((attack) => ({ attack, target: v })))
        .sort((a, b) => a.attack.arriveAt - b.attack.arriveAt);
      el.hidden = attacks.length === 0;
      if (!attacks.length) return;
      const d = villageDefense(state, village);
      setText(
        defense,
        `${village.name} savunması: piyadeye ${fmtInt(d.piyade)} · süvariye ${fmtInt(d.suvari)} · okçuya ${fmtInt(d.okcu)}` +
          ` (sur ${village.buildings.sur}. seviye ve destek dahil). Askerlerini köyde tut ya da diğer köylerinden destek gönder; Gizli Depo kaynaklarını korur.`,
      );
      const next = attacks.map((a) => a.attack.id).join('|');
      if (next !== signature) {
        signature = next;
        rows = attacks.map(({ attack, target }) => {
          const remaining = h('span', { class: 'queue-remaining' });
          const bar = h('span');
          const row = h(
            'div',
            { class: 'queue-row movement is-incoming' },
            h(
              'div',
              { class: 'queue-unit' },
              h('span', { class: 'unit-icon small' }, icon('saldiri')),
              h('strong', null, attack.from.owner),
              h('a', { class: 'card-link', href: `#/harita/${attack.from.x}/${attack.from.y}` }, `${attack.from.name} (${attack.from.x}|${attack.from.y})`),
              villages.length > 1 ? h('span', null, `→ ${target.name}`) : null,
              h('span', { class: 'muted movement-units' }, `tahmini saldırı gücü ~${fmtInt(incomingEstimate(attack))}`),
            ),
            h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `varış ${fmtClock(attack.arriveAt, now)}`)),
            h('span'),
            h('div', { class: 'progress' }, bar),
          );
          return { row, remaining, bar, attack };
        });
        body.replaceChildren(...rows.map((r) => r.row));
      }
      for (const { remaining, bar, attack } of rows) {
        setText(remaining, fmtDuration((attack.arriveAt - now) / 1000));
        const done = (now - attack.departAt) / (attack.arriveAt - attack.departAt);
        bar.style.width = `${Math.min(100, Math.max(0, done * 100))}%`;
      }
    },
  };
}

const MOVEMENT_KINDS = {
  saldiri: { label: 'Saldırı →', icon: 'saldiri', className: 'is-attack' },
  casus: { label: 'Casusluk →', icon: 'gozcu', className: 'is-spy' },
  destek: { label: 'Destek →', icon: 'savunma', className: 'is-support' },
  nakliye: { label: 'Nakliye →', icon: 'tasima', className: 'is-transport' },
  kesif: { label: 'Keşif →', icon: 'kasif', className: 'is-expedition' },
  donus: { label: 'Dönüş ←', icon: 'donus', className: 'is-return' },
};

/**
 * Destek birlikleri: bu köyün başka köylerde duran askerleri (geri çağrılabilir) ve başka
 * köylerden bu köyü savunmaya gelenler (geri gönderilebilir). Hiç yoksa gizlenir.
 */
function createSupportPanel({ game, refresh }) {
  const away = h('div', { class: 'queue' });
  const here = h('div', { class: 'queue' });
  const awayBlock = h('div', { class: 'stack-sm' }, h('h3', { class: 'info-subtitle' }, 'Başka köylerdeki askerlerin'), away);
  const hereBlock = h('div', { class: 'stack-sm' }, h('h3', { class: 'info-subtitle' }, 'Bu köyü savunan destek'), here);
  const el = h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Destek')), awayBlock, hereBlock);
  let signature = null;

  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-home]');
    if (!button) return;
    const now = Date.now();
    const result = game.withdrawSupport(button.dataset.home, button.dataset.host, now);
    if (result.ok) toast(`Askerler ${result.host.name} köyünden ${result.home.name} köyüne dönüyor. Varış ${fmtClock(result.movement.arriveAt, now)}.`);
    else toast(result.reason, 'error');
    refresh(now);
  });

  const row = (label, units, home, host, buttonText) =>
    h(
      'div',
      { class: 'queue-row' },
      h('div', { class: 'queue-unit' }, h('span', { class: 'unit-icon small' }, icon('savunma')), h('strong', null, label), h('span', { class: 'muted movement-units' }, armyList(units))),
      h('span'),
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { home, host } }, buttonText),
    );

  return {
    el,
    update(state, village) {
      const mine = stationedAway(state, village);
      const guests = supportAt(state, village.id);
      el.hidden = !mine.length && !guests.length;
      const next = JSON.stringify([village.id, mine.map((m) => [m.hostId, m.units]), guests.map((g) => [g.home.id, g.units])]);
      if (next === signature) return;
      signature = next;
      awayBlock.hidden = !mine.length;
      hereBlock.hidden = !guests.length;
      away.replaceChildren(...mine.map((m) => row(`→ ${m.host?.name ?? m.hostId}`, m.units, village.id, m.hostId, 'Geri çağır')));
      here.replaceChildren(...guests.map((g) => row(`${g.home.name} köyünden`, g.units, g.home.id, village.id, 'Geri gönder')));
    },
  };
}

function armyList(units) {
  return Object.entries(units)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`)
    .join(', ');
}

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
      const units =
        movement.type === 'nakliye'
          ? `${movement.merchants} tüccar · ${fmtInt(Object.values(movement.resources).reduce((a, b) => a + b, 0))} kaynak`
          : armyList(movement.units);
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
      ...(rows.length ? rows.map((r) => r.row) : [h('p', { class: 'muted' }, 'Yolda birlik yok. Haritadan bir barbar köyü seçip saldırı, kendi başka köyünü seçip destek gönderebilirsin.')]),
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
  const techTag = h('span');
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
      h('div', { class: 'unit-title' }, unitPortrait(unitId), h('div', null, h('h3', null, unit.name), h('span', { class: 'role' }, unit.role, techTag))),
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
      const tech = village.tech[unitId];
      setText(techTag, tech ? ` · Demirci ${tech} (+%${Math.round((techMultiplier(tech) - 1) * 100)})` : '');
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

/** Birim portresi (özgün çizim), kategori renginde madalyon çerçevede. */
export function unitPortrait(unitId) {
  const el = h('span', { class: 'unit-portrait', 'aria-hidden': 'true' });
  el.innerHTML = gameIconSvg(unitId);
  el.dataset.cat = UNITS[unitId].building === 'atolye' ? 'kusatma' : UNITS[unitId].building === 'saray' ? 'ozel' : UNITS[unitId].type;
  return el;
}

function unitIcon(unitId, small = false) {
  return h('span', { class: small ? 'unit-icon small' : 'unit-icon', title: UNITS[unitId].name }, icon(unitId));
}

function stat(iconName, title, ...content) {
  return h('span', { class: 'stat', title }, icon(iconName), ...content);
}
