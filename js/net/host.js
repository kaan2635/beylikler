import { createWorld, addPlayer, advanceWorld, playerView, postChat, serializeWorld, loadWorld } from '../systems/multiplayer.js';
import { Game } from '../game.js';
import { ACTIONS } from './actions.js';

/**
 * Tarayıcıda kurulan çok oyunculu dünya ("oda"). Ev sahibinin sekmesi Node sunucusunun yaptığını
 * yapar: dünyayı tutar, her saniye ilerletir, oyuncuların eylemlerini oyunun kurallarıyla uygular
 * ve kaydeder. Oyuncular ev sahibine doğrudan (WebRTC, bkz. p2p.js) bağlanır; ev sahibi de
 * kendi dünyasına aynı yoldan (LocalApi) katılır.
 *
 * Kimlik: her oyuncunun tarayıcısı rastgele bir gizli anahtar üretir ve saklar. Ev sahibi
 * anahtarın yalnızca özetini (SHA-256) tutar; aynı anahtarla gelen oyuncu aynı beye döner.
 *
 * Bu sınıf ağa ve DOM'a dokunmaz; Node'da da test edilir.
 */

const NAME = /^[\p{L}\p{N}_ ]{3,20}$/u;

async function digest(text) {
  const bytes = new TextEncoder().encode(String(text));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSecret() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Oda kodu: karıştırılması zor harf ve rakamlar (0/O, 1/I yok). */
export function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export class HostWorld {
  /**
   * @param storage { load(): string|null, save(text) } — tarayıcıda localStorage
   */
  constructor(storage, { now = Date.now(), speed = 1, seed } = {}) {
    this.storage = storage;
    const text = storage.load();
    this.data = text ? loadWorld(text) : createWorld({ seed: seed ?? Math.floor(Math.random() * 2 ** 32), speed, now });
    this.data.peerKeys ??= {}; // anahtar özeti → oyuncu
    this.listeners = new Set(); // (oyuncuId, olay türü, yük) → void
    this.dirty = !text;
  }

  /** Dünyayı şimdiye getirir; olayı olan oyunculara haber verir. */
  tick(now = Date.now()) {
    const events = advanceWorld(this.data, now);
    for (const [playerId, list] of Object.entries(events)) {
      this.dirty = true;
      this.notify(playerId, 'changed', { events: list });
    }
  }

  notify(playerId, type, payload) {
    for (const listener of this.listeners) listener(playerId, type, payload);
  }

  broadcast(type, payload) {
    for (const playerId of Object.keys(this.data.players)) this.notify(playerId, type, payload);
  }

  view(playerId, now = Date.now()) {
    return playerView(this.data, playerId, now);
  }

  /** Oyuncu katılır: anahtarı tanınıyorsa kendi beyine döner, yoksa yeni köy kurulur. */
  async join({ name, secret }, now = Date.now()) {
    if (typeof secret !== 'string' || secret.length < 16 || secret.length > 200) return { ok: false, reason: 'Geçersiz oyuncu anahtarı' };
    const key = await digest(secret);
    let playerId = this.data.peerKeys[key];
    if (!playerId || !this.data.players[playerId]) {
      const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
      if (!NAME.test(clean)) return { ok: false, reason: 'Bey adı 3–20 karakter olmalı: harf, rakam, boşluk' };
      const taken = Object.values(this.data.players).some((p) => p.name.toLocaleLowerCase('tr') === clean.toLocaleLowerCase('tr'));
      if (taken) return { ok: false, reason: 'Bu dünyada bu adda bir bey var; başka bir ad seç' };
      this.tick(now);
      const player = addPlayer(this.data, { name: clean, now });
      playerId = player.id;
      this.data.peerKeys[key] = playerId;
      this.dirty = true;
      this.broadcast('chat', { system: true, text: `${clean} dünyaya katıldı.` });
      this.broadcast('changed', { events: [] });
    }
    this.tick(now);
    return { ok: true, playerId, view: this.view(playerId, now) };
  }

  state(playerId, now = Date.now()) {
    if (!this.data.players[playerId]) return { ok: false, reason: 'Oyuncu bulunamadı' };
    this.tick(now);
    return { ok: true, view: this.view(playerId, now) };
  }

  action(playerId, name, args, now = Date.now()) {
    if (!this.data.players[playerId]) return { ok: false, reason: 'Oyuncu bulunamadı' };
    const act = ACTIONS[name];
    if (!act) return { ok: false, reason: 'Bilinmeyen eylem' };
    this.tick(now);
    const game = new Game({ load: () => null, save() {}, clear() {} });
    game.state = this.data.players[playerId].state;
    let result;
    try {
      result = act(game, Array.isArray(args) ? args : [], now);
    } catch (err) {
      return { ok: false, reason: err.message || 'Geçersiz eylem' };
    }
    this.dirty = true;
    // Saldırı başka bir oyuncuyu da ilgilendirir: gelen saldırıyı hemen görsün.
    if (/Attack/.test(name)) {
      for (const id of Object.keys(this.data.players)) if (id !== playerId) this.notify(id, 'changed', { events: [] });
    }
    return { ok: true, result: plain(result), view: this.view(playerId, now) };
  }

  chat(playerId, text, now = Date.now()) {
    if (!this.data.players[playerId]) return { ok: false, reason: 'Oyuncu bulunamadı' };
    const result = postChat(this.data, playerId, text, now);
    if (!result.ok) return result;
    this.dirty = true;
    this.broadcast('chat', result.message);
    return { ok: true };
  }

  /** Değiştiyse kaydeder. Dönen: kaydedildi mi. */
  save(force = false) {
    if (!this.dirty && !force) return false;
    this.storage.save(serializeWorld(this.data));
    this.dirty = false;
    return true;
  }

  get playerCount() {
    return Object.keys(this.data.players).length;
  }
}

/** Eylem sonucunu aktarılabilir hâle getirir (durum nesnelerine başvuru kalmasın). */
function plain(result) {
  if (result == null || typeof result !== 'object') return result;
  const { movement, target, ...rest } = result;
  return JSON.parse(
    JSON.stringify({
      ...rest,
      ...(target && { target: { name: target.name, x: target.x, y: target.y } }),
      ...(movement && { movement: { id: movement.id, arriveAt: movement.arriveAt } }),
    }),
  );
}

/**
 * Ev sahibinin kendi oyunu için bağlantı: ağ yok, dünyaya doğrudan çağrı. OnlineGame'in
 * beklediği Api arayüzünü (state, action, chat, events, logout) taşır.
 */
export class LocalApi {
  constructor(host) {
    this.host = host;
    this.playerId = null;
  }

  async join(name, secret) {
    const response = await this.host.join({ name, secret });
    if (response.ok) this.playerId = response.playerId;
    return response;
  }

  async state() {
    return this.host.state(this.playerId);
  }

  async action(name, args) {
    return this.host.action(this.playerId, name, args);
  }

  async chat(text) {
    return this.host.chat(this.playerId, text);
  }

  async logout() {
    return { ok: true };
  }

  events(handlers) {
    const listener = (playerId, type, payload) => {
      if (playerId === this.playerId) queueMicrotask(() => handlers[type]?.(payload));
    };
    this.host.listeners.add(listener);
    return { close: () => this.host.listeners.delete(listener) };
  }
}
