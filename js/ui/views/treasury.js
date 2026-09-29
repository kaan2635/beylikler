import { CLASSES, CLASS_IDS, OFFICERS, OFFICER_IDS, PREMIUM } from '../../config/classes.js';
import { BUILDINGS } from '../../config/buildings.js';
import { UNITS } from '../../config/units.js';
import { RESOURCES, RESOURCE_IDS } from '../../config/resources.js';
import { officerUntil, finishCost, resourcePackAmounts } from '../../systems/premium.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

/**
 * Hazine: Akçe bakiyesi, sınıf, görevliler, anında bitirme, kaynak paketi ve hesap dökümü.
 * Akçe yalnızca oyun içinde kazanılır; gerçek parayla satılmaz.
 */
export function createTreasuryView({ game, refresh }) {
  const balance = h('strong', { class: 'akce-balance' });
  const classPanel = createClassPanel({ game, refresh });
  const officers = createOfficersPanel({ game, refresh });
  const speedUp = createSpeedUpPanel({ game, refresh });
  const ledger = h('ul', { class: 'news-list' });
  let ledgerSignature = null;

  const el = h(
    'section',
    { class: 'stack' },
    h(
      'header',
      { class: 'view-header' },
      h('h1', null, 'Hazine'),
      h('span', { class: 'akce-total' }, icon('akce'), balance, h('span', { class: 'muted' }, 'Akçe')),
    ),
    classPanel.el,
    officers.el,
    speedUp.el,
    h(
      'div',
      { class: 'settings-grid' },
      h(
        'section',
        { class: 'panel stack-sm' },
        h('h2', null, 'Akçe nasıl kazanılır?'),
        h(
          'ul',
          { class: 'perk-list' },
          h('li', null, `Oyun başında ${PREMIUM.startAkce} Akçe`),
          h('li', null, `Bir köy fethetmek: +${PREMIUM.rewards.conquest}`),
          h('li', null, `Bey saldırısını püskürtmek: +${PREMIUM.rewards.defense}`),
          h('li', null, 'Keşif seferlerinde bulunan hazineler'),
          h('li', null, 'Görevler ve başarımlar'),
        ),
        h('p', { class: 'muted' }, 'Akçe yalnızca oyun içinde kazanılır; gerçek parayla satılmaz.'),
      ),
      h('section', { class: 'panel stack-sm' }, h('h2', null, 'Hesap dökümü'), ledger),
    ),
  );

  return {
    el,
    update(now) {
      const player = game.state.player;
      setText(balance, fmtInt(player.akce ?? 0));
      classPanel.update();
      officers.update(now);
      speedUp.update(now);
      const log = player.akceLog ?? [];
      const next = log.map((e) => `${e.at}:${e.amount}`).join('|');
      if (next !== ledgerSignature) {
        ledgerSignature = next;
        ledger.replaceChildren(
          ...(log.length
            ? log.map((e) =>
                h(
                  'li',
                  null,
                  h('span', { class: 'muted news-time' }, fmtClock(e.at, now)),
                  h('span', null, e.reason, ' ', h('strong', { class: e.amount > 0 ? 'gain' : 'loss' }, `${e.amount > 0 ? '+' : ''}${fmtInt(e.amount)}`)),
                ),
              )
            : [h('li', { class: 'muted' }, 'Henüz Akçe hareketi yok.')]),
        );
      }
    },
  };
}

function createClassPanel({ game, refresh }) {
  const cards = {};
  const grid = h('div', { class: 'class-grid' });
  for (const id of CLASS_IDS) {
    const def = CLASSES[id];
    const badge = h('span', { class: 'badge' }, 'Sınıfın');
    const button = h('button', { type: 'button', class: 'btn btn-small', dataset: { change: id } });
    const card = h(
      'article',
      { class: `class-card static class-${id}` },
      h('span', { class: 'class-emblem' }, icon(id)),
      h('strong', { class: 'class-name' }, def.name),
      h('em', { class: 'class-motto' }, def.motto),
      h('ul', { class: 'perk-list' }, def.perks.map((perk) => h('li', null, perk))),
      badge,
      button,
    );
    cards[id] = { card, badge, button };
    grid.append(card);
  }
  const el = h(
    'section',
    { class: 'panel stack-sm' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Sınıf'), h('span', { class: 'muted' }, `Değiştirmek ${PREMIUM.classChangeCost} Akçe`)),
    grid,
  );
  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-change]');
    if (!button) return;
    const id = button.dataset.change;
    if (!confirm(`Sınıfını ${CLASSES[id].name} olarak değiştirmek ${PREMIUM.classChangeCost} Akçe tutar. Emin misin?`)) return;
    const result = game.changeClass(id, Date.now());
    if (result.ok) toast(`Artık sınıfın: ${CLASSES[id].name}.`, 'success');
    else toast(result.reason, 'error');
    refresh();
  });

  return {
    el,
    update() {
      const current = game.state.player.class;
      const akce = game.state.player.akce ?? 0;
      for (const [id, { card, badge, button }] of Object.entries(cards)) {
        const mine = id === current;
        card.classList.toggle('selected', mine);
        badge.hidden = !mine;
        button.hidden = mine;
        setText(button, `Bu sınıfa geç (${PREMIUM.classChangeCost} Akçe)`);
        button.disabled = akce < PREMIUM.classChangeCost;
      }
    },
  };
}

function createOfficersPanel({ game, refresh }) {
  const rows = {};
  const grid = h('div', { class: 'building-grid' });
  for (const id of OFFICER_IDS) {
    const def = OFFICERS[id];
    const status = h('p', { class: 'card-status' });
    const button = h('button', { type: 'button', class: 'btn', dataset: { hire: id } });
    const card = h(
      'article',
      { class: 'card officer-card' },
      h('div', { class: 'card-head' }, h('div', { class: 'unit-title' }, h('span', { class: 'unit-icon' }, icon(id)), h('h3', null, def.name))),
      h('p', { class: 'card-desc' }, def.description),
      h('ul', { class: 'perk-list' }, def.perks.map((perk) => h('li', null, perk))),
      status,
      h('div', { class: 'form-row' }, button),
    );
    rows[id] = { card, status, button };
    grid.append(card);
  }
  const el = h(
    'section',
    { class: 'panel stack-sm' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Görevliler'), h('span', { class: 'muted' }, `Her biri ${PREMIUM.officerDays} gün görev yapar; görevdeyken yeniden tutarsan süre uzar`)),
    grid,
  );
  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-hire]');
    if (!button) return;
    const id = button.dataset.hire;
    const now = Date.now();
    const result = game.hireOfficer(id, now);
    if (result.ok) toast(`${OFFICERS[id].name} göreve başladı; ${fmtClock(result.until, now)} tarihine kadar.`, 'success');
    else toast(result.reason, 'error');
    refresh(now);
  });

  return {
    el,
    update(now) {
      const akce = game.state.player.akce ?? 0;
      for (const [id, { card, status, button }] of Object.entries(rows)) {
        const until = officerUntil(game.state, id, now);
        card.classList.toggle('active-officer', !!until);
        setText(status, until ? `Görevde · ${fmtDuration((until - now) / 1000)} kaldı` : 'Görevde değil');
        setText(button, `${until ? 'Uzat' : 'Tut'} · ${OFFICERS[id].cost} Akçe`);
        button.disabled = akce < OFFICERS[id].cost;
      }
    },
  };
}

/** Hızlandırma satırı: simge, başlık, açıklama ve Akçe düğmesi; öğeler bir kez kurulur. */
function speedUpRow(iconName, action) {
  const title = h('strong');
  const detail = h('span', { class: 'cell-sub' });
  const cost = h('span');
  const button = h('button', { type: 'button', class: 'btn btn-small btn-gold', dataset: { speedup: action } }, icon('simsek'), cost);
  const el = h('div', { class: 'speedup-row' }, h('span', { class: 'unit-icon small' }, icon(iconName)), h('div', null, title, detail), button);
  return {
    el,
    set(titleText, detailText, price, disabled) {
      setText(title, titleText);
      setText(detail, detailText);
      button.hidden = price == null;
      if (price != null) setText(cost, `${fmtInt(price)} Akçe`);
      button.disabled = !!disabled;
    },
  };
}

function createSpeedUpPanel({ game, refresh }) {
  const build = speedUpRow('saat', 'build');
  const research = speedUpRow('saat', 'research');
  const pack = speedUpRow('paket', 'pack');
  const el = h(
    'section',
    { class: 'panel stack-sm' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Hızlandır'), h('span', { class: 'muted' }, `Yönetilen köy · kalan her ${PREMIUM.finishGameMinutesPerAkce} oyun dakikası 1 Akçe`)),
    build.el,
    research.el,
    pack.el,
  );

  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-speedup]');
    if (!button) return;
    const now = Date.now();
    const action = button.dataset.speedup;
    const result = action === 'build' ? game.finishBuilding(now) : action === 'research' ? game.finishResearch(now) : game.buyResourcePack(now);
    if (result.ok) toast(action === 'pack' ? 'Kaynak paketi ambara kondu.' : `Tamamlandı (${result.cost} Akçe).`, 'success');
    else toast(result.reason, 'error');
    refresh(now);
  });

  return {
    el,
    update(now) {
      const village = game.village;
      const akce = game.state.player.akce ?? 0;
      const job = village.buildQueue[0];
      if (job) {
        const price = finishCost(job.endAt - now, game.state.world);
        build.set(`${BUILDINGS[job.building].name} ${job.level}. seviye`, `kalan ${fmtDuration((job.endAt - now) / 1000)} · arkadaki işler öne kayar`, price, akce < price);
      } else {
        build.set('İnşaat yok', 'Köyde süren bir inşaat olunca burada anında bitirebilirsin.', null);
      }
      const busy = village.research;
      if (busy) {
        const price = finishCost(busy.endAt - now, game.state.world);
        research.set(`Demirci: ${UNITS[busy.unit].name} ${busy.level}. seviye`, `kalan ${fmtDuration((busy.endAt - now) / 1000)}`, price, akce < price);
      } else {
        research.set('Demircide geliştirme yok', 'Süren bir geliştirme olunca burada anında bitirebilirsin.', null);
      }
      const amounts = resourcePackAmounts(village);
      const total = Object.values(amounts).reduce((a, b) => a + b, 0);
      pack.set(
        'Kaynak paketi',
        total ? RESOURCE_IDS.map((id) => `+${fmtInt(amounts[id])} ${RESOURCES[id].name.toLocaleLowerCase('tr')}`).join(' · ') : 'Ambar dolu',
        PREMIUM.resourcePack.cost,
        akce < PREMIUM.resourcePack.cost || !total,
      );
    },
  };
}
