import { UNITS, UNIT_IDS } from '../../config/units.js';
import { BUILDINGS } from '../../config/buildings.js';
import { CATAPULT_TARGETS, CONQUEST } from '../../config/combat.js';
import { loyaltyOf } from '../../systems/barbarians.js';
import { RESOURCE_IDS } from '../../config/resources.js';
import { inspectAttack, totalUnits } from '../../systems/movements.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

/**
 * Haritada seçilen barbar köyüne birlik gönderme formu. Yalnız gözcü seçilirse birlik
 * casusluğa gider; mancınık varsa hedef bina sorulur.
 */
export function createAttackForm({ game, refresh }) {
  let target = null;
  const rows = {};
  for (const id of UNIT_IDS) {
    const input = h('input', { type: 'number', min: 0, value: 0, inputmode: 'numeric', 'aria-label': `Gönderilecek ${UNITS[id].name}` });
    const all = h('button', { type: 'button', class: 'link-btn', title: `Tüm ${UNITS[id].name} askerlerini seç` });
    all.addEventListener('click', () => {
      input.value = String(game.village.units[id]);
      refresh();
    });
    input.addEventListener('input', () => refresh());
    const row = h('div', { class: 'send-row' }, h('span', { class: 'unit-icon small' }, icon(id)), h('span', null, UNITS[id].name), all, input);
    rows[id] = { row, input, all };
  }

  const catapultSelect = h(
    'select',
    { id: 'catapult-target' },
    CATAPULT_TARGETS.map((id) => h('option', { value: id }, BUILDINGS[id].name)),
  );
  catapultSelect.addEventListener('change', () => refresh());
  const catapultRow = h('div', { class: 'form-row' }, h('label', { for: 'catapult-target' }, 'Mancınık hedefi'), catapultSelect);

  const empty = h('p', { class: 'muted' }, 'Köyde asker yok. Ordu sekmesinden asker eğitebilirsin.');
  const envoyHint = h('p', { class: 'intel' });
  const lastAttack = h('p', { class: 'muted' });
  const intel = h('p', { class: 'intel' });
  const summary = h('div', { class: 'stats' });
  const status = h('p', { class: 'card-status' });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Saldır');
  const allButton = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: fillAll }, 'Tüm birlikler');
  const clearButton = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: clear }, 'Temizle');
  const lastArmyButton = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: fillLastArmy }, 'Son orduyu kullan');

  const el = h(
    'form',
    { class: 'attack-form stack-sm', onsubmit: onSubmit },
    h('h4', { class: 'info-subtitle' }, 'Birlik gönder'),
    intel,
    lastAttack,
    empty,
    h('div', { class: 'send-grid' }, UNIT_IDS.map((id) => rows[id].row)),
    catapultRow,
    envoyHint,
    h('p', { class: 'muted hint' }, 'Yalnız gözcü gönderirsen casusluk yapılır: köyün askerleri, kaynakları ve binaları görünür.'),
    summary,
    h('div', { class: 'form-row' }, submit, allButton, lastArmyButton, clearButton),
    status,
  );
  el.hidden = true;

  const readUnits = () => Object.fromEntries(UNIT_IDS.map((id) => [id, Number(rows[id].input.value || 0)]));
  const options = () => ({ catapultTarget: catapultSelect.value });
  const latest = (type) => (target ? game.state.reports.find((r) => r.type === type && r.target.id === target.id) : null);

  function fillAll() {
    // Gözcüler savaşamaz; "tüm birlikler" onları dışarıda bırakır.
    for (const id of UNIT_IDS) rows[id].input.value = String(UNITS[id].attack > 0 ? game.village.units[id] : 0);
    refresh();
  }

  function clear() {
    for (const id of UNIT_IDS) rows[id].input.value = '0';
    refresh();
  }

  /** Bu köye gönderilen son orduyu (ve mancınık hedefini) köyde olduğu kadarıyla forma yazar. */
  function fillLastArmy() {
    const report = latest('saldiri');
    if (!report) return;
    for (const id of UNIT_IDS) rows[id].input.value = String(Math.min(report.attackers[id] ?? 0, game.village.units[id]));
    if (report.catapultTarget) catapultSelect.value = report.catapultTarget;
    refresh();
  }

  function onSubmit(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.sendAttack(target.x, target.y, readUnits(), now, options());
    if (result.ok) {
      const what = result.mission === 'casus' ? `${fmtInt(result.units.gozcu)} gözcü` : `${fmtInt(totalUnits(result.units))} asker`;
      toast(`${what} ${result.target.name} köyüne yola çıktı. Varış ${fmtClock(result.arriveAt, now)}.`, 'success');
      for (const id of UNIT_IDS) rows[id].input.value = '0';
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
  }

  function renderIntel(now) {
    const report = latest('casus');
    const known = report?.intel;
    intel.hidden = !known;
    if (!known) return;
    const units = Object.entries(known.units).filter(([, n]) => n > 0).map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`);
    const resources = RESOURCE_IDS.map((id) => fmtInt(known.resources[id])).join(' / ');
    setText(
      intel,
      `Casus raporu (${fmtClock(report.at, now)}): ${units.length ? units.join(', ') : 'asker yok'} · ` +
        `kaynak ${resources}${known.hidden ? ` (gizli ${fmtInt(known.hidden)})` : ''} · ` +
        `${known.buildings.sur ? `sur ${known.buildings.sur}. seviye` : 'sur yok'}`,
    );
  }

  function renderLastAttack(now) {
    const report = latest('saldiri');
    lastAttack.hidden = !report;
    lastArmyButton.hidden = !report;
    if (!report) return;
    const left = Object.entries(report.defenders)
      .map(([id, n]) => [id, n - (report.defenderLosses[id] ?? 0)])
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`);
    setText(
      lastAttack,
      `Son saldırı ${fmtClock(report.at, now)}: ${report.attackerWins ? 'zafer' : 'yenilgi'}. ` +
        (left.length ? `Savunmada ${left.join(', ')} kaldı.` : 'Savunmada kimse kalmadı.'),
    );
  }

  return {
    el,
    /** Hedef barbar köyü {x, y, id}; null ise form gizlenir. */
    setTarget(next) {
      if (next?.id !== target?.id) clear();
      target = next;
      el.hidden = !target;
    },
    update(now) {
      if (!target) return;
      const village = game.village;
      let available = 0;
      for (const id of UNIT_IDS) {
        const home = village.units[id];
        available += home;
        setText(rows[id].all, `(${fmtInt(home)})`);
        rows[id].row.hidden = home === 0 && Number(rows[id].input.value || 0) === 0;
      }
      empty.hidden = available > 0;
      renderIntel(now);
      renderLastAttack(now);

      const check = inspectAttack(game.state, village, target.x, target.y, readUnits(), now, options());
      catapultRow.hidden = !check.units.mancinik;
      const envoys = check.units.elci ?? 0;
      envoyHint.hidden = !envoys;
      if (envoys) {
        const [min, max] = CONQUEST.loyaltyDrop;
        setText(
          envoyHint,
          `${envoys} Elçi, saldırı kazanılırsa bağlılığı ${envoys * min}–${envoys * max} düşürür. ` +
            `Köyün bağlılığı şu an ${fmtInt(loyaltyOf(game.state, target.id))}; sıfırlanınca köy senin olur.`,
        );
      }
      const chosen = totalUnits(check.units) > 0;
      summary.hidden = !chosen;
      if (chosen) {
        summary.replaceChildren(
          ...(check.mission === 'casus'
            ? [h('span', { class: 'muted' }, 'Casusluk')]
            : [stat('saldiri', 'Saldırı gücü', fmtInt(check.attack)), stat('tasima', 'Taşıma kapasitesi', fmtInt(check.carry))]),
          stat('saat', 'Yolculuk süresi (tek yön)', fmtDuration(check.seconds)),
          h('span', { class: 'muted' }, `varış ${fmtClock(check.arriveAt, now)}`),
        );
      }
      setText(submit, check.mission === 'casus' ? 'Casus gönder' : 'Saldır');
      submit.disabled = !check.ok;
      setText(status, check.ok || check.code === 'empty' ? '' : check.reason);
    },
  };
}

function stat(iconName, title, value) {
  return h('span', { class: 'stat', title }, icon(iconName), value);
}
