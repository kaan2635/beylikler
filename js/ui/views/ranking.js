import { PERSONALITIES } from '../../config/lords.js';
import { ranking } from '../../systems/ranking.js';
import { h } from '../dom.js';
import { fmtInt, fmtClock } from '../format.js';

/** Sıralama: oyuncu ve rakip beyler; altta dünya olayları. */
export function createRankingView({ game }) {
  const body = h('tbody');
  const news = h('ul', { class: 'news-list' });
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Sıralama')),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel-head' },
        h('h2', null, 'Beyler'),
        h('span', { class: 'muted' }, 'Puan binalardan gelir; savaş puanı öldürülen düşman askerlerinin nüfus değeridir'),
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data-table ranking' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { class: 'num' }, '#'),
              h('th', null, 'Bey'),
              h('th', { class: 'num' }, 'Puan'),
              h('th', { class: 'num' }, 'Savaş'),
              h('th', { class: 'num' }, 'Ganimet'),
            ),
          ),
          body,
        ),
      ),
    ),
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Dünya olayları')), news),
  );
  let tableSignature = null;
  let newsSignature = null;

  return {
    el,
    update(now) {
      const table = ranking(game.state);
      const signature = table.map((e) => `${e.id}:${e.points}:${e.kills}:${e.loot}`).join('|');
      if (signature !== tableSignature) {
        tableSignature = signature;
        body.replaceChildren(
          ...table.map((e) =>
            h(
              'tr',
              { class: e.kind === 'oyuncu' ? 'is-me' : null },
              h('td', { class: 'num' }, String(e.rank)),
              h(
                'td',
                { class: 'wrap' },
                e.kind === 'oyuncu'
                  ? h('strong', null, 'Sen')
                  : h('a', { class: 'card-link', href: `#/harita/${e.x}/${e.y}` }, e.name),
                h(
                  'span',
                  { class: 'cell-sub' },
                  e.kind === 'oyuncu' ? e.villageName : `${e.villageName} · ${PERSONALITIES[e.personality].name}`,
                ),
              ),
              h('td', { class: 'num' }, fmtInt(e.points)),
              h('td', { class: 'num' }, fmtInt(e.kills)),
              h('td', { class: 'num' }, fmtInt(e.loot)),
            ),
          ),
        );
      }

      const items = game.state.news;
      const nextNews = items.map((n) => `${n.at}:${n.text}`).join('|');
      if (nextNews !== newsSignature) {
        newsSignature = nextNews;
        news.replaceChildren(
          ...(items.length
            ? items.map((n) => h('li', null, h('span', { class: 'muted news-time' }, fmtClock(n.at, now)), h('span', null, n.text)))
            : [h('li', { class: 'muted' }, 'Henüz bir olay yok. Beyler güçlendikçe birbirleriyle ve seninle çatışacak.')]),
        );
      }
    },
  };
}
