import { GAME } from './config/game.js';
import { Game } from './game.js';
import { localStore } from './storage/local-store.js';
import { mountApp } from './ui/app.js';
import { Api, readOnlineConfig, writeOnlineConfig } from './net/api.js';
import { OnlineGame } from './net/online-game.js';
import { renderOfflineScreen } from './ui/online-login.js';

/**
 * Başlangıç: bağlantı bilgisi varsa çok oyunculu sunucuya bağlanır, yoksa bu cihazdaki
 * tek oyunculu oyun açılır.
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
  if (splash) splash.textContent = 'Sunucuya bağlanılıyor…';
  window.beylikler = { connecting: true }; // yavaş bağlantıda "oyun yüklenemedi" uyarısı çıkmasın
  const api = new Api(online.base, online.token);
  const response = await api.state();
  if (!response.ok) {
    if (response.status === 401) writeOnlineConfig({ ...online, token: null });
    renderOfflineScreen(document.getElementById('view'), response.reason ?? 'Bilinmeyen hata');
    window.beylikler = { offline: true };
    return null;
  }
  const game = new OnlineGame(api, response.view, online.username);
  game.listen();
  mountApp(game, { isNew: false, events: [] });
  return game;
}

// Tarayıcı konsolundan inceleme için: beylikler.state
window.beylikler = await start();

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
