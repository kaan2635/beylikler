import { CLASSES } from '../../config/classes.js';
import { Api } from '../../net/api.js';
import { h, setText } from '../dom.js';
import { fmtInt } from '../format.js';

const ADMIN_NOTE = 'Bu alan yalnızca sunucuda tanımlı yönetici hesabıyla açılır. Parola ve oturum belirteci tarayıcı kalıcı deposuna yazılmaz; yönetici oturumu 8 saat geçerlidir.';

function defaultServerAddress() {
  if (location.protocol === 'file:' || location.hostname === 'github.io' || location.hostname.endsWith('.github.io')) return '';
  return location.origin;
}

function secureServerAddress(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

function dateTime(value) {
  if (!Number.isFinite(value)) return '—';
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Sunucu tarafında doğrulanan yönetici girişi ve dünya denetim paneli. */
export function createAdminView() {
  const root = h('section', { class: 'stack admin-view' });
  const serverAddress = h('input', {
    type: 'url',
    value: defaultServerAddress(),
    placeholder: 'https://oyun-sunucun.example',
    autocomplete: 'url',
    'aria-label': 'Oyun sunucusu adresi',
  });
  const username = h('input', { type: 'text', maxlength: 32, autocomplete: 'username', required: true });
  const password = h('input', { type: 'password', maxlength: 200, autocomplete: 'current-password', required: true });
  const loginStatus = h('p', { class: 'admin-status muted', 'aria-live': 'polite' });
  const loginButton = h('button', { type: 'submit', class: 'btn' }, 'Güvenli giriş');
  let api = null;
  let token = null;
  let lastLoaded = null;

  function showLogin(message = '') {
    api = null;
    token = null;
    setText(loginStatus, message);
    loginButton.disabled = false;
    root.replaceChildren(
      h('header', { class: 'view-header' }, h('h1', null, 'Yönetici girişi')),
      h('section', { class: 'panel stack-sm admin-login-card' },
        h('p', { class: 'muted' }, ADMIN_NOTE),
        h('form', { class: 'stack-sm admin-login-form', onsubmit: onLogin },
          h('label', null, 'Oyun sunucusu', serverAddress),
          h('label', null, 'Yönetici adı', username),
          h('label', null, 'Yönetici parolası', password),
          h('div', { class: 'form-row' }, loginButton),
          loginStatus,
        ),
        h('p', { class: 'hint muted' }, 'GitHub Pages / statik önizleme yönetim API’si sağlamaz. Kendi Node sunucunda ADMIN_USERNAME ve en az 16 karakterli ADMIN_PASSWORD ayarlanmalıdır.'),
      ),
    );
  }

  async function onLogin(event) {
    event.preventDefault();
    const address = serverAddress.value.trim().replace(/\/+$/, '');
    if (!address) return setText(loginStatus, 'Önce kendi oyun sunucusunun HTTPS adresini yaz.');
    if (!secureServerAddress(address)) return setText(loginStatus, 'Güvenlik için HTTPS kullan; yalnızca localhost HTTP ile açılabilir.');
    loginButton.disabled = true;
    setText(loginStatus, 'Yönetici doğrulanıyor…');
    const apiBase = new URL(address).origin;
    const candidate = new Api(apiBase);
    const response = await candidate.adminLogin(username.value.trim(), password.value);
    loginButton.disabled = false;
    password.value = '';
    if (!response.ok) {
      const hint = response.status === 404 ? ' Bu adres yönetim API’si sunmuyor.' : '';
      return setText(loginStatus, `${response.reason ?? 'Giriş başarısız.'}${hint}`);
    }
    token = response.token;
    api = new Api(apiBase, token);
    await loadDashboard();
  }

  function metric(label, value, note = '') {
    return h('article', { class: 'admin-metric' }, h('span', { class: 'admin-metric-label' }, label), h('strong', { class: 'admin-metric-value' }, value), note ? h('span', { class: 'admin-metric-note muted' }, note) : null);
  }

  function playerTable(players) {
    const rows = players.length
      ? players.map((player) => {
          const state = player.banned
            ? h('span', { class: 'admin-badge is-banned', title: player.banReason ?? '' }, 'Askıda')
            : h('span', { class: 'admin-badge is-active' }, 'Etkin');
          const action = player.banned
            ? h('button', {
                type: 'button',
                class: 'btn btn-ghost btn-small',
                onclick: () => changeBan(player, false),
              }, 'Erişimi aç')
            : h('button', {
                type: 'button',
                class: 'btn btn-danger btn-small',
                onclick: () => changeBan(player, true),
              }, 'Askıya al');
          return h('tr', null,
            h('td', null, player.username ?? '—'),
            h('td', null, player.name),
            h('td', null, fmtInt(player.villages)),
            h('td', null, fmtInt(player.points)),
            h('td', null, CLASSES[player.class]?.name ?? player.class ?? '—'),
            h('td', null, state),
            h('td', null, action),
          );
        })
      : [h('tr', null, h('td', { colspan: 7, class: 'muted' }, 'Dünyada henüz oyuncu yok.'))];
    return h('div', { class: 'table-wrap' }, h('table', { class: 'data-table admin-player-table' },
      h('thead', null, h('tr', null,
        h('th', null, 'Hesap'), h('th', null, 'Bey'), h('th', null, 'Köy'), h('th', null, 'Puan'), h('th', null, 'Sınıf'), h('th', null, 'Durum'), h('th', null, 'İşlem'),
      )),
      h('tbody', null, ...rows),
    ));
  }

  function chatList(messages) {
    return messages.length
      ? h('ol', { class: 'admin-chat-list' }, ...messages.map((message) => h('li', { class: message.system ? 'is-system' : '' },
          h('div', { class: 'admin-chat-meta' }, h('strong', null, message.name), h('time', null, dateTime(message.at))),
          h('p', null, message.text),
        )))
      : h('p', { class: 'muted' }, 'Sohbet geçmişi boş.');
  }

  async function changeBan(player, shouldBan) {
    const action = shouldBan ? 'askıya almak' : 'yeniden açmak';
    const prompt = shouldBan
      ? `“${player.name}” hesabını askıya almak istiyor musun? Etkin oturumları kapatılır; köyü silinmez.`
      : `“${player.name}” hesabının erişimini yeniden açmak istiyor musun?`;
    if (!window.confirm(prompt)) return;
    const reason = shouldBan ? (window.prompt('Askıya alma nedeni (isteğe bağlı):', 'Kurallara aykırı davranış') ?? null) : null;
    if (shouldBan && reason === null) return;
    const response = shouldBan ? await api.adminBanPlayer(player.id, reason) : await api.adminUnbanPlayer(player.id);
    if (!response.ok) return loadDashboard(response.reason ?? `Hesap ${action} başarısız.`);
    await loadDashboard(shouldBan ? 'Oyuncu askıya alındı; etkin oturumları kapatıldı.' : 'Oyuncunun erişimi yeniden açıldı.');
  }

  async function sendAnnouncement(input, status, button) {
    const text = input.value.trim();
    if (!text) return setText(status, 'Duyuru metni boş olamaz.');
    button.disabled = true;
    const response = await api.adminAnnouncement(text);
    button.disabled = false;
    if (!response.ok) return setText(status, response.reason ?? 'Duyuru gönderilemedi.');
    input.value = '';
    setText(status, 'Duyuru bütün oyunculara gönderildi.');
    await loadDashboard();
  }

  async function loadDashboard(message = '') {
    if (!api) return showLogin(message);
    const response = await api.adminOverview();
    if (!response.ok) {
      if (response.status === 401) return showLogin('Yönetici oturumu sona erdi; yeniden giriş yap.');
      return showLogin(response.reason ?? 'Yönetim bilgileri alınamadı.');
    }
    lastLoaded = response.overview;
    renderDashboard(lastLoaded, message);
  }

  function renderDashboard(overview, message = '') {
    const stats = overview.stats;
    const announcement = h('textarea', { rows: 3, maxlength: 280, placeholder: 'Dünya duyurusu…', 'aria-label': 'Duyuru metni' });
    const announcementStatus = h('p', { class: 'admin-status muted', 'aria-live': 'polite' });
    const announcementButton = h('button', { type: 'submit', class: 'btn' }, 'Duyuruyu gönder');
    const announcementForm = h('form', {
      class: 'stack-sm',
      onsubmit: (event) => {
        event.preventDefault();
        void sendAnnouncement(announcement, announcementStatus, announcementButton);
      },
    }, announcement, h('div', { class: 'form-row' }, announcementButton), announcementStatus);
    const clearChat = h('button', {
      type: 'button',
      class: 'btn btn-danger btn-small',
      onclick: async () => {
        if (!window.confirm('Tüm sohbet geçmişi silinsin mi? Bu işlem geri alınamaz.')) return;
        const response = await api.adminClearChat();
        await loadDashboard(response.ok ? `${fmtInt(response.removed)} sohbet mesajı silindi.` : response.reason ?? 'Sohbet temizlenemedi.');
      },
    }, 'Sohbeti temizle');
    const refreshButton = h('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => loadDashboard() }, 'Yenile');
    const logoutButton = h('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: async () => {
      await api.adminLogout();
      showLogin('Yönetici oturumundan çıkış yapıldı.');
    } }, 'Çıkış yap');
    const worldDay = Math.floor((stats.worldTime ?? 0) / 86_400_000) + 1;
    const metrics = h('div', { class: 'admin-metrics' },
      metric('Oyuncu', fmtInt(stats.players)),
      metric('Etkin oturum', fmtInt(stats.activeSessions)),
      metric('Askıdaki hesap', fmtInt(stats.bannedPlayers)),
      metric('Sohbet mesajı', fmtInt(stats.chatMessages)),
      metric('Dünya', `${fmtInt(worldDay)}. gün`, `${stats.speed}× hız · tohum ${stats.seed}`),
    );
    const playerPanel = h('section', { class: 'panel stack-sm' },
      h('div', { class: 'panel-head' }, h('h2', null, 'Oyuncular'), h('span', { class: 'muted' }, `${fmtInt(stats.accounts)} hesap`)),
      playerTable(overview.players),
      h('p', { class: 'hint muted' }, 'Askıya alma hesabı silmez; oyuncu ve köy verisi korunur. Erişim yeniden açıldığında tekrar giriş yapabilir.'),
    );
    const communicationPanel = h('div', { class: 'admin-columns' },
      h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Dünya duyurusu')), h('p', { class: 'muted' }, 'Mesaj sohbet sekmesinde yönetim duyurusu olarak görünür.'), announcementForm),
      h('section', { class: 'panel stack-sm' },
        h('div', { class: 'panel-head admin-panel-head' }, h('h2', null, 'Son sohbet'), clearChat),
        chatList(overview.chat),
      ),
    );
    root.replaceChildren(
      h('header', { class: 'view-header admin-header' },
        h('h1', null, 'Yönetim paneli'),
        h('div', { class: 'form-row' }, refreshButton, logoutButton),
      ),
      metrics,
      message ? h('p', { class: 'admin-feedback', role: 'status' }, message) : null,
      playerPanel,
      communicationPanel,
      h('p', { class: 'admin-footnote muted' }, `Sunucu çalışma süresi: ${fmtInt(stats.uptime)} sn · Son yenileme: ${new Date().toLocaleTimeString('tr-TR')}`),
    );
  }

  showLogin();
  return {
    el: root,
    onShow() {
      if (token && lastLoaded) void loadDashboard();
    },
    update() {},
  };
}
