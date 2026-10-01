import { DIPLOMACY } from '../config/lords.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { canAfford, spend, storageCap } from './economy.js';
import { lordsOf, lordDefeated } from './world.js';
import { spendAkce } from './premium.js';

/**
 * Beylerle diplomasi. Oyuncunun kaydında: state.diplomacy[beyId] =
 *   { relation, at, peaceUntil }   (at ve peaceUntil dünya saatidir, oyun ms)
 * İlişki her oyun günü sıfıra doğru azalır; hesap tembeldir: kayıtta son değer ve zamanı durur.
 * Yapay zekâ ilişkiye göre daha seyrek ya da sık saldırır, barış süresince hiç saldırmaz.
 */

const DAY = 86_400_000;

const now = (state) => state.world.clock.time;

function entryOf(state, lordId) {
  state.diplomacy ??= {};
  return (state.diplomacy[lordId] ??= { relation: 0, at: now(state), peaceUntil: 0 });
}

/** Beyle şu anki ilişki (−100..100), zamanla sıfıra yaklaşmış hâliyle. */
export function relationOf(state, lordId, time = now(state)) {
  const entry = state.diplomacy?.[lordId];
  if (!entry) return 0;
  const decay = DIPLOMACY.decayPerDay * Math.max(0, (time - entry.at) / DAY);
  return entry.relation > 0 ? Math.max(0, entry.relation - decay) : Math.min(0, entry.relation + decay);
}

export function adjustRelation(state, lordId, delta, time = now(state)) {
  const current = relationOf(state, lordId, time);
  const entry = entryOf(state, lordId);
  entry.relation = Math.max(-100, Math.min(100, current + delta));
  entry.at = time;
  return entry.relation;
}

/** İlişkinin adı ve saldırı sıklığına etkisi. */
export function relationLevel(value) {
  return DIPLOMACY.levels.find((level) => value >= level.min);
}

export function peaceUntil(state, lordId) {
  return state.diplomacy?.[lordId]?.peaceUntil ?? 0;
}

export function peaceActive(state, lordId, time = now(state)) {
  return peaceUntil(state, lordId) > time;
}

/** Saldırılar arası bekleme çarpanı (müttefik bey için Infinity). */
export function attackIntervalFactor(state, lordId) {
  return relationLevel(relationOf(state, lordId)).interval;
}

function shareCost(village, share) {
  const amount = Math.round((share * storageCap(village)) / 10) * 10;
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, amount]));
}

export function giftCost(village, tierId) {
  const tier = DIPLOMACY.gifts.find((g) => g.id === tierId);
  return tier ? shareCost(village, tier.share) : null;
}

export function peaceCost(village) {
  return { ...shareCost(village, DIPLOMACY.peace.share), akce: DIPLOMACY.peace.akce };
}

function findLord(state, lordId) {
  const lord = lordsOf(state.world.seed).find((l) => l.id === lordId);
  if (!lord) return { error: { ok: false, code: 'lord', reason: 'Böyle bir bey yok' } };
  if (lordDefeated(state, lordId)) return { error: { ok: false, code: 'defeated', reason: 'Bu beyin hisarı fethedildi' } };
  return { lord };
}

export function inspectGift(state, village, lordId, tierId) {
  const { error } = findLord(state, lordId);
  if (error) return error;
  const tier = DIPLOMACY.gifts.find((g) => g.id === tierId);
  if (!tier) return { ok: false, code: 'tier', reason: 'Geçerli bir hediye seç' };
  const cost = giftCost(village, tierId);
  if (!canAfford(village, cost)) return { ok: false, code: 'resources', reason: 'Bu hediye için kaynak yetmiyor', cost, tier };
  return { ok: true, cost, tier };
}

/** Beye hediye gönderir: kaynaklar yönetilen köyden gider, ilişki yükselir. */
export function sendGift(state, village, lordId, tierId) {
  const check = inspectGift(state, village, lordId, tierId);
  if (!check.ok) return check;
  spend(village, check.cost);
  const relation = adjustRelation(state, lordId, check.tier.relation);
  state.stats.gifts = (state.stats.gifts ?? 0) + 1;
  return { ...check, relation };
}

export function inspectPeace(state, village, lordId) {
  const { error } = findLord(state, lordId);
  if (error) return error;
  const cost = peaceCost(village);
  const relation = relationOf(state, lordId);
  // İlişki zamanla azaldığı için yuvarlanır: hediyeden hemen sonra 19,99 da 20 sayılır.
  if (Math.round(relation) < DIPLOMACY.peace.minRelation) {
    return { ok: false, code: 'relation', reason: `Barış için ilişki en az ${DIPLOMACY.peace.minRelation} olmalı; önce hediye gönder`, cost };
  }
  if ((state.player.akce ?? 0) < cost.akce) return { ok: false, code: 'akce', reason: `Bunun için ${cost.akce} Akçe gerekir`, cost };
  const { akce, ...resources } = cost;
  if (!canAfford(village, resources)) return { ok: false, code: 'resources', reason: 'Antlaşma armağanı için kaynak yetmiyor', cost };
  return { ok: true, cost };
}

/**
 * Barış antlaşması: bey `days` oyun günü boyunca saldırmaz (süren barış uzar). Bedel Akçe ve
 * kaynaktır; ilişki de biraz yükselir.
 */
export function makePeace(state, village, lordId, at) {
  const check = inspectPeace(state, village, lordId);
  if (!check.ok) return check;
  const { akce, ...resources } = check.cost;
  spend(village, resources);
  spendAkce(state, akce, 'Barış antlaşması', at);
  const entry = entryOf(state, lordId);
  entry.peaceUntil = Math.max(entry.peaceUntil ?? 0, now(state)) + DIPLOMACY.peace.days * DAY;
  adjustRelation(state, lordId, DIPLOMACY.peace.relation);
  state.stats.treaties = (state.stats.treaties ?? 0) + 1;
  return { ...check, peaceUntil: entry.peaceUntil };
}
