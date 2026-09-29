import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import { siegeLevels } from '../js/systems/combat.js';
import { sendAttack, inspectAttack, recallAttack } from '../js/systems/movements.js';
import { barbarianAt, nearbyBarbarians } from '../js/systems/world.js';
import { barbarianLive, barbarianGarrison } from '../js/systems/barbarians.js';
import { COMBAT, BARBARIAN } from '../js/config/combat.js';

const T0 = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

/** Belirli gelişmişlikte bir barbar köyü bulana dek dünya saatini ilerletir. */
function setup(units, { minGrowth = 0, days = 0 } = {}) {
  const state = createNewGame({ now: T0, difficulty: 'baris', seed: 7 });
  const village = state.villages[state.activeVillageId];
  Object.assign(village.units, units);
  state.world.clock.time = days * DAY;
  const target = nearbyBarbarians(state, village.x, village.y, 15).find((b) => b.growth >= minGrowth);
  return { state, village, target };
}

/** Birliği gönderir ve varışa kadar ilerletir; varış olayını döndürür. */
function arrive(state, village, target, units, options) {
  const sent = sendAttack(state, village, target.x, target.y, units, T0, options);
  assert.ok(sent.ok, sent.reason);
  const [event] = advance(state, sent.arriveAt);
  return { sent, event, report: state.reports[0] };
}

test('kuşatma: L seviyeli binayı bir seviye indirmek L × perLevel araç ister', () => {
  assert.equal(siegeLevels(0, 5, 2), 0);
  assert.equal(siegeLevels(9, 5, 2), 0);
  assert.equal(siegeLevels(10, 5, 2), 1);
  assert.equal(siegeLevels(10 + 8 + 6 + 4 + 2, 5, 2), 5);
  assert.equal(siegeLevels(1000, 5, 3, 1), 4, 'en düşük seviyenin altına inmez');
});

test('barbar köylerinde gelişmişliğe göre gözcü de bulunur', () => {
  assert.equal(barbarianGarrison(3).gozcu, 0);
  assert.equal(barbarianGarrison(20).gozcu, Math.floor(20 * BARBARIAN.garrisonPerGrowth.gozcu));
});

test('başarılı casusluk askerleri, kaynakları ve binaları gösterir; savaş olmaz', () => {
  const { state, village, target } = setup({ gozcu: 10 }, { minGrowth: 8, days: 30 });
  const before = barbarianLive(state, target);
  const { sent, event, report } = arrive(state, village, target, { gozcu: 10 });
  assert.equal(sent.mission, 'casus');
  assert.equal(event.type, 'spy-result');
  assert.equal(event.success, true);
  assert.equal(report.type, 'casus');
  const guards = before.units.gozcu;
  assert.ok(guards > 0, 'bu köyde nöbetçi gözcü olmalı');
  assert.equal(report.attackerLosses.gozcu, Math.round(10 * (guards / 10) ** COMBAT.lossExponent));
  assert.deepEqual(report.intel.units, before.units);
  assert.deepEqual(report.intel.buildings, target.buildings);
  assert.equal(state.barbarians[target.id], undefined, 'köyün durumu değişmedi');
  assert.equal(village.movements[0].type, 'donus');
  assert.equal(village.movements[0].loot, null);
});

test('savunan gözcü sayısına yetişemeyen casuslar yakalanır, bilgi gelmez', () => {
  const { state, village, target } = setup({ gozcu: 1 }, { minGrowth: 8, days: 30 });
  const { event, report } = arrive(state, village, target, { gozcu: 1 });
  assert.equal(event.success, false);
  assert.equal(report.intel, null);
  assert.equal(report.attackerLosses.gozcu, 1);
  assert.equal(village.movements.length, 0);
});

test('casus birliği de geri çağrılabilir', () => {
  const { state, village, target } = setup({ gozcu: 3 });
  const sent = sendAttack(state, village, target.x, target.y, { gozcu: 3 }, T0);
  assert.ok(recallAttack(village, sent.movement.id, T0 + 1000).ok);
  advance(state, T0 + 10 * 60_000);
  assert.equal(village.units.gozcu, 3);
  assert.equal(state.reports.length, 0);
});

test('zaferden sonra koçbaşı suru, mancınık seçilen binayı yıkar; köy zamanla onarır', () => {
  const { state, village, target } = setup({ baltaci: 400, kocbasi: 60, mancinik: 60 }, { minGrowth: 12, days: 40 });
  const wall = target.buildings.sur;
  const storage = target.buildings.ambar;
  assert.ok(wall >= 3 && storage >= 5, `yeterince gelişmiş köy lazım (sur ${wall}, ambar ${storage})`);

  const { report, event } = arrive(state, village, target, { baltaci: 400, kocbasi: 60, mancinik: 60 }, { catapultTarget: 'ambar' });
  assert.ok(report.attackerWins);
  const rams = 60 - report.attackerLosses.kocbasi;
  const cats = 60 - report.attackerLosses.mancinik;
  const wallTo = wall - siegeLevels(rams, wall, COMBAT.ramsPerLevel);
  const storageTo = storage - siegeLevels(cats, storage, COMBAT.catapultsPerLevel, 1);
  assert.deepEqual(report.siege, { wall: { from: wall, to: wallTo }, catapult: { building: 'ambar', from: storage, to: storageTo } });
  assert.deepEqual(event.siege, report.siege);
  assert.equal(report.catapultTarget, 'ambar');
  assert.ok(wallTo < wall && storageTo < storage);

  const damaged = barbarianAt(state, target.x, target.y);
  assert.equal(damaged.buildings.sur, wallTo);
  assert.equal(damaged.buildings.ambar, storageTo);
  assert.ok(damaged.points < target.points, 'yıkım puanı düşürür');

  // Her oyun günü bir seviye onarılır.
  state.world.clock.time += DAY;
  assert.equal(barbarianAt(state, target.x, target.y).buildings.sur, Math.min(wall, wallTo + 1));
  state.world.clock.time += 30 * DAY;
  const repaired = barbarianAt(state, target.x, target.y);
  assert.ok(repaired.buildings.sur >= wall && repaired.buildings.ambar >= storage);
});

test('kaybedilen saldırıda kuşatma araçları bir şey yıkamaz', () => {
  const { state, village, target } = setup({ kocbasi: 5 }, { minGrowth: 12, days: 40 });
  const { report } = arrive(state, village, target, { kocbasi: 5 });
  assert.equal(report.attackerWins, false);
  assert.deepEqual(report.siege, {});
  assert.equal(barbarianAt(state, target.x, target.y).buildings.sur, target.buildings.sur);
});

test('mancınık hedefi doğrulanır ve tekrar saldırıda korunur', () => {
  const { state, village, target } = setup({ baltaci: 100, mancinik: 10 });
  assert.equal(inspectAttack(state, village, target.x, target.y, { mancinik: 1 }, T0, { catapultTarget: 'sur' }).code, 'catapult');
  assert.equal(inspectAttack(state, village, target.x, target.y, { mancinik: 1 }, T0).catapultTarget, 'konak');
  assert.equal(inspectAttack(state, village, target.x, target.y, { baltaci: 1 }, T0).catapultTarget, null);

  const store = { load: () => structuredClone(state), save() {}, clear() {} };
  const game = new Game(store);
  game.load(T0);
  const first = game.sendAttack(target.x, target.y, { baltaci: 50, mancinik: 5 }, T0, { catapultTarget: 'gizlidepo' });
  game.tick(first.arriveAt + first.seconds * 1000);
  const again = game.repeatAttack(game.state.reports[0].id, first.arriveAt + first.seconds * 1000 + 1);
  assert.ok(again.ok, again.reason);
  assert.equal(again.movement.catapultTarget, 'gizlidepo');
});
