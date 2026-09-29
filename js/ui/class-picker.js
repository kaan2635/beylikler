import { CLASSES, CLASS_IDS } from '../config/classes.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { toast } from './toast.js';

/**
 * Oyun başında sınıf seçimi penceresi. Sınıf seçilene kadar oyunun önünde durur; bey ve köy
 * adı da burada verilir. Seçimden sonra `onDone` çağrılır.
 */
export function openClassPicker(game, onDone) {
  let chosen = null;
  const playerName = h('input', { type: 'text', id: 'picker-player', maxlength: 24, value: game.state.player.name ?? 'Bey', autocomplete: 'off' });
  const villageName = h('input', { type: 'text', id: 'picker-village', maxlength: 32, value: game.village.name, autocomplete: 'off' });
  const start = h('button', { type: 'submit', class: 'btn btn-large', disabled: true }, 'Sınıf seç');

  const cards = CLASS_IDS.map((id) => {
    const def = CLASSES[id];
    const card = h(
      'button',
      { type: 'button', class: `class-card class-${id}`, 'aria-pressed': 'false', dataset: { class: id } },
      h('span', { class: 'class-emblem' }, icon(id)),
      h('strong', { class: 'class-name' }, def.name),
      h('em', { class: 'class-motto' }, def.motto),
      h('span', { class: 'class-desc' }, def.description),
      h('ul', { class: 'perk-list' }, def.perks.map((perk) => h('li', null, perk))),
    );
    return card;
  });

  const form = h(
    'form',
    { class: 'picker stack', onsubmit: onSubmit },
    h('header', { class: 'picker-head' }, h('p', { class: 'eyebrow' }, 'Beylikler'), h('h1', { id: 'picker-title' }, 'Beyliğini kur'), h('p', { class: 'muted' }, 'Adını koy ve yolunu seç. Sınıfını sonra Hazine sayfasından Akçe karşılığında değiştirebilirsin.')),
    h(
      'div',
      { class: 'picker-names' },
      h('label', { for: 'picker-player' }, 'Bey adın', playerName),
      h('label', { for: 'picker-village' }, 'Köyünün adı', villageName),
    ),
    h('div', { class: 'class-grid', role: 'group', 'aria-label': 'Sınıf' }, cards),
    h('div', { class: 'picker-foot' }, start),
  );
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'picker-title' }, form);

  form.addEventListener('click', (event) => {
    const card = event.target.closest('button[data-class]');
    if (!card) return;
    chosen = card.dataset.class;
    for (const other of cards) other.setAttribute('aria-pressed', String(other === card));
    start.disabled = false;
    start.textContent = `${CLASSES[chosen].name} olarak başla`;
  });

  function onSubmit(event) {
    event.preventDefault();
    if (!chosen) return;
    const result = game.chooseClass(chosen, { playerName: playerName.value, villageName: villageName.value }, Date.now());
    if (!result.ok) {
      toast(result.reason, 'error');
      return;
    }
    overlay.remove();
    document.body.classList.remove('has-overlay');
    onDone?.(chosen);
  }

  document.body.append(overlay);
  document.body.classList.add('has-overlay');
  cards[0].focus();
}
