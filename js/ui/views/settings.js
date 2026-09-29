import { GAME } from '../../config/game.js';
import { DIFFICULTIES } from '../../config/lords.js';
import { h, setText } from '../dom.js';
import { toast } from '../toast.js';
import { createMultiplayerChoices } from '../online-login.js';
import { readOnlineConfig, writeOnlineConfig } from '../../net/api.js';

/** Ayarlar: köy adı, kaydı dışa/içe aktarma, dünya hızı ve sıfırlama. */
export function createSettingsView({ game, refresh }) {
  const nameInput = h('input', { type: 'text', maxlength: 32, id: 'village-name', autocomplete: 'off' });
  const playerInput = h('input', { type: 'text', maxlength: 24, id: 'player-name', autocomplete: 'off' });
  const exportArea = h('textarea', { rows: 4, readonly: true, placeholder: 'Önce "Kodu oluştur"a bas.' });
  const importArea = h('textarea', { rows: 4, placeholder: 'BEY1: ile başlayan kayıt kodunu buraya yapıştır.' });
  const speedSelect = h(
    'select',
    { id: 'world-speed' },
    GAME.speedOptions.map((speed) => h('option', { value: speed }, `${speed}x`)),
  );
  const createdAt = h('p', { class: 'muted' });
  const difficultySelect = h(
    'select',
    { id: 'difficulty' },
    Object.entries(DIFFICULTIES)
      .filter(([, d]) => !d.hidden)
      .map(([key, d]) => h('option', { value: key }, d.name)),
  );
  const difficultyInfo = h('p', { class: 'muted' });
  const installText = h('p', { class: 'muted' });
  const installButton = h('button', { class: 'btn', type: 'button' }, 'Ana ekrana ekle');
  installButton.addEventListener('click', async () => {
    const prompt = window.beylikKurulum;
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    window.beylikKurulum = null;
    if (choice?.outcome === 'accepted') toast('Beylikler ana ekrana eklendi.', 'success');
    updateInstall();
  });
  window.addEventListener('beylik-kurulabilir', () => updateInstall());

  function updateInstall() {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    installButton.hidden = !window.beylikKurulum;
    installText.textContent = standalone
      ? 'Oyun uygulama olarak açık. İnternet olmadan da açılır; kaydın bu cihazda durur.'
      : window.beylikKurulum
        ? 'Beylikler\'i telefonuna ya da bilgisayarına uygulama gibi kurabilirsin; internet olmadan da açılır.'
        : ios
          ? 'iPhone/iPad: Safari\'de Paylaş düğmesine dokun, "Ana Ekrana Ekle"yi seç.'
          : 'Tarayıcının menüsünden "Uygulamayı yükle" ya da "Ana ekrana ekle" seçeneğini kullanabilirsin. Oyun bir kez açıldıktan sonra internetsiz de açılır.';
  }

  const online = !!game.online;
  const logout = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Çıkış yap ve tek oyunculuya dön');
  logout.addEventListener('click', async () => {
    await game.logout();
    writeOnlineConfig(null);
    location.hash = '#/koy';
    location.reload();
  });
  const room = game.room;
  const inviteLink = room ? `${location.origin}${location.pathname}#/katil/${room.code}` : '';
  const copyInvite = h('button', { class: 'btn', type: 'button' }, 'Davet bağlantısını kopyala');
  copyInvite.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast('Davet bağlantısı kopyalandı. Arkadaşlarına gönder!', 'success');
    } catch {
      toast(`Bağlantı: ${inviteLink}`, 'info', 10000);
    }
  });
  if (room) setText(logout, room.host ? 'Odayı kapat ve tek oyunculuya dön' : 'Odadan çık ve tek oyunculuya dön');
  const multiplayer = h(
    'section',
    { class: 'panel stack-sm multiplayer-panel' },
    h('h2', null, 'Çok oyunculu'),
    room
      ? [
          h('p', null, 'Oda kodu: ', h('strong', { class: 'room-code' }, room.code), room.host ? ' · ev sahibi sensin' : ''),
          h('p', { class: 'muted' }, room.host
            ? 'Arkadaşların oyunu açıp bu kodla (ya da davet bağlantısıyla) katılır. Onlar oynarken bu sekme açık kalmalı. Dünya bu tarayıcıda saklanır; odayı kapatsan da silinmez, yeniden kurunca aynı kodla açılır.'
            : 'Dünya ev sahibinin tarayıcısında. Ev sahibi oyunu kapatırsa bağlantı kopar; açınca kaldığın yerden devam edersin.'),
          h('div', { class: 'form-row' }, copyInvite, logout),
        ]
      : online
        ? [
            h('p', null, 'Bağlı olduğun dünya: ', h('strong', null, readOnlineConfig()?.base ?? ''), '. Hesabın: ', h('strong', null, game.username ?? '')),
            h('p', { class: 'muted' }, 'Bu dünyada zaman, hız ve kurallar sunucudadır. Tek oyunculu kaydın bu cihazda duruyor; çıkış yapınca geri gelir.'),
            h('div', { class: 'form-row' }, logout),
          ]
        : [h('p', { class: 'muted' }, 'Arkadaşlarınla aynı dünyada oyna. Tek oyunculu kaydın silinmez; istediğin zaman geri dönersin.'), createMultiplayerChoices()],
  );

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Ayarlar')),
    h(
      'div',
      { class: 'settings-grid' },
      multiplayer,
      h(
        'section',
        { class: 'panel stack-sm' },
        h('h2', null, 'Beylik'),
        h(
          'form',
          { class: 'form-row', onsubmit: onRenamePlayer },
          h('label', { for: 'player-name' }, 'Bey adı'),
          playerInput,
          h('button', { class: 'btn', type: 'submit' }, 'Kaydet'),
        ),
        h(
          'form',
          { class: 'form-row', onsubmit: onRename },
          h('label', { for: 'village-name' }, 'Köy adı'),
          nameInput,
          h('button', { class: 'btn', type: 'submit' }, 'Kaydet'),
        ),
      ),
      h(
        'section',
        { class: 'panel stack-sm' },
        h('h2', null, 'Dünya'),
        createdAt,
        online ? null : h('div', { class: 'form-row' }, h('label', { for: 'world-speed' }, 'Dünya hızı'), speedSelect),
        h(
          'p',
          { class: 'muted' },
          online ? 'Dünyanın hızını sunucu belirler.' : 'Test için hızı artırabilirsin. Üretimi ve yeni inşaatları hızlandırır; sıradaki işlerin süresi değişmez.',
        ),
      ),
      online
        ? null
        : h(
            'section',
            { class: 'panel stack-sm' },
            h('h2', null, 'Rakip beyler'),
            h('div', { class: 'form-row' }, h('label', { for: 'difficulty' }, 'Zorluk'), difficultySelect),
            difficultyInfo,
            h('p', { class: 'muted' }, 'Zorluk değişince beylerin saldırı takvimi yeniden kurulur; ilk saldırı en az 12 oyun saati sonra gelir.'),
          ),
      online
        ? null
        : h(
        'section',
        { class: 'panel stack-sm' },
        h('h2', null, 'Kayıt'),
        h(
          'p',
          { class: 'muted' },
          'Oyun bu tarayıcıya otomatik kaydedilir. Yedeklemek ya da başka bir cihaza taşımak için kayıt kodunu kullan.',
        ),
        h(
          'div',
          { class: 'form-row' },
          h('button', { class: 'btn', type: 'button', onclick: onExport }, 'Kodu oluştur'),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: onCopy }, 'Kopyala'),
        ),
        exportArea,
        importArea,
        h('div', { class: 'form-row' }, h('button', { class: 'btn', type: 'button', onclick: onImport }, 'İçe aktar')),
      ),
      h(
        'section',
        { class: 'panel stack-sm' },
        h('h2', null, 'Uygulama olarak kur'),
        installText,
        h('div', { class: 'form-row' }, installButton),
      ),
      online
        ? null
        : h(
        'section',
        { class: 'panel stack-sm danger' },
        h('h2', null, 'Oyunu sıfırla'),
        h('p', { class: 'muted' }, 'Tüm ilerleme kalıcı olarak silinir ve yeni bir beylikle baştan başlarsın.'),
        h(
          'div',
          { class: 'form-row' },
          h('button', { class: 'btn btn-danger', type: 'button', onclick: onReset }, 'Oyunu sıfırla'),
        ),
      ),
    ),
  );

  speedSelect.addEventListener('change', () => {
    game.setSpeed(Number(speedSelect.value), Date.now());
    toast(`Dünya hızı ${speedSelect.value}x olarak ayarlandı.`);
    refresh();
  });

  difficultySelect.addEventListener('change', () => {
    const key = difficultySelect.value;
    if (game.setDifficulty(key, Date.now())) toast(`Zorluk: ${DIFFICULTIES[key].name}. ${DIFFICULTIES[key].description}`);
    difficultyInfo.textContent = DIFFICULTIES[key].description;
    refresh();
  });

  function onRenamePlayer(event) {
    event.preventDefault();
    if (game.renamePlayer(playerInput.value)) toast('Bey adı kaydedildi.', 'success');
    else toast('Bey adı boş olamaz.', 'error');
    refresh();
  }

  function onRename(event) {
    event.preventDefault();
    if (game.renameVillage(nameInput.value)) toast('Köy adı kaydedildi.', 'success');
    else toast('Köy adı boş olamaz.', 'error');
    refresh();
  }

  function onExport() {
    exportArea.value = game.exportSave();
    exportArea.select();
  }

  async function onCopy() {
    if (!exportArea.value) onExport();
    try {
      await navigator.clipboard.writeText(exportArea.value);
      toast('Kayıt kodu panoya kopyalandı.', 'success');
    } catch {
      exportArea.select();
      toast('Kopyalanamadı; seçili metni elle kopyala (Ctrl+C).', 'error');
    }
  }

  function onImport() {
    if (!importArea.value.trim()) return toast('Önce bir kayıt kodu yapıştır.', 'error');
    if (!confirm('Mevcut oyunun yerine bu kayıt yüklenecek. Emin misin?')) return;
    try {
      game.importSave(importArea.value, Date.now());
      importArea.value = '';
      // Ekranlar yeni kayıtla baştan kurulsun (sınıfı seçilmemiş eski bir kayıtsa seçim penceresi açılır).
      location.hash = '#/koy';
      location.reload();
    } catch (err) {
      toast(`Kayıt yüklenemedi: ${err.message}`, 'error', 6000);
    }
  }

  function onReset() {
    if (!confirm('Tüm ilerleme silinecek. Oyunu sıfırlamak istediğine emin misin?')) return;
    game.reset(Date.now());
    location.hash = '#/koy';
    location.reload(); // yeni oyun sınıf seçimiyle başlar
  }

  // Form alanları yalnızca görünüm açılırken doldurulur; saniyelik yenileme yazılanı ezmesin.
  function onShow() {
    nameInput.value = game.village.name;
    playerInput.value = game.state.player.name;
    speedSelect.value = String(game.state.world.speed);
    difficultySelect.value = game.state.ai.difficulty;
    difficultyInfo.textContent = DIFFICULTIES[game.state.ai.difficulty].description;
    exportArea.value = '';
    updateInstall();
    const created = new Date(game.state.createdAt).toLocaleString('tr-TR');
    createdAt.textContent = `Kuruluş: ${created} · Harita tohumu: ${game.state.world.seed}${game.online ? ` · Hız ${game.state.world.speed}x` : ''}`;
  }

  return { el, onShow, update() {} };
}
