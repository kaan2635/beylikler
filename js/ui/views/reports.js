import { UNITS, UNIT_IDS } from '../../config/units.js';
import { RESOURCE_IDS, RESOURCES } from '../../config/resources.js';
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtClock } from '../format.js';

/** Raporlar: her saldırının sonucu, kayıpları ve ganimeti. Açılan rapor okunmuş sayılır. */
export function createReportsView({ game, refresh }) {
  const list = h('div', { class: 'stack-sm' });
  const markAll = h('button', { class: 'btn btn-small btn-ghost', type: 'button' }, 'Tümünü okundu say');
  const el = h('section', { class: 'stack' }, h('header', { class: 'view-header' }, h('h1', null, 'Raporlar'), markAll), list);
  const items = new Map(); // rapor numarası → <details>
  let signature = null;

  markAll.addEventListener('click', () => {
    game.markReportsRead(game.state.reports.map((r) => r.id));
    refresh();
  });

  function rebuild(reports, now) {
    // Yeniden çizimde açık raporlar açık kalsın.
    const open = new Set([...items].filter(([, item]) => item.open).map(([id]) => id));
    items.clear();
    list.replaceChildren(
      ...(reports.length
        ? reports.map((report) => {
            const item = renderReport(report, now);
            item.open = open.has(report.id);
            item.addEventListener('toggle', () => {
              if (item.open && !report.read) {
                game.markReportsRead([report.id]);
                refresh();
              }
            });
            items.set(report.id, item);
            return item;
          })
        : [h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Henüz rapor yok. Haritadan bir barbar köyü seçip saldırı gönderebilirsin.'))]),
    );
  }

  return {
    el,
    update(now) {
      const reports = game.state.reports;
      const next = reports.map((r) => r.id).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(reports, now);
      }
      for (const report of reports) items.get(report.id)?.classList.toggle('unread', !report.read);
      markAll.disabled = !reports.some((r) => !r.read);
    },
  };
}

function renderReport(report, now) {
  const lootTotal = RESOURCE_IDS.reduce((total, id) => total + report.loot[id], 0);
  const luck = Math.round(report.luck * 100);
  const units = UNIT_IDS.filter((id) => report.attackers[id] || report.defenders[id]);

  return h(
    'details',
    { class: 'panel report' },
    h(
      'summary',
      null,
      h('span', { class: `badge ${report.attackerWins ? 'badge-win' : 'badge-loss'}` }, report.attackerWins ? 'Zafer' : 'Yenilgi'),
      h('span', { class: 'report-title' }, `${report.origin.name} → ${report.target.name} (${report.target.x}|${report.target.y})`),
      h('span', { class: 'muted report-meta' }, `${fmtClock(report.at, now)}${lootTotal ? ` · ganimet ${fmtInt(lootTotal)}` : ''}`),
    ),
    h(
      'div',
      { class: 'report-body stack-sm' },
      h(
        'div',
        { class: 'stats' },
        h('span', { class: 'stat', title: 'Saldırı gücü (şans dahil)' }, icon('saldiri'), fmtInt(report.attack)),
        h('span', { class: 'stat', title: 'Savunma gücü (sur ve köylüler dahil)' }, icon('savunma'), fmtInt(report.defense)),
        h('span', { class: 'muted' }, `Şans ${luck > 0 ? '+' : luck < 0 ? '−' : ''}%${Math.abs(luck)}`),
        h('span', { class: 'muted' }, report.wallLevel ? `Sur ${report.wallLevel}. seviye` : 'Sur yok'),
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, 'Birim'),
              h('th', { class: 'num' }, 'Saldıran'),
              h('th', { class: 'num' }, 'Kayıp'),
              h('th', { class: 'num' }, 'Savunan'),
              h('th', { class: 'num' }, 'Kayıp'),
            ),
          ),
          h(
            'tbody',
            null,
            units.map((id) =>
              h(
                'tr',
                null,
                h('td', null, h('span', { class: 'unit-cell' }, h('span', { class: 'unit-icon small' }, icon(id)), UNITS[id].name)),
                cell(report.attackers[id]),
                cell(report.attackerLosses[id], true),
                cell(report.defenders[id]),
                cell(report.defenderLosses[id], true),
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'cost' },
        h('span', { class: 'muted' }, 'Ganimet:'),
        lootTotal
          ? RESOURCE_IDS.map((id) => h('span', { class: 'cost-item', title: RESOURCES[id].name }, icon(id), fmtInt(report.loot[id])))
          : h('span', { class: 'muted' }, 'yok'),
      ),
      h('a', { class: 'card-link', href: `#/harita/${report.target.x}/${report.target.y}` }, 'Haritada göster ve tekrar saldır →'),
    ),
  );
}

function cell(value, loss = false) {
  const n = value ?? 0;
  return h('td', { class: `num${loss && n > 0 ? ' loss' : ''}` }, n ? fmtInt(n) : '—');
}
