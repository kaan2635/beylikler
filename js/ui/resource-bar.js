import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { productionRates, storageCap, populationCap, populationUsed } from '../systems/economy.js';
import { h, setText } from './dom.js';
import { icon } from './icons.js';
import { fmtInt } from './format.js';

/** Üst çubuktaki kaynak, ambar ve nüfus göstergeleri. */
export function createResourceBar(root) {
  const cells = {};
  for (const id of RESOURCE_IDS) {
    cells[id] = cell(id, RESOURCES[id].name);
    root.append(cells[id].el);
  }
  const storage = cell('ambar', 'Ambar kapasitesi');
  const population = cell('nufus', 'Nüfus (kullanılan / sınır)');
  root.append(storage.el, population.el);

  return {
    update(game) {
      const village = game.village;
      const cap = storageCap(village);
      const rates = productionRates(village, game.state.world);
      for (const id of RESOURCE_IDS) {
        const amount = village.resources[id];
        setText(cells[id].value, fmtInt(amount));
        setText(cells[id].sub, `+${fmtInt(rates[id])}/sa`);
        cells[id].el.classList.toggle('full', amount >= cap);
        // Ambarın ne kadarının dolduğu; dolmak üzereyken uyarı rengi.
        const ratio = Math.min(1, amount / cap);
        cells[id].fill.style.transform = `scaleX(${ratio})`;
        cells[id].el.classList.toggle('near-full', ratio >= 0.9 && ratio < 1);
        const hours = rates[id] > 0 ? (cap - amount) / rates[id] : Infinity;
        cells[id].el.title = amount >= cap ? `${RESOURCES[id].name}: ambar dolu, üretim durdu` : `${RESOURCES[id].name}: ambar ${hours < 1 ? `${Math.max(1, Math.round(hours * 60))} dakikada` : `${fmtInt(hours)} saatte`} dolar`;
      }
      setText(storage.value, fmtInt(cap));
      setText(storage.sub, 'ambar');
      const used = populationUsed(village);
      const popCap = populationCap(village);
      setText(population.value, `${fmtInt(used)}/${fmtInt(popCap)}`);
      setText(population.sub, 'nüfus');
      population.el.classList.toggle('full', used >= popCap);
      population.fill.style.transform = `scaleX(${Math.min(1, used / popCap)})`;
    },
  };
}

function cell(iconName, title) {
  const value = h('span', { class: 'res-amount' });
  const sub = h('span', { class: 'res-rate' });
  const fill = h('span', { class: 'res-fill' });
  const el = h('div', { class: `res res-${iconName}`, title }, icon(iconName), h('div', { class: 'res-text' }, value, sub), h('span', { class: 'res-meter' }, fill));
  return { el, value, sub, fill };
}
