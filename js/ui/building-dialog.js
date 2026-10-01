import { BUILDINGS } from '../config/buildings.js';
import { createBuildingCard, upgradeFromButton } from './building-card.js';
import { h } from './dom.js';

let current = null; // açık pencere (aynı anda bir tane)

/**
 * Bina penceresi: sahnede ya da listede bir binaya tıklayınca açılır. Binanın açıklaması,
 * etkisi, maliyeti, gereksinimleri ve yükseltme düğmesi tek yerde durur; oyuncu sahneden
 * ayrılmadan yükseltir. Esc, × ya da dışarı tıklamak kapatır. Her saniye kendini yeniler.
 */
export function openBuildingDialog({ game, refresh }, buildingId) {
  if (!BUILDINGS[buildingId]) return;
  current?.close();

  const card = createBuildingCard(buildingId, { detailed: true });
  const close = h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Kapat', title: 'Kapat (Esc)' }, '×');
  const panel = h('div', { class: 'picker building-dialog' }, close, card.el);
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': BUILDINGS[buildingId].name }, panel);

  const update = () => card.update(game.village, game.state.world, Date.now());
  const timer = setInterval(update, 1000);
  const onKey = (event) => {
    if (event.key === 'Escape') dialog.close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('.dialog-close') || event.target.closest('[data-close]')) {
      dialog.close();
      return;
    }
    const opener = event.target.closest('[data-open]');
    if (opener) {
      openBuildingDialog({ game, refresh }, opener.dataset.open);
      return;
    }
    const button = event.target.closest('button[data-action="upgrade"]');
    if (!button) return;
    const now = Date.now();
    upgradeFromButton(game, button, now);
    refresh(now);
    update();
  });

  const onRoute = () => dialog.close(); // başka sayfaya geçilince pencere kapanır
  const dialog = {
    close() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onRoute);
      overlay.remove();
      document.body.classList.remove('has-overlay');
      if (current === dialog) current = null;
    },
  };
  current = dialog;

  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onRoute);
  document.body.append(overlay);
  document.body.classList.add('has-overlay');
  update();
  (card.el.querySelector('button[data-action="upgrade"]:not(:disabled)') ?? close).focus();
  return dialog;
}
