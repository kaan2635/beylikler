import { GAME } from '../config/game.js';
import { BUILDINGS } from '../config/buildings.js';
import { createResourceBar } from './resource-bar.js';
import { createVillageView } from './views/village.js';
import { createSettingsView } from './views/settings.js';
import { createPlaceholderView } from './views/placeholder.js';
import { initToasts, toast } from './toast.js';

// Adres çubuğundaki #/koy gibi yollar ve karşılık gelen ekranlar.
const ROUTES = {
  koy: (ctx) => createVillageView(ctx),
  harita: () =>
    createPlaceholderView({
      title: 'Harita',
      intro: 'Beyliğinin çevresindeki toprakları burada göreceksin.',
      items: [
        'Tohumlu rastgele üretilen dünya haritası',
        'Barbar köyleri ve rakip beylikler',
        'Köy bilgisi, mesafe ve yolculuk süresi',
      ],
    }),
  ordu: () =>
    createPlaceholderView({
      title: 'Ordu',
      intro: 'Kışlada asker yetiştirip seferlere göndereceksin.',
      items: [
        'Yaya, Kılıççı, Baltacı, Okçu, Akıncı, Sipahi, Koçbaşı, Mancınık',
        'Eğitim kuyruğu ve nüfus kullanımı',
        'Saldırı, destek ve yağma seferleri',
      ],
    }),
  raporlar: () =>
    createPlaceholderView({
      title: 'Raporlar',
      intro: 'Savaşların, yağmaların ve casus raporlarının kaydı.',
      items: ['Savaş raporları (kayıplar, ganimet)', 'Casusluk raporları', 'Olay geçmişi'],
    }),
  ayarlar: (ctx) => createSettingsView(ctx),
};

/** Arayüzü kurar, yönlendirmeyi ve saniyelik yenilemeyi başlatır. */
export function mountApp(game, { isNew, events }) {
  initToasts(document.getElementById('toasts'));
  const resourceBar = createResourceBar(document.getElementById('resource-bar'));
  const viewRoot = document.getElementById('view');
  const views = {};
  let current = null;

  function refresh(now = Date.now()) {
    game.tick(now);
    resourceBar.update(game);
    current?.update(now);
    document.title = `${game.village.name} · ${GAME.title}`;
  }

  function route() {
    const requested = location.hash.replace(/^#\/?/, '');
    const name = ROUTES[requested] ? requested : 'koy';
    views[name] ??= ROUTES[name]({ game, refresh });
    current = views[name];
    viewRoot.replaceChildren(current.el);
    current.onShow?.();
    for (const link of document.querySelectorAll('[data-route]')) {
      const active = link.dataset.route === name;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
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
  const done = events.filter((event) => event.type === 'build-complete');
  if (done.length > 3) {
    toast(`${whileAway ? 'Sen yokken ' : ''}${done.length} inşaat tamamlandı.`, 'success', 6000);
    return;
  }
  for (const event of done) {
    toast(`${BUILDINGS[event.building].name} ${event.level}. seviyeye ulaştı.`, 'success');
  }
}
