import { Api, writeOnlineConfig } from '../net/api.js';
import { h, setText } from './dom.js';

/** Sunucu adresi için makul varsayılan: oyun sunucudan açıldıysa aynı adres. */
function defaultBase() {
  if (location.protocol.startsWith('http') && !location.hostname.endsWith('github.io')) return location.origin;
  return '';
}

/**
 * Çok oyunculu sunucuya giriş / kayıt formu. Başarılı olunca bağlantı bilgisi saklanır ve
 * sayfa çok oyunculu kipte yeniden açılır. Tek oyunculu kayıt silinmez; çıkış yapınca geri gelir.
 */
export function createOnlineForm() {
  const base = h('input', { type: 'url', id: 'online-base', placeholder: 'https://sunucu-adresi', value: defaultBase(), autocomplete: 'url' });
  const username = h('input', { type: 'text', id: 'online-user', maxlength: 20, autocomplete: 'username' });
  const password = h('input', { type: 'password', id: 'online-pass', maxlength: 200, autocomplete: 'current-password' });
  const status = h('p', { class: 'card-status', 'aria-live': 'polite' });
  const login = h('button', { type: 'submit', class: 'btn' }, 'Giriş yap');
  const register = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Kayıt ol');

  async function submit(kind) {
    const api = new Api(base.value.trim());
    if (!api.base) return setText(status, 'Sunucu adresini yaz (ör. http://192.168.1.20:8787).');
    login.disabled = register.disabled = true;
    setText(status, kind === 'register' ? 'Hesap açılıyor…' : 'Giriş yapılıyor…');
    const response = kind === 'register' ? await api.register(username.value.trim(), password.value) : await api.login(username.value.trim(), password.value);
    login.disabled = register.disabled = false;
    if (!response.ok) return setText(status, response.reason ?? 'Olmadı; tekrar dene.');
    writeOnlineConfig({ base: api.base, token: response.token, username: username.value.trim() });
    setText(status, 'Bağlanıldı. Dünya açılıyor…');
    location.hash = '#/koy';
    location.reload();
  }

  const form = h(
    'form',
    { class: 'stack-sm online-form', onsubmit: (event) => (event.preventDefault(), submit('login')) },
    h('label', { for: 'online-base' }, 'Sunucu adresi', base),
    h('div', { class: 'picker-names' }, h('label', { for: 'online-user' }, 'Kullanıcı adı', username), h('label', { for: 'online-pass' }, 'Şifre (en az 8 karakter)', password)),
    h('div', { class: 'form-row' }, login, register),
    status,
  );
  register.addEventListener('click', () => submit('register'));
  return form;
}

/** Giriş penceresi (ör. sınıf seçiminden "Çok oyunculu oyna" ile). */
export function openOnlineLogin() {
  const close = h('button', { type: 'button', class: 'btn btn-ghost btn-small' }, 'Vazgeç');
  const overlay = h(
    'div',
    { class: 'overlay online-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'online-title' },
    h(
      'div',
      { class: 'picker stack' },
      h('header', { class: 'picker-head' }, h('p', { class: 'eyebrow' }, 'Beylikler'), h('h1', { id: 'online-title' }, 'Çok oyunculu dünya'), h('p', { class: 'muted' }, 'Arkadaşlarınla aynı dünyada oyna. Sunucuyu kuran kişi adresini seninle paylaşır.')),
      createOnlineForm(),
      h('div', { class: 'picker-foot' }, close),
    ),
  );
  close.addEventListener('click', () => overlay.remove());
  document.body.append(overlay);
}

/** Bağlanılamadığında gösterilen ekran: yeniden dene ya da tek oyunculuya dön. */
export function renderOfflineScreen(root, reason) {
  const retry = h('button', { type: 'button', class: 'btn' }, 'Yeniden dene');
  const solo = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Tek oyunculuya dön');
  retry.addEventListener('click', () => location.reload());
  solo.addEventListener('click', () => {
    writeOnlineConfig(null);
    location.reload();
  });
  root.replaceChildren(
    h('section', { class: 'panel stack-sm' }, h('h2', null, 'Sunucuya bağlanılamadı'), h('p', null, reason), h('div', { class: 'form-row' }, retry, solo), h('h3', { class: 'info-subtitle' }, 'Yeniden giriş yap'), createOnlineForm()),
  );
}
