import { UNITS, UNIT_IDS } from '../../config/units.js';
import { EXPEDITION, EXPEDITION_OUTCOMES } from '../../config/expedition.js';
import { RESOURCE_IDS } from '../../config/resources.js';
import {
  inspectExpedition,
  expeditionOdds,
  expeditionScale,
  expeditionSlots,
  expeditionsUnderway,
} from '../../systems/expedition.js';
import { totalUnits } from '../../systems/army.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

const SENDABLE = UNIT_IDS.filter((id) => !EXPEDITION.excluded.includes(id));

/**
 * Keşif seferleri sayfası: birlik ve keşif süresi seçimi, olası sonuçların olasılıkları,
 * yoldaki seferler ve son keşif raporları.
 */
export function createExpeditionView({ game, refresh }) {
  const slotsBadge = h('span', { class: 'badge' });
  const noBuilding = h(
    'section',
    { class: 'panel stack-sm' },
    h('h2', null, 'Kervansaray gerekli'),
    h('p', null, 'Keşif seferleri Kervansaraydan düzenlenir. Kervansaray için Konak 5 ve Ahır 1 gerekir.'),
    h('a', { class: 'card-link', href: '#/koy' }, 'Köy ekranından inşa et →'),
  );

  // ---------- Form ----------
  const rows = {};
  for (const id of SENDABLE) {
    const input = h('input', { type: 'number', min: 0, value: 0, inputmode: 'numeric', 'aria-label': `Sefere gidecek ${UNITS[id].name}` });
    const all = h('button', { type: 'button', class: 'link-btn' });
    all.addEventListener('click', () => {
      input.value = String(game.village.units[id]);
      refresh();
    });
    input.addEventListener('input', () => refresh());
    rows[id] = { row: h('div', { class: 'send-row' }, h('span', { class: 'unit-icon small' }, icon(id)), h('span', null, UNITS[id].name), all, input), input, all };
  }
  const hold = h('select', { id: 'expedition-hold' }, EXPEDITION.holdHours.map((n) => h('option', { value: n, selected: n === 2 }, `${n} saat`)));
  hold.addEventListener('change', () => refresh());
  const empty = h('p', { class: 'muted' }, 'Köyde sefere çıkabilecek asker yok.');
  const preview = h('div', { class: 'stats' });
  const status = h('p', { class: 'card-status' });
  const submit = h('button', { type: 'submit', class: 'btn' }, icon('kasif'), 'Sefere çıkar');
  const form = h(
    'form',
    { class: 'stack-sm', onsubmit: onSend },
    empty,
    h('div', { class: 'send-grid' }, SENDABLE.map((id) => rows[id].row)),
    h('div', { class: 'form-row' }, h('label', { for: 'expedition-hold' }, 'Keşif süresi'), hold, h('span', { class: 'muted' }, 'uzun keşif daha çok bulur, boş dönme olasılığı azalır')),
    preview,
    h(
      'div',
      { class: 'form-row' },
      submit,
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: fillAll }, 'Tüm birlikler'),
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: clear }, 'Temizle'),
    ),
    status,
  );
  const formPanel = h(
    'section',
    { class: 'panel stack-sm' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Sefer düzenle'), h('span', { class: 'muted' }, 'Birlik haritanın ötesindeki yabani topraklara gider, dolaşır ve bulduklarıyla döner')),
    form,
  );

  // ---------- Olasılıklar ----------
  const oddsBody = h('tbody');
  const oddsNote = h('p', { class: 'muted hint' });
  const oddsPanel = h(
    'section',
    { class: 'panel stack-sm' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Olası sonuçlar')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' }, h('thead', null, h('tr', null, h('th', null, 'Sonuç'), h('th', null, 'Ne olur?'), h('th', { class: 'num' }, 'Olasılık'))), oddsBody)),
    oddsNote,
  );

  // ---------- Yoldaki seferler ----------
  const underwayList = h('div', { class: 'queue' });
  const recentList = h('ul', { class: 'news-list' });
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Keşif seferleri'), slotsBadge),
    noBuilding,
    h('div', { class: 'settings-grid expedition-grid' }, formPanel, oddsPanel),
    h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Yoldaki seferler')), underwayList),
    h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Son keşifler'), h('a', { class: 'card-link', href: '#/raporlar' }, 'Tüm raporlar →')), recentList),
  );

  const read = () => Object.fromEntries(SENDABLE.map((id) => [id, Number(rows[id].input.value || 0)]));

  function fillAll() {
    for (const id of SENDABLE) rows[id].input.value = String(game.village.units[id]);
    refresh();
  }

  function clear() {
    for (const id of SENDABLE) rows[id].input.value = '0';
    refresh();
  }

  function onSend(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.sendExpedition(read(), Number(hold.value), now);
    if (result.ok) {
      toast(`${fmtInt(totalUnits(result.units))} asker keşfe çıktı. Keşif ${fmtClock(result.arriveAt, now)} tamamlanır.`, 'success');
      clear();
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
  }

  let oddsSignature = null;
  let underwaySignature = null;
  let underwayRows = [];
  let recentSignature = null;

  function renderOdds(village, hours) {
    const odds = expeditionOdds(village, hours);
    const signature = JSON.stringify(odds);
    if (signature === oddsSignature) return;
    oddsSignature = signature;
    const what = {
      bos: 'Hiçbir şey bulunamaz',
      kaynak: 'Taşıyabildiği kadar kaynak getirir',
      asker: 'Paralı askerler birliğe katılır',
      akce: `${EXPEDITION.akce[0]}–${EXPEDITION.akce[1]} Akçe bulunur`,
      gecikme: 'Dönüş %50–100 uzar',
      erken: 'Dönüş yarı sürede tamamlanır',
      eskiya: 'Eşkıyayla savaş; kazanırsa ganimet, kaybederse birlik yok olur',
      kayip: 'Birlik tümüyle kaybolur',
    };
    oddsBody.replaceChildren(
      ...Object.entries(odds).map(([key, p]) =>
        h(
          'tr',
          null,
          h('td', null, h('span', { class: `outcome outcome-${outcomeTone(key)}` }, EXPEDITION_OUTCOMES[key].name)),
          h('td', { class: 'wrap' }, what[key]),
          h('td', { class: 'num' }, `%${(p * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`),
        ),
      ),
    );
  }

  function renderUnderway(state, now) {
    const list = Object.values(state.villages).flatMap((village) => village.movements.filter((m) => m.mission === 'kesif').map((m) => ({ m, village })));
    list.sort((a, b) => a.m.arriveAt - b.m.arriveAt);
    const signature = list.map(({ m }) => `${m.id}:${m.type}:${m.arriveAt}`).join('|');
    if (signature !== underwaySignature) {
      underwaySignature = signature;
      underwayRows = list.map(({ m, village }) => {
        const label = h('strong');
        const remaining = h('span', { class: 'queue-remaining' });
        const when = h('span', { class: 'muted' });
        const bar = h('span');
        const row = h(
          'div',
          { class: 'queue-row movement is-expedition' },
          h('div', { class: 'queue-unit' }, h('span', { class: 'unit-icon small' }, icon(m.type === 'donus' ? 'donus' : 'kasif')), label, h('span', { class: 'muted movement-units' }, `${village.name} · ${fmtInt(totalUnits(m.units))} asker${m.loot ? ` · ${fmtInt(Object.values(m.loot).reduce((a, b) => a + b, 0))} kaynak` : ''}`)),
          h('div', { class: 'queue-time' }, remaining, when),
          h('span'),
          h('div', { class: 'progress' }, bar),
        );
        return { row, label, remaining, when, bar, m };
      });
      underwayList.replaceChildren(...(underwayRows.length ? underwayRows.map((r) => r.row) : [h('p', { class: 'muted' }, 'Şu anda yolda sefer yok.')]));
    }
    for (const { label, remaining, when, bar, m } of underwayRows) {
      let phase;
      let end;
      let start;
      if (m.type === 'donus') [phase, start, end] = ['Dönüyor', m.departAt, m.arriveAt];
      else if (now < m.exploreAt) [phase, start, end] = ['Yolda', m.departAt, m.exploreAt];
      else [phase, start, end] = [`Keşifte (${m.holdHours} saat)`, m.exploreAt, m.arriveAt];
      setText(label, phase);
      setText(remaining, fmtDuration((end - now) / 1000));
      setText(when, `${m.type === 'donus' ? 'varış' : now < m.exploreAt ? 'keşif başlar' : 'keşif biter'} ${fmtClock(end, now)}`);
      bar.style.width = `${Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))}%`;
    }
  }

  function renderRecent(state, now) {
    const reports = state.reports.filter((r) => r.type === 'kesif').slice(0, 6);
    const signature = reports.map((r) => r.id).join('|');
    if (signature === recentSignature) return;
    recentSignature = signature;
    recentList.replaceChildren(
      ...(reports.length
        ? reports.map((r) =>
            h(
              'li',
              null,
              h('span', { class: 'muted news-time' }, fmtClock(r.at, now)),
              h('span', null, h('span', { class: `outcome outcome-${outcomeTone(r.outcome)}` }, EXPEDITION_OUTCOMES[r.outcome].name), ' ', expeditionSummary(r)),
            ),
          )
        : [h('li', { class: 'muted' }, 'Henüz keşif yapılmadı.')]),
    );
  }

  return {
    el,
    update(now) {
      const state = game.state;
      const village = game.village;
      const slots = expeditionSlots(state, village);
      const underway = expeditionsUnderway(state);
      setText(slotsBadge, `${underway}/${slots} sefer`);
      slotsBadge.classList.toggle('badge-muted', !slots);
      noBuilding.hidden = village.buildings.kervansaray > 0;

      let available = 0;
      for (const id of SENDABLE) {
        const home = village.units[id];
        available += home;
        setText(rows[id].all, `(${fmtInt(home)})`);
        rows[id].row.hidden = home === 0 && Number(rows[id].input.value || 0) === 0;
      }
      empty.hidden = available > 0;

      const hours = Number(hold.value);
      const check = inspectExpedition(state, village, read(), hours, now);
      const scale = expeditionScale(state, village, hours);
      preview.replaceChildren(
        stat('saat', 'Yolculuk (tek yön)', fmtDuration(check.seconds)),
        stat('kasif', 'Keşif süresi', `${hours} oyun saati`),
        stat('tasima', 'Taşıma kapasitesi', fmtInt(check.carry)),
        h('span', { class: 'muted' }, `dönüş ~${fmtClock(check.returnAt, now)} · kaynak bulursa en çok ~${fmtInt(Math.min(scale, check.carry))}`),
      );
      preview.hidden = !totalUnits(check.units);
      submit.disabled = !check.ok;
      setText(status, check.ok || check.code === 'empty' ? '' : check.reason);
      renderOdds(village, hours);
      setText(
        oddsNote,
        `Keşif hakkı: Kervansaray 1. seviyede 1, her ${EXPEDITION.slotsEvery} seviyede +1. Kâşif sınıfı +1 hak, bulgular +%50 ve tehlikeler −%50 kazanır.`,
      );
      renderUnderway(state, now);
      renderRecent(state, now);
    },
  };
}

/** Sonucun rengi: iyi, kötü ya da nötr. */
export function outcomeTone(outcome) {
  const good = EXPEDITION_OUTCOMES[outcome]?.good;
  return good === true ? 'good' : good === false ? 'bad' : 'neutral';
}

/** Keşif raporunun tek satırlık özeti. */
export function expeditionSummary(report) {
  const loot = RESOURCE_IDS.reduce((sum, id) => sum + report.loot[id], 0);
  const parts = [];
  if (loot) parts.push(`${fmtInt(loot)} kaynak`);
  const found = Object.entries(report.found ?? {}).map(([id, n]) => `${fmtInt(n)} ${UNITS[id].name}`);
  if (found.length) parts.push(`${found.join(', ')} katıldı`);
  if (report.akce) parts.push(`${fmtInt(report.akce)} Akçe`);
  const lost = totalUnits(report.attackerLosses ?? {});
  if (lost) parts.push(`${fmtInt(lost)} kayıp`);
  if (report.outcome === 'gecikme') parts.push(`dönüş %${Math.round((report.returnFactor - 1) * 100)} gecikti`);
  if (report.outcome === 'erken') parts.push('dönüş kısaldı');
  return parts.length ? `· ${parts.join(' · ')}` : '';
}

function stat(iconName, title, value) {
  return h('span', { class: 'stat', title }, icon(iconName), value);
}
