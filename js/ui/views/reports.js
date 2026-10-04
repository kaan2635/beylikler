import { UNITS, UNIT_IDS } from '../../config/units.js';
import { RESOURCE_IDS, RESOURCES } from '../../config/resources.js';
import { BUILDINGS } from '../../config/buildings.js';
import { inspectAttack } from '../../systems/movements.js';
import { inspectExpedition } from '../../systems/expedition.js';
import { EXPEDITION_OUTCOMES, REGIONS } from '../../config/expedition.js';
import { RARITIES, ITEM_SLOTS } from '../../config/hero.js';
import { FORMATIONS } from '../../config/formations.js';
import { outcomeTone, expeditionSummary } from './expedition.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtClock } from '../format.js';
import { toast } from '../toast.js';

const FILTERS = {
  tumu: { label: 'Tümü', match: () => true },
  okunmamis: { label: 'Okunmamış', match: (r) => !r.read },
  zafer: { label: 'Zafer', match: (r) => isBattle(r) && playerWon(r) },
  yenilgi: { label: 'Yenilgi', match: (r) => isBattle(r) && !playerWon(r) },
  savunma: { label: 'Savunma', match: (r) => r.type === 'savunma' },
  casus: { label: 'Casusluk', match: (r) => r.type === 'casus' },
  kesif: { label: 'Keşif', match: (r) => r.type === 'kesif' },
};

const isBattle = (report) => report.type === 'saldiri' || report.type === 'savunma';

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
    } else if (button.dataset.action === 'repeat-expedition') {
      const result = game.repeatExpedition(id, now);
      if (result.ok) toast(`Birlik yeniden keşfe çıktı. Keşif ${fmtClock(result.arriveAt, now)} tamamlanır.`, 'success');
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
        if (!entry.repeat) continue; // savunma raporlarında tekrar yok
        const check =
          report.type === 'kesif'
            ? inspectExpedition(game.state, game.village, report.attackers, report.holdHours, now, { region: report.region })
            : inspectAttack(game.state, game.village, report.target.x, report.target.y, report.attackers, now);
        entry.repeat.disabled = !check.ok;
        entry.repeat.title = check.ok ? (report.type === 'kesif' ? 'Aynı birliği aynı süreyle yeniden keşfe gönder' : 'Aynı orduyu aynı köye yeniden gönder') : check.reason;
      }
      markAll.disabled = !all.some((r) => !r.read);
      deleteRead.disabled = !all.some((r) => r.read);
    },
  };
}

/** Rapor oyuncu açısından başarılı mı? Savunmada saldıranın yenilmesi zaferdir. */
function playerWon(report) {
  return report.type === 'savunma' ? !report.attackerWins : report.attackerWins;
}

function renderReport(report, now) {
  if (report.type === 'kesif') return renderExpeditionReport(report, now);
  if (report.type === 'bildirim') return renderNotice(report, now);
  return report.type === 'casus' ? renderSpyReport(report, now) : renderAttackReport(report, now);
}

/** Bildirim: başka bir oyuncunun casusluğu gibi kısa haberler. */
function renderNotice(report, now) {
  const item = h(
    'details',
    { class: 'panel report' },
    h(
      'summary',
      null,
      h('span', { class: 'badge badge-spy' }, 'Bildirim'),
      h('span', { class: 'report-title' }, `${placeLabel(report.origin)} → ${report.target.name}`),
      h('span', { class: 'muted report-meta' }, fmtClock(report.at, now)),
    ),
    h(
      'div',
      { class: 'report-body stack-sm' },
      h('p', null, report.text),
      h(
        'div',
        { class: 'form-row' },
        h('a', { class: 'btn btn-small', href: `#/harita/${report.origin.x}/${report.origin.y}` }, 'Karşılık ver'),
        h('button', { class: 'btn btn-small btn-ghost btn-quiet', type: 'button', dataset: { action: 'delete', report: report.id } }, 'Sil'),
      ),
    ),
  );
  return { item, repeat: null };
}

/** Keşif seferi raporu: anlatı, bulunanlar, kayıplar ve varsa eşkıya savaşı. */
function renderExpeditionReport(report, now) {
  const outcome = EXPEDITION_OUTCOMES[report.outcome];
  const tone = outcomeTone(report.outcome);
  const lootTotal = RESOURCE_IDS.reduce((total, id) => total + report.loot[id], 0);
  const repeat = h('button', { class: 'btn btn-small', type: 'button', dataset: { action: 'repeat-expedition', report: report.id } }, 'Tekrar keşfe çık');
  const sent = UNIT_IDS.filter((id) => report.attackers[id]).map((id) => `${fmtInt(report.attackers[id])} ${UNITS[id].name}`);
  const body = [
    h('p', { class: 'expedition-text' }, report.text),
    report.note ? h('p', { class: 'muted' }, report.note) : null,
    h('p', { class: 'muted' }, `Sefer: ${sent.join(', ')} · ${report.holdHours} saat keşif${report.region ? ` · ${REGIONS[report.region]?.name ?? ''}` : ''}${report.hero ? ` · Kahraman ${report.hero.name}` : ''}`),
  ];
  if (report.item) body.push(itemLine(report.item, 'Kahramanın heybesine girdi'));
  if (report.renown) body.push(h('p', { class: 'cost' }, icon('san'), h('strong', null, `+${report.renown} şan`), ' beyliğin adı yayıldı.'));
  if (lootTotal) {
    body.push(
      h(
        'div',
        { class: 'cost' },
        h('span', { class: 'muted' }, 'Getirilen:'),
        RESOURCE_IDS.map((id) => h('span', { class: 'cost-item', title: RESOURCES[id].name }, icon(id), fmtInt(report.loot[id]))),
      ),
    );
  }
  const found = Object.entries(report.found ?? {});
  if (found.length) body.push(h('p', null, `Katılan: ${found.map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`).join(', ')}`));
  if (report.akce) body.push(h('p', { class: 'cost' }, icon('akce'), h('strong', null, `${fmtInt(report.akce)} Akçe`), ' hazineye eklendi.'));
  if (report.bandits) {
    const bandits = Object.entries(report.bandits.units).filter(([, n]) => n > 0).map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`);
    body.push(h('p', { class: 'muted' }, `Eşkıya: ${bandits.join(', ')}`));
  }
  const lost = Object.entries(report.attackerLosses ?? {}).filter(([, n]) => n > 0);
  if (lost.length) body.push(h('p', { class: 'loss' }, `Kayıplar: ${lost.map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`).join(', ')}`));
  body.push(
    h(
      'div',
      { class: 'form-row' },
      repeat,
      h('a', { class: 'btn btn-small btn-ghost', href: '#/kesif' }, 'Keşif sayfası'),
      h('button', { class: 'btn btn-small btn-ghost btn-quiet', type: 'button', dataset: { action: 'delete', report: report.id } }, 'Sil'),
    ),
  );

  const item = h(
    'details',
    { class: 'panel report' },
    h(
      'summary',
      null,
      h('span', { class: `badge ${tone === 'good' ? 'badge-win' : tone === 'bad' ? 'badge-loss' : 'badge-neutral'}` }, outcome.name),
      h('span', { class: 'report-title' }, `${report.origin.name} → ${report.target.name}`),
      h('span', { class: 'muted report-meta' }, `${fmtClock(report.at, now)} ${expeditionSummary(report)}`),
    ),
    h('div', { class: 'report-body stack-sm' }, body),
  );
  return { item, repeat };
}

/** Köy adı; bey hisarlarında sahibiyle: "Germiyan Bey (Germiyan Hisarı)". */
function placeLabel(place) {
  return place.owner ? `${place.owner} (${place.name})` : place.name;
}

/**
 * Rapor altındaki düğmeler: tekrar gönder, haritada göster, sil. Savunma raporunda tekrar
 * yerine saldıranın hisarına giden "Karşı saldırı" bağlantısı olur.
 */
function reportActions(report, repeatLabel) {
  const defense = report.type === 'savunma';
  const place = defense ? report.origin : report.target;
  const event = report.target?.id === 'haydut'; // olaydaki haydut savaşı: tekrarı ve haritası yok
  const repeat = defense || event
    ? null
    : h('button', { class: 'btn btn-small', type: 'button', dataset: { action: 'repeat', report: report.id } }, repeatLabel);
  const row = h(
    'div',
    { class: 'form-row' },
    repeat,
    event ? null : h('a', { class: `btn btn-small${defense ? '' : ' btn-ghost'}`, href: `#/harita/${place.x}/${place.y}` }, defense ? 'Karşı saldırı' : 'Haritada göster'),
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
      h('span', { class: 'report-title' }, `${report.origin.name} → ${placeLabel(report.target)} (${report.target.x}|${report.target.y})`),
      h('span', { class: 'muted report-meta' }, fmtClock(report.at, now)),
    ),
    h('div', { class: 'report-body stack-sm' }, body),
  );
  return { item, repeat };
}

/** Saldırı ve savunma raporu (savunmada saldıran bir beydir, kayıplar senin askerlerindir). */
function renderAttackReport(report, now) {
  const defense = report.type === 'savunma';
  const won = playerWon(report);
  const badgeText = defense ? (won ? 'Savunma: zafer' : 'Savunma: yenilgi') : won ? 'Zafer' : 'Yenilgi';
  const other = defense ? report.origin : report.target;
  const lootLabel = defense ? 'yağmalanan' : 'ganimet';
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
      h('span', { class: `badge ${won ? 'badge-win' : 'badge-loss'}` }, badgeText),
      h('span', { class: 'report-title' }, `${placeLabel(report.origin)} → ${placeLabel(report.target)} (${other.x}|${other.y})`),
      h('span', { class: 'muted report-meta' }, `${fmtClock(report.at, now)}${lootTotal ? ` · ${lootLabel} ${fmtInt(lootTotal)}` : ''}`),
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
        FORMATIONS[report.formation] ? h('span', { class: 'muted' }, `Düzen: ${FORMATIONS[report.formation].name}`) : null,
        report.hero ? h('span', { class: 'stat', title: 'Savaşa katılan kahraman' }, icon('nav-kahraman'), report.hero.name) : null,
      ),
      balance(report),
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
        h('span', { class: 'muted' }, defense ? 'Yağmalanan:' : 'Ganimet:'),
        lootTotal
          ? RESOURCE_IDS.map((id) => h('span', { class: 'cost-item', title: RESOURCES[id].name }, icon(id), fmtInt(report.loot[id])))
          : h('span', { class: 'muted' }, 'yok'),
      ),
      siege.map((line) => h('p', { class: 'siege-line' }, line)),
      report.reward?.akce ? h('p', { class: 'cost' }, icon('akce'), h('strong', null, `${fmtInt(report.reward.akce)} Akçe`), ' hazineye eklendi.') : null,
      report.reward?.item ? itemLine(report.reward.item, report.reward.sold ? `Heybe dolu olduğu için ${report.reward.sold} Akçeye satıldı` : 'Kahramanın heybesine girdi') : null,
      report.conquest
        ? h(
            'p',
            { class: `siege-line${report.conquest.conquered ? ' conquest' : ''}` },
            report.conquest.lostVillage
              ? 'Köyünün bağlılığı sıfırlandı; köy artık düşmanın.'
              : report.conquest.capital
                ? 'Başkent fethedilemez; elçiler etkisiz kaldı.'
                : report.conquest.conquered
                  ? `Köy fethedildi! Bağlılık ${report.conquest.from} → 0. Sağ kalan askerler yeni köyde destek olarak kaldı.`
                  : `Elçiler bağlılığı düşürdü: ${report.conquest.from} → ${report.conquest.to}.`,
          )
        : null,
      actions,
    ),
  );
  return { item, repeat };
}

/** Saldırı ve savunma gücünü yan yana gösteren terazi. */
function balance(report) {
  const total = Math.max(1, report.attack + report.defense);
  const share = Math.round((report.attack / total) * 100);
  return h(
    'div',
    { class: 'balance', title: `Saldırı %${share} · Savunma %${100 - share}` },
    h('span', { class: 'balance-attack', style: `width:${share}%` }),
    h('span', { class: 'balance-defense', style: `width:${100 - share}%` }),
  );
}

/** Bulunan eşya satırı: nadirlik renginde ad ve etkiler. */
function itemLine(item, note) {
  return h(
    'p',
    { class: `item-line rarity-${item.rarity}` },
    icon(ITEM_SLOTS[item.slot]?.icon ?? 'nisan'),
    h('strong', { class: 'item-name' }, item.name),
    h('span', { class: 'item-rarity' }, ` ${RARITIES[item.rarity].name} ${ITEM_SLOTS[item.slot]?.name.toLowerCase() ?? ''}`),
    h('span', { class: 'muted' }, ` · ${note}`),
  );
}

function cell(value, loss = false) {
  const n = value ?? 0;
  return h('td', { class: `num${loss && n > 0 ? ' loss' : ''}` }, n ? fmtInt(n) : '—');
}
