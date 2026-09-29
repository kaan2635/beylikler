import { GAME } from '../../config/game.js';
import { DIFFICULTIES } from '../../config/lords.js';
import { h } from '../dom.js';
import { toast } from '../toast.js';

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
    Object.entries(DIFFICULTIES).map(([key, d]) => h('option', { value: key }, d.name)),
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

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Ayarlar')),
    h(
      'div',
      { class: 'settings-grid' },
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
        h('div', { class: 'form-row' }, h('label', { for: 'world-speed' }, 'Dünya hızı'), speedSelect),
        h(
          'p',
          { class: 'muted' },
          'Test için hızı artırabilirsin. Üretimi ve yeni inşaatları hızlandırır; sıradaki işlerin süresi değişmez.',
        ),
      ),
      h(
        'section',
        { class: 'panel stack-sm' },
        h('h2', null, 'Rakip beyler'),
        h('div', { class: 'form-row' }, h('label', { for: 'difficulty' }, 'Zorluk'), difficultySelect),
        difficultyInfo,
        h('p', { class: 'muted' }, 'Zorluk değişince beylerin saldırı takvimi yeniden kurulur; ilk saldırı en az 12 oyun saati sonra gelir.'),
      ),
      h(
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
      h(
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
    createdAt.textContent = `Kuruluş: ${created} · Harita tohumu: ${game.state.world.seed}`;
  }

  return { el, onShow, update() {} };
}
