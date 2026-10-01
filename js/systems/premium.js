import { CLASSES, CLASS_IDS, OFFICERS, DEFAULT_BONUS, ADDITIVE_BONUS, PREMIUM } from '../config/classes.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { storageCap, produce, deposit } from './economy.js';
import { seasonOf } from './seasons.js';
import { ilimBonuses, unlockedUnits } from './ilim.js';
import { heroHomeBonus } from './hero.js';
import { TITLES } from '../config/titles.js';

/**
 * Sınıf, Akçe ve görevliler.
 *
 * Oyuncu: state.player = { name, class, akce, officers: { [görevli]: bitiş (ms) }, akceLog }
 * Sınıfın ve görevlilerin etkileri tek bir `bonus` nesnesinde birleşir ve her köye kayda
 * yazılmayan (sayılmayan) bir alan olarak eklenir; motor her olaydan sonra yeniler. Kurallar
 * köyün bonusunu `bonusOf(village)` ile okur. Böylece kayıt küçük kalır ve eski bir bonus
 * kayıttan geri gelemez.
 */

const DAY = 86_400_000;
const MINUTE = 60_000;

function playerSources(player) {
  const sources = [];
  if (player?.class && CLASSES[player.class]) sources.push(CLASSES[player.class].bonus);
  for (const id of Object.keys(player?.officers ?? {})) if (OFFICERS[id]) sources.push(OFFICERS[id].bonus);
  return sources;
}

function merge(sources) {
  const bonus = { ...DEFAULT_BONUS };
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (!(key in DEFAULT_BONUS)) continue;
      bonus[key] = ADDITIVE_BONUS.has(key) ? bonus[key] + value : bonus[key] * value;
    }
  }
  return Object.freeze(bonus);
}

/** Oyuncunun sınıfı ve görevdeki görevlilerinden birleşik etki. */
export function playerBonus(player) {
  return merge(playerSources(player));
}

/**
 * Bütün etkiler: sınıf, görevliler, unvan, mevsim, Divan araştırmaları ve olaylardan gelen
 * geçici etkiler (state.player.modifiers).
 */
export function stateBonus(state) {
  return merge([
    ...playerSources(state.player),
    TITLES[state.player?.title ?? 0]?.bonus ?? {},
    ...(state.world && seasonOf(state.world) ? [seasonOf(state.world).bonus] : []),
    ...ilimBonuses(state),
    ...(state.player?.modifiers ?? []).map((modifier) => modifier.bonus),
  ]);
}

export { bonusOf } from './bonus.js';

/**
 * Tüm köylerin etkisini yeniler. Etki ve araştırmaların açtığı birimler köye kayda yazılmayan
 * alanlar olarak eklenir (`bonus`, `unlocks`).
 */
export function syncBonuses(state) {
  const bonus = stateBonus(state);
  const unlocks = unlockedUnits(state);
  // Kahramanın köyü fethedilip elden çıktıysa başkente döner.
  if (state.hero && !state.villages[state.hero.home]) {
    state.hero.home = (Object.values(state.villages).find((v) => v.capital) ?? Object.values(state.villages)[0]).id;
  }
  // Köyündeki kahraman o köyün üretimini ve savunmasını artırır.
  const hero = heroHomeBonus(state);
  const heroBonus = hero ? Object.freeze({ ...bonus, production: bonus.production * hero.production, defense: bonus.defense * hero.defense }) : null;
  for (const village of Object.values(state.villages)) {
    const value = heroBonus && village.id === hero.villageId ? heroBonus : bonus;
    Object.defineProperty(village, 'bonus', { value, enumerable: false, writable: true, configurable: true });
    Object.defineProperty(village, 'unlocks', { value: unlocks, enumerable: false, writable: true, configurable: true });
  }
}

// ---------- Akçe ----------

function log(state, at, amount, reason) {
  const player = state.player;
  player.akceLog ??= [];
  player.akceLog.unshift({ at, amount, reason });
  if (player.akceLog.length > PREMIUM.logMax) player.akceLog.length = PREMIUM.logMax;
}

/** Oyuncuya Akçe verir (keşif, fetih, görev…). */
export function grantAkce(state, amount, reason, at) {
  if (!state.player || amount <= 0) return;
  state.player.akce = (state.player.akce ?? 0) + amount;
  log(state, at, amount, reason);
}

function spend(state, amount, reason, at) {
  if ((state.player.akce ?? 0) < amount) return false;
  state.player.akce -= amount;
  log(state, at, -amount, reason);
  return true;
}

/** Akçe harcar (diplomasi, olaylar); yetmezse false. */
export const spendAkce = spend;

const notEnough = (cost, state) => ({ ok: false, code: 'akce', reason: `Bunun için ${cost} Akçe gerekir; hazinende ${Math.floor(state.player.akce ?? 0)} var` });

// ---------- Sınıf ----------

/** Oyunun başında sınıf seçimi (ücretsiz). İsteğe bağlı olarak bey ve köy adı da verilir. */
export function chooseClass(state, classId, { playerName, villageName } = {}, now) {
  if (!CLASSES[classId]) return { ok: false, code: 'class', reason: 'Geçerli bir sınıf seç' };
  if (state.player.class) return { ok: false, code: 'chosen', reason: 'Sınıfın zaten seçildi; Hazine sayfasından değiştirebilirsin' };
  state.player.class = classId;
  const name = playerName?.trim().slice(0, 24);
  if (name) state.player.name = name;
  const village = state.villages[state.activeVillageId];
  const vName = villageName?.trim().slice(0, 32);
  if (vName && village) village.name = vName;
  syncBonuses(state);
  return { ok: true, classId, at: now };
}

/** Sınıfı Akçe karşılığında değiştirir. */
export function changeClass(state, classId, now) {
  if (!CLASSES[classId]) return { ok: false, code: 'class', reason: 'Geçerli bir sınıf seç' };
  if (!state.player.class) return chooseClass(state, classId, {}, now);
  if (state.player.class === classId) return { ok: false, code: 'same', reason: 'Zaten bu sınıftasın' };
  const cost = PREMIUM.classChangeCost;
  if (!spend(state, cost, `Sınıf değişimi: ${CLASSES[classId].name}`, now)) return notEnough(cost, state);
  state.player.class = classId;
  syncBonuses(state);
  return { ok: true, classId, cost };
}

export { CLASS_IDS };

// ---------- Görevliler ----------

/** Görevlinin bitiş anı (ms); görevde değilse null. */
export function officerUntil(state, officerId, now) {
  const until = state.player.officers?.[officerId];
  return until && until > now ? until : null;
}

/** Görevliyi tutar ya da süresini uzatır. */
export function hireOfficer(state, officerId, now) {
  const officer = OFFICERS[officerId];
  if (!officer) return { ok: false, code: 'officer', reason: 'Böyle bir görevli yok' };
  if (!spend(state, officer.cost, `${officer.name} (${PREMIUM.officerDays} gün)`, now)) return notEnough(officer.cost, state);
  state.player.officers ??= {};
  const from = Math.max(now, state.player.officers[officerId] ?? 0);
  state.player.officers[officerId] = from + PREMIUM.officerDays * DAY;
  syncBonuses(state);
  return { ok: true, officerId, until: state.player.officers[officerId], cost: officer.cost };
}

/**
 * Süresi dolan görevli ayrılır. Motor bitiş anında çağırır; ayrılmadan önce tüm köylerin
 * üretimi o ana kadar eski oranla yürütülür.
 */
export function expireOfficer(state, officerId, at) {
  for (const village of Object.values(state.villages)) produce(village, state.world, at);
  delete state.player.officers[officerId];
  syncBonuses(state);
  return { type: 'officer-expired', officer: officerId, at };
}

// ---------- Anında bitirme ----------

/** Kalan gerçek süre (ms) için anında bitirme bedeli; dünya hızına göre oyun dakikası üzerinden. */
export function finishCost(remainingMs, world) {
  const gameMinutes = (Math.max(0, remainingMs) * world.speed) / MINUTE;
  return Math.max(PREMIUM.finishMinCost, Math.ceil(gameMinutes / PREMIUM.finishGameMinutesPerAkce));
}

/** Kuyruktaki ilk inşaatı anında bitirir; arkadaki işler aynı süre kadar öne kayar. */
export function finishBuilding(state, village, now) {
  const job = village.buildQueue[0];
  if (!job || job.endAt <= now) return { ok: false, code: 'none', reason: 'Bitirilecek inşaat yok' };
  const saved = job.endAt - now;
  const cost = finishCost(saved, state.world);
  if (!spend(state, cost, `Anında bitirme: inşaat`, now)) return notEnough(cost, state);
  for (const [index, next] of village.buildQueue.entries()) {
    if (index > 0) next.startAt -= saved;
    next.endAt -= saved;
  }
  job.startAt = Math.min(job.startAt, now);
  return { ok: true, cost, job };
}

/** Süren Demirci geliştirmesini anında bitirir. */
export function finishResearch(state, village, now) {
  const research = village.research;
  if (!research || research.endAt <= now) return { ok: false, code: 'none', reason: 'Bitirilecek geliştirme yok' };
  const cost = finishCost(research.endAt - now, state.world);
  if (!spend(state, cost, 'Anında bitirme: Demirci', now)) return notEnough(cost, state);
  research.endAt = now;
  return { ok: true, cost };
}

// ---------- Kaynak paketi ----------

/** Paketin köye ekleyeceği miktar (ambar kapasitesinin payı, ambara sığdığı kadar). */
export function resourcePackAmounts(village) {
  const cap = storageCap(village);
  const each = Math.floor(cap * PREMIUM.resourcePack.share);
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.max(0, Math.min(each, Math.floor(cap - village.resources[id])))]));
}

export function buyResourcePack(state, village, now) {
  const amounts = resourcePackAmounts(village);
  if (Object.values(amounts).every((n) => n <= 0)) return { ok: false, code: 'full', reason: 'Ambar zaten dolu' };
  const cost = PREMIUM.resourcePack.cost;
  if (!spend(state, cost, `Kaynak paketi: ${village.name}`, now)) return notEnough(cost, state);
  const stored = deposit(village, amounts);
  return { ok: true, cost, stored };
}
