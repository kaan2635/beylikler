import { BUILDINGS, BUILDING_IDS } from '../../config/buildings.js';
import { maxBuildQueue } from '../../systems/construction.js';
import { finishCost } from '../../systems/premium.js';
import { sceneSvg, skyState } from '../art/scene.js';
import { titleOf, renownOf, nextTitle } from '../../systems/renown.js';
import { heroHealthy } from '../../systems/hero.js';
import { heroWhere } from './hero.js';
import { createQuestList } from './quests.js';
import { createBuildingCard, upgradeFromButton, BUILDING_GROUPS } from '../building-card.js';
import { openBuildingDialog } from '../building-dialog.js';
import { villagePoints, continentOf } from '../../systems/world.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';
import { ILIM } from '../../config/ilim.js';
import { seasonOf, seasonLeft } from '../../systems/seasons.js';
import { lordsOf } from '../../systems/world.js';
import { openEventDialog } from '../event-dialog.js';
import { bonusText } from '../bonus-text.js';

const FILTER_KEY = 'beylikler:bina-suzgeci';

function readFilter() {
  try {
    const value = localStorage.getItem(FILTER_KEY);
    return value === 'hazir' || BUILDING_GROUPS[value] ? value : 'tumu';
  } catch {
    return 'tumu';
  }
}

/** Köy ekranı: inşaat kuyruğu ve bina kartları. */
export function createVillageView({ game, refresh }) {
  const name = h('h1', { class: 'village-name' });
  const coords = h('span', { class: 'muted' });
  const queue = createQueuePanel();
  const status = createStatusPanel({ game, refresh });
  const cards = BUILDING_IDS.map((id) => createBuildingCard(id));
  const open = (id) => openBuildingDialog({ game, refresh }, id);
  const scene = createScene(open);
  const filter = createBuildingFilter(cards);

  const quests = createQuestList({ game, refresh, compact: true });
  const questPanel = h(
    'section',
    { class: 'panel quest-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Görevler'), h('a', { class: 'card-link', href: '#/gorevler' }, 'Tüm görevler ve başarımlar →')),
    quests.el,
  );

  // Geniş ekranda sahne ve binalar solda, kuyruk ve görevler sağ sütunda; dar ekranda
  // hepsi alt alta (sahne, kuyruk, görevler, binalar) dizilir (bkz. .village-layout).
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, name, coords),
    h(
      'div',
      { class: 'village-layout' },
      h(
        'div',
        { class: 'village-main' },
        scene.el,
        h(
          'section',
          { class: 'panel buildings-panel' },
          h('div', { class: 'panel-head' }, h('h2', null, 'Binalar'), filter.el),
          h('div', { class: 'building-grid' }, cards.map((card) => card.el)),
          filter.empty,
        ),
      ),
      h('aside', { class: 'village-side' }, status.el, queue.el, questPanel),
    ),
  );

  // Düğmeler her saniye yeniden oluşturulmadığı için tek bir dinleyici yeterli.
  el.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open]');
    if (opener) {
      open(opener.dataset.open);
      return;
    }
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const now = Date.now();
    if (button.dataset.action === 'upgrade') {
      upgradeFromButton(game, button, now);
    } else if (button.dataset.action === 'cancel') {
      const job = game.cancelLastUpgrade(now);
      if (job) toast(`${BUILDINGS[job.building].name} yükseltmesi iptal edildi, kaynaklar iade edildi.`);
    } else if (button.dataset.action === 'finish') {
      const result = game.finishBuilding(now);
      if (!result.ok) toast(result.reason, 'error');
    }
    refresh(now);
  });

  return {
    el,
    update(now) {
      const village = game.village;
      setText(name, village.name);
      const points = fmtInt(villagePoints(village.buildings));
      setText(coords, `(${village.x}|${village.y}) · ${continentOf(village.x, village.y)} · ${points} puan`);
      scene.update(village, game.state.world);
      scene.light(game.state.world);
      status.update(now);
      quests.update();
      queue.update(village, now, game.state);
      for (const card of cards) card.update(village, game.state.world, now);
      filter.update();
    },
  };
}

/**
 * Bina listesinin süzgeci: Tümü, şimdi yükseltilebilenler ya da gruplar (kaynak, askerî, yönetim).
 * Seçim tarayıcıda hatırlanır.
 */
function createBuildingFilter(cards) {
  let active = readFilter();
  const options = [['tumu', 'Tümü'], ['hazir', 'Yükseltilebilir'], ...Object.entries(BUILDING_GROUPS).map(([id, g]) => [id, g.label])];
  const counts = {};
  const buttons = options.map(([id, label]) => {
    counts[id] = h('span', { class: 'segment-count' });
    return h('button', { type: 'button', class: 'segment', dataset: { filter: id }, 'aria-pressed': 'false' }, label, counts[id]);
  });
  const el = h('div', { class: 'segmented building-filter', role: 'group', 'aria-label': 'Binaları süz' }, buttons);
  const empty = h('p', { class: 'muted filter-empty' }, 'Şu anda yükseltilebilecek bina yok; kaynaklar birikince burada görünür.');

  const matches = (card, id) => {
    if (id === 'tumu') return true;
    if (id === 'hazir') return card.el.classList.contains('ready');
    return BUILDING_GROUPS[id].ids.includes(card.el.dataset.building);
  };
  const update = () => {
    let shown = 0;
    for (const card of cards) {
      const visible = matches(card, active);
      card.el.hidden = !visible;
      if (visible) shown += 1;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === active));
    for (const button of buttons) button.classList.toggle('active', button.dataset.filter === active);
    setText(counts.hazir, String(cards.filter((card) => matches(card, 'hazir')).length));
    empty.hidden = shown > 0;
  };
  el.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    active = button.dataset.filter;
    try {
      localStorage.setItem(FILTER_KEY, active);
    } catch {
      // gizli pencere: seçim hatırlanmaz
    }
    update();
  });
  return { el, empty, update };
}

/** Köy sahnesi: binalar seviyelerine göre çizilir; tıklanan binanın kartına gidilir. */
function createScene(onSelect) {
  const clock = h('span', { class: 'scene-clock', title: 'Oyun saati: köyde gece ve gündüz buna göre değişir' });
  const el = h('section', { class: 'scene-panel', 'aria-label': 'Köy görünümü' });
  let signature = null;
  let lightSig = null;
  const pick = (event) => {
    const target = event.target.closest('[data-building]');
    if (target) onSelect(target.dataset.building);
  };
  el.addEventListener('click', pick);
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    pick(event);
  });
  const names = Object.fromEntries(BUILDING_IDS.map((id) => [id, BUILDINGS[id].name]));

  return {
    el,
    update(village, world) {
      const upgrading = new Set(village.buildQueue.map((job) => job.building));
      const locked = new Set(
        BUILDING_IDS.filter((id) => Object.entries(BUILDINGS[id].requires).some(([req, lvl]) => (village.buildings[req] ?? 0) < lvl)),
      );
      const season = seasonOf(world)?.id ?? null;
      const next = JSON.stringify([village.id, village.buildings, [...upgrading], [...locked], season]);
      if (next === signature) return;
      signature = next;
      el.dataset.season = season ?? '';
      el.innerHTML = sceneSvg(village.buildings, { upgrading, locked, names, season });
      el.append(clock);
    },
    /** Gece ve gündüz: oyun saatine göre ışık, güneş ve ay (sahne yeniden çizilmeden). */
    light(world) {
      const sky = skyState(world);
      const hh = Math.floor(sky.hour);
      const mm = Math.floor((sky.hour % 1) * 60);
      const sig = `${hh}:${Math.floor(mm / 5)}`;
      if (sig === lightSig) return;
      lightSig = sig;
      el.style.setProperty('--night', sky.night.toFixed(3));
      el.style.setProperty('--sun-x', sky.sun[0].toFixed(1));
      el.style.setProperty('--sun-y', sky.sun[1].toFixed(1));
      el.style.setProperty('--moon-x', sky.moon[0].toFixed(1));
      el.style.setProperty('--moon-y', sky.moon[1].toFixed(1));
      const part = hh < 5 ? 'Gece' : hh < 7 ? 'Şafak' : hh < 11 ? 'Sabah' : hh < 15 ? 'Öğle' : hh < 18 ? 'İkindi' : hh < 20 ? 'Akşam' : 'Gece';
      clock.replaceChildren(icon(sky.night > 0.5 ? 'ay' : 'gunes'), `${part} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    },
  };
}

/**
 * Beylik durumu: mevsim, bekleyen olay, Divan'daki araştırma, olaylardan gelen geçici etkiler
 * ve beylerle barışlar. Köy ekranının yan sütununda en üstte durur.
 */
function createStatusPanel({ game, refresh }) {
  const seasonIcon = h('span', { class: 'status-icon' });
  const seasonName = h('strong');
  const seasonLeftText = h('span', { class: 'muted' });
  const seasonPerks = h('span', { class: 'status-sub' });
  const eventRow = h('div', { class: 'status-row status-event' });
  const invasionRow = h('div', { class: 'status-row status-event' });
  const heroRow = h('div', { class: 'status-row' });
  const titleRow = h('div', { class: 'status-row' });
  const ilimRow = h('div', { class: 'status-row' });
  const effects = h('ul', { class: 'status-list' });
  const el = h(
    'section',
    { class: 'panel status-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Beylik durumu')),
    h('div', { class: 'status-row' }, seasonIcon, h('div', null, h('div', null, seasonName, ' ', seasonLeftText), seasonPerks)),
    eventRow,
    invasionRow,
    titleRow,
    heroRow,
    ilimRow,
    effects,
  );
  const heroName = h('strong');
  const heroSub = h('span', { class: 'status-sub' });
  heroRow.append(h('span', { class: 'status-icon' }, icon('nav-kahraman')), h('div', null, heroName, heroSub), h('a', { class: 'card-link', href: '#/kahraman' }, 'Kahraman →'));
  const titleName = h('strong');
  const titleSub = h('span', { class: 'status-sub' });
  titleRow.append(h('span', { class: 'status-icon' }, icon('tac')), h('div', null, titleName, titleSub));
  const invasionText = h('span', { class: 'status-sub' });
  const invasionLink = h('a', { class: 'btn btn-small btn-gold' }, 'Ordugâh');
  invasionRow.append(h('span', { class: 'status-icon pulse' }, icon('ordugah')), h('div', null, h('strong', null, 'Moğol akını!'), invasionText), invasionLink);
  el.addEventListener('click', (event) => {
    if (event.target.closest('button[data-action="event"]')) openEventDialog({ game, refresh });
  });
  let signature = null;

  return {
    el,
    update(now) {
      const { state } = game;
      const season = seasonOf(state.world);
      el.querySelector('.status-row').hidden = !season;
      if (season) {
        if (seasonIcon.dataset.season !== season.id) {
          seasonIcon.dataset.season = season.id;
          seasonIcon.replaceChildren(icon(`mevsim-${season.id}`));
        }
        setText(seasonName, season.name);
        setText(seasonLeftText, `· ${fmtDuration(seasonLeft(state.world, now) / state.world.speed / 1000)} kaldı`);
        setText(seasonPerks, season.perks.join(' · '));
      }

      // Unvan ve şan
      const title = titleOf(state);
      const upcoming = nextTitle(state);
      const renown = renownOf(state);
      setText(titleName, `${title.name} · ${fmtInt(renown)} şan`);
      setText(titleSub, upcoming ? `${upcoming.name} unvanına ${fmtInt(Math.max(0, upcoming.renown - renown))} şan kaldı` : 'En yüksek unvan');
      // Kahraman
      const hero = state.hero;
      heroRow.hidden = !hero;
      if (hero) {
        setText(heroName, `${hero.name} · ${hero.level}. seviye${hero.points ? ` · ${hero.points} puan` : ''}`);
        setText(heroSub, heroWhere(state, hero, now));
        heroSub.classList.toggle('loss', !heroHealthy(hero, now));
      }
      // Moğol akını
      const invasion = state.invasion;
      const camp = invasion?.phase === 'active' ? invasion.camp : null;
      invasionRow.hidden = !camp;
      if (camp) {
        invasionLink.href = `#/harita/${camp.x}/${camp.y}`;
        const next = invasion.nextWaveAt ? `sıradaki dalga ${fmtDuration((invasion.nextWaveAt - now) / 1000)} sonra` : invasion.leaveAt ? `ordugâh ${fmtDuration((invasion.leaveAt - now) / 1000)} sonra çekilir` : '';
        setText(invasionText, `Ordugâh (${camp.x}|${camp.y}) · ${invasion.wavesLeft} dalga kaldı${next ? ` · ${next}` : ''}`);
      }

      const pending = state.events?.pending;
      const ilim = state.player.ilim?.current;
      const time = state.world.clock.time;
      const peaces = lordsOf(state.world.seed).filter((lord) => (state.diplomacy?.[lord.id]?.peaceUntil ?? 0) > time);
      const modifiers = state.player.modifiers ?? [];
      const next = [pending?.id, ilim?.id, ilim?.endAt, modifiers.map((m) => m.id + m.until).join(), peaces.map((l) => l.id).join()].join('|');
      if (next !== signature) {
        signature = next;
        eventRow.hidden = !pending;
        if (pending) {
          eventRow.replaceChildren(
            h('span', { class: 'status-icon pulse' }, icon(pending.icon ?? 'olay')),
            h('div', null, h('strong', null, pending.title), h('span', { class: 'status-sub' }, 'Kararını bekliyor')),
            h('button', { type: 'button', class: 'btn btn-small btn-gold', dataset: { action: 'event' } }, 'Karar ver'),
          );
        }
        ilimRow.replaceChildren(
          h('span', { class: 'status-icon' }, icon('nav-divan')),
          ilim
            ? h('div', null, h('strong', null, ILIM[ilim.id].name), h('span', { class: 'status-sub', dataset: { until: ilim.endAt } }))
            : h('div', null, h('strong', null, 'Divan boşta'), h('span', { class: 'status-sub' }, 'Bir araştırma başlat')),
          h('a', { class: 'card-link', href: '#/divan' }, 'Divan →'),
        );
        effects.replaceChildren(
          ...modifiers.map((m) => h('li', null, h('strong', null, m.name), ` · ${bonusText(m.bonus)} · `, h('span', { class: 'muted', dataset: { until: m.until } }))),
          ...peaces.map((lord) => h('li', null, icon('baris'), h('strong', null, ` ${lord.name} Bey ile barış`), ' · ', h('span', { class: 'muted', dataset: { peace: lord.id } }))),
        );
        effects.hidden = !modifiers.length && !peaces.length;
      }
      for (const span of el.querySelectorAll('[data-until]')) setText(span, `${fmtDuration((Number(span.dataset.until) - now) / 1000)} kaldı`);
      for (const span of el.querySelectorAll('[data-peace]')) {
        const left = ((state.diplomacy?.[span.dataset.peace]?.peaceUntil ?? 0) - time) / state.world.speed;
        setText(span, `${fmtDuration(left / 1000)} kaldı`);
      }
    },
  };
}

function createQueuePanel() {
  const count = h('span', { class: 'muted' });
  const body = h('div', { class: 'queue' });
  const el = h(
    'section',
    { class: 'panel queue-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'İnşaat kuyruğu'), count),
    body,
  );
  let signature = null;
  let rows = [];

  function rebuild(jobs, now) {
    rows = jobs.map((job, index) => {
      const remaining = h('span', { class: 'queue-remaining' });
      const bar = h('span');
      const isLast = index === jobs.length - 1;
      const finishText = h('span');
      const finish =
        index === 0
          ? h('button', { class: 'btn btn-small btn-gold', dataset: { action: 'finish' }, title: 'Akçe ile anında bitir' }, icon('simsek'), finishText)
          : null;
      const row = h(
        'div',
        { class: 'queue-row' },
        h('div', null, h('button', { type: 'button', class: 'title-button', dataset: { open: job.building } }, h('strong', null, BUILDINGS[job.building].name)), ` → ${job.level}. seviye`),
        h('div', { class: 'queue-time' }, remaining, h('span', { class: 'muted' }, `bitiş ${fmtClock(job.endAt, now)}`)),
        h(
          'div',
          { class: 'queue-actions' },
          finish,
          isLast ? h('button', { class: 'btn btn-small btn-ghost', dataset: { action: 'cancel' } }, 'İptal') : null,
        ),
        index === 0 ? h('div', { class: 'progress' }, bar) : null,
      );
      return { row, remaining, bar, job, finish, finishText };
    });
    body.replaceChildren(
      ...(rows.length
        ? rows.map((r) => r.row)
        : [h('p', { class: 'muted' }, 'Şu anda inşaat yok. Aşağıdan bir bina seç.')]),
    );
  }

  return {
    el,
    update(village, now, state) {
      const jobs = village.buildQueue;
      setText(count, `${jobs.length}/${maxBuildQueue(village)}`);
      const next = jobs.map((j) => `${j.building}:${j.level}:${j.endAt}`).join('|');
      if (next !== signature) {
        signature = next;
        rebuild(jobs, now);
      }
      rows.forEach(({ remaining, bar, job, finish, finishText }, index) => {
        if (index === 0) {
          setText(remaining, fmtDuration((job.endAt - now) / 1000));
          const progress = (now - job.startAt) / (job.endAt - job.startAt);
          bar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
          const cost = finishCost(job.endAt - now, state.world);
          setText(finishText, `${fmtInt(cost)}`);
          finish.disabled = (state.player.akce ?? 0) < cost;
          finish.title = `${fmtInt(cost)} Akçe ile anında bitir`;
        } else {
          setText(remaining, `sırada · ${fmtDuration((job.endAt - job.startAt) / 1000)}`);
        }
      });
    },
  };
}
