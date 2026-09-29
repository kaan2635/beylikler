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
import { initToasts, toast } from './toast.js';
import { h } from './dom.js';
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
};

// Sekmesi olmayan bina sayfalarında hangi sekme seçili görünsün.
const PARENT_TAB = { demirci: 'koy', pazar: 'koy' };

/** Arayüzü kurar, yönlendirmeyi ve saniyelik yenilemeyi başlatır. */
export function mountApp(game, { isNew, events }) {
  initToasts(document.getElementById('toasts'));
  const resourceBar = createResourceBar(document.getElementById('resource-bar'));
  const viewRoot = document.getElementById('view');
  const reportsBadge = document.getElementById('reports-badge');
  const incomingAlert = document.getElementById('incoming-alert');
  const alertText = h('span');
  incomingAlert.append(icon('saldiri'), alertText);
  const views = {};
  let current = null;

  function refresh(now = Date.now()) {
    game.tick(now);
    resourceBar.update(game);
    current?.update(now);
    const unread = game.state.reports.filter((report) => !report.read).length;
    reportsBadge.hidden = unread === 0;
    reportsBadge.textContent = String(unread);

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
    views[name] ??= ROUTES[name]({ game, refresh });
    current = views[name];
    viewRoot.replaceChildren(current.el);
    current.onShow?.(params.map(Number));
    const tab = PARENT_TAB[name] ?? name;
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

  game.on((newEvents) => announce(newEvents, false));
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  setInterval(refresh, GAME.tickMs);
  route();

  if (isNew) toast('Beyliğine hoş geldin! İşe kaynak binalarını yükselterek başla.', 'success', 7000);
  announce(events, true);
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
      return: 'dönüş',
    };
    const parts = Object.entries(counts).map(([type, n]) => `${n} ${labels[type]}`);
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
      return {
        text: `${event.attacker} saldırıya geçti! Varış ${fmtClock(event.arriveAt, event.at)}. Askerlerini ve surunu hazırla.`,
        kind: 'error',
      };
    case 'defense-result': {
      if (event.defended) return { text: `${event.attacker} saldırısı püskürtüldü!`, kind: 'success' };
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
    default:
      return null;
  }
}
