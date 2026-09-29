import { h } from './dom.js';

let container = null;

export function initToasts(el) {
  container = el;
}

/** Köşede kısa süreli bildirim gösterir. kind: 'info' | 'success' | 'error' */
export function toast(message, kind = 'info', ms = 4000) {
  if (!container) return;
  const el = h('div', { class: `toast toast-${kind}`, role: 'status' }, message);
  container.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
