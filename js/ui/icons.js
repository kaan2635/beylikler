import { h } from './dom.js';

// Oyuna özgü basit SVG simgeler (harici dosya ya da font gerekmez).
const ICONS = {
  odun: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="16" height="8" rx="2" fill="#9a6433"/><path d="M4 11h10M5 14h8" stroke="#6f431c" stroke-width="1"/><ellipse cx="18" cy="12" rx="3.2" ry="4" fill="#e2b27a" stroke="#6f431c"/><circle cx="18" cy="12" r="1.3" fill="none" stroke="#9a6433"/></svg>',
  kil: '<svg viewBox="0 0 24 24"><g fill="#c4603c" stroke="#8a3a20" stroke-width=".8"><rect x="2" y="13" width="9.5" height="5" rx=".6"/><rect x="12.5" y="13" width="9.5" height="5" rx=".6"/><rect x="7.2" y="7" width="9.5" height="5" rx=".6"/></g></svg>',
  demir: '<svg viewBox="0 0 24 24"><path d="M3 17l3.5-8h11l3.5 8z" fill="#8c96a1" stroke="#4e5660" stroke-width=".8"/><path d="M6.5 9l1.8 3.5h7.4L17.5 9" fill="#c3cad2" stroke="#4e5660" stroke-width=".8"/></svg>',
  nufus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.8" fill="#a07a4c"/><path d="M4.5 20.5c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill="#a07a4c"/></svg>',
  ambar: '<svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6v10H3z" fill="#b07c45" stroke="#6b451f"/><rect x="9" y="13" width="6" height="7" fill="#6b451f"/></svg>',
  saat: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',

  // Birimler ve savaş değerleri: yazı rengini (currentColor) kullanan çizgi simgeler.
  yaya: line('<path d="M4 20L15 9"/><path d="M13.5 7.5L20 4l-3.5 6.5z" fill="currentColor"/>'),
  kilicci: line('<path d="M19 5L9 15"/><path d="M6 12l6 6"/><path d="M8.5 15.5L4 20"/>'),
  baltaci: line('<path d="M5 20L15 8"/><path d="M12.5 5.5c2.5-2.5 6.5-2 8 1-2 0-3.5 1.2-4.5 3.2z" fill="currentColor"/>'),
  okcu: line('<path d="M7 3c8 3 8 15 0 18"/><path d="M7 3v18"/><path d="M3 12h14"/><path d="M14 9l3 3-3 3"/>'),
  gozcu: line('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  akinci: line('<path d="M6 20v-9a6 6 0 0 1 12 0v9"/><path d="M4 20h4M16 20h4"/>'),
  sipahi: line('<path d="M5 20v-7a7 7 0 0 1 14 0v7z"/><path d="M5 14h14"/><path d="M9 17h6"/><path d="M12 6V2"/>'),
  kocbasi: line('<rect x="3" y="7" width="14" height="5" rx="2"/><path d="M17 6.5l3.5 3-3.5 3"/><circle cx="7" cy="17" r="2"/><circle cx="14" cy="17" r="2"/>'),
  mancinik: line('<path d="M3 20h18"/><path d="M6 20l5-8 5 8"/><path d="M11 12l7-7"/><circle cx="19" cy="4" r="1.8" fill="currentColor"/>'),
  saldiri: line('<path d="M5 5l11 11"/><path d="M19 5L8 16"/><path d="M13.5 18.5l5-5M5.5 13.5l5 5"/>'),
  savunma: line('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  hiz: line('<path d="M3 12h10"/><path d="M9 7l5 5-5 5"/><path d="M15 7l5 5-5 5"/>'),
  konum: line('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  tasima: line('<path d="M9 3h6l-2 4h-2z"/><path d="M8 8h8c3 3 4 6 3 9a3 3 0 0 1-3 2.5H8A3 3 0 0 1 5 17c-1-3 0-6 3-9z"/>'),
};

function line(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export function icon(name, title) {
  const span = h('span', { class: 'icon', title, 'aria-hidden': title ? null : 'true' });
  span.innerHTML = ICONS[name];
  return span;
}
