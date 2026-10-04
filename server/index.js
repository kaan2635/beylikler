// Beylikler çok oyunculu sunucusu. Bağımlılık yok: yalnızca Node.js (20+).
//
//   npm run server                    → http://127.0.0.1:8787 (oyun + API)
//   HOST=0.0.0.0 npm run server       → aynı ağdaki arkadaşların da bağlanabilir
//
// Ortam değişkenleri: PORT, HOST, DATA_DIR, WORLD_SPEED, WORLD_SEED, ALLOWED_ORIGINS,
// ADMIN_USERNAME ve ADMIN_PASSWORD (yönetici paneli; parola en az 16 karakter).
// (virgülle; oyunu GitHub Pages'ten açanlar için ör. https://kaan2635.github.io), SERVE_STATIC.
//
// Sunucu otoritedir: oyuncunun her eylemi sunucuda, oyunun aynı kurallarıyla (js/ klasörü)
// uygulanır. İstemci yalnızca niyet gönderir; sonuç ve dünyanın durumu sunucudan gelir.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../js/game.js';
import { createWorld, addPlayer, advanceWorld, playerView, postChat } from '../js/systems/multiplayer.js';
import { createStore } from './store.js';
import { hashPassword, verifyPassword, newToken, validUsername, validPassword, safeEqualText } from './auth.js';
import { adminOverview, addAdminAnnouncement, banPlayer, unbanPlayer, clearAdminChat } from './admin.js';
import { ACTIONS } from '../js/net/actions.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(ROOT, 'data'));
const SPEED = Number(process.env.WORLD_SPEED ?? 1);
const ALLOWED = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const SERVE_STATIC = process.env.SERVE_STATIC !== 'false';
const SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 8;
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME ?? '').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const ADMIN_ENABLED = ADMIN_USERNAME.length >= 3 && ADMIN_USERNAME.length <= 32 && ADMIN_PASSWORD.length >= 16;
if ((ADMIN_USERNAME || ADMIN_PASSWORD) && !ADMIN_ENABLED) {
  console.warn('Yönetim paneli kapalı: ADMIN_USERNAME (3–32 karakter) ve ADMIN_PASSWORD (en az 16 karakter) ayarlanmalı.');
}

const store = createStore(DATA_DIR);
let data = await store.loadWorld();
if (!data) {
  const seed = Number(process.env.WORLD_SEED ?? Math.floor(Math.random() * 2 ** 32));
  data = createWorld({ seed, speed: SPEED, now: Date.now() });
  await store.saveWorld(data);
  console.log(`Yeni dünya kuruldu (tohum ${seed}, hız ${SPEED}x)`);
}
const accounts = (await store.load('accounts')) ?? {}; // kullanıcı adı → { playerId, salt, hash }
const sessions = (await store.load('sessions')) ?? {}; // jeton → { playerId?, role?, expires }
const bans = (await store.load('bans')) ?? {}; // oyuncu kimliği → { at, reason }
let dirty = false;

// ---------- Canlı bildirimler (SSE) ----------

const streams = new Map(); // oyuncu → Set<res>

function push(playerId, type, payload) {
  for (const res of streams.get(playerId) ?? []) res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(type, payload) {
  for (const id of streams.keys()) push(id, type, payload);
}

/** Dünyayı şimdiye getirir; olayı olan oyunculara haber verir. */
function tick(now = Date.now()) {
  const events = advanceWorld(data, now);
  for (const [playerId, list] of Object.entries(events)) {
    dirty = true;
    push(playerId, 'changed', { events: list });
  }
}

setInterval(() => {
  try {
    tick();
  } catch (err) {
    console.error('Dünya ilerletilemedi:', err);
  }
}, 1000);

setInterval(async () => {
  if (!dirty) return;
  dirty = false;
  await store.saveWorld(data);
}, 5000);

setInterval(() => broadcast('ping', { at: Date.now() }), 25_000);

// ---------- Yardımcılar ----------

const limits = new Map(); // anahtar → { count, reset }
function limited(key, max, windowMs) {
  const now = Date.now();
  const entry = limits.get(key);
  if (!entry || entry.reset < now) {
    limits.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw Object.assign(new Error('İstek çok büyük'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Geçersiz JSON'), { status: 400 });
  }
}

function sessionOf(req, url, { allowQueryToken = false } = {}) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : allowQueryToken ? url.searchParams.get('token') : null;
  const session = token && sessions[token];
  if (!session || session.expires < Date.now()) return null;
  if (session.role === 'admin') return { token, role: 'admin' };
  if (!session.playerId || !data.players[session.playerId]) return null;
  if (bans[session.playerId]) return { token, playerId: session.playerId, role: 'banned' };
  return { token, playerId: session.playerId, role: 'player' };
}

async function startSession(playerId, { role = 'player', ttlMs = SESSION_DAYS * 86_400_000 } = {}) {
  const token = newToken();
  sessions[token] = { ...(playerId && { playerId }), role, expires: Date.now() + ttlMs };
  for (const [key, session] of Object.entries(sessions)) if (session.expires < Date.now()) delete sessions[key];
  await store.save('sessions', sessions);
  return token;
}

function view(playerId) {
  const now = Date.now();
  return playerView(data, playerId, now);
}

async function adminApi(req, res, url) {
  const { pathname } = url;
  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    tick();
    const now = Date.now();
    return send(res, 200, {
      ok: true,
      overview: adminOverview({ data, accounts, sessions, bans, now, uptime: process.uptime() }),
    });
  }

  if (pathname === '/api/admin/announcement' && req.method === 'POST') {
    const { text } = await readJson(req);
    const result = addAdminAnnouncement(data, text, Date.now());
    if (!result.ok) return send(res, 400, result);
    dirty = true;
    broadcast('chat', result.message);
    return send(res, 200, result);
  }

  if (pathname === '/api/admin/chat/clear' && req.method === 'POST') {
    await readJson(req);
    const removed = clearAdminChat(data);
    dirty = true;
    broadcast('chat-cleared', { removed });
    return send(res, 200, { ok: true, removed });
  }

  const playerMatch = pathname.match(/^\/api\/admin\/players\/(p\d+)\/(ban|unban)$/);
  if (playerMatch && req.method === 'POST') {
    const [, playerId, action] = playerMatch;
    const body = await readJson(req);
    if (action === 'ban') {
      const result = banPlayer(bans, data, playerId, body.reason, Date.now());
      if (!result.ok) return send(res, 404, result);
      for (const [token, playerSession] of Object.entries(sessions)) {
        if (playerSession.playerId === playerId) delete sessions[token];
      }
      await store.save('bans', bans);
      await store.save('sessions', sessions);
      push(playerId, 'session-expired', { reason: 'Bu hesap yönetici tarafından askıya alındı.' });
      for (const response of streams.get(playerId) ?? []) response.end();
      streams.delete(playerId);
      return send(res, 200, { ok: true, playerId, ban: result.ban });
    }

    const result = unbanPlayer(bans, data, playerId);
    if (!result.ok) return send(res, 404, result);
    if (result.changed) await store.save('bans', bans);
    return send(res, 200, { ok: true, playerId, changed: result.changed });
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    await readJson(req);
    const token = sessionOf(req, url)?.token;
    if (token) delete sessions[token];
    await store.save('sessions', sessions);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { ok: false, reason: 'Yönetim API yolu bulunamadı' });
}

// ---------- API ----------

async function api(req, res, url) {
  const ip = req.socket.remoteAddress ?? '?';
  const path = url.pathname;

  if (path === '/api/health') return send(res, 200, { ok: true, players: Object.keys(data.players).length, now: Date.now(), speed: data.world.speed });

  if (path === '/api/admin/login' && req.method === 'POST') {
    if (!ADMIN_ENABLED) return send(res, 503, { ok: false, reason: 'Yönetim girişi sunucuda yapılandırılmamış' });
    if (limited(`admin-auth:${ip}`, 5, 60_000)) return send(res, 429, { ok: false, reason: 'Çok fazla yönetici giriş denemesi; bir dakika bekle' });
    const { username, password } = await readJson(req);
    const suppliedName = String(username ?? '').trim().toLocaleLowerCase('tr');
    const configuredName = ADMIN_USERNAME.toLocaleLowerCase('tr');
    const validName = safeEqualText(suppliedName, configuredName);
    const validSecret = safeEqualText(password, ADMIN_PASSWORD);
    if (!validName || !validSecret) return send(res, 401, { ok: false, reason: 'Yönetici adı ya da parolası yanlış' });
    const token = await startSession(null, { role: 'admin', ttlMs: ADMIN_SESSION_HOURS * 3_600_000 });
    return send(res, 200, { ok: true, token, expiresIn: ADMIN_SESSION_HOURS * 3_600 });
  }

  if (path.startsWith('/api/admin/')) {
    const session = sessionOf(req, url);
    if (!session || session.role !== 'admin') return send(res, 401, { ok: false, reason: 'Yönetici oturumu yok ya da süresi doldu; yeniden giriş yap' });
    if (limited(`admin:${ip}`, 90, 10_000)) return send(res, 429, { ok: false, reason: 'Yönetim istekleri çok hızlı; biraz yavaşla' });
    return adminApi(req, res, url);
  }

  if (path === '/api/register' && req.method === 'POST') {
    if (limited(`auth:${ip}`, 10, 60_000)) return send(res, 429, { ok: false, reason: 'Çok fazla deneme; bir dakika bekle' });
    const { username, password } = await readJson(req);
    const name = String(username ?? '').trim();
    const key = name.toLocaleLowerCase('tr');
    if (!validUsername(name)) return send(res, 400, { ok: false, reason: 'Kullanıcı adı 3–20 karakter olmalı: harf, rakam, alt çizgi' });
    if (!validPassword(password)) return send(res, 400, { ok: false, reason: 'Şifre en az 8 karakter olmalı' });
    if (ADMIN_USERNAME && key === ADMIN_USERNAME.toLocaleLowerCase('tr')) return send(res, 409, { ok: false, reason: 'Bu kullanıcı adı yönetici girişi için ayrılmış' });
    if (accounts[key]) return send(res, 409, { ok: false, reason: 'Bu kullanıcı adı alınmış' });
    tick();
    const player = addPlayer(data, { name, now: Date.now() });
    accounts[key] = { playerId: player.id, ...(await hashPassword(password)), createdAt: Date.now() };
    await store.save('accounts', accounts);
    await store.saveWorld(data);
    broadcast('chat', { system: true, text: `${name} dünyaya katıldı.` });
    broadcast('changed', { events: [] }); // öbür oyuncuların haritasında yeni köy görünsün
    return send(res, 200, { ok: true, token: await startSession(player.id), view: view(player.id) });
  }

  if (path === '/api/login' && req.method === 'POST') {
    if (limited(`auth:${ip}`, 10, 60_000)) return send(res, 429, { ok: false, reason: 'Çok fazla deneme; bir dakika bekle' });
    const { username, password } = await readJson(req);
    const account = accounts[String(username ?? '').trim().toLocaleLowerCase('tr')];
    if (!account || !(await verifyPassword(String(password ?? ''), account))) {
      return send(res, 401, { ok: false, reason: 'Kullanıcı adı ya da şifre yanlış' });
    }
    if (bans[account.playerId]) return send(res, 403, { ok: false, reason: 'Bu hesap yönetici tarafından askıya alındı' });
    tick();
    return send(res, 200, { ok: true, token: await startSession(account.playerId), view: view(account.playerId) });
  }

  const session = sessionOf(req, url, { allowQueryToken: path === '/api/events' });
  if (session?.role === 'banned') return send(res, 403, { ok: false, reason: 'Bu hesap yönetici tarafından askıya alındı' });
  if (!session || session.role !== 'player') return send(res, 401, { ok: false, reason: 'Oturum yok ya da süresi doldu; yeniden giriş yap' });
  const { playerId } = session;

  if (path === '/api/logout' && req.method === 'POST') {
    delete sessions[session.token];
    await store.save('sessions', sessions);
    return send(res, 200, { ok: true });
  }

  if (path === '/api/state' && req.method === 'GET') {
    tick();
    return send(res, 200, { ok: true, view: view(playerId) });
  }

  if (path === '/api/action' && req.method === 'POST') {
    if (limited(`act:${playerId}`, 30, 1000)) return send(res, 429, { ok: false, reason: 'Çok hızlı; biraz yavaşla' });
    const { name, args } = await readJson(req);
    const action = ACTIONS[name];
    if (!action) return send(res, 400, { ok: false, reason: 'Bilinmeyen eylem' });
    const now = Date.now();
    tick(now);
    const game = new Game({ load: () => null, save() {}, clear() {} });
    game.state = data.players[playerId].state;
    let result;
    try {
      result = action(game, Array.isArray(args) ? args : [], now);
    } catch (err) {
      return send(res, 400, { ok: false, reason: err.message || 'Geçersiz eylem' });
    }
    dirty = true;
    // Saldırı gibi eylemler başka bir oyuncuyu da etkileyebilir: onu da uyar.
    if (name === 'sendAttack' || name === 'repeatAttack' || name === 'repeatAttacks' || name === 'recallAttack') {
      for (const id of Object.keys(data.players)) if (id !== playerId) push(id, 'changed', { events: [] });
    }
    return send(res, 200, { ok: true, result: plain(result), view: view(playerId) });
  }

  if (path === '/api/chat' && req.method === 'POST') {
    if (limited(`chat:${playerId}`, 5, 10_000)) return send(res, 429, { ok: false, reason: 'Çok hızlı yazıyorsun' });
    const { text } = await readJson(req);
    const result = postChat(data, playerId, text, Date.now());
    if (!result.ok) return send(res, 400, result);
    dirty = true;
    broadcast('chat', result.message);
    return send(res, 200, { ok: true });
  }

  if (path === '/api/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`event: hello\ndata: ${JSON.stringify({ playerId })}\n\n`);
    if (!streams.has(playerId)) streams.set(playerId, new Set());
    streams.get(playerId).add(res);
    req.on('close', () => {
      streams.get(playerId)?.delete(res);
      if (!streams.get(playerId)?.size) streams.delete(playerId);
    });
    return;
  }

  return send(res, 404, { ok: false, reason: 'Bulunamadı' });
}

/** Eylem sonucunu JSON'a uygun hâle getirir (durum nesnelerine başvuru taşımasın). */
function plain(result) {
  if (result == null || typeof result !== 'object') return result;
  const { movement, target, ...rest } = result;
  return JSON.parse(JSON.stringify({ ...rest, ...(target && { target: { name: target.name, x: target.x, y: target.y } }), ...(movement && { movement: { id: movement.id, arriveAt: movement.arriveAt } }) }));
}

// ---------- Statik dosyalar (oyunun kendisi) ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const PUBLIC = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'assets'];

async function serveStatic(req, res, url) {
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  const full = normalize(join(ROOT, path));
  const top = full.slice(ROOT.length + 1).split(sep)[0];
  if (!full.startsWith(ROOT + sep) || !PUBLIC.includes(top)) return send(res, 404, { ok: false, reason: 'Bulunamadı' });
  try {
    const info = await stat(full);
    if (!info.isFile()) throw new Error('dosya değil');
    res.writeHead(200, { 'Content-Type': TYPES[extname(full)] ?? 'application/octet-stream', 'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(await readFile(full));
  } catch {
    send(res, 404, { ok: false, reason: 'Bulunamadı' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (SERVE_STATIC && req.method === 'GET') return await serveStatic(req, res, url);
    return send(res, 404, { ok: false, reason: 'Bulunamadı' });
  } catch (err) {
    if (!res.headersSent) send(res, err.status ?? 500, { ok: false, reason: err.status ? err.message : 'Sunucu hatası' });
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  const port = server.address()?.port ?? PORT;
  console.log(`Beylikler sunucusu: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}  (${Object.keys(data.players).length} oyuncu, hız ${data.world.speed}x)`);
});

async function shutdown() {
  await store.saveWorld(data);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
