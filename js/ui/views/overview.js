import { BUILDINGS } from '../../config/buildings.js';
import { RESOURCES, RESOURCE_IDS } from '../../config/resources.js';
import { storageCap, populationCap, populationUsed } from '../../systems/economy.js';
import { merchantsAvailable } from '../../systems/market.js';
import { supportAt } from '../../systems/support.js';
import { totalUnits } from '../../systems/army.js';
import { villagePoints } from '../../systems/world.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration } from '../format.js';

/** Köylere genel bakış: tüm köylerin kaynakları, nüfusu, kuyrukları ve askerleri tek tabloda. */
export function createOverviewView({ game, refresh }) {
  const body = h('tbody');
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Köyler'), h('span', { class: 'muted' }, 'Köy adına tıklayınca o köyü yönetirsin')),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data-table overview' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, 'Köy'),
              RESOURCE_IDS.map((id) => h('th', { class: 'num', title: RESOURCES[id].name }, icon(id))),
              h('th', { class: 'num', title: 'Nüfus' }, icon('nufus')),
              h('th', null, 'İnşaat'),
              h('th', { class: 'num' }, 'Eğitim'),
              h('th', { class: 'num' }, 'Asker'),
              h('th', { class: 'num' }, 'Tüccar'),
              h('th', { class: 'num' }, 'Saldırı'),
            ),
          ),
          body,
        ),
      ),
    ),
    h(
      'p',
      { class: 'muted hint' },
      'Köyler arasında kaynak göndermek için Pazar, asker göndermek için haritada hedef köyü seçip "Destek gönder" kullan.',
    ),
  );

  body.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-village]');
    if (!button) return;
    game.setActiveVillage(button.dataset.village);
    location.hash = '#/koy';
    refresh();
  });

  let signature = null;
  let rows = [];

  function rebuild(villages) {
    rows = villages.map((village) => {
      const cells = {
        name: h('button', { type: 'button', class: 'link-btn strong', dataset: { village: village.id } }),
        sub: h('span', { class: 'cell-sub' }),
        resources: Object.fromEntries(RESOURCE_IDS.map((id) => [id, h('td', { class: 'num' })])),
        pop: h('td', { class: 'num' }),
        build: h('td', { class: 'wrap' }),
        train: h('td', { class: 'num' }),
        units: h('td', { class: 'num' }),
        merchants: h('td', { class: 'num' }),
        incoming: h('td', { class: 'num' }),
      };
      const row = h(
        'tr',
        null,
        h('td', { class: 'wrap' }, cells.name, cells.sub),
        RESOURCE_IDS.map((id) => cells.resources[id]),
        cells.pop,
        cells.build,
        cells.train,
        cells.units,
        cells.merchants,
        cells.incoming,
      );
      return { village, row, cells };
    });
    body.replaceChildren(...rows.map((r) => r.row));
  }

  return {
    el,
    update(now) {
      const state = game.state;
      const villages = Object.values(state.villages);
      const next = villages.map((v) => v.id).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(villages);
      }
      for (const { village, row, cells } of rows) {
        row.classList.toggle('is-me', village.id === state.activeVillageId);
        setText(cells.name, village.name);
        setText(cells.sub, `(${village.x}|${village.y}) · ${fmtInt(villagePoints(village.buildings))} puan`);
        const cap = storageCap(village);
        for (const id of RESOURCE_IDS) {
          setText(cells.resources[id], fmtInt(village.resources[id]));
          cells.resources[id].classList.toggle('full', village.resources[id] >= cap);
          cells.resources[id].title = `Ambar ${fmtInt(cap)}`;
        }
        setText(cells.pop, `${fmtInt(populationUsed(village))}/${fmtInt(populationCap(village))}`);
        const job = village.buildQueue[0];
        setText(
          cells.build,
          job ? `${BUILDINGS[job.building].name} ${job.level} · ${fmtDuration((job.endAt - now) / 1000)}${village.buildQueue.length > 1 ? ` (+${village.buildQueue.length - 1})` : ''}` : '—',
        );
        const training = Object.values(village.trainQueues).flat().reduce((sum, b) => sum + b.count - b.trained, 0);
        setText(cells.train, training ? fmtInt(training) : '—');
        const support = supportAt(state, village.id).reduce((sum, s) => sum + totalUnits(s.units), 0);
        setText(cells.units, `${fmtInt(totalUnits(village.units))}${support ? ` +${fmtInt(support)}` : ''}`);
        cells.units.title = support ? `${fmtInt(support)} destek askeri dahil değil` : '';
        const level = village.buildings.pazar;
        setText(cells.merchants, level ? `${merchantsAvailable(village, now)}/${level}` : '—');
        setText(cells.incoming, village.incoming.length ? String(village.incoming.length) : '—');
        cells.incoming.classList.toggle('loss', village.incoming.length > 0);
      }
    },
  };
}
