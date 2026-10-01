import { QUESTS, QUEST_WINDOW, ACHIEVEMENTS, DAILY, VICTORY } from '../config/quests.js';
import { RESOURCE_IDS } from '../config/resources.js';
import { villagePoints, lordsOf } from './world.js';
import { grantAkce } from './premium.js';
import { deposit, storageCap } from './economy.js';

/**
 * Görevler, başarımlar, günlük hazine ve oyun sonu (Sultanlık).
 *
 * Kayıtta: state.quests = { claimed: [id…] }, state.achievements = { id: ulaşılan kademe },
 * state.player.dailyDay (son alınan günlük hazinenin günü), state.victory = { at } | null.
 * İlerleme kayda ayrıca yazılmaz; her seferinde oyunun durumundan ölçülür (`measure`).
 */

const DAY = 86_400_000;

function ownedUnits(village, unitId) {
  let n = village.units[unitId] ?? 0;
  for (const m of village.movements) n += m.units?.[unitId] ?? 0;
  for (const units of Object.values(village.stationed ?? {})) n += units[unitId] ?? 0;
  return n;
}

/** Bir ölçütün şu anki değeri. */
export function measure(state, goal) {
  const villages = Object.values(state.villages);
  const best = (id) => Math.max(0, ...villages.map((v) => v.buildings[id] ?? 0));
  switch (goal.kind) {
    case 'building':
      return best(goal.id);
    case 'buildings':
      return Math.min(...goal.ids.map(best));
    case 'units':
      return villages.reduce((sum, v) => sum + ownedUnits(v, goal.id), 0);
    case 'stat':
      return state.stats?.[goal.id] ?? 0;
    case 'tech':
      return villages.reduce((sum, v) => sum + Object.values(v.tech).reduce((a, b) => a + b, 0), 0);
    case 'points':
      return villages.reduce((sum, v) => sum + villagePoints(v.buildings), 0);
    case 'villages':
      return villages.length;
    case 'lords':
      return Object.values(state.ai?.lords ?? {}).filter((entry) => entry.defeated).length;
    case 'ilim':
      return state.player?.ilim?.done?.length ?? 0;
    case 'diplomacy':
      return (state.stats?.gifts ?? 0) + (state.stats?.treaties ?? 0);
    default:
      return 0;
  }
}

// ---------- Görevler ----------

/** Sıradaki görevler (en fazla QUEST_WINDOW): { quest, value, done }. */
export function activeQuests(state) {
  const claimed = new Set(state.quests?.claimed ?? []);
  return QUESTS.filter((q) => !claimed.has(q.id))
    .slice(0, QUEST_WINDOW)
    .map((quest) => {
      const value = measure(state, quest.goal);
      return { quest, value: Math.min(value, quest.goal.target), done: value >= quest.goal.target };
    });
}

/** Tamamlanan görev sayısı ve toplam. */
export function questProgress(state) {
  return { claimed: state.quests?.claimed?.length ?? 0, total: QUESTS.length };
}

/** Tamamlanmış görevin ödülünü yönetilen köye verir. */
export function claimQuest(state, village, questId, now) {
  const entry = activeQuests(state).find((q) => q.quest.id === questId);
  if (!entry) return { ok: false, reason: 'Bu görev şu an açık değil' };
  if (!entry.done) return { ok: false, reason: 'Görev henüz tamamlanmadı' };
  const stored = deposit(village, entry.quest.reward);
  if (entry.quest.akce) grantAkce(state, entry.quest.akce, `Görev: ${entry.quest.title}`, now);
  state.quests.claimed.push(questId);
  return { ok: true, quest: entry.quest, stored, akce: entry.quest.akce ?? 0 };
}

// ---------- Başarımlar ----------

/** Başarımın durumu: { achievement, value, tier (0..3), next } */
export function achievementStatus(state) {
  return ACHIEVEMENTS.map((achievement) => {
    const value = measure(state, achievement.goal);
    const tier = state.achievements?.[achievement.id] ?? 0;
    return { achievement, value, tier, next: achievement.tiers[tier] ?? null };
  });
}

/** Yeni kademeleri açar, Akçe verir ve olaylarını döndürür. Motor her ilerlemenin sonunda çağırır. */
export function checkAchievements(state, at) {
  const events = [];
  state.achievements ??= {};
  for (const achievement of ACHIEVEMENTS) {
    const value = measure(state, achievement.goal);
    let tier = state.achievements[achievement.id] ?? 0;
    while (tier < achievement.tiers.length && value >= achievement.tiers[tier]) {
      grantAkce(state, achievement.akce[tier], `Başarım: ${achievement.title} ${tier + 1}. kademe`, at);
      tier += 1;
      events.push({ type: 'achievement', id: achievement.id, title: achievement.title, tier, akce: achievement.akce[tier - 1], at });
    }
    state.achievements[achievement.id] = tier;
  }
  return events;
}

// ---------- Günlük hazine ----------

export function dayIndex(now) {
  return Math.floor(now / DAY);
}

/** Bugünün hazinesi alınabilir mi; alınabilecek miktarlar. */
export function dailyStatus(state, village, now) {
  const available = state.player.dailyDay !== dayIndex(now);
  const cap = storageCap(village);
  const resources = Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.floor(cap * DAILY.resources)]));
  return { available, akce: DAILY.akce, resources, nextAt: (dayIndex(now) + 1) * DAY };
}

export function claimDaily(state, village, now) {
  const status = dailyStatus(state, village, now);
  if (!status.available) return { ok: false, reason: 'Bugünün hazinesini aldın; yarın yeniden gel', nextAt: status.nextAt };
  state.player.dailyDay = dayIndex(now);
  const stored = deposit(village, status.resources);
  grantAkce(state, status.akce, 'Günlük hazine', now);
  return { ok: true, stored, akce: status.akce };
}

// ---------- Oyun sonu ----------

/** Fethedilmesi gereken bey sayısı ve fethedilenler. */
export function victoryProgress(state) {
  const total = lordsOf(state.world.seed).length;
  return { done: measure(state, { kind: 'lords' }), total, won: !!state.victory };
}

/** Bütün beyler düştüyse Sultanlık ilan edilir (bir kez). */
export function checkVictory(state, at) {
  if (state.victory) return [];
  const { done, total } = victoryProgress(state);
  if (done < total) return [];
  state.victory = { at };
  grantAkce(state, VICTORY.akce, 'Sultanlık ilan edildi', at);
  return [{ type: 'victory', at }];
}
