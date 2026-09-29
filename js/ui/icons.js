import { h } from './dom.js';

// Oyuna özgü basit SVG simgeler (harici dosya ya da font gerekmez).
const ICONS = {
  odun: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="16" height="8" rx="2" fill="#9a6433"/><path d="M4 11h10M5 14h8" stroke="#6f431c" stroke-width="1"/><ellipse cx="18" cy="12" rx="3.2" ry="4" fill="#e2b27a" stroke="#6f431c"/><circle cx="18" cy="12" r="1.3" fill="none" stroke="#9a6433"/></svg>',
  kil: '<svg viewBox="0 0 24 24"><g fill="#c4603c" stroke="#8a3a20" stroke-width=".8"><rect x="2" y="13" width="9.5" height="5" rx=".6"/><rect x="12.5" y="13" width="9.5" height="5" rx=".6"/><rect x="7.2" y="7" width="9.5" height="5" rx=".6"/></g></svg>',
  demir: '<svg viewBox="0 0 24 24"><path d="M3 17l3.5-8h11l3.5 8z" fill="#8c96a1" stroke="#4e5660" stroke-width=".8"/><path d="M6.5 9l1.8 3.5h7.4L17.5 9" fill="#c3cad2" stroke="#4e5660" stroke-width=".8"/></svg>',
  nufus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.8" fill="#a07a4c"/><path d="M4.5 20.5c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill="#a07a4c"/></svg>',
  ambar: '<svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6v10H3z" fill="#b07c45" stroke="#6b451f"/><rect x="9" y="13" width="6" height="7" fill="#6b451f"/></svg>',
  saat: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export function icon(name, title) {
  const span = h('span', { class: 'icon', title, 'aria-hidden': title ? null : 'true' });
  span.innerHTML = ICONS[name];
  return span;
}
