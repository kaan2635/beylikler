import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import {
  measure,
  activeQuests,
  claimQuest,
  achievementStatus,
  checkAchievements,
  dailyStatus,
  claimDaily,
  victoryProgress,
  checkVictory,
} from '../js/systems/quests.js';
import { sendAttack } from '../js/systems/movements.js';
import { nearbyBarbarians, lordsOf } from '../js/systems/world.js';
import { QUESTS, QUEST_WINDOW, ACHIEVEMENTS, DAILY, VICTORY } from '../js/config/quests.js';
import { storageCap } from '../js/systems/economy.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1, 12);
const DAY = 86_400_000;

function game() {
  const state = createNewGame({ now: T0, seed: 11, difficulty: 'baris' });
  return { state, village: state.villages.v1 };
}

test('görevler sırayla açılır; tamamlanınca ödül alınır', () => {
  const { state, village } = game();
  let active = activeQuests(state);
  assert.equal(active.length, QUEST_WINDOW);
  assert.equal(active[0].quest.id, QUESTS[0].id);
  assert.equal(active[0].done, false);
  assert.equal(claimQuest(state, village, QUESTS[0].id, T0).ok, false);
  assert.equal(claimQuest(state, village, QUESTS[5].id, T0).ok, false, 'sırası gelmeyen görev alınamaz');

  village.buildings.oduncu = 2;
  village.buildings.ambar = 5;
  const before = village.resources.odun;
  const result = claimQuest(state, village, 'oduncu2', T0);
  assert.ok(result.ok);
  assert.equal(village.resources.odun, before + QUESTS[0].reward.odun);
  assert.equal(claimQuest(state, village, 'oduncu2', T0).ok, false, 'iki kez alınamaz');
  active = activeQuests(state);
  assert.equal(active[0].quest.id, QUESTS[1].id);
  assert.equal(active.at(-1).quest.id, QUESTS[QUEST_WINDOW].id);
});

test('ölçütler: bina, birim, sayaç, puan, köy', () => {
  const { state, village } = game();
  village.buildings.kilocagi = 3;
  village.buildings.demirmadeni = 1;
  assert.equal(measure(state, { kind: 'buildings', ids: ['kilocagi', 'demirmadeni'] }), 1);
  village.units.yaya = 4;
  village.stationed = { v9: { yaya: 3 } };
  assert.equal(measure(state, { kind: 'units', id: 'yaya' }), 7);
  assert.ok(measure(state, { kind: 'points' }) > 30);
  assert.equal(measure(state, { kind: 'villages' }), 1);

  // Kazanılan saldırı sayacı artar.
  village.units.baltaci = 200;
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 200 }, T0);
  advance(state, sent.arriveAt);
  assert.equal(state.stats.attacks, 1);
  assert.equal(measure(state, { kind: 'stat', id: 'attacksWon' }), state.reports[0].attackerWins ? 1 : 0);
});

test('başarım kademeleri aşıldıkça Akçe verilir ve olay üretilir', () => {
  const { state, village } = game();
  const akce = state.player.akce;
  assert.deepEqual(checkAchievements(state, T0), []);
  state.stats.loot = 150_000;
  const events = checkAchievements(state, T0);
  const loot = ACHIEVEMENTS.find((a) => a.id === 'yagmaci');
  assert.deepEqual(events.filter((e) => e.id === 'yagmaci').map((e) => e.tier), [1, 2]);
  assert.equal(state.player.akce, akce + loot.akce[0] + loot.akce[1]);
  assert.deepEqual(checkAchievements(state, T0), [], 'aynı kademe tekrar verilmez');
  const status = achievementStatus(state).find((s) => s.achievement.id === 'yagmaci');
  assert.equal(status.tier, 2);
  assert.equal(status.next, loot.tiers[2]);
  village.buildings.konak = 1;
});

test('günlük hazine günde bir kez alınır', () => {
  const { state, village } = game();
  village.resources = { odun: 0, kil: 0, demir: 0 };
  const status = dailyStatus(state, village, T0);
  assert.ok(status.available);
  const result = claimDaily(state, village, T0);
  assert.ok(result.ok);
  assert.equal(village.resources.odun, Math.floor(storageCap(village) * DAILY.resources));
  assert.equal(claimDaily(state, village, T0 + 1000).ok, false);
  assert.ok(claimDaily(state, village, T0 + DAY).ok);
});

test('bütün beyler düşünce Sultanlık ilan edilir (bir kez)', () => {
  const { state } = game();
  advance(state, T0);
  assert.equal(victoryProgress(state).total, lordsOf(state.world.seed).length);
  assert.deepEqual(checkVictory(state, T0), []);
  for (const lord of lordsOf(state.world.seed)) state.ai.lords[lord.id].defeated = true;
  const akce = state.player.akce;
  const events = checkVictory(state, T0);
  assert.equal(events[0].type, 'victory');
  assert.equal(state.player.akce, akce + VICTORY.akce);
  assert.ok(victoryProgress(state).won);
  assert.deepEqual(checkVictory(state, T0), []);
});

test('8. sürüm kayda görev ve başarım alanları eklenir', () => {
  const { state } = game();
  const old = structuredClone(state);
  old.version = 8;
  delete old.quests;
  delete old.achievements;
  delete old.victory;
  old.stats = { kills: 5, loot: 10 };
  const migrated = migrate(old);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.deepEqual(migrated.quests, { claimed: [] });
  assert.equal(migrated.stats.kills, 5);
  assert.equal(migrated.stats.expeditions, 0);
  assert.equal(migrated.victory, null);
});
