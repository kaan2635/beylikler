import { NEWBIE_PROTECTION_DAYS } from '../config/lords.js';
import { WORLD } from '../config/world.js';
import { createNewGame, migrate } from '../core/state.js';
import { advanceMany } from '../core/engine.js';
import { hash3, mulberry32 } from '../core/random.js';
import { villagePoints, terrainAt, barbarianAt, lordsOf, lordPowerIn, lordVillage, distance, inWorld } from './world.js';

/**
 * Çok oyunculu dünya. Tek bir dünya nesnesi tüm oyuncuları tutar:
 *   { world, barbarians, ai, news, players: { id: { id, name, state } }, chat, nextPlayer }
 * Her oyuncunun `state`'i tek oyunculu oyunla aynı biçimdedir; yalnız `world`, `barbarians`,
 * `ai` ve `news` alanları bütün oyuncularda aynı (paylaşılan) nesnelerdir ve durumun
 * kayda yazılmayan `peers` alanı öbür oyuncuların köylerini gösterir. Böylece bütün oyun
 * kuralları değişmeden çok oyunculu çalışır; motor bütün oyuncuları tek zaman çizelgesinde
 * ilerletir (advanceMany).
 *
 * Bu modül DOM'a da ağa da dokunmaz: sunucu (server/) ve testler aynı kodu kullanır.
 */

const DAY = 86_400_000;
const SHARED = ['world', 'barbarians', 'ai', 'news'];
export const CHAT_MAX = 200;

/** Yeni, boş bir dünya. Beyler oyunculara saldırmaz (zorluk 'cok'). */
export function createWorld({ seed, speed = 1, now }) {
  return {
    version: 1,
    createdAt: now,
    world: { speed, seed, clock: { time: 0, at: now } },
    barbarians: {},
    ai: { difficulty: 'cok', lords: {} },
    news: [],
    players: {},
    chat: [],
    nextPlayer: 1,
  };
}

// ---------- Köy dizini ve öbür oyuncular ----------

const registries = new WeakMap();

function registry(data) {
  let reg = registries.get(data);
  if (!reg) {
    reg = { index: null };
    registries.set(data, reg);
  }
  if (!reg.index) {
    reg.index = new Map();
    reg.byId = new Map();
    for (const player of Object.values(data.players)) {
      for (const village of Object.values(player.state.villages)) {
        const entry = { player, village };
        reg.index.set(`${village.x}|${village.y}`, entry);
        reg.byId.set(village.id, entry);
      }
    }
  }
  return reg;
}

/** Köy el değiştirdi ya da yeni oyuncu geldi: dizin yeniden kurulsun. */
export function invalidate(data) {
  const reg = registries.get(data);
  if (reg) reg.index = null;
}

function isProtected(data, player) {
  return data.world.clock.time < (player.state.player.protectUntil ?? 0);
}

/** Öbür oyuncuların gördüğü köy özeti. */
function summary(data, player, village) {
  return {
    id: village.id,
    kind: 'rakip',
    name: village.name,
    owner: player.state.player.name,
    ownerId: player.id,
    x: village.x,
    y: village.y,
    points: villagePoints(village.buildings),
    capital: !!village.capital,
    protected: isProtected(data, player),
  };
}

/** `playerId` oyuncusunun gözünden öbür oyuncular (sunucu tarafı: gerçek köylere erişir). */
function peersFor(data, playerId) {
  const others = (entry) => entry && entry.player.id !== playerId;
  return {
    villageAt(x, y) {
      const entry = registry(data).index.get(`${x}|${y}`);
      return others(entry) ? summary(data, entry.player, entry.village) : null;
    },
    nearCapital(x, y, radius) {
      for (const [, entry] of registry(data).byId) {
        if (others(entry) && entry.village.capital && distance(x, y, entry.village.x, entry.village.y) < radius) return true;
      }
      return false;
    },
    resolve(villageId) {
      const entry = registry(data).byId.get(villageId);
      return entry ? { state: entry.player.state, village: entry.village, playerId: entry.player.id } : null;
    },
    notifyIncoming(villageId, notice) {
      const entry = registry(data).byId.get(villageId);
      if (entry && !entry.village.incoming.some((a) => a.id === notice.id)) entry.village.incoming.push(notice);
    },
    cancelIncoming(villageId, movementId) {
      const entry = registry(data).byId.get(villageId);
      if (!entry) return;
      entry.village.incoming = entry.village.incoming.filter((a) => a.id !== movementId);
    },
    /** Köyü sahibinden alıp `toState`e verir (fetih). */
    transfer(villageId, toState) {
      const entry = registry(data).byId.get(villageId);
      if (!entry) return;
      const from = entry.player.state;
      delete from.villages[villageId];
      if (from.activeVillageId === villageId) from.activeVillageId = Object.keys(from.villages)[0];
      toState.villages[villageId] = entry.village;
      invalidate(data);
    },
    list() {
      return [...registry(data).byId.values()].filter(others).map((entry) => summary(data, entry.player, entry.village));
    },
  };
}

/** Paylaşılan nesneleri ve `peers`i oyuncunun durumuna bağlar (yükledikten sonra da çağrılır). */
function attach(data, player) {
  for (const key of SHARED) player.state[key] = data[key];
  Object.defineProperty(player.state, 'peers', { value: peersFor(data, player.id), enumerable: false, configurable: true, writable: true });
}

// ---------- Oyuncular ----------

/** Yeni oyuncuya köy yeri: merkezden oyuncu sayısıyla genişleyen bir halkada boş kara. */
export function spawnPoint(data, salt = 0) {
  const n = Object.keys(data.players).length;
  const rng = mulberry32(hash3(data.world.seed ^ 0x51a7e5, n, salt));
  const probe = { world: data.world, villages: {}, barbarians: data.barbarians, ai: data.ai, peers: peersFor(data, null) };
  const lordTiles = new Set(lordsOf(data.world.seed).map((l) => `${l.x}|${l.y}`));
  for (let attempt = 0; attempt < 400; attempt++) {
    const radius = 6 + 4 * Math.sqrt(n) + attempt * 0.05;
    const angle = rng() * Math.PI * 2;
    const x = Math.round(WORLD.center + Math.cos(angle) * radius);
    const y = Math.round(WORLD.center + Math.sin(angle) * radius);
    if (!inWorld(x, y) || terrainAt(data.world.seed, x, y) === 'gol' || lordTiles.has(`${x}|${y}`)) continue;
    if (barbarianAt(probe, x, y)) continue;
    const crowded = [...registry(data).byId.values()].some(({ village }) => distance(x, y, village.x, village.y) < 4);
    if (!crowded) return { x, y };
  }
  throw new Error('Dünyada boş yer kalmadı');
}

/** Oyuncu ekler; köyü boş bir yere kurulur ve yeni oyuncu koruması başlar. */
export function addPlayer(data, { name, now }) {
  const id = `p${data.nextPlayer++}`;
  const { x, y } = spawnPoint(data);
  const state = createNewGame({ now, seed: data.world.seed, speed: data.world.speed, difficulty: 'cok', idPrefix: `${id}v`, x, y, playerName: name });
  state.player.protectUntil = data.world.clock.time + NEWBIE_PROTECTION_DAYS * DAY;
  const player = { id, name, state, joinedAt: now };
  data.players[id] = player;
  attach(data, player);
  invalidate(data);
  return player;
}

/** Bütün oyuncuları `now` anına ilerletir. Dönen: { oyuncuId: olaylar[] } (yalnız olayı olanlar). */
export function advanceWorld(data, now) {
  const players = Object.values(data.players);
  if (!players.length) {
    data.world.clock.time += Math.max(0, now - data.world.clock.at) * data.world.speed;
    data.world.clock.at = Math.max(data.world.clock.at, now);
    return {};
  }
  const results = advanceMany(players.map((p) => p.state), now);
  const byPlayer = {};
  for (const player of players) {
    const events = results.get(player.state);
    if (events?.length) byPlayer[player.id] = events;
  }
  return byPlayer;
}

// ---------- İstemciye giden görünüm ----------

/** Barbar köylerinin gizli bilgileri (asker, kaynak) casusluk olmadan görünmesin. */
function publicBarbarians(barbarians) {
  const out = {};
  for (const [id, entry] of Object.entries(barbarians)) {
    out[id] = { ...(entry.damage && { damage: entry.damage }), ...(entry.loyalty && { loyalty: entry.loyalty }) };
  }
  return out;
}

/** Sıralama: bütün oyuncular ve beyler. */
export function worldRanking(data) {
  const rows = Object.values(data.players).map((player) => ({
    id: player.id,
    kind: 'oyuncu',
    name: player.state.player.name,
    points: Object.values(player.state.villages).reduce((sum, v) => sum + villagePoints(v.buildings), 0),
    villages: Object.keys(player.state.villages).length,
    kills: player.state.stats.kills,
    loot: player.state.stats.loot,
    class: player.state.player.class,
  }));
  const probe = { world: data.world, ai: data.ai, barbarians: data.barbarians };
  for (const lord of lordsOf(data.world.seed)) {
    const entry = data.ai.lords[lord.id] ?? {};
    const village = lordVillage(probe, lord);
    rows.push({
      id: lord.id,
      kind: 'bey',
      name: village.owner,
      villageName: village.name,
      personality: lord.personality,
      x: lord.x,
      y: lord.y,
      points: entry.defeated ? 0 : village.points,
      power: lordPowerIn(probe, lord),
      kills: entry.kills ?? 0,
      loot: entry.loot ?? 0,
      defeated: !!entry.defeated,
    });
  }
  rows.sort((a, b) => b.points - a.points || b.kills - a.kills);
  rows.forEach((row, index) => (row.rank = index + 1));
  return rows;
}

/**
 * Oyuncunun istemcisine gönderilen görünüm: kendi durumu (tam), öbür oyuncuların köy
 * özetleri, sıralama ve sohbet. Sunucu saati de eklenir; istemci saat farkını düzeltir.
 */
export function playerView(data, playerId, now) {
  const player = data.players[playerId];
  const state = { ...player.state, barbarians: publicBarbarians(data.barbarians) };
  return {
    playerId,
    serverNow: now,
    state,
    peers: player.state.peers.list(),
    ranking: worldRanking(data),
    chat: data.chat.slice(-50),
    players: Object.keys(data.players).length,
  };
}

// ---------- Sohbet ----------

export function postChat(data, playerId, text, now) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!clean) return { ok: false, reason: 'Boş mesaj gönderilemez' };
  const player = data.players[playerId];
  const message = { at: now, playerId, name: player.state.player.name, text: clean };
  data.chat.push(message);
  if (data.chat.length > CHAT_MAX) data.chat.splice(0, data.chat.length - CHAT_MAX);
  return { ok: true, message };
}

// ---------- Kayıt ----------

/** Dünyayı JSON'a çevirir: paylaşılan nesneler bir kez yazılır. */
export function serializeWorld(data) {
  const players = {};
  for (const [id, player] of Object.entries(data.players)) {
    const state = { ...player.state };
    for (const key of SHARED) delete state[key];
    players[id] = { ...player, state };
  }
  return JSON.stringify({ ...data, players });
}

/** JSON'dan dünyayı kurar; eski oyuncu kayıtları güncel şemaya taşınır. */
export function loadWorld(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  for (const player of Object.values(data.players)) {
    for (const key of SHARED) player.state[key] = data[key];
    player.state = migrate(player.state);
    for (const key of SHARED) player.state[key] = data[key]; // taşıma yeni nesne döndürmüş olabilir
    attach(data, player);
  }
  data.chat ??= [];
  return data;
}

/** İstemci tarafı: sunucunun gönderdiği özetlerden salt okunur `peers`. */
export function clientPeers(list) {
  const index = new Map(list.map((v) => [`${v.x}|${v.y}`, v]));
  return {
    villageAt: (x, y) => index.get(`${x}|${y}`) ?? null,
    nearCapital: (x, y, radius) => list.some((v) => v.capital && distance(x, y, v.x, v.y) < radius),
    resolve: () => null,
    notifyIncoming() {},
    cancelIncoming() {},
    transfer() {},
    list: () => list,
  };
}
