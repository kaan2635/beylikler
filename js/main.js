import { GAME } from './config/game.js';
import { Game } from './game.js';
import { localStore } from './storage/local-store.js';
import { mountApp } from './ui/app.js';

const game = new Game(localStore);
mountApp(game, game.load(Date.now()));

// Ayrı bir otomatik kayda gerek yok: her eylem ve olay anında kaydedilir, kaynak üretimi ise
// kayıttaki son güncelleme zamanından her açılışta yeniden hesaplanır.

// Oyun başka bir sekmede değişirse bu sekme eski durumla üzerine yazmasın diye yeniden yüklenir.
window.addEventListener('storage', (event) => {
  if (event.key === GAME.saveKey) location.reload();
});

// Tarayıcı konsolundan inceleme için: beylikler.state
window.beylikler = game;

// Telefona kurulum ve çevrimdışı açılış (PWA). Yalnızca güvenli bağlamda (https ya da localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Kayıt başarısızsa oyun yine çalışır; yalnızca çevrimdışı açılış olmaz.
    });
  });
}

// "Ana ekrana ekle" isteği: Ayarlar'daki kurulum düğmesi kullanır.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.beylikKurulum = event;
  window.dispatchEvent(new Event('beylik-kurulabilir'));
});
