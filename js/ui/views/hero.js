import { HERO, xpForLevel, RARITIES, ITEM_SLOTS, SLOT_IDS, ITEM_EFFECTS } from '../../config/hero.js';
import { TITLES } from '../../config/titles.js';
import { heroEffects, heroHealthy } from '../../systems/hero.js';
import { renownOf, titleOf, nextTitle } from '../../systems/renown.js';
import { FRONTIER } from '../../systems/expedition.js';
import { REGIONS } from '../../config/expedition.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration } from '../format.js';
import { toast } from '../toast.js';
import { heroPortrait } from '../art/portrait.js';

/**
 * Kahraman sayfası: portre, seviye ve tecrübe, özellik puanları, kuşanılan eşyalar, heybe;
 * altta beyliğin şanı ve unvan merdiveni.
 */
export function createHeroView({ game, refresh }) {
  const portrait = h('div', { class: 'hero-portrait' });
  const levelBadge = h('span', { class: 'hero-level' });
  const nameText = h('h2', { class: 'hero-name' });
  const renameInput = h('input', { type: 'text', maxlength: 24, 'aria-label': 'Kahramanın yeni adı' });
  const renameForm = h(
    'form',
    { class: 'hero-rename', hidden: true },
    renameInput,
    h('button', { class: 'btn btn-small', type: 'submit' }, 'Kaydet'),
    h('button', { class: 'btn btn-small btn-ghost', type: 'button', dataset: { action: 'rename-cancel' } }, 'Vazgeç'),
  );
  const where = h('p', { class: 'hero-where' });
  const xpText = h('span', { class: 'muted' });
  const xpBar = h('span');
  const power = h('span');
  const guard = h('span');
  const pointsBadge = h('span', { class: 'badge badge-gold' });
  const titleLine = h('span', { class: 'muted' });

  const attrRows = Object.entries(HERO.attributes).map(([id, attr]) => {
    const value = h('strong', { class: 'attr-value' });
    const effect = h('span', { class: 'attr-effect' });
    const button = h('button', { type: 'button', class: 'btn btn-small btn-gold attr-plus', dataset: { attr: id }, 'aria-label': `${attr.name} +1` }, '+');
    const row = h(
      'div',
      { class: 'attr-row' },
      h('span', { class: 'attr-icon' }, icon(attr.icon)),
      h('div', { class: 'attr-text' }, h('strong', null, attr.name), h('span', { class: 'muted' }, attr.effect)),
      value,
      effect,
      button,
    );
    return { id, attr, row, value, effect, button };
  });

  const slots = h('div', { class: 'equip-grid' });
  const bag = h('div', { class: 'bag-grid' });
  const bagCount = h('span', { class: 'muted' });
  const renown = createRenownPanel();

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Kahraman'), titleLine),
    h(
      'section',
      { class: 'panel hero-sheet' },
      h('div', { class: 'hero-medallion' }, portrait, levelBadge),
      h(
        'div',
        { class: 'hero-info stack-sm' },
        h('div', { class: 'hero-name-row' }, nameText, h('button', { type: 'button', class: 'link-btn', dataset: { action: 'rename' } }, 'Adını değiştir')),
        renameForm,
        where,
        h('div', { class: 'hero-xp' }, h('div', { class: 'progress progress-gold' }, xpBar), xpText),
        h(
          'div',
          { class: 'stats' },
          h('span', { class: 'stat', title: 'Kahramanın orduya kattığı saldırı gücü (atlı sayılır)' }, icon('saldiri'), power),
          h('span', { class: 'stat', title: 'Köyündeyken savunmaya kattığı güç' }, icon('savunma'), guard),
        ),
        h(
          'p',
          { class: 'muted hint' },
          'Kahraman köyündeyken üretime ve savunmaya güç katar; saldırı ya da keşif formunda "Kahraman katılsın" seçilirse orduya önderlik eder. Yenilen ordudaki kahraman yaralanır ve bir süre iyileşir.',
        ),
      ),
    ),
    h(
      'div',
      { class: 'hero-columns' },
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Özellikler'), pointsBadge),
        h('div', { class: 'attr-list' }, attrRows.map((r) => r.row)),
        h('p', { class: 'muted hint' }, `Her seviyede ${HERO.pointsPerLevel} puan. Bir özellik en çok ${HERO.maxAttribute} puan alır.`),
      ),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Kuşanılanlar')),
        slots,
        h('p', { class: 'muted hint' }, 'Eşyalar harabelerden, Moğol ordugâhlarından, keşiflerden ve olaylardan çıkar. Kahraman seferdeyken eşya değiştirilemez.'),
      ),
    ),
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Heybe'), bagCount), bag),
    renown.el,
  );

  el.addEventListener('click', (event) => {
    const now = Date.now();
    const plus = event.target.closest('button[data-attr]');
    if (plus) {
      const result = game.heroSpend(plus.dataset.attr, now);
      if (!result.ok) toast(result.reason, 'error');
      refresh(now);
      return;
    }
    const equip = event.target.closest('button[data-equip]');
    if (equip) {
      const result = game.heroEquip(Number(equip.dataset.equip), now);
      if (result.ok) toast(`${result.item.name} kuşanıldı.`, 'success');
      else toast(result.reason, 'error');
      refresh(now);
      return;
    }
    const unequip = event.target.closest('button[data-unequip]');
    if (unequip) {
      const result = game.heroUnequip(unequip.dataset.unequip, now);
      if (!result.ok) toast(result.reason, 'error');
      refresh(now);
      return;
    }
    const sell = event.target.closest('button[data-sell]');
    if (sell) {
      const result = game.heroSell(Number(sell.dataset.sell), now);
      if (result.ok) toast(`${result.item.name} ${result.akce} Akçeye satıldı.`, 'success');
      else toast(result.reason, 'error');
      refresh(now);
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'rename') {
      renameInput.value = game.state.hero?.name ?? '';
      renameForm.hidden = false;
      renameInput.focus();
    } else if (action === 'rename-cancel') {
      renameForm.hidden = true;
    }
  });
  renameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (game.renameHero(renameInput.value)) {
      renameForm.hidden = true;
      toast(`Kahramanın adı artık ${game.state.hero.name}.`, 'success');
    } else {
      toast('Kahramanın adı boş olamaz.', 'error');
    }
    refresh();
  });

  let portraitSig = null;
  let equipSig = null;
  let bagSig = null;

  return {
    el,
    update(now) {
      const { state } = game;
      const hero = state.hero;
      if (!hero) return;
      const fx = heroEffects(hero);
      const healthy = heroHealthy(hero, now);
      const sig = `${hero.level}|${healthy}|${SLOT_IDS.map((s) => hero.equipment[s]?.rarity ?? '-').join(',')}`;
      if (sig !== portraitSig) {
        portraitSig = sig;
        portrait.innerHTML = heroPortrait(hero, { wounded: !healthy });
      }
      setText(levelBadge, String(hero.level));
      setText(nameText, hero.name);
      setText(titleLine, `${titleOf(state).name} ${hero.name} · ${hero.level}. seviye`);
      setText(where, heroWhere(state, hero, now));
      where.classList.toggle('wounded', !healthy);
      const need = xpForLevel(hero.level);
      const max = hero.level >= HERO.maxLevel;
      setText(xpText, max ? 'En yüksek seviye' : `Tecrübe ${fmtInt(hero.xp)} / ${fmtInt(need)}`);
      xpBar.style.width = `${max ? 100 : Math.min(100, (hero.xp / need) * 100)}%`;
      setText(power, fmtInt(fx.power));
      setText(guard, fmtInt(fx.guard));
      setText(pointsBadge, hero.points ? `${hero.points} puan dağıtılabilir` : 'Puan yok');
      pointsBadge.classList.toggle('badge-muted', !hero.points);

      for (const r of attrRows) {
        const points = hero.attrs[r.id];
        setText(r.value, String(points));
        setText(r.effect, `+%${Math.round(points * r.attr.perPoint * 100)}`);
        r.button.disabled = hero.points <= 0 || points >= HERO.maxAttribute;
      }

      const eSig = SLOT_IDS.map((s) => hero.equipment[s]?.id ?? 0).join(',') + (hero.away ? 'a' : '');
      if (eSig !== equipSig) {
        equipSig = eSig;
        slots.replaceChildren(...SLOT_IDS.map((slot) => slotCard(slot, hero.equipment[slot], !!hero.away)));
      }
      const bSig = hero.inventory.map((item) => item.id).join(',') + (hero.away ? 'a' : '') + eSig;
      if (bSig !== bagSig) {
        bagSig = bSig;
        bag.replaceChildren(
          ...(hero.inventory.length
            ? hero.inventory.map((item) => bagCard(item, hero.equipment[item.slot], !!hero.away))
            : [h('p', { class: 'muted' }, 'Heybe boş. Harabeleri yağmala, Moğol ordugâhlarını dağıt, keşfe çık.')]),
        );
      }
      setText(bagCount, `${hero.inventory.length}/${HERO.inventoryMax}`);
      renown.update(state);
    },
  };
}

/** Kahramanın nerede olduğu ve durumu, tek cümle. */
export function heroWhere(state, hero, now) {
  const home = state.villages[hero.home];
  if (!heroHealthy(hero, now)) return `Yaralı · ${home?.name ?? 'köyünde'} iyileşiyor (${fmtDuration((hero.woundedUntil - now) / 1000)})`;
  if (hero.away) {
    const movement = Object.values(state.villages).flatMap((v) => v.movements).find((m) => m.id === hero.away);
    if (!movement) return 'Seferde';
    const target = movement.region ? `${REGIONS[movement.region]?.name ?? FRONTIER.name}` : (movement.target?.name ?? '');
    if (movement.type === 'donus') return `Orduyla dönüyor · ${target}`;
    return movement.type === 'kesif' ? `Keşifte · ${target}` : `Orduyla yolda · ${target}`;
  }
  return `${home?.name ?? 'Köyünde'} köyünde · üretim ve savunmaya güç katıyor`;
}

function effectList(effects) {
  return h(
    'ul',
    { class: 'item-effects' },
    Object.entries(effects).map(([key, value]) => h('li', null, `${ITEM_EFFECTS[key]} ${key.startsWith('hero') ? `+${fmtInt(value)}` : `+%${Math.round(value * 100)}`}`)),
  );
}

function itemHead(item) {
  return h(
    'div',
    { class: 'item-head' },
    h('span', { class: 'item-icon' }, icon(ITEM_SLOTS[item.slot].icon)),
    h('div', null, h('strong', { class: 'item-name' }, item.name), h('span', { class: 'item-rarity' }, `${RARITIES[item.rarity].name} ${ITEM_SLOTS[item.slot].name.toLowerCase()}`)),
  );
}

function slotCard(slot, item, away) {
  if (!item) {
    return h(
      'div',
      { class: 'equip-slot empty' },
      h('span', { class: 'item-icon' }, icon(ITEM_SLOTS[slot].icon)),
      h('div', null, h('strong', null, ITEM_SLOTS[slot].name), h('span', { class: 'muted' }, 'Boş')),
    );
  }
  return h(
    'div',
    { class: `equip-slot rarity-${item.rarity}` },
    itemHead(item),
    effectList(item.effects),
    h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { unequip: slot }, disabled: away }, 'Çıkar'),
  );
}

/** Heybedeki eşya; kuşanılanla karşılaştırma ("daha güçlü") etkilerin toplamına göre. */
function bagCard(item, equipped, away) {
  const score = (it) => (it ? Object.entries(it.effects).reduce((sum, [key, v]) => sum + (key.startsWith('hero') ? v / 1000 : v), 0) : 0);
  const better = score(item) > score(equipped);
  return h(
    'div',
    { class: `bag-item rarity-${item.rarity}` },
    itemHead(item),
    effectList(item.effects),
    better ? h('span', { class: 'item-better' }, equipped ? '▲ Kuşanılandan güçlü' : '▲ Yuva boş') : null,
    h(
      'div',
      { class: 'card-actions' },
      h('button', { type: 'button', class: 'btn btn-small', dataset: { equip: item.id }, disabled: away }, 'Kuşan'),
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { sell: item.id } }, icon('akce'), `Sat (${RARITIES[item.rarity].akce})`),
    ),
  );
}

/** Şan ve unvan merdiveni. */
function createRenownPanel() {
  const value = h('strong', { class: 'renown-value' });
  const next = h('span', { class: 'muted' });
  const bar = h('span');
  const ladder = h(
    'ol',
    { class: 'title-ladder' },
    TITLES.map((title) =>
      h(
        'li',
        { dataset: { title: title.id } },
        h('span', { class: 'title-seal' }, icon('tac')),
        h('div', null, h('strong', null, title.name), h('span', { class: 'muted' }, title.renown ? `${fmtInt(title.renown)} şan` : 'Başlangıç')),
        h('ul', { class: 'perk-list' }, title.perks.length ? title.perks.map((perk) => h('li', null, perk)) : h('li', { class: 'muted' }, 'Ayrıcalık yok')),
      ),
    ),
  );
  const el = h(
    'section',
    { class: 'panel renown-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Şan ve unvan'), h('span', { class: 'renown-chip' }, icon('san'), value)),
    h('div', { class: 'hero-xp' }, h('div', { class: 'progress progress-gold' }, bar), next),
    h(
      'p',
      { class: 'muted hint' },
      'Şan; zaferlerden, savunmalardan, fethedilen köy ve beylerden, görev ve başarımlardan, harabelerden, Moğol akınlarından, araştırmalardan ve kahramanın seviyesinden gelir. Unvan bir kez kazanılınca düşmez; ayrıcalıkları bütün köylerine işler.',
    ),
    ladder,
  );
  return {
    el,
    update(state) {
      const renown = renownOf(state);
      const current = titleOf(state);
      const upcoming = nextTitle(state);
      setText(value, `${fmtInt(renown)} şan`);
      if (upcoming) {
        setText(next, `${upcoming.name} unvanına ${fmtInt(Math.max(0, upcoming.renown - renown))} şan kaldı`);
        bar.style.width = `${Math.min(100, Math.max(0, ((renown - current.renown) / (upcoming.renown - current.renown)) * 100))}%`;
      } else {
        setText(next, 'En yüksek unvan: Hünkâr');
        bar.style.width = '100%';
      }
      const index = TITLES.indexOf(current);
      for (const [i, li] of [...ladder.children].entries()) {
        li.classList.toggle('earned', i <= index);
        li.classList.toggle('current', i === index);
      }
    },
  };
}
