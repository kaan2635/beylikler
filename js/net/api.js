/**
 * Çok oyunculu bağlantı bilgisi tarayıcıda saklanır: localStorage['beylikler:cevrimici'] =
 *   { base, token, username }                             → Node sunucusu (server/index.js)
 *   { mode: 'oda', role: 'host'|'guest', room, name, secret } → tarayıcıda kurulan oda (p2p.js)
 */

const CONFIG_KEY = 'beylikler:cevrimici';

export function readOnlineConfig() {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null');
    if (value?.mode === 'oda') return value.room && value.secret ? value : null;
    return value?.token && typeof value.base === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function writeOnlineConfig(config) {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // Tarayıcı saklamaya izin vermiyorsa oturum yalnızca bu sekmede sürer.
  }
}

export class Api {
  constructor(base, token = null) {
    this.base = String(base ?? '').replace(/\/+$/, '');
    this.token = token;
  }

  async request(method, path, body) {
    let response;
    try {
      response = await fetch(this.base + path, {
        method,
        headers: {
          ...(body && { 'content-type': 'application/json' }),
          ...(this.token && { authorization: `Bearer ${this.token}` }),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      return { ok: false, offline: true, reason: 'Sunucuya ulaşılamadı. İnternet bağlantını ve sunucu adresini kontrol et.' };
    }
    let data;
    try {
      data = await response.json();
    } catch {
      data = { ok: false, reason: `Sunucudan geçersiz yanıt (${response.status})` };
    }
    return { ...data, status: response.status };
  }

  register(username, password) {
    return this.request('POST', '/api/register', { username, password });
  }

  login(username, password) {
    return this.request('POST', '/api/login', { username, password });
  }

  logout() {
    return this.request('POST', '/api/logout', {});
  }

  state() {
    return this.request('GET', '/api/state');
  }

  action(name, args) {
    return this.request('POST', '/api/action', { name, args });
  }

  chat(text) {
    return this.request('POST', '/api/chat', { text });
  }

  /** Canlı bildirimler (Server-Sent Events). */
  events(handlers) {
    const source = new EventSource(`${this.base}/api/events?token=${encodeURIComponent(this.token)}`);
    for (const [type, handler] of Object.entries(handlers)) {
      source.addEventListener(type, (event) => {
        try {
          handler(JSON.parse(event.data));
        } catch {
          // Bozuk mesajı yok say.
        }
      });
    }
    return source;
  }
}
