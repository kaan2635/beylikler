/**
 * Tarayıcılar arası doğrudan bağlantı (WebRTC) ile oda. PeerJS kütüphanesi (MIT lisanslı) yalnız
 * çok oyunculu odada, gerektiğinde yüklenir; bütünlük özetiyle (SRI) doğrulanır. Bağlantıyı
 * kurmak için PeerJS'in ücretsiz, herkese açık tanışma sunucusu kullanılır; oyun verisi
 * tarayıcılar arasında doğrudan ve şifreli (DTLS) akar.
 *
 * Mesajlar: istemci → ev sahibi { id, type: 'join'|'state'|'action'|'chat', ... }
 *           ev sahibi → istemci { re: id, ...yanıt }  ya da  { push: 'changed'|'chat', payload }
 */

const PEERJS = {
  src: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
  integrity: 'sha384-x0YgkOr/3UOZP2CRDxGW9e0Q+2Qjyr3uJrm4xU32Y7ZCNAo7Cc7bjhrZMi/dwczu',
};
const PREFIX = 'beylikler-oda-';
const TIMEOUT = 15_000;

let loading = null;

/** PeerJS'i bir kez yükler. */
export function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PEERJS.src;
    script.integrity = PEERJS.integrity;
    script.crossOrigin = 'anonymous';
    script.onload = () => (globalThis.Peer ? resolve(globalThis.Peer) : reject(new Error('Bağlantı kütüphanesi yüklenemedi')));
    script.onerror = () => {
      loading = null;
      reject(new Error('Bağlantı kütüphanesi indirilemedi; internet bağlantını kontrol et'));
    };
    document.head.append(script);
  });
  return loading;
}

export function peerIdOf(room) {
  return PREFIX + String(room).toLowerCase();
}

function describeError(err) {
  switch (err?.type) {
    case 'unavailable-id':
      return 'Bu oda zaten açık (belki başka bir sekmede). O sekmeyi kapatıp yeniden dene.';
    case 'peer-unavailable':
      return 'Oda bulunamadı. Ev sahibinin oyunu açık olmalı; kodu da kontrol et.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Tanışma sunucusuna ulaşılamadı; internet bağlantını kontrol et.';
    case 'browser-incompatible':
      return 'Bu tarayıcı doğrudan bağlantıyı (WebRTC) desteklemiyor.';
    default:
      return err?.message || 'Bağlantı kurulamadı';
  }
}

function openPeer(Peer, id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const fail = (err) => {
      peer.destroy();
      reject(new Error(describeError(err)));
    };
    peer.once('open', () => {
      peer.off('error', fail);
      resolve(peer);
    });
    peer.once('error', fail);
  });
}

/**
 * Odayı açar: gelen bağlantıları ev sahibi dünyasına (HostWorld) bağlar.
 * Dönen: { peer, close() }
 */
export async function openRoom(host, room) {
  const Peer = await loadPeer();
  const peer = await openPeer(Peer, peerIdOf(room));
  const connections = new Set();

  host.listeners.add((playerId, type, payload) => {
    for (const conn of connections) if (conn.playerId === playerId && conn.open) conn.send({ push: type, payload });
  });

  peer.on('connection', (conn) => {
    const budget = { count: 0, reset: Date.now() + 1000 };
    connections.add(conn);
    conn.on('data', async (message) => {
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
      // Basit hız sınırı: saniyede 30 istek
      if (Date.now() > budget.reset) Object.assign(budget, { count: 0, reset: Date.now() + 1000 });
      if (++budget.count > 30) return conn.send({ re: message.id, ok: false, reason: 'Çok hızlı; biraz yavaşla' });
      let response;
      try {
        if (message.type === 'join') {
          response = await host.join({ name: message.name, secret: message.secret });
          if (response.ok) conn.playerId = response.playerId;
        } else if (!conn.playerId) {
          response = { ok: false, reason: 'Önce odaya katıl' };
        } else if (message.type === 'state') {
          response = host.state(conn.playerId);
        } else if (message.type === 'action') {
          response = host.action(conn.playerId, String(message.name), message.args);
        } else if (message.type === 'chat') {
          response = host.chat(conn.playerId, message.text);
        } else {
          response = { ok: false, reason: 'Bilinmeyen istek' };
        }
      } catch (err) {
        response = { ok: false, reason: err.message || 'Ev sahibinde hata' };
      }
      if (conn.open) conn.send({ re: message.id, ...response });
    });
    conn.on('close', () => connections.delete(conn));
    conn.on('error', () => connections.delete(conn));
  });
  // Tanışma sunucusuyla bağ koparsa (ağ değişti, uyku…) yeniden bağlan; açık oyuncu bağlantıları sürer.
  peer.on('disconnected', () => {
    if (!peer.destroyed) setTimeout(() => peer.reconnect(), 2000);
  });

  return {
    peer,
    get connected() {
      return [...connections].filter((c) => c.open && c.playerId).length;
    },
    close() {
      peer.destroy();
    },
  };
}

/**
 * Odadaki ev sahibine bağlanan istemci. OnlineGame'in beklediği Api arayüzünü taşır.
 * Bağlantı koparsa kendiliğinden yeniden bağlanmayı dener.
 */
export class P2PApi {
  constructor(room) {
    this.room = room;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = {};
    this.closed = false;
  }

  async connect() {
    const Peer = await loadPeer();
    this.peer ??= await openPeer(Peer, null);
    await new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerIdOf(this.room), { reliable: true });
      const timer = setTimeout(() => reject(new Error('Ev sahibine ulaşılamadı (zaman aşımı). Oyunu açık mı?')), TIMEOUT);
      const onError = (err) => {
        clearTimeout(timer);
        reject(new Error(describeError(err)));
      };
      this.peer.once('error', onError);
      conn.on('open', () => {
        clearTimeout(timer);
        this.peer.off('error', onError);
        this.conn = conn;
        resolve();
      });
      conn.on('data', (message) => this.receive(message));
      conn.on('close', () => this.lost());
      conn.on('error', () => this.lost());
    });
  }

  receive(message) {
    if (!message || typeof message !== 'object') return;
    if (message.re != null) {
      const request = this.pending.get(message.re);
      if (request) {
        this.pending.delete(message.re);
        clearTimeout(request.timer);
        const { re, ...response } = message;
        request.resolve(response);
      }
    } else if (message.push) {
      this.handlers[message.push]?.(message.payload);
    }
  }

  /** Bağlantı koptu: bekleyen istekler başarısız olur, bir süre sonra yeniden bağlanılır. */
  lost() {
    if (this.conn === null) return;
    this.conn = null;
    for (const [, request] of this.pending) {
      clearTimeout(request.timer);
      request.resolve({ ok: false, offline: true, reason: 'Ev sahibiyle bağlantı koptu' });
    }
    this.pending.clear();
    this.handlers.disconnected?.({});
    if (!this.closed) this.retry(3000);
  }

  retry(delay) {
    setTimeout(async () => {
      if (this.closed || this.conn) return;
      try {
        await this.connect();
        if (this.credentials) await this.join(...this.credentials);
        this.handlers.changed?.({ events: [] });
        this.handlers.reconnected?.({});
      } catch {
        this.retry(Math.min(delay * 2, 30_000));
      }
    }, delay);
  }

  request(type, fields = {}) {
    if (!this.conn?.open) return Promise.resolve({ ok: false, offline: true, reason: 'Ev sahibiyle bağlantı yok; yeniden bağlanılıyor…' });
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, offline: true, reason: 'Ev sahibi yanıt vermedi' });
      }, TIMEOUT);
      this.pending.set(id, { resolve, timer });
      this.conn.send({ id, type, ...fields });
    });
  }

  async join(name, secret) {
    this.credentials = [name, secret];
    return this.request('join', { name, secret });
  }

  state() {
    return this.request('state');
  }

  action(name, args) {
    return this.request('action', { name, args });
  }

  chat(text) {
    return this.request('chat', { text });
  }

  async logout() {
    this.closed = true;
    this.peer?.destroy();
    return { ok: true };
  }

  events(handlers) {
    this.handlers = handlers;
    return { close: () => (this.handlers = {}) };
  }
}
