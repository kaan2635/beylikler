import { h } from '../dom.js';

/** Henüz yapılmamış bölümler için yol haritasından bilgi gösteren geçici ekran. */
export function createPlaceholderView({ title, intro, items }) {
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, title), h('span', { class: 'tag' }, 'Yakında')),
    h(
      'section',
      { class: 'panel stack-sm' },
      h('p', null, intro),
      h('ul', { class: 'plain-list' }, items.map((item) => h('li', null, item))),
    ),
  );
  return { el, update() {} };
}
