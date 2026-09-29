import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { resolveBattle, weightedDefense, attackByType, distributeLoot } from '../js/systems/combat.js';
import { barbarianLive, barbarianGarrison } from '../js/systems/barbarians.js';
import { inspectAttack, sendAttack, luckFor, armyCarry } from '../js/systems/movements.js';
import { nearbyBarbarians, barbarianAt } from '../js/systems/world.js';
import { populationUsed, storageCap } from '../js/systems/economy.js';
import { wallBonus } from '../js/core/formulas.js';
import { COMBAT, BARBARIAN } from '../js/config/combat.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

function game({ units = {}, speed = 1 } = {}) {
  const state = createNewGame({ now: T0, difficulty: 'baris', seed: 42, speed });
  const village = state.villages[state.activeVillageId];
  Object.assign(village.units, units);
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  return { state, village, target };
}

test('savunma, saldıranın tür karışımına göre ağırlıklanır', () => {
  const defenders = { yaya: 10 }; // piyadeye 15, süvariye 40
  assert.equal(weightedDefense(defenders, attackByType({ baltaci: 1 })), 150);
  assert.equal(weightedDefense(defenders, attackByType({ akinci: 1 })), 400);
  const mixed = attackByType({ baltaci: 13, akinci: 4 }); // 520 piyade + 520 süvari
  assert.equal(weightedDefense(defenders, mixed), (150 + 400) / 2);
});

test('güçlü saldırı kazanır; kayıp oranı (savunma / saldırı) ^ 1.5', () => {
  const battle = resolveBattle({ attackers: { baltaci: 100 }, defenders: { yaya: 10 } });
  const defense = 150 + COMBAT.villageDefense;
  assert.ok(battle.attackerWins);
  assert.equal(battle.defense, defense);
  assert.equal(battle.attackerLosses.baltaci, Math.round(100 * (defense / 4000) ** 1.5));
  assert.deepEqual(battle.defenderLosses, { yaya: 10 });
});

test('zayıf saldırı kaybeder; tüm saldıranlar ölür, savunan oranla kayıp verir', () => {
  const battle = resolveBattle({ attackers: { yaya: 5 }, defenders: { kilicci: 10 } });
  const defense = 450 + COMBAT.villageDefense;
  assert.equal(battle.attackerWins, false);
  assert.deepEqual(battle.attackerLosses, { yaya: 5 });
  assert.equal(battle.defenderLosses.kilicci, Math.round(10 * (50 / defense) ** 1.5));
});

test('asker yokken bile köylüler direnir; sur yüzde ve sabit savunma katar', () => {
  assert.equal(resolveBattle({ attackers: { yaya: 1 }, defenders: {} }).attackerWins, false, '10 saldırı < 20 direniş');
  const wall = 5;
  const battle = resolveBattle({ attackers: { baltaci: 100 }, defenders: { yaya: 10 }, wallLevel: wall });
  const expected = 150 * (1 + wallBonus(wall)) + COMBAT.villageDefense + COMBAT.wallDefensePerLevel * wall;
  assert.ok(Math.abs(battle.defense - expected) < 1e-9);
});

test('şans saldırı gücünü ölçekler ve tohumdan deterministik gelir', () => {
  const lucky = resolveBattle({ attackers: { baltaci: 10 }, defenders: {}, luck: 0.25 });
  assert.equal(lucky.attack, 500);
  assert.equal(luckFor(42, 7), luckFor(42, 7));
  for (let id = 1; id < 200; id++) assert.ok(Math.abs(luckFor(42, id)) <= COMBAT.luckRange);
});

test('yağma kapasiteyi kaynaklara eşit dağıtır, biten kaynağın payı diğerlerine kalır', () => {
  assert.deepEqual(distributeLoot({ odun: 1000, kil: 1000, demir: 1000 }, 300), { odun: 100, kil: 100, demir: 100 });
  assert.deepEqual(distributeLoot({ odun: 20, kil: 1000, demir: 1000 }, 300), { odun: 20, kil: 140, demir: 140 });
  assert.deepEqual(distributeLoot({ odun: 10.7, kil: 0, demir: 5 }, 300), { odun: 10, kil: 0, demir: 5 });
  const loot = distributeLoot({ odun: 999, kil: 999, demir: 999 }, 100);
  assert.equal(loot.odun + loot.kil + loot.demir, 100);
});

test('dokunulmamış barbar köyü tam garnizonla ve biriken kaynakla gelir; ambarı aşmaz', () => {
  const { state, target } = game();
  const live = barbarianLive(state, target);
  assert.deepEqual(live.units, barbarianGarrison(target.growth));
  assert.equal(live.resources.odun, Math.min(live.cap, BARBARIAN.startResources));
  state.world.clock.time = 100 * DAY;
  const later = barbarianAt(state, target.x, target.y);
  assert.equal(barbarianLive(state, later).resources.odun, barbarianLive(state, later).cap);
});

test('saldırı kontrolleri: boş ordu, eksik asker, hedef yok; yalnız gözcü casusluğa gider', () => {
  const { state, village, target } = game({ units: { baltaci: 5, gozcu: 2 } });
  const inspect = (units, x = target.x, y = target.y) => inspectAttack(state, village, x, y, units, T0);
  assert.equal(inspect({}).code, 'empty');
  assert.equal(inspect({ baltaci: 6 }).code, 'units');
  assert.equal(inspect({ baltaci: 1.5 }).code, 'count');
  assert.equal(inspect({ baltaci: 1 }, village.x, village.y).code, 'self');
  assert.equal(inspect({ baltaci: 1 }, village.x + 1, village.y).code, 'target');
  assert.equal(inspect({ gozcu: 2 }).mission, 'casus');
  assert.equal(inspect({ baltaci: 5, gozcu: 1 }).mission, 'saldiri');
  assert.ok(inspect({ baltaci: 5, gozcu: 1 }).ok);
});

test('saldırı gönderilince askerler köyden çıkar ama nüfusu kullanmaya devam eder', () => {
  const { state, village, target } = game({ units: { baltaci: 20 } });
  const popBefore = populationUsed(village);
  const result = sendAttack(state, village, target.x, target.y, { baltaci: 20 }, T0);
  assert.ok(result.ok);
  assert.equal(village.units.baltaci, 0);
  assert.equal(village.movements.length, 1);
  assert.equal(populationUsed(village), popBefore);
  assert.equal(result.seconds, Math.round(target.distance * 18 * 60));
});

test('tam akış: varışta savaş ve rapor, dönüşte askerler ve ganimet köye eklenir', () => {
  const { state, village, target } = game({ units: { baltaci: 40 } });
  village.resources = { odun: 0, kil: 0, demir: 0 };
  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 40 }, T0);

  const events = advance(state, sent.arriveAt);
  assert.equal(events.length, 1);
  const [result] = events;
  assert.equal(result.type, 'attack-result');
  assert.ok(result.attackerWins, '40 baltacı küçük bir barbar köyünü yenmeli');
  const report = state.reports[0];
  assert.equal(report.id, result.reportId);
  assert.equal(report.read, false);
  assert.deepEqual(report.defenders, barbarianGarrison(target.growth));

  const survivors = 40 - report.attackerLosses.baltaci;
  const lootTotal = report.loot.odun + report.loot.kil + report.loot.demir;
  assert.ok(lootTotal > 0 && lootTotal <= armyCarry({ baltaci: survivors }));
  const movement = village.movements[0];
  assert.equal(movement.type, 'donus');
  assert.equal(movement.arriveAt, sent.arriveAt + sent.seconds * 1000);

  const back = advance(state, movement.arriveAt);
  assert.equal(back[0].type, 'return');
  assert.equal(village.units.baltaci, survivors);
  assert.equal(village.movements.length, 0);
  assert.ok(village.resources.odun >= report.loot.odun, 'ganimet ambara eklendi');

  // Yenilen barbar köyünün garnizonu silindi, zamanla toparlanır ama tam garnizonu aşmaz.
  const after = barbarianAt(state, target.x, target.y);
  assert.deepEqual(barbarianLive(state, after).units, Object.fromEntries(Object.keys(report.defenders).map((id) => [id, 0])));
  state.world.clock.time += 10 * DAY;
  assert.deepEqual(barbarianLive(state, barbarianAt(state, target.x, target.y)).units, barbarianGarrison(barbarianAt(state, target.x, target.y).growth));
});

test('kaybedilen saldırıda kimse dönmez; ganimet ambara sığdığı kadar eklenir', () => {
  const { state, village, target } = game({ units: { yaya: 1 } });
  const sent = sendAttack(state, village, target.x, target.y, { yaya: 1 }, T0);
  const [result] = advance(state, sent.arriveAt);
  assert.equal(result.attackerWins, false);
  assert.equal(village.movements.length, 0);
  assert.equal(village.units.yaya, 0);

  const full = game({ units: { akinci: 50 } });
  full.village.resources = { odun: 990, kil: 990, demir: 990 };
  const trip = sendAttack(full.state, full.village, full.target.x, full.target.y, { akinci: 50 }, T0);
  advance(full.state, trip.arriveAt + trip.seconds * 1000);
  assert.equal(full.village.resources.odun, storageCap(full.village));
});

test('raporlar sınırlıdır; en yeni başta durur', () => {
  const { state, village, target } = game({ units: { yaya: COMBAT.maxReports + 5 } });
  for (let i = 0; i < COMBAT.maxReports + 5; i++) sendAttack(state, village, target.x, target.y, { yaya: 1 }, T0 + i);
  advance(state, T0 + 10 * DAY);
  assert.equal(state.reports.length, COMBAT.maxReports);
  assert.ok(state.reports[0].at >= state.reports.at(-1).at);
});

test('3. sürüm kayda raporlar ve barbar durumu eklenir', () => {
  const { state } = game();
  const v3 = structuredClone(state);
  v3.version = 3;
  delete v3.reports;
  delete v3.barbarians;
  delete v3.nextId;
  delete v3.villages.v1.movements;
  const migrated = migrate(v3);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.deepEqual(migrated.reports, []);
  assert.deepEqual(migrated.barbarians, {});
  assert.equal(migrated.nextId, 1);
  assert.deepEqual(migrated.villages.v1.movements, []);
});
