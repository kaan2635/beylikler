import { h } from './dom.js';
import { UNITS } from '../config/units.js';
import { GAME_ICONS } from './art/game-icons.js';
import { CUSTOM_ICONS } from './art/custom-icons.js';

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
  muhafiz: line('<path d="M6 3h12v9c0 5-3 8-6 9-3-1-6-4-6-9z"/><path d="M12 3v18M6 10h12"/>'),
  serdengecti: line('<path d="M5 20L15 8"/><path d="M19 20L9 8"/><path d="M12.8 5.4c2-2 5-1.5 6 1-1.6 0-2.8 1-3.6 2.6z" fill="currentColor"/><path d="M11.2 5.4c-2-2-5-1.5-6 1 1.6 0 2.8 1 3.6 2.6z" fill="currentColor"/>'),
  deli: line('<path d="M6 21v-7a6 6 0 0 1 12 0v7"/><path d="M4 21h4M16 21h4"/><path d="M12 8c0-3 2.2-5.5 5.5-5.5-.8 3.2-2.4 4.8-5.5 5.5z" fill="currentColor"/>'),
  atliokcu: line('<path d="M4 9c4-5 12-5 16 0"/><path d="M4 9h16"/><path d="M12 3v10"/><path d="M8 21v-3a4 4 0 0 1 8 0v3"/>'),
  elci: line('<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7"/><path d="M7 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2z"/><path d="M9 10h7M9 14h5"/><circle cx="15.5" cy="18" r="1.8" fill="currentColor"/>'),
  saldiri: line('<path d="M5 5l11 11"/><path d="M19 5L8 16"/><path d="M13.5 18.5l5-5M5.5 13.5l5 5"/>'),
  savunma: line('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  hiz: line('<path d="M3 12h10"/><path d="M9 7l5 5-5 5"/><path d="M15 7l5 5-5 5"/>'),
  donus: line('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  konum: line('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  tasima: line('<path d="M9 3h6l-2 4h-2z"/><path d="M8 8h8c3 3 4 6 3 9a3 3 0 0 1-3 2.5H8A3 3 0 0 1 5 17c-1-3 0-6 3-9z"/>'),

  // Akçe: delikli Osmanlı sikkesi.
  akce: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#e0b54a" stroke="#8a6414" stroke-width="1.2"/><circle cx="12" cy="12" r="7" fill="none" stroke="#a87c1c" stroke-width=".8" stroke-dasharray="1.2 1.4"/><rect x="10" y="10" width="4" height="4" rx=".6" fill="#8a6414"/></svg>',
  simsek: line('<path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="currentColor"/>'),
  paket: line('<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),

  // Sınıflar ve görevliler.
  tuccar: line('<path d="M12 3v18M5 21h14"/><path d="M4 7h16"/><path d="M4 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M20 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>'),
  serdar: line('<path d="M12 2v14"/><path d="M8 16h8"/><path d="M12 16v5"/><path d="M9.5 2.8L12 2l2.5.8"/><path d="M5 9c2 1 2 5 0 6M19 9c-2 1-2 5 0 6"/>'),
  kasif: line('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'),
  vezir: line('<path d="M6 4h11a2 2 0 0 1 2 2v12"/><path d="M6 4a2 2 0 0 0-2 2v1h4"/><path d="M8 7v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1H10"/><path d="M11 9h5M11 12h5"/>'),
  defterdar: line('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M8 7h7M8 10h7M8 13h4"/>'),
  mimarbasi: line('<path d="M4 20l9-9"/><path d="M12 4l6 6-3 3-6-6z"/><path d="M14 20h7M14 20v-6"/>'),
  serasker: line('<path d="M5 21V3"/><path d="M5 4h12l-3 4 3 4H5"/>'),

  // Gezinme sekmeleri.
  'nav-koy': line('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  'nav-koyler': line('<path d="M2 12l5-4 5 4"/><path d="M3.5 11v8h7v-8"/><path d="M12 9l5-4 5 4"/><path d="M13.5 8v11h7V8"/>'),
  'nav-harita': line('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  'nav-kesif': line('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/>'),
  'nav-ordu': line('<path d="M5 5l11 11"/><path d="M19 5L8 16"/><path d="M13.5 18.5l5-5M5.5 13.5l5 5"/>'),
  'nav-raporlar': line('<path d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/>'),
  'nav-siralama': line('<path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/><path d="M4 21h16"/>'),
  'nav-sohbet': line('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
  'nav-gorevler': line('<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1z"/><path d="M9 10l2 2 4-4"/>'),
  kupa: line('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/><path d="M12 14v4M8 21h8M9 18h6"/>'),
  sandik: line('<path d="M4 10h16v10H4z"/><path d="M4 10a8 5 0 0 1 16 0"/><path d="M4 14h16"/><rect x="10.5" y="12.5" width="3" height="3.5" rx="0.6" fill="currentColor"/>'),
  tac: line('<path d="M3 18h18l1-11-5 4-5-7-5 7-5-4z"/><circle cx="12" cy="4" r="1" fill="currentColor"/><path d="M3 21h18"/>'),
  'nav-diger': line('<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>'),
  'nav-divan': line('<path d="M3 5.5c3-1.2 6-1 9 1V20c-3-2-6-2.2-9-1z"/><path d="M21 5.5c-3-1.2-6-1-9 1V20c3-2 6-2.2 9-1z"/>'),
  'nav-diplomasi': line('<path d="M2 11l4-4 4 2 3-2 4 1 5 4"/><path d="M6 13l4 4c1 1 2.2 1 3 0l6-6"/><path d="M10 13l2.5 2.5M12.5 11.5l2.5 2.5"/>'),
  olay: line('<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7"/><path d="M7 3a2 2 0 0 0-2 2v2h4V5a2 2 0 0 0-2-2z"/><path d="M7 21a2 2 0 0 1-2-2V9"/><path d="M11 8h5M11 12h5M11 16h3"/>'),
  'mevsim-ilkbahar': line('<path d="M12 21v-9"/><path d="M12 12c0-4.5 3-7 7.5-7 0 4.5-3 7-7.5 7z"/><path d="M12 15c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6z"/>'),
  'mevsim-yaz': line('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
  'mevsim-sonbahar': line('<path d="M5 19C5 10.5 11 5 20 5c0 9-5.5 15-14 15"/><path d="M5 19l9-9"/>'),
  'mevsim-kis': line('<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>'),
  baris: line('<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>'),
  // 2.0: kahraman, eşya yuvaları, şan, harabe, Moğol ordugâhı, tarihçe.
  'nav-kahraman': line('<path d="M12 2.5c-1.2 3.2-6.5 6.2-6.5 11.5h13c0-5.3-5.3-8.3-6.5-11.5z"/><path d="M4.5 14h15"/><path d="M12 14v5"/><path d="M6.5 14v3.5c0 2 2 3.5 3.5 4M17.5 14v3.5c0 2-2 3.5-3.5 4"/>'),
  'nav-tarihce': line('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/><circle cx="19" cy="6" r="1.2" fill="currentColor"/>'),
  silah: line('<path d="M19.5 3H21v1.5L10 15.5 8.5 14z"/><path d="M6 12l6 6"/><path d="M8.5 15.5L4 20"/>'),
  zirh: line('<path d="M8 3h8l4 4-2 3v10H6V10L4 7z"/><path d="M9 3c0 2 1.3 3 3 3s3-1 3-3"/><path d="M6 14h12M12 6v14"/>'),
  at: line('<path d="M8 21v-5.5C5.5 14.5 4.5 12 5.5 9.5L10 4l1.5 2 4 1c2.5.8 4 3 4 5.5l-2.2 1-2.8-2-1.3 3.8L15 21"/><circle cx="11" cy="8.5" r=".9" fill="currentColor"/>'),
  nisan: line('<circle cx="12" cy="15" r="5.5"/><path d="M8 3l4 6.5L16 3"/><path d="M12 12l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="currentColor"/>'),
  san: line('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  yara: line('<path d="M5.6 13.9l8.3-8.3a3 3 0 0 1 4.2 4.2l-8.3 8.3a3 3 0 0 1-4.2-4.2z"/><path d="M10 10l4 4"/>'),
  harabe: line('<path d="M3 21h18"/><path d="M5 21V10h4v11"/><path d="M4 10h6"/><path d="M14 21v-7l1.5-1.5L17 14v7"/><path d="M13 9l2-2 1.5 1 2.5-2"/>'),
  ordugah: line('<path d="M2.5 20.5L12 5l9.5 15.5z"/><path d="M9 20.5l3-6 3 6"/><path d="M12 5V2l3.5 1.2L12 4.4"/>'),
  harita2: line('<path d="M4 5l5-2 6 2 5-2v15l-5 2-6-2-5 2z"/><path d="M9 3v15M15 5v15"/><path d="M11 10l2 2M13 10l-2 2"/>'),
  gunes: line('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>'),
  ay: line('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'),
  'nav-ayarlar': line('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
};

// Kaynak ve birim simgeleri: game-icons.net (CC BY 3.0). Kaynaklar kendi renginde, birimler
// bulunduğu yerin rengini (currentColor) alır; madalyonda kategori rengine boyanır.
const ICON_COLORS = { odun: '#c98a4b', kil: '#d9744c', demir: '#a9b4bf', nufus: '#d6b27a', ambar: '#c99a62', akce: '#e2b64c' };
for (const [key, d] of Object.entries({ ...GAME_ICONS, ...CUSTOM_ICONS })) {
  ICONS[key] = `<svg viewBox="0 0 512 512"><path fill="${ICON_COLORS[key] ?? 'currentColor'}" d="${d}"/></svg>`;
}

/** Birim simgelerinin kategorisi: madalyon rengi için. */
const UNIT_CATEGORY = {};
for (const [id, unit] of Object.entries(UNITS)) {
  UNIT_CATEGORY[id] = unit.building === 'atolye' ? 'kusatma' : unit.building === 'saray' ? 'ozel' : unit.type;
}

function line(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export function icon(name, title) {
  const span = h('span', { class: 'icon', title, 'aria-hidden': title ? null : 'true', dataset: UNIT_CATEGORY[name] ? { cat: UNIT_CATEGORY[name] } : null });
  span.innerHTML = ICONS[name] ?? '';
  return span;
}
