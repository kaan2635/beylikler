import { CHAT_MAX, worldRanking } from '../js/systems/multiplayer.js';

/** Yönetim paneline güvenle gönderilebilecek dünya özeti; hesap özeti/hash'i dışarı çıkmaz. */
export function adminOverview({ data, accounts, sessions, bans, now = Date.now(), uptime = 0 }) {
  const rank = new Map(worldRanking(data).filter((row) => row.kind === 'oyuncu').map((row) => [row.id, row.points]));
  const usernameByPlayer = new Map(Object.entries(accounts).map(([username, account]) => [account.playerId, username]));
  const players = Object.values(data.players)
    .map((player) => {
      const state = player.state;
      const ban = bans[player.id];
      return {
        id: player.id,
        username: usernameByPlayer.get(player.id) ?? null,
        name: state.player.name ?? player.name,
        class: state.player.class ?? null,
        joinedAt: player.joinedAt ?? null,
        villages: Object.keys(state.villages).length,
        points: rank.get(player.id) ?? 0,
        kills: state.stats?.kills ?? 0,
        banned: !!ban,
        banReason: ban?.reason ?? null,
        bannedAt: ban?.at ?? null,
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'tr'));

  const activeSessions = Object.values(sessions).filter((session) => session?.expires > now);
  return {
    stats: {
      players: players.length,
      accounts: Object.keys(accounts).length,
      activeSessions: activeSessions.filter((session) => session.role !== 'admin' && session.playerId && !bans[session.playerId]).length,
      bannedPlayers: players.filter((player) => player.banned).length,
      chatMessages: data.chat.length,
      speed: data.world.speed,
      seed: data.world.seed,
      worldTime: data.world.clock.time,
      createdAt: data.createdAt,
      uptime: Math.max(0, Math.floor(uptime)),
    },
    players,
    chat: data.chat.slice(-30).reverse().map((message) => ({
      at: message.at ?? null,
      name: message.name ?? (message.system ? 'Sistem' : 'Bilinmeyen'),
      text: message.text,
      system: !!message.system,
    })),
  };
}

/** Yalnızca düz metin duyurusu kabul eder; sohbet arayüzü de metni güvenli biçimde gösterir. */
export function addAdminAnnouncement(data, text, now = Date.now()) {
  const clean = (typeof text === 'string' ? text : '').replace(/\s+/gu, ' ').trim().slice(0, 280);
  if (!clean) return { ok: false, reason: 'Duyuru metni boş olamaz' };
  const message = { at: now, system: true, name: 'Yönetim', text: clean };
  data.chat.push(message);
  if (data.chat.length > CHAT_MAX) data.chat.splice(0, data.chat.length - CHAT_MAX);
  return { ok: true, message };
}

/** Hesabı silmeden erişimi askıya alır; tüm etkin oyuncu oturumları ayrıca iptal edilir. */
export function banPlayer(bans, data, playerId, reason, now = Date.now()) {
  if (!data.players[playerId]) return { ok: false, reason: 'Oyuncu bulunamadı' };
  const cleanReason = (typeof reason === 'string' ? reason : '').replace(/\s+/gu, ' ').trim().slice(0, 160);
  bans[playerId] = { at: now, reason: cleanReason || 'Yönetici kararı' };
  return { ok: true, ban: bans[playerId] };
}

export function unbanPlayer(bans, data, playerId) {
  if (!data.players[playerId]) return { ok: false, reason: 'Oyuncu bulunamadı' };
  const existed = !!bans[playerId];
  delete bans[playerId];
  return { ok: true, changed: existed };
}

export function clearAdminChat(data) {
  const removed = data.chat.length;
  data.chat.length = 0;
  return removed;
}
