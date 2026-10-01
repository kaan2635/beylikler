import { GAME } from '../config/game.js';
import { BUILDINGS } from '../config/buildings.js';
import { UNITS } from '../config/units.js';
import { createResourceBar } from './resource-bar.js';
import { createVillageView } from './views/village.js';
import { createArmyView } from './views/army.js';
import { createMapView } from './views/map.js';
import { createReportsView } from './views/reports.js';
import { createSmithyView } from './views/smithy.js';
import { createMarketView } from './views/market.js';
import { createRankingView } from './views/ranking.js';
import { createSettingsView } from './views/settings.js';
import { createOverviewView } from './views/overview.js';
import { createTreasuryView } from './views/treasury.js';
import { createExpeditionView } from './views/expedition.js';
import { EXPEDITION_OUTCOMES } from '../config/expedition.js';
import { createQuestsView, claimableQuests } from './views/quests.js';
import { openVictory } from './victory.js';
import { createChatView } from './views/chat.js';
import { createDivanView } from './views/divan.js';
import { createDiplomacyView } from './views/diplomacy.js';
import { openEventDialog } from './event-dialog.js';
import { createHeroView } from './views/hero.js';
import { createHistoryView } from './views/history.js';
import { maybeShowWhatsNew, openIntro } from './whats-new.js';
import { titleOf } from '../systems/renown.js';
import { heroHealthy } from '../systems/hero.js';
import { RARITIES } from '../config/hero.js';
import { REGIONS } from '../config/expedition.js';
import { seasonOf, seasonLeft } from '../systems/seasons.js';
import { ILIM } from '../config/ilim.js';
import { openClassPicker } from './class-picker.js';
import { openHelp } from './help.js';
import { CLASSES, OFFICERS } from '../config/classes.js';
import { initToasts, toast } from './toast.js';
import { h, setText } from './dom.js';
import { icon } from './icons.js';
import { fmtInt, fmtDuration, fmtClock } from './format.js';

// Adres çubuğundaki #/koy gibi yollar ve karşılık gelen ekranlar.
// Yolun devamı ekrana parametre olarak gider: #/harita/503/500 → harita, [503, 500].
const ROUTES = {
  koy: (ctx) => createVillageView(ctx),
  harita: (ctx) => createMapView(ctx),
  ordu: (ctx) => createArmyView(ctx),
  raporlar: (ctx) => createReportsView(ctx),
  siralama: (ctx) => createRankingView(ctx),
  ayarlar: (ctx) => createSettingsView(ctx),
  demirci: (ctx) => createSmithyView(ctx),
  pazar: (ctx) => createMarketView(ctx),
  koyler: (ctx) => createOverviewView(ctx),
  hazine: (ctx) => createTreasuryView(ctx),
  kesif: (ctx) => createExpeditionView(ctx),
  gorevler: (ctx) => createQuestsView(ctx),
  sohbet: (ctx) => createChatView(ctx),
  divan: (ctx) => createDivanView(ctx),
  diplomasi: (ctx) => createDiplomacyView(ctx),
  kahraman: (ctx) => createHeroView(ctx),
  tarihce: (ctx) => createHistoryView(ctx),
};

// Sekmesi olmayan bina sayfalarında hangi sekme seçili görünsün.
const PARENT_TAB = { demirci: 'koy', pazar: 'koy' };

// Sayfa başlığının yanındaki madalyonun simgesi; sekmesi olanlarda sekmenin simgesi.
const VIEW_ICONS = { demirci: 'savunma', pazar: 'tuccar', hazine: 'sandik' };

/** Ekranın başlığına, altın çerçeveli bir madalyon içinde sayfanın simgesini ekler. */
function withEmblem(view, name) {
  const header = view.el.querySelector('.view-header');
  header?.prepend(h('span', { class: 'view-emblem', 'aria-hidden': 'true' }, icon(VIEW_ICONS[name] ?? `nav-${name}`)));
  return view;
}

/**
 * Telefonda alt çubukta yer kalmadığı için ikincil sekmeler (Keşif, Sıralama, Ayarlar…)
 * "Diğer" düğmesinin açtığı küçük bir pencerede toplanır. Geniş ekranda düğme görünmez.
 */
function createMoreMenu() {
  const button = document.getElementById('tab-more');
  const sheet = document.getElementById('more-sheet');
  if (!button || !sheet) return { markActive() {} };
  button.prepend(icon('nav-diger'));
  const close = () => {
    sheet.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', () => {
    if (!sheet.hidden) {
      close();
      return;
    }
    // Her açılışta güncel sekmelerden kurulur (Köyler ve Sohbet duruma göre görünür).
    const links = [...document.querySelectorAll('.tabs .tab-extra')].filter((link) => !link.hidden);
    sheet.replaceChildren(...links.map((link) => {
      const copy = link.cloneNode(true);
      copy.classList.remove('tab-extra');
      return copy;
    }));
    sheet.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  });
  sheet.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('click', (event) => {
    if (!sheet.hidden && !event.target.closest('#more-sheet, #tab-more')) close();
  });
  window.addEventListener('hashchange', close);
  return {
    markActive(route) {
      const extra = document.querySelector(`.tabs .tab-extra[data-route="${route}"]`);
      button.classList.toggle('active', !!extra);
    },
  };
}

/** Arayüzü kurar, yönlendirmeyi ve saniyelik yenilemeyi başlatır. */
export function mountApp(game, { isNew, events }) {
  initToasts(document.getElementById('toasts'));
  const resourceBar = createResourceBar(document.getElementById('resource-bar'));
  const viewRoot = document.getElementById('view');
  const reportsBadge = document.getElementById('reports-badge');
  const questsBadge = document.getElementById('quests-badge');
  const incomingAlert = document.getElementById('incoming-alert');
  const alertText = h('span');
  incomingAlert.append(icon('saldiri'), alertText);
  const villageSwitch = document.getElementById('village-switch');
  const titleChip = document.getElementById('title-chip');
  const titleText = h('span', { class: 'title-name' });
  const heroState = h('span', { class: 'title-hero' });
  titleChip?.append(icon('tac'), titleText, heroState);
  const heroBadge = document.getElementById('hero-badge');
  const invasionAlert = document.getElementById('invasion-alert');
  const invasionText = h('span');
  invasionAlert?.append(icon('ordugah'), h('span', { class: 'invasion-label' }, 'Moğol akını · '), invasionText);
  const overviewTab = document.querySelector('[data-route="koyler"]');
  // Sekmelere simge
  for (const link of document.querySelectorAll('.tabs [data-route]')) link.prepend(icon(`nav-${link.dataset.route}`));
  const akceChip = document.getElementById('akce-chip');
  const akceText = h('span', { class: 'akce-amount' });
  akceChip.append(icon('akce'), akceText);
  // Çok oyunculu: sohbet sekmesi ve bağlantı göstergesi.
  const chatTab = document.querySelector('[data-route="sohbet"]');
  if (chatTab) chatTab.hidden = !game.online;
  const onlineChip = document.getElementById('online-chip');
  if (onlineChip) onlineChip.hidden = !game.online;
  const more = createMoreMenu();
  document.getElementById('help-button')?.addEventListener('click', openHelp);
  // Mevsim göstergesi ve bekleyen olay düğmesi
  const seasonChip = document.getElementById('season-chip');
  const eventButton = document.getElementById('event-button');
  const eventLabel = h('span', null, 'Olay');
  eventButton?.append(icon('olay'), eventLabel);
  eventButton?.addEventListener('click', () => openEventDialog({ game, refresh }));
  let seasonShown = null;
  const diplomacyTab = document.querySelector('[data-route="diplomasi"]');
  if (diplomacyTab) diplomacyTab.hidden = !!game.online;
  let switchSignature = null;
  villageSwitch.addEventListener('change', () => {
    if (game.setActiveVillage(villageSwitch.value)) toast(`${game.village.name} köyünü yönetiyorsun.`);
    refresh();
  });
  const views = {};
  let current = null;

  /** Birden fazla köy varsa tepe çubuğunda köy seçimi. */
  function updateVillageSwitch() {
    const villages = Object.values(game.state.villages);
    villageSwitch.hidden = villages.length < 2;
    overviewTab.hidden = villages.length < 2;
    const signature = villages.map((v) => `${v.id}:${v.name}`).join('|');
    if (signature !== switchSignature) {
      switchSignature = signature;
      villageSwitch.replaceChildren(...villages.map((v) => h('option', { value: v.id }, `${v.name} (${v.x}|${v.y})`)));
    }
    villageSwitch.value = game.state.activeVillageId;
  }

  function refresh(now = Date.now()) {
    game.tick(now);
    updateVillageSwitch();
    resourceBar.update(game);
    akceText.textContent = fmtInt(game.state.player.akce ?? 0);
    const season = seasonOf(game.state.world);
    if (seasonChip) {
      seasonChip.hidden = !season;
      if (season) {
        if (seasonShown !== season.id) {
          seasonShown = season.id;
          seasonChip.replaceChildren(icon(`mevsim-${season.id}`), h('span', { class: 'season-name' }, season.name), h('span', { class: 'season-left' }));
          seasonChip.dataset.season = season.id;
        }
        const left = seasonLeft(game.state.world, now) / game.state.world.speed / 1000;
        seasonChip.lastChild.textContent = `${Math.max(0, Math.floor(left / 86400))}g ${Math.floor((left % 86400) / 3600)}s`;
        seasonChip.title = `${season.name}: ${season.description} ${season.perks.join(', ')}. Mevsim değişimine ${fmtDuration(left)}.`;
      }
    }
    const pendingEvent = game.state.events?.pending;
    if (eventButton) {
      eventButton.hidden = !pendingEvent;
      if (pendingEvent) {
        eventLabel.textContent = pendingEvent.title;
        eventButton.title = `Olay: ${pendingEvent.title} — kararını bekliyor (${fmtDuration((pendingEvent.expiresAt - now) / 1000)} kaldı)`;
      }
    }
    current?.update(now);
    const unread = game.state.reports.filter((report) => !report.read).length;
    reportsBadge.hidden = unread === 0;
    reportsBadge.textContent = String(unread);
    const claimable = claimableQuests(game.state);
    questsBadge.hidden = claimable === 0;
    questsBadge.textContent = String(claimable);
    if (game.online && onlineChip) {
      const where = game.room ? `Oda ${game.room.code}` : game.username ?? '';
      onlineChip.textContent = `${game.connected === false ? '○' : '●'} ${where} · ${game.playerCount ?? 0} oyuncu`;
      onlineChip.classList.toggle('stale', !!game.pending || game.connected === false);
      onlineChip.title = game.room?.host ? 'Oda senin tarayıcında açık. Davet için: Ayarlar → Çok oyunculu' : 'Çok oyunculu dünya · sohbet';
    }

    // Unvan ve kahraman: tepe çubuğunda; dağıtılmamış puan varsa rozet.
    const hero = game.state.hero;
    if (titleChip) {
      titleChip.hidden = !game.state.player.class;
      setText(titleText, titleOf(game.state).name);
      const wounded = hero && !heroHealthy(hero, now);
      setText(heroState, hero ? (wounded ? 'yaralı' : hero.away ? 'seferde' : `${hero.level}. sv`) : '');
      titleChip.classList.toggle('wounded', !!wounded);
      titleChip.classList.toggle('has-points', !!hero?.points);
      titleChip.title = hero ? `${titleOf(game.state).name} · Kahraman ${hero.name}, ${hero.level}. seviye${hero.points ? ` · ${hero.points} puan dağıtılabilir` : ''}` : 'Kahraman';
    }
    if (heroBadge) {
      heroBadge.hidden = !hero?.points;
      heroBadge.textContent = String(hero?.points ?? 0);
    }
    // Moğol akını: ordugâh kurulduysa her sayfadan görünen uyarı.
    const invasion = game.state.invasion;
    if (invasionAlert) {
      const camp = invasion?.phase === 'active' ? invasion.camp : null;
      invasionAlert.hidden = !camp;
      if (camp) {
        invasionAlert.href = `#/harita/${camp.x}/${camp.y}`;
        const next = invasion.nextWaveAt ? fmtDuration((invasion.nextWaveAt - now) / 1000) : invasion.leaveAt ? `çekilme ${fmtDuration((invasion.leaveAt - now) / 1000)}` : '';
        invasionText.textContent = `${invasion.wavesLeft} dalga${next ? ` · ${next}` : ''}`;
        invasionAlert.title = `Moğol ordugâhı (${camp.x}|${camp.y}). Ordugâhı dağıtırsan akın biter ve büyük ödül kazanırsın.`;
      }
    }

    // Köye gelen bey saldırıları: tepe çubuğunda her sayfadan görünen uyarı.
    const incoming = Object.values(game.state.villages).flatMap((village) => village.incoming);
    incomingAlert.hidden = incoming.length === 0;
    if (incoming.length) {
      const first = Math.min(...incoming.map((attack) => attack.arriveAt));
      alertText.textContent = `${incoming.length} saldırı geliyor · ${fmtDuration((first - now) / 1000)}`;
      incomingAlert.title = `İlk saldırı ${fmtClock(first, now)} varacak. Ayrıntılar Ordu sekmesinde.`;
    }
    document.title = `${incoming.length ? '⚔ ' : ''}${unread ? `(${unread}) ` : ''}${game.village.name} · ${GAME.title}`;
  }

  function route() {
    const [requested, ...params] = location.hash.replace(/^#\/?/, '').split('/');
    const name = ROUTES[requested] ? requested : 'koy';
    views[name] ??= withEmblem(ROUTES[name]({ game, refresh }), name);
    current = views[name];
    viewRoot.replaceChildren(current.el);
    current.onShow?.(params.map(Number));
    const tab = PARENT_TAB[name] ?? name;
    more.markActive(tab);
    for (const link of document.querySelectorAll('[data-route]')) {
      const active = link.dataset.route === tab;
      link.classList.toggle('active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
        // Dar ekranda sekmeler yana kayar; seçili sekme görünür kalsın.
        const bar = link.parentElement;
        const left = link.offsetLeft - bar.offsetLeft;
        if (left < bar.scrollLeft || left + link.offsetWidth > bar.scrollLeft + bar.clientWidth) {
          bar.scrollLeft = left - (bar.clientWidth - link.offsetWidth) / 2;
        }
      } else {
        link.removeAttribute('aria-current');
      }
    }
    refresh();
  }

  game.on((newEvents) => {
    // Çok oyunculu bildirimler: sohbet, sunucu reddi, oturum sonu.
    const rest = [];
    for (const event of newEvents) {
      if (event.type === 'chat') {
        const { message } = event;
        if (!message.system && message.playerId !== game.playerId && !location.hash.startsWith('#/sohbet')) toast(`${message.name}: ${message.text}`, 'info', 5000);
        else if (message.system) toast(message.text, 'info', 4000);
      } else if (event.type === 'server-error') {
        toast(`Sunucu: ${event.reason}`, 'error', 6000);
      } else if (event.type === 'connection-lost') {
        toast('Ev sahibiyle bağlantı koptu; yeniden bağlanılıyor…', 'error', 6000);
      } else if (event.type === 'connection-back') {
        toast('Bağlantı yeniden kuruldu.', 'success');
      } else if (event.type === 'session-expired') {
        toast('Oturumun sona erdi. Ayarlar → Çok oyunculu bölümünden yeniden giriş yap.', 'error', 10000);
      } else {
        rest.push(event);
      }
    }
    if (rest.length) announce(rest, false);
    if (rest.some((event) => event.type === 'victory')) openVictory(game);
    if (game.online) refresh(); // sunucudan gelen değişiklik hemen görünsün
  });
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  setInterval(refresh, GAME.tickMs);
  route();

  const welcome = () => toast('Beyliğine hoş geldin! Sahnede bir binaya tıklayıp yükselt; ne yapacağını Görevler gösterir. Rehber için tepedeki ? düğmesi.', 'success', 9000);
  const pickClass = () =>
    openClassPicker(game, (classId) => {
      refresh();
      if (isNew) welcome();
      else toast(`Sınıfın: ${CLASSES[classId].name}. Başlangıç Akçen Hazine'de seni bekliyor.`, 'success', 7000);
    });
  if (!game.state.player.class) {
    if (isNew) openIntro(pickClass);
    else pickClass();
  } else if (isNew) {
    welcome();
  } else {
    maybeShowWhatsNew();
  }
  announce(events, true);
  if (events.some((event) => event.type === 'victory')) openVictory(game);
}

function announce(events, whileAway) {
  if (events.length > 3) {
    const counts = {};
    for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
    const labels = {
      'build-complete': 'inşaat',
      'train-complete': 'eğitim',
      'attack-result': 'savaş',
      'spy-result': 'casusluk',
      'research-complete': 'geliştirme',
      'incoming-attack': 'bey saldırısı',
      'defense-result': 'savunma',
      'transport-arrived': 'nakliye',
      'support-arrived': 'destek',
      'officer-expired': 'görevli ayrılığı',
      season: 'mevsim değişimi',
      'ilim-complete': 'araştırma',
      event: 'olay',
      'event-expired': 'kendiliğinden çözülen olay',
      'modifier-expired': 'etki sonu',
      'expedition-result': 'keşif',
      'hero-level': 'kahraman seviyesi',
      'hero-wounded': 'kahraman yarası',
      'hero-healed': 'kahraman iyileşmesi',
      'title-up': 'unvan',
      'invasion-start': 'Moğol akını',
      'invasion-end': 'akın sonu',
      achievement: 'başarım',
      victory: 'zafer',
      return: 'dönüş',
    };
    const parts = Object.entries(counts).filter(([type]) => labels[type]).map(([type, n]) => `${n} ${labels[type]}`);
    // Unvan ve akın gibi önemli olaylar toplu bildirimde kaybolmasın.
    for (const event of events) {
      if (['title-up', 'invasion-start', 'invasion-end'].includes(event.type)) {
        const message = describe(event);
        if (message) toast(message.text, message.kind, 9000);
      }
    }
    const lostDefense = events.some((event) => event.type === 'defense-result' && !event.defended);
    toast(
      `${whileAway ? 'Sen yokken ' : ''}${parts.join(', ')} gerçekleşti. Ayrıntılar Raporlar'da.`,
      lostDefense ? 'error' : 'success',
      8000,
    );
    return;
  }
  for (const event of events) {
    const message = describe(event);
    if (message) toast(message.text, message.kind, 6000);
  }
}

function describe(event) {
  const total = (resources) => Object.values(resources ?? {}).reduce((a, b) => a + b, 0);
  switch (event.type) {
    case 'build-complete':
      return { text: `${BUILDINGS[event.building].name} ${event.level}. seviyeye ulaştı.`, kind: 'success' };
    case 'train-complete':
      return { text: `${fmtInt(event.count)} ${UNITS[event.unit].name} eğitildi ve köyde hazır.`, kind: 'success' };
    case 'attack-result': {
      if (!event.attackerWins) return { text: `${event.target} saldırısı: yenilgi. Birlikler geri dönemedi.`, kind: 'error' };
      if (event.conquest?.conquered) {
        return {
          text: `${event.target} fethedildi! Artık senin köyün; sağ kalan askerler orada destek olarak duruyor. Köyler arasında tepe çubuğundan geçebilirsin.`,
          kind: 'success',
        };
      }
      if (event.conquest) {
        return { text: `${event.target} saldırısı: zafer! Elçiler bağlılığı düşürdü: ${event.conquest.from} → ${event.conquest.to}.`, kind: 'success' };
      }
      const { wall, catapult } = event.siege ?? {};
      const fell = (name, { from, to }) => (to < from ? (to === 0 ? `${name} yıkıldı` : `${name} ${to}. seviyeye indi`) : '');
      const siege = [wall && fell('sur', wall), catapult && fell(BUILDINGS[catapult.building].name, catapult)].filter(Boolean);
      return {
        text: `${event.target} saldırısı: zafer! Ganimet ${fmtInt(total(event.loot))}.${siege.length ? ` Kuşatma: ${siege.join(', ')}.` : ''}`,
        kind: 'success',
      };
    }
    case 'research-complete':
      return { text: `Demirci: ${UNITS[event.unit].name} ${event.level}. seviyeye geliştirildi.`, kind: 'success' };
    case 'incoming-attack':
      if (event.invasion) return { text: `Moğol akın dalgası yola çıktı! Varış ${fmtClock(event.arriveAt, event.at)}. Surunu ve askerlerini hazırla.`, kind: 'error' };
      return {
        text: `${event.attacker} saldırıya geçti! Varış ${fmtClock(event.arriveAt, event.at)}. Askerlerini ve surunu hazırla.`,
        kind: 'error',
      };
    case 'spy-caught':
      return { text: `${event.attacker} köyünü gözetlemeye çalıştı; gözcüleri yakalandı.`, kind: 'info' };
    case 'defense-result': {
      if (event.defended) return { text: `${event.attacker} saldırısı püskürtüldü!`, kind: 'success' };
      if (event.lostVillage) return { text: `${event.attacker} bir köyünü fethetti!`, kind: 'error' };
      const wall = event.siege?.wall;
      const wallText = wall && wall.to < wall.from ? ` Surun ${wall.to ? `${wall.to}. seviyeye indi` : 'yıkıldı'}.` : '';
      return { text: `${event.attacker} köyünü yağmaladı: ${fmtInt(total(event.loot))} kaynak gitti.${wallText}`, kind: 'error' };
    }
    case 'spy-result':
      return event.success
        ? { text: `${event.target} gözetlendi. Casus raporu hazır.`, kind: 'success' }
        : { text: `${event.target} köyünde gözcülerin yakalandı.`, kind: 'error' };
    case 'return': {
      const lost = total(event.loot) - total(event.stored);
      const loot = total(event.loot) ? ` ${fmtInt(total(event.stored))} kaynak ambara eklendi.` : '';
      const overflow = lost > 0 ? ` Ambar dolu olduğu için ${fmtInt(lost)} kaynak kayboldu.` : '';
      return { text: `Birlikler ${event.target} köyünden döndü.${loot}${overflow}`, kind: 'success' };
    }
    case 'transport-arrived': {
      const lost = total(event.resources) - total(event.stored);
      const overflow = lost > 0 ? ` Ambar dolu olduğu için ${fmtInt(lost)} kaynak kayboldu.` : '';
      return { text: `Tüccarlar ${event.target} köyüne ${fmtInt(total(event.stored))} kaynak ulaştırdı.${overflow}`, kind: 'success' };
    }
    case 'hero-level':
      return { text: `${event.name} ${event.level}. seviyeye ulaştı! Kahraman sayfasında özellik puanı seni bekliyor.`, kind: 'success' };
    case 'hero-wounded':
      return { text: `${event.name} yaralandı; köyünde iyileşiyor (${fmtClock(event.until, event.at)}).`, kind: 'error' };
    case 'hero-healed':
      return { text: `${event.name} iyileşti ve yeniden sefere hazır.`, kind: 'success' };
    case 'title-up':
      return { text: `Şanın yayıldı: artık ${event.name} unvanını taşıyorsun! ${event.perks.join(', ')}.`, kind: 'success' };
    case 'invasion-start':
      return { text: `Moğol ordusu (${event.x}|${event.y}) yakınına ordugâh kurdu! İlk dalga ${fmtClock(event.firstWaveAt, event.at)} yola çıkacak. Hedef: ${event.target}.`, kind: 'error' };
    case 'invasion-end': {
      if (event.outcome === 'destroyed') {
        const item = event.reward.item ? ` Ganimetler arasında ${RARITIES[event.reward.item.rarity].name.toLowerCase()} bir eşya: ${event.reward.item.name}.` : '';
        return { text: `Moğol ordugâhı dağıtıldı! +${event.reward.akce} Akçe.${item}`, kind: 'success' };
      }
      return event.reward.akce
        ? { text: `Moğol akını püskürtüldü, ordugâh söküldü. +${event.reward.akce} Akçe.`, kind: 'success' }
        : { text: 'Moğol ordusu yağmasını tamamlayıp çekildi.', kind: 'info' };
    }
    case 'achievement':
      return { text: `Başarım: ${event.title} ${'★'.repeat(event.tier)} · +${event.akce} Akçe`, kind: 'success' };
    case 'victory':
      return { text: 'Bütün beyler diz çöktü. Sultanlık ilan edildi!', kind: 'success' };
    case 'expedition-result': {
      const name = EXPEDITION_OUTCOMES[event.outcome].name;
      const extra = event.item
        ? ` Kahramana ${RARITIES[event.item.rarity].name.toLowerCase()} bir eşya: ${event.item.name}.`
        : event.outcome === 'akce' || event.outcome === 'hazine'
          ? ` ${fmtInt(event.akce)} Akçe bulundu!`
          : total(event.loot)
            ? ` ${fmtInt(total(event.loot))} kaynak yolda.`
            : total(event.found)
              ? ` ${fmtInt(total(event.found))} asker katıldı.`
              : '';
      return {
        text: `Keşif seferi: ${name}.${extra}${event.survived ? '' : ' Birlik geri dönmeyecek.'} Ayrıntılar Raporlar'da.`,
        kind: event.survived ? (EXPEDITION_OUTCOMES[event.outcome].good === false ? 'error' : 'success') : 'error',
      };
    }
    case 'officer-expired':
      return { text: `${OFFICERS[event.officer].name} görevini tamamladı. Hazine'den yeniden tutabilirsin.`, kind: 'info' };
    case 'season':
      return { text: `Mevsim değişti: ${event.name}.`, kind: 'info' };
    case 'ilim-complete':
      return { text: `Divan: ${ILIM[event.ilim]?.name ?? event.name} araştırması tamamlandı. Etkisi bütün köylerinde.`, kind: 'success' };
    case 'event':
      return { text: `Yeni olay: ${event.title}. Kararını bekliyor — tepe çubuğundaki parşömene tıkla.`, kind: 'info' };
    case 'event-expired':
      return { text: `${event.title}: karar verilmedi, olay kendi seyrine bırakıldı. ${event.result ?? ''}`, kind: 'info' };
    case 'modifier-expired':
      return { text: `${event.name} etkisi sona erdi.`, kind: 'info' };
    case 'support-arrived':
      return { text: `${fmtInt(total(event.units))} asker destek olarak ${event.target} köyüne vardı.`, kind: 'success' };
    default:
      return null;
  }
}
