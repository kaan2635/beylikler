import { GAME } from './config/game.js';
import { Game } from './game.js';
import { localStore } from './storage/local-store.js';
import { mountApp } from './ui/app.js';
import { Api, readOnlineConfig, writeOnlineConfig } from './net/api.js';
import { OnlineGame } from './net/online-game.js';
import { renderOfflineScreen, openRoomJoin } from './ui/online-login.js';

const WORLD_KEY = 'beylikler:dunya'; // ev sahibinin oda dünyası

/**
 * Başlangıç: bağlantı bilgisi varsa çok oyunculu dünyaya bağlanır (Node sunucusu ya da
 * tarayıcıda kurulan oda), yoksa bu cihazdaki tek oyunculu oyun açılır.
 */
async function start() {
  const online = readOnlineConfig();
  if (!online) {
    const game = new Game(localStore);
    mountApp(game, game.load(Date.now()));
    // Oyun başka bir sekmede değişirse bu sekme eski durumla üzerine yazmasın diye yeniden yüklenir.
    window.addEventListener('storage', (event) => {
      if (event.key === GAME.saveKey) location.reload();
    });
    return game;
  }

  const splash = document.querySelector('.splash p');
  window.beylikler = { connecting: true }; // yavaş bağlantıda "oyun yüklenemedi" uyarısı çıkmasın
  try {
    const game = online.mode === 'oda' ? await startRoom(online, splash) : await startServer(online, splash);
    game.listen();
    mountApp(game, { isNew: false, events: [] });
    return game;
  } catch (err) {
    renderOfflineScreen(document.getElementById('view'), err.message, online);
    return { offline: true };
  }
}

async function startServer(online, splash) {
  if (splash) splash.textContent = 'Sunucuya bağlanılıyor…';
  const api = new Api(online.base, online.token);
  const response = await api.state();
  if (!response.ok) {
    if (response.status === 401) writeOnlineConfig({ ...online, token: null });
    throw new Error(response.reason ?? 'Bilinmeyen hata');
  }
  return new OnlineGame(api, response.view, online.username);
}

/** Oda: ev sahibiysek dünyayı bu sekmede kurup açarız; değilsek ev sahibine bağlanırız. */
async function startRoom(online, splash) {
  const { P2PApi, openRoom } = await import('./net/p2p.js');
  let api;
  let room = null;
  if (online.role === 'host') {
    if (splash) splash.textContent = 'Oda açılıyor…';
    const { HostWorld, LocalApi } = await import('./net/host.js');
    const storage = {
      load: () => localStorage.getItem(WORLD_KEY),
      save: (text) => localStorage.setItem(WORLD_KEY, text),
    };
    const host = new HostWorld(storage, { speed: online.speed ?? 1 });
    room = await openRoom(host, online.room);
    setInterval(() => host.tick(), 1000);
    setInterval(() => host.save(), 5000);
    window.addEventListener('pagehide', () => host.save(true));
    api = new LocalApi(host);
    window.beylikOda = { host, room };
  } else {
    if (splash) splash.textContent = `${online.room} odasına bağlanılıyor…`;
    api = new P2PApi(online.room);
    await api.connect();
  }
  const response = await api.join(online.name, online.secret);
  if (!response.ok) throw new Error(response.reason ?? 'Odaya katılınamadı');
  const game = new OnlineGame(api, response.view, online.name);
  game.room = { code: online.room, host: online.role === 'host', link: room };
  return game;
}

// Tarayıcı konsolundan inceleme için: beylikler.state
window.beylikler = await start();

// Davet bağlantısı: #/katil/KOD → odaya katılma penceresi
const invite = location.hash.match(/^#\/katil\/([A-Za-z0-9]{4,12})/);
if (invite && !(window.beylikler?.room?.code === invite[1].toUpperCase())) openRoomJoin(invite[1].toUpperCase());

// Telefona kurulum ve çevrimdışı açılış (PWA). Yalnızca güvenli bağlamda (https ya da localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Kayıt başarısızsa oyun yine çalışır; yalnızca çevrimdışı açılış olmaz.
  });
}

// "Ana ekrana ekle" isteği: Ayarlar'daki kurulum düğmesi kullanır.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.beylikKurulum = event;
  window.dispatchEvent(new Event('beylik-kurulabilir'));
});
