import { UNITS, UNIT_IDS } from '../../config/units.js';
import { RESOURCE_IDS, RESOURCES } from '../../config/resources.js';
import { BUILDINGS } from '../../config/buildings.js';
import { inspectAttack } from '../../systems/movements.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtClock } from '../format.js';
import { toast } from '../toast.js';

const FILTERS = {
  tumu: { label: 'Tümü', match: () => true },
  okunmamis: { label: 'Okunmamış', match: (r) => !r.read },
  zafer: { label: 'Zafer', match: (r) => r.type === 'saldiri' && r.attackerWins },
  yenilgi: { label: 'Yenilgi', match: (r) => r.type === 'saldiri' && !r.attackerWins },
  casus: { label: 'Casusluk', match: (r) => r.type === 'casus' },
};

/**
 * Raporlar: her saldırının sonucu, kayıpları ve ganimeti. Açılan rapor okunmuş sayılır.
 * Raporlar süzülebilir, silinebilir ve aynı orduyla tek tıkla tekrarlanabilir.
 */
export function createReportsView({ game, refresh }) {
  let filter = 'tumu';
  const filterButtons = {};
  const filterBar = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Raporları süz' },
    Object.entries(FILTERS).map(([key, { label }]) => {
      const count = h('span', { class: 'segment-count' });
      const button = h('button', { type: 'button', class: 'segment', dataset: { filter: key } }, label, count);
      filterButtons[key] = { button, count };
      return button;
    }),
  );
  const markAll = h('button', { class: 'btn btn-small btn-ghost', type: 'button' }, 'Tümünü okundu say');
  const deleteRead = h('button', { class: 'btn btn-small btn-ghost', type: 'button' }, 'Okunanları sil');
  const list = h('div', { class: 'stack-sm' });
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Raporlar')),
    h('div', { class: 'toolbar' }, filterBar, h('div', { class: 'form-row' }, markAll, deleteRead)),
    list,
  );
  const items = new Map(); // rapor numarası → { item: <details>, repeat: <button> }
  let signature = null;

  filterBar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    refresh();
  });

  markAll.addEventListener('click', () => {
    game.markReportsRead(game.state.reports.map((r) => r.id));
    refresh();
  });

  deleteRead.addEventListener('click', () => {
    const read = game.state.reports.filter((r) => r.read).map((r) => r.id);
    if (!read.length || !confirm(`${read.length} okunmuş rapor silinecek. Emin misin?`)) return;
    game.deleteReports(read);
    refresh();
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.report);
    const now = Date.now();
    if (button.dataset.action === 'delete') {
      game.deleteReports([id]);
    } else if (button.dataset.action === 'repeat') {
      const result = game.repeatAttack(id, now);
      if (result.ok) toast(`Ordu ${result.target.name} köyüne yeniden yola çıktı. Varış ${fmtClock(result.arriveAt, now)}.`, 'success');
      else toast(result.reason, 'error');
    }
    refresh(now);
  });

  function rebuild(reports, now) {
    // Yeniden çizimde açık raporlar açık kalsın.
    const open = new Set([...items].filter(([, { item }]) => item.open).map(([id]) => id));
    items.clear();
    if (!reports.length) {
      const empty = game.state.reports.length
        ? 'Bu süzgece uyan rapor yok.'
        : 'Henüz rapor yok. Haritadan bir barbar köyü seçip saldırı gönderebilirsin.';
      list.replaceChildren(h('div', { class: 'panel' }, h('p', { class: 'muted' }, empty)));
      return;
    }
    list.replaceChildren(
      ...reports.map((report) => {
        const { item, repeat } = renderReport(report, now);
        item.open = open.has(report.id);
        item.addEventListener('toggle', () => {
          if (item.open && !report.read) {
            game.markReportsRead([report.id]);
            refresh();
          }
        });
        items.set(report.id, { item, repeat });
        return item;
      }),
    );
  }

  return {
    el,
    update(now) {
      const all = game.state.reports;
      for (const [key, { button, count }] of Object.entries(filterButtons)) {
        button.classList.toggle('active', key === filter);
        button.setAttribute('aria-pressed', String(key === filter));
        setText(count, String(all.filter(FILTERS[key].match).length));
      }
      // Açık rapor süzgece artık uymasa da (ör. "Okunmamış"ta açılınca okundu olur) okunurken kaybolmasın.
      const reports = all.filter((r) => FILTERS[filter].match(r) || items.get(r.id)?.item.open);
      const next = `${filter}:${reports.map((r) => r.id).join('|')}`;
      if (next !== signature) {
        signature = next;
        rebuild(reports, now);
      }
      for (const report of reports) {
        const entry = items.get(report.id);
        if (!entry) continue;
        entry.item.classList.toggle('unread', !report.read);
        const check = inspectAttack(game.state, game.village, report.target.x, report.target.y, report.attackers, now);
        entry.repeat.disabled = !check.ok;
        entry.repeat.title = check.ok ? 'Aynı orduyu aynı köye yeniden gönder' : check.reason;
      }
      markAll.disabled = !all.some((r) => !r.read);
      deleteRead.disabled = !all.some((r) => r.read);
    },
  };
}

function renderReport(report, now) {
  return report.type === 'casus' ? renderSpyReport(report, now) : renderAttackReport(report, now);
}

/** Rapor altındaki düğmeler: tekrar gönder, haritada göster, sil. */
function reportActions(report, repeatLabel) {
  const repeat = h('button', { class: 'btn btn-small', type: 'button', dataset: { action: 'repeat', report: report.id } }, repeatLabel);
  const row = h(
    'div',
    { class: 'form-row' },
    repeat,
    h('a', { class: 'btn btn-small btn-ghost', href: `#/harita/${report.target.x}/${report.target.y}` }, 'Haritada göster'),
    h('button', { class: 'btn btn-small btn-ghost btn-quiet', type: 'button', dataset: { action: 'delete', report: report.id } }, 'Sil'),
  );
  return { row, repeat };
}

function renderSpyReport(report, now) {
  const sent = report.attackers.gozcu;
  const lost = report.attackerLosses.gozcu;
  const { intel } = report;
  const { row, repeat } = reportActions(report, 'Tekrar gönder');
  const body = [
    h('p', { class: 'muted' }, `${fmtInt(sent)} gözcü gönderildi, ${lost ? `${fmtInt(lost)} tanesi yakalandı` : 'hepsi döndü'}. Köyde ${fmtInt(report.defenders.gozcu)} nöbetçi gözcü vardı.`),
  ];
  if (intel) {
    const units = UNIT_IDS.filter((id) => intel.units[id] > 0);
    body.push(
      h('h4', { class: 'info-subtitle' }, 'Askerler'),
      units.length
        ? h('div', { class: 'stats' }, units.map((id) => h('span', { class: 'unit-cell' }, h('span', { class: 'unit-icon small' }, icon(id)), `${fmtInt(intel.units[id])} ${UNITS[id].name}`)))
        : h('p', { class: 'muted' }, 'Köyde asker yok.'),
      h('h4', { class: 'info-subtitle' }, 'Kaynaklar'),
      h(
        'div',
        { class: 'cost' },
        RESOURCE_IDS.map((id) => h('span', { class: 'cost-item', title: RESOURCES[id].name }, icon(id), fmtInt(intel.resources[id]))),
        intel.hidden ? h('span', { class: 'muted' }, `(gizli depoda ${fmtInt(intel.hidden)} korunuyor)`) : null,
      ),
      h('h4', { class: 'info-subtitle' }, 'Binalar'),
      h(
        'ul',
        { class: 'building-levels' },
        Object.entries(intel.buildings).map(([id, level]) => h('li', null, BUILDINGS[id].name, h('strong', null, String(level)))),
      ),
    );
  } else {
    body.push(h('p', null, 'Gözcülerin hepsi yakalandı; bilgi alınamadı. Daha fazla gözcü göndermeyi dene.'));
  }
  body.push(row);

  const item = h(
    'details',
    { class: 'panel report' },
    h(
      'summary',
      null,
      h('span', { class: `badge ${intel ? 'badge-spy' : 'badge-loss'}` }, intel ? 'Casusluk' : 'Başarısız'),
      h('span', { class: 'report-title' }, `${report.origin.name} → ${report.target.name} (${report.target.x}|${report.target.y})`),
      h('span', { class: 'muted report-meta' }, fmtClock(report.at, now)),
    ),
    h('div', { class: 'report-body stack-sm' }, body),
  );
  return { item, repeat };
}

function renderAttackReport(report, now) {
  const lootTotal = RESOURCE_IDS.reduce((total, id) => total + report.loot[id], 0);
  const luck = Math.round(report.luck * 100);
  const units = UNIT_IDS.filter((id) => report.attackers[id] || report.defenders[id]);
  const { row: actions, repeat } = reportActions(report, 'Tekrar saldır');
  const siege = [];
  if (report.siege?.wall) {
    const { from, to } = report.siege.wall;
    siege.push(
      from === to
        ? from ? `Koçbaşılar sura zarar veremedi (${from}. seviye).` : 'Köyde yıkılacak sur yoktu.'
        : to === 0 ? `Koçbaşılar suru tamamen yıktı (${from}. seviyeydi).` : `Koçbaşılar suru ${from}. seviyeden ${to}. seviyeye indirdi.`,
    );
  }
  if (report.siege?.catapult) {
    const { building, from, to } = report.siege.catapult;
    const name = BUILDINGS[building].name;
    siege.push(
      from === to
        ? `Mancınıklar ${name} binasına zarar veremedi (${from}. seviye).`
        : to === 0 ? `Mancınıklar ${name} binasını tamamen yıktı (${from}. seviyeydi).` : `Mancınıklar ${name} binasını ${from}. seviyeden ${to}. seviyeye indirdi.`,
    );
  }

  const item = h(
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
      siege.map((line) => h('p', { class: 'siege-line' }, line)),
      actions,
    ),
  );
  return { item, repeat };
}

function cell(value, loss = false) {
  const n = value ?? 0;
  return h('td', { class: `num${loss && n > 0 ? ' loss' : ''}` }, n ? fmtInt(n) : '—');
}
