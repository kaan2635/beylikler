import { DIPLOMACY, PERSONALITIES } from '../../config/lords.js';
import { RESOURCE_IDS } from '../../config/resources.js';
import { lordsOf, lordVillage, lordDefeated, lordPowerIn, distance } from '../../systems/world.js';
import { relationOf, relationLevel, peaceUntil, giftCost, peaceCost, inspectGift, inspectPeace } from '../../systems/diplomacy.js';
import { buildingImage } from '../art/sprites.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtDecimal } from '../format.js';
import { toast } from '../toast.js';

/**
 * Diplomasi: rakip beylerle ilişkiler. Hediye ilişkiyi yükseltir, barış antlaşması bir süre
 * saldırıyı durdurur; iyi ilişkideki bey daha seyrek saldırır, müttefik bey hiç saldırmaz.
 */
export function createDiplomacyView({ game, refresh }) {
  const cards = lordsOf(game.state.world.seed).map((lord) => createLordCard(lord));
  const note = h('p', { class: 'muted page-intro' });
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Diplomasi')),
    note,
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Rakip beyler'), h('span', { class: 'muted' }, `İlişki her oyun günü ${DIPLOMACY.decayPerDay} puan sıfıra yaklaşır; hisarına saldırmak ${-DIPLOMACY.attackPenalty} puan düşürür`)), h('div', { class: 'lord-grid' }, cards.map((card) => card.el))),
    h(
      'section',
      { class: 'panel stack-sm' },
      h('div', { class: 'panel-head' }, h('h2', null, 'İlişki ve saldırı')),
      h('ul', { class: 'relation-legend' }, DIPLOMACY.levels.map((level) => h('li', { class: `rel-${level.id}` }, h('strong', null, level.name), ` ${Number.isFinite(level.min) ? `(${level.min} ve üstü)` : ''} — ${intervalText(level.interval)}`))),
    ),
  );

  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-lord]');
    if (!button) return;
    const now = Date.now();
    const { lord, gift } = button.dataset;
    const result = gift ? game.sendGift(lord, gift, now) : game.makePeace(lord, now);
    if (result.ok) toast(gift ? `Hediye gönderildi; ilişki ${Math.round(result.relation)} oldu.` : `Barış antlaşması imzalandı: ${DIPLOMACY.peace.days} oyun günü saldırı yok.`, 'success');
    else toast(result.reason, 'error');
    refresh(now);
  });

  return {
    el,
    update(now) {
      const online = !!game.online;
      setText(
        note,
        online
          ? 'Çok oyunculu dünyada beyler oyunculara saldırmaz; yine de hediye ve antlaşmayla ilişki kurabilirsin.'
          : 'Beylerle aranı iyi tutarsan daha seyrek saldırırlar; müttefik olan bey hiç saldırmaz. Hediyeler ve antlaşmalar yönettiğin köyün ambarından ödenir.',
      );
      for (const card of cards) card.update(game, now);
    },
  };
}

function intervalText(interval) {
  if (interval === Infinity) return 'hiç saldırmaz';
  if (interval > 1) return `${fmtDecimal(interval)} kat seyrek saldırır`;
  if (interval < 1) return `daha sık saldırır (%${Math.round((1 / interval - 1) * 100)} fazla)`;
  return 'olağan sıklıkta saldırır';
}

/** Hediyelerde her kaynaktan aynı miktar gider: kısa yazılır. */
function costText(cost) {
  const each = cost[RESOURCE_IDS[0]];
  return `her kaynaktan ${fmtInt(each)}${cost.akce ? ` + ${fmtInt(cost.akce)} Akçe` : ''}`;
}

function createLordCard(lord) {
  const relationValue = h('strong', { class: 'relation-value' });
  const relationName = h('span', { class: 'relation-name' });
  const fill = h('span', { class: 'relation-fill' });
  const marker = h('span', { class: 'relation-marker' });
  const effect = h('p', { class: 'muted lord-effect' });
  const peace = h('p', { class: 'peace-note' });
  const stats = h('p', { class: 'muted' });
  const giftRows = DIPLOMACY.gifts.map((tier) => {
    const cost = h('span', { class: 'muted diplo-cost' });
    const button = h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { lord: lord.id, gift: tier.id } }, `${tier.name} (+${tier.relation})`);
    return { tier, cost, button, row: h('div', { class: 'diplo-row' }, button, cost) };
  });
  const peaceCostEl = h('span', { class: 'muted diplo-cost' });
  const peaceButton = h('button', { type: 'button', class: 'btn btn-small', dataset: { lord: lord.id } }, icon('baris'), `Barış antlaşması (${DIPLOMACY.peace.days} gün)`);
  const peaceReason = h('span', { class: 'card-status' });
  const actions = h('div', { class: 'stack-sm' }, giftRows.map((r) => r.row), h('div', { class: 'diplo-row' }, peaceButton, peaceCostEl), peaceReason);
  const defeated = h('p', { class: 'muted' }, 'Hisarı fethedildi; bu bey artık oyunda değil.');
  const el = h(
    'article',
    { class: 'card lord-card' },
    h(
      'div',
      { class: 'card-head' },
      h('img', { class: 'lord-art', src: buildingImage('saray'), alt: '', loading: 'lazy' }),
      h('div', { class: 'card-title' }, h('h3', null, `${lord.name} Bey`), h('span', { class: 'badge badge-muted' }, PERSONALITIES[lord.personality].name)),
      h('a', { class: 'card-link lord-map', href: `#/harita/${lord.x}/${lord.y}` }, 'Haritada →'),
    ),
    stats,
    h('div', { class: 'relation' }, h('div', { class: 'relation-top' }, relationName, relationValue), h('div', { class: 'relation-bar' }, fill, marker)),
    effect,
    peace,
    actions,
    defeated,
  );
  let signature = null;

  return {
    el,
    update(game, now) {
      const { state } = game;
      const village = game.village;
      const out = lordDefeated(state, lord.id);
      el.classList.toggle('defeated', out);
      defeated.hidden = !out;
      actions.hidden = out;
      if (out) return;

      const relation = relationOf(state, lord.id);
      const level = relationLevel(relation);
      setText(relationValue, String(Math.round(relation)));
      setText(relationName, level.name);
      relationName.className = `relation-name rel-${level.id}`;
      // Çubuk: −100 solda, 0 ortada, +100 sağda; dolgu ortadan değere uzanır.
      const pct = (relation + 100) / 2;
      fill.style.left = `${Math.min(50, pct)}%`;
      fill.style.width = `${Math.abs(pct - 50)}%`;
      fill.classList.toggle('negative', relation < 0);
      marker.style.left = `${pct}%`;
      setText(effect, `Saldırı: ${intervalText(level.interval)}.`);

      const until = peaceUntil(state, lord.id);
      const peaceLeft = (until - state.world.clock.time) / state.world.speed;
      peace.hidden = peaceLeft <= 0;
      if (peaceLeft > 0) setText(peace, `Barış sürüyor: ${fmtDuration(peaceLeft / 1000)} kaldı.`);

      const hisar = lordVillage(state, lord);
      setText(stats, `${hisar.name} (${lord.x}|${lord.y}) · güç ${fmtDecimal(lordPowerIn(state, lord))} · ${fmtInt(hisar.points)} puan · uzaklık ${fmtDecimal(distance(lord.x, lord.y, village.x, village.y))}`);

      const next = `${village.id}:${village.buildings.ambar}:${state.player.akce}`;
      if (next !== signature) {
        signature = next;
        for (const { tier, cost } of giftRows) setText(cost, costText(giftCost(village, tier.id)));
        setText(peaceCostEl, costText(peaceCost(village)));
      }
      for (const { tier, button } of giftRows) button.disabled = !inspectGift(state, village, lord.id, tier.id).ok;
      const peaceCheck = inspectPeace(state, village, lord.id);
      peaceButton.disabled = !peaceCheck.ok;
      setText(peaceReason, peaceCheck.ok ? '' : peaceCheck.reason);
    },
  };
}
