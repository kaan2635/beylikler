import { UNITS, UNIT_IDS } from '../../config/units.js';
import { inspectAttack, totalUnits } from '../../systems/movements.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

/** Haritada seçilen barbar köyüne asker gönderme formu. */
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

  const empty = h('p', { class: 'muted' }, 'Köyde asker yok. Ordu sekmesinden asker eğitebilirsin.');
  const lastReport = h('p', { class: 'muted' });
  const summary = h('div', { class: 'stats' });
  const status = h('p', { class: 'card-status' });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Saldır');
  const allButton = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: fillAll }, 'Tüm birlikler');
  const clearButton = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: clear }, 'Temizle');
  const lastArmyButton = h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: fillLastArmy }, 'Son orduyu kullan');

  const el = h(
    'form',
    { class: 'attack-form stack-sm', onsubmit: onSubmit },
    h('h4', { class: 'info-subtitle' }, 'Saldırı gönder'),
    lastReport,
    empty,
    h('div', { class: 'send-grid' }, UNIT_IDS.map((id) => rows[id].row)),
    summary,
    h('div', { class: 'form-row' }, submit, allButton, lastArmyButton, clearButton),
    status,
  );
  el.hidden = true;

  const readUnits = () => Object.fromEntries(UNIT_IDS.map((id) => [id, Number(rows[id].input.value || 0)]));

  function fillAll() {
    // Gözcüler savaşamaz; "tüm birlikler" onları dışarıda bırakır.
    for (const id of UNIT_IDS) rows[id].input.value = String(UNITS[id].attack > 0 ? game.village.units[id] : 0);
    refresh();
  }

  function clear() {
    for (const id of UNIT_IDS) rows[id].input.value = '0';
    refresh();
  }

  /** Bu köye gönderilen son orduyu, köyde olduğu kadarıyla forma yazar. */
  function fillLastArmy() {
    const report = lastReportFor(target);
    if (!report) return;
    for (const id of UNIT_IDS) rows[id].input.value = String(Math.min(report.attackers[id] ?? 0, game.village.units[id]));
    refresh();
  }

  function lastReportFor(village) {
    return village ? game.state.reports.find((r) => r.target.id === village.id) : null;
  }

  function onSubmit(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.sendAttack(target.x, target.y, readUnits(), now);
    if (result.ok) {
      const count = fmtInt(totalUnits(result.units));
      toast(`${count} asker ${result.target.name} köyüne yola çıktı. Varış ${fmtClock(result.arriveAt, now)}.`, 'success');
      for (const id of UNIT_IDS) rows[id].input.value = '0';
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
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

      const report = lastReportFor(target);
      lastReport.hidden = !report;
      lastArmyButton.hidden = !report;
      if (report) {
        const left = Object.entries(report.defenders)
          .map(([id, n]) => [id, n - report.defenderLosses[id]])
          .filter(([, n]) => n > 0)
          .map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`);
        setText(
          lastReport,
          `Son saldırı ${fmtClock(report.at, now)}: ${report.attackerWins ? 'zafer' : 'yenilgi'}. ` +
            (left.length ? `Savunmada ${left.join(', ')} kaldı.` : 'Savunmada kimse kalmadı.'),
        );
      }

      const check = inspectAttack(game.state, village, target.x, target.y, readUnits(), now);
      const chosen = totalUnits(check.units) > 0;
      summary.hidden = !chosen;
      if (chosen) {
        summary.replaceChildren(
          stat('saldiri', 'Saldırı gücü', fmtInt(check.attack)),
          stat('tasima', 'Taşıma kapasitesi', fmtInt(check.carry)),
          stat('saat', 'Yolculuk süresi (tek yön)', fmtDuration(check.seconds)),
          h('span', { class: 'muted' }, `varış ${fmtClock(check.arriveAt, now)}`),
        );
      }
      submit.disabled = !check.ok;
      setText(status, check.ok || check.code === 'empty' ? '' : check.reason);
    },
  };
}

function stat(iconName, title, value) {
  return h('span', { class: 'stat', title }, icon(iconName), value);
}
