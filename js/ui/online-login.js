import { Api, writeOnlineConfig } from '../net/api.js';
import { randomSecret, randomRoomCode } from '../net/host.js';
import { h, setText } from './dom.js';

const SECRETS_KEY = 'beylikler:oda-anahtarlari'; // oda kodu → bu tarayıcının gizli anahtarı

/** Bu tarayıcının o odadaki kimliği: ilk katılışta üretilir, sonra hep aynı kalır. */
function secretFor(room) {
  let secrets = {};
  try {
    secrets = JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '{}');
  } catch {
    // bozuksa sıfırdan
  }
  if (!secrets[room]) {
    secrets[room] = randomSecret();
    try {
      localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
    } catch {
      // saklanamazsa yalnız bu oturumda geçerli
    }
  }
  return secrets[room];
}

function cleanCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function enter(config) {
  writeOnlineConfig(config);
  location.hash = '#/koy';
  location.reload();
}

/** Tarayıcıda oda kur: bu sekme dünyanın ev sahibi olur. */
function createHostForm() {
  const name = h('input', { type: 'text', id: 'room-host-name', maxlength: 20, placeholder: 'Bey adın', autocomplete: 'nickname' });
  const speed = h(
    'select',
    { id: 'room-speed' },
    [1, 2, 5, 10].map((n) => h('option', { value: n, selected: n === 2 }, `${n}x hız`)),
  );
  const status = h('p', { class: 'card-status', 'aria-live': 'polite' });
  const form = h(
    'form',
    {
      class: 'stack-sm online-form',
      onsubmit: (event) => {
        event.preventDefault();
        const player = name.value.trim();
        if (player.length < 3) return setText(status, 'Bey adın en az 3 karakter olmalı.');
        const room = randomRoomCode();
        enter({ mode: 'oda', role: 'host', room, name: player, secret: secretFor(room), speed: Number(speed.value) });
      },
    },
    h('div', { class: 'picker-names' }, h('label', { for: 'room-host-name' }, 'Bey adın', name), h('label', { for: 'room-speed' }, 'Dünya hızı', speed)),
    h('div', { class: 'form-row' }, h('button', { type: 'submit', class: 'btn' }, 'Oda kur')),
    status,
  );
  return form;
}

/** Arkadaşının odasına katıl. */
export function createJoinForm(code = '') {
  const room = h('input', { type: 'text', id: 'room-code', maxlength: 12, placeholder: 'ör. K7M2QX', value: code, autocomplete: 'off', style: 'text-transform:uppercase' });
  const name = h('input', { type: 'text', id: 'room-join-name', maxlength: 20, placeholder: 'Bey adın', autocomplete: 'nickname' });
  const status = h('p', { class: 'card-status', 'aria-live': 'polite' });
  return h(
    'form',
    {
      class: 'stack-sm online-form',
      onsubmit: (event) => {
        event.preventDefault();
        const code = cleanCode(room.value);
        if (code.length < 4) return setText(status, 'Oda kodunu yaz (ev sahibi paylaşır).');
        if (name.value.trim().length < 3) return setText(status, 'Bey adın en az 3 karakter olmalı.');
        enter({ mode: 'oda', role: 'guest', room: code, name: name.value.trim(), secret: secretFor(code) });
      },
    },
    h('div', { class: 'picker-names' }, h('label', { for: 'room-code' }, 'Oda kodu', room), h('label', { for: 'room-join-name' }, 'Bey adın', name)),
    h('div', { class: 'form-row' }, h('button', { type: 'submit', class: 'btn' }, 'Odaya katıl')),
    status,
  );
}

/** Kendi Node sunucusuna bağlanma formu (ileri düzey). */
export function createOnlineForm() {
  const base = h('input', { type: 'url', id: 'online-base', placeholder: 'https://sunucu-adresi', value: location.protocol.startsWith('http') && !location.hostname.endsWith('github.io') ? location.origin : '', autocomplete: 'url' });
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
    enter({ base: api.base, token: response.token, username: username.value.trim() });
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

/** Çok oyunculu seçenekleri: oda kur, odaya katıl, (ileri düzey) sunucuya bağlan. */
export function createMultiplayerChoices() {
  return h(
    'div',
    { class: 'mp-choices' },
    h(
      'section',
      { class: 'mp-choice' },
      h('h3', null, 'Oda kur'),
      h('p', { class: 'muted' }, 'Dünya senin tarayıcında kurulur; arkadaşların oda koduyla katılır. Hesap ya da sunucu gerekmez. Arkadaşların oynarken bu sekme açık kalmalı; kapatınca dünya bekler, açınca kaldığı yerden sürer.'),
      createHostForm(),
    ),
    h(
      'section',
      { class: 'mp-choice' },
      h('h3', null, 'Odaya katıl'),
      h('p', { class: 'muted' }, 'Arkadaşının paylaştığı oda kodunu yaz. Bu tarayıcı seni hatırlar; sonra aynı koda döndüğünde köyün seni bekler.'),
      createJoinForm(),
    ),
    h(
      'details',
      { class: 'mp-choice' },
      h('summary', null, h('strong', null, 'Kendi sunucuna bağlan'), h('span', { class: 'muted' }, ' — sürekli açık bir dünya için (bkz. docs/COK_OYUNCULU.md)')),
      createOnlineForm(),
    ),
  );
}

function overlay(title, lead, ...content) {
  const close = h('button', { type: 'button', class: 'btn btn-ghost btn-small' }, 'Vazgeç');
  const el = h(
    'div',
    { class: 'overlay online-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'online-title' },
    h('div', { class: 'picker stack' }, h('header', { class: 'picker-head' }, h('p', { class: 'eyebrow' }, 'Beylikler'), h('h1', { id: 'online-title' }, title), h('p', { class: 'muted' }, lead)), ...content, h('div', { class: 'picker-foot' }, close)),
  );
  close.addEventListener('click', () => el.remove());
  document.body.append(el);
  return el;
}

/** Çok oyunculu penceresi (ör. sınıf seçiminden "Arkadaşlarınla oyna"). */
export function openOnlineLogin() {
  overlay('Arkadaşlarınla oyna', 'Aynı dünyada saldır, fethet, sohbet et. Tek oyunculu kaydın silinmez.', createMultiplayerChoices());
}

/** Davet bağlantısıyla gelen oyuncu için katılma penceresi. */
export function openRoomJoin(code) {
  const el = overlay(`${code} odasına davet`, 'Bir arkadaşın seni dünyasına çağırıyor. Bey adını yaz ve katıl.', createJoinForm(code));
  el.querySelector('#room-join-name')?.focus();
}

/** Bağlanılamadığında gösterilen ekran: yeniden dene ya da tek oyunculuya dön. */
export function renderOfflineScreen(root, reason, online) {
  const retry = h('button', { type: 'button', class: 'btn' }, 'Yeniden dene');
  const solo = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Tek oyunculuya dön');
  retry.addEventListener('click', () => location.reload());
  solo.addEventListener('click', () => {
    writeOnlineConfig(null);
    location.hash = '#/koy';
    location.reload();
  });
  const title = online?.mode === 'oda' ? (online.role === 'host' ? 'Oda açılamadı' : `${online.room} odasına bağlanılamadı`) : 'Sunucuya bağlanılamadı';
  const hint =
    online?.mode === 'oda' && online.role !== 'host'
      ? 'Ev sahibinin oyunu açık olmalı. Ev sahibi dönünce "Yeniden dene"ye bas; köyün kaybolmaz.'
      : null;
  root.replaceChildren(
    h(
      'section',
      { class: 'panel stack-sm' },
      h('h2', null, title),
      h('p', null, reason),
      hint ? h('p', { class: 'muted' }, hint) : null,
      h('div', { class: 'form-row' }, retry, solo),
      h('h3', { class: 'info-subtitle' }, 'Başka bir yoldan bağlan'),
      createMultiplayerChoices(),
    ),
  );
}
