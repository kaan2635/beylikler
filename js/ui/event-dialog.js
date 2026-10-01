import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { choiceBlocked } from '../systems/events.js';
import { h, setText } from './dom.js';
import { icon } from './icons.js';
import { fmtInt, fmtDuration } from './format.js';
import { toast } from './toast.js';

let current = null;

/** Seçeneğin bedeli: kaynak ve Akçe çipleri. */
function costChips(cost) {
  const chips = RESOURCE_IDS.filter((id) => cost[id]).map((id) => h('span', { class: 'cost-item', title: RESOURCES[id].name }, icon(id), fmtInt(cost[id])));
  if (cost.akce) chips.push(h('span', { class: 'cost-item', title: 'Akçe' }, icon('akce'), fmtInt(cost.akce)));
  return chips;
}

/**
 * Bekleyen olayın penceresi: hikâye, seçenekler (bedelleriyle) ve karar süresi. Kapatmak kararı
 * erteler; süre dolarsa olay kendi seyrine bırakılır.
 */
export function openEventDialog({ game, refresh }) {
  const pending = game.state.events?.pending;
  if (!pending) return;
  current?.close();

  const left = h('span');
  const fallback = pending.choices.find((c) => c.id === pending.fallback);
  const buttons = pending.choices.map((choice) => {
    const reason = h('span', { class: 'choice-reason' });
    const button = h(
      'button',
      { type: 'button', class: 'event-choice', dataset: { choice: choice.id } },
      h('span', { class: 'choice-label' }, choice.label),
      Object.keys(choice.cost).length ? h('span', { class: 'cost' }, costChips(choice.cost)) : h('span', { class: 'choice-free muted' }, 'Bedelsiz'),
      reason,
    );
    return { button, reason, choice };
  });
  const close = h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Sonra karar ver', title: 'Sonra karar ver (Esc)' }, '×');
  const panel = h(
    'div',
    { class: 'picker event-dialog stack' },
    close,
    h(
      'header',
      { class: 'event-head' },
      h('span', { class: 'help-icon event-icon' }, icon(pending.icon ?? 'olay')),
      h('div', null, h('p', { class: 'eyebrow' }, 'Olay'), h('h1', { id: 'event-title' }, pending.title)),
    ),
    h('p', { class: 'event-text' }, pending.text),
    h('div', { class: 'event-choices' }, buttons.map((b) => b.button)),
    h('p', { class: 'muted event-deadline' }, 'Karar vermezsen ', left, ` sonra olay kendi seyrine bırakılır: “${fallback?.label ?? ''}”.`),
  );
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'event-title' }, panel);

  const update = () => {
    const now = Date.now();
    if (game.state.events?.pending?.id !== pending.id) {
      dialog.close();
      return;
    }
    setText(left, fmtDuration((pending.expiresAt - now) / 1000));
    for (const { button, reason, choice } of buttons) {
      const blocked = choiceBlocked(game.state, choice);
      button.disabled = !!blocked;
      setText(reason, blocked ?? '');
    }
  };
  const timer = setInterval(update, 1000);
  const onKey = (event) => {
    if (event.key === 'Escape') dialog.close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('.dialog-close')) {
      dialog.close();
      return;
    }
    const button = event.target.closest('button[data-choice]');
    if (!button || button.disabled) return;
    const now = Date.now();
    const result = game.chooseEvent(button.dataset.choice, now);
    if (!result.ok) {
      toast(result.reason, 'error');
      return;
    }
    toast(`${result.title}: ${result.result}`, 'success', 7000);
    dialog.close();
    refresh(now);
  });

  const dialog = {
    close() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      document.body.classList.remove('has-overlay');
      if (current === dialog) current = null;
    },
  };
  current = dialog;
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  document.body.classList.add('has-overlay');
  update();
  (buttons.find((b) => !b.button.disabled)?.button ?? close).focus();
}
