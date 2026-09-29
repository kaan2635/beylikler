import { VICTORY } from '../config/quests.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { fmtInt } from './format.js';

/** Sultanlık ilanı: bütün beyler düştüğünde bir kez açılan kutlama penceresi. */
export function openVictory(game) {
  if (document.querySelector('.victory-overlay')) return;
  const { state } = game;
  const villages = Object.values(state.villages).length;
  const close = h('button', { type: 'button', class: 'btn btn-large btn-gold' }, 'Oynamaya devam et');
  const overlay = h(
    'div',
    { class: 'overlay victory-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'victory-title' },
    h(
      'div',
      { class: 'picker victory stack' },
      h('span', { class: 'victory-crown' }, icon('tac')),
      h('p', { class: 'eyebrow' }, 'Beylikler'),
      h('h1', { id: 'victory-title' }, 'Sultanlık ilan edildi!'),
      h('p', null, `${state.player.name} artık ${VICTORY.title}. Bütün rakip beylerin hisarları beyliğine katıldı.`),
      h(
        'div',
        { class: 'stats victory-stats' },
        h('span', null, h('strong', null, fmtInt(villages)), ' köy'),
        h('span', null, h('strong', null, fmtInt(state.stats.kills)), ' savaş puanı'),
        h('span', null, h('strong', null, fmtInt(state.stats.loot)), ' ganimet'),
        h('span', null, h('strong', null, `+${VICTORY.akce}`), ' Akçe'),
      ),
      h('div', { class: 'picker-foot' }, close),
    ),
  );
  close.addEventListener('click', () => {
    overlay.remove();
    document.body.classList.remove('has-overlay');
  });
  document.body.append(overlay);
  document.body.classList.add('has-overlay');
  close.focus();
}
