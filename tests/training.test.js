import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { startUpgrade } from '../js/systems/construction.js';
import {
  inspectTraining,
  startTraining,
  cancelLastTraining,
  maxTrainable,
} from '../js/systems/training.js';
import { populationUsed, populationCap } from '../js/systems/economy.js';
import { trainDuration } from '../js/core/formulas.js';
import { UNITS, UNIT_IDS, TRAINING_BUILDINGS } from '../js/config/units.js';
import { BUILDINGS } from '../js/config/buildings.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);

/** Kışlası olan, bol kaynaklı bir köy. */
function armyGame({ kisla = 1, resources = 900 } = {}) {
  const state = createNewGame({ now: T0, difficulty: 'baris', seed: 1 });
  const village = state.villages[state.activeVillageId];
  village.buildings.konak = 3;
  village.buildings.kisla = kisla;
  village.resources = { odun: resources, kil: resources, demir: resources };
  return { state, village };
}

test('her birimin eğitim binası var ve maliyeti 1. seviye ambara sığar', () => {
  for (const id of UNIT_IDS) {
    const unit = UNITS[id];
    assert.ok(BUILDINGS[unit.building], `${id}: bilinmeyen bina ${unit.building}`);
    assert.ok(TRAINING_BUILDINGS.includes(unit.building));
    for (const amount of Object.values(unit.cost)) assert.ok(amount <= 1000, `${id} maliyeti`);
    for (const building of Object.keys(unit.requires)) assert.ok(BUILDINGS[building], `${id} gereksinimi`);
  }
});

test('Kışla yokken Yaya eğitilemez', () => {
  const { state, village } = armyGame({ kisla: 0 });
  assert.equal(inspectTraining(village, state.world, 'yaya', 1, T0).code, 'requires');
  assert.equal(maxTrainable(village, 'yaya'), 0);
});

test('eğitim maliyeti ve nüfusu partinin tamamı için hemen ayrılır', () => {
  const { state, village } = armyGame();
  const popBefore = populationUsed(village);
  const result = startTraining(village, state.world, 'yaya', 5, T0);
  assert.ok(result.ok);
  assert.deepEqual(village.resources, { odun: 900 - 250, kil: 900 - 150, demir: 900 - 50 });
  assert.equal(populationUsed(village), popBefore + 5);
  assert.equal(village.units.yaya, 0);
});

test('askerler birer birer yetişir, parti bitince tek olay üretilir', () => {
  const { state, village } = armyGame();
  const { unitSeconds } = startTraining(village, state.world, 'yaya', 3, T0);
  const unitMs = unitSeconds * 1000;

  assert.deepEqual(advance(state, T0 + unitMs - 1), []);
  assert.equal(village.units.yaya, 0);

  assert.deepEqual(advance(state, T0 + unitMs), []);
  assert.equal(village.units.yaya, 1);

  const events = advance(state, T0 + 3 * unitMs);
  assert.equal(village.units.yaya, 3);
  assert.deepEqual(events.map((e) => [e.type, e.unit, e.count]), [['train-complete', 'yaya', 3]]);
  assert.equal(village.trainQueues.kisla.length, 0);
});

test('partiler sırayla eğitilir; inşaat ve eğitim olayları zaman sırasıyla işlenir', () => {
  const { state, village } = armyGame({ kisla: 2, resources: 1000 });
  const a = startTraining(village, state.world, 'yaya', 2, T0);
  const b = startTraining(village, state.world, 'kilicci', 1, T0);
  const build = startUpgrade(village, state.world, 'oduncu', T0);
  assert.ok(a.ok && b.ok && build.ok);

  const events = advance(state, T0 + (a.duration + b.duration + build.duration) * 1000);
  const times = events.map((e) => e.at);
  assert.deepEqual(times, [...times].sort((x, y) => x - y), 'olaylar zaman sırasında');
  assert.equal(village.units.yaya, 2);
  assert.equal(village.units.kilicci, 1);
  assert.equal(village.buildings.oduncu, 2);
  assert.equal(events.find((e) => e.unit === 'kilicci').at, T0 + (a.duration + b.duration) * 1000);
});

test('kuyruktaki son parti iptal edilince yalnızca yetişmemiş askerler iade edilir', () => {
  const { state, village } = armyGame();
  const { unitSeconds } = startTraining(village, state.world, 'yaya', 4, T0);
  advance(state, T0 + unitSeconds * 1000); // 1 asker yetişti
  const before = { ...village.resources };

  const batch = cancelLastTraining(village, 'kisla');
  assert.equal(batch.remaining, 3);
  assert.equal(village.units.yaya, 1);
  assert.equal(Math.round(village.resources.odun - before.odun), 3 * UNITS.yaya.cost.odun);
  assert.equal(village.trainQueues.kisla.length, 0);
  assert.equal(cancelLastTraining(village, 'kisla'), null);
});

test('en fazla eğitilebilecek sayı kaynak ve boş nüfusla sınırlıdır', () => {
  const { village } = armyGame({ resources: 900 });
  assert.equal(maxTrainable(village, 'yaya'), Math.min(
    Math.floor(900 / UNITS.yaya.cost.odun),
    populationCap(village) - populationUsed(village),
  ));
  village.resources = { odun: 1e6, kil: 1e6, demir: 1e6 };
  assert.equal(maxTrainable(village, 'yaya'), populationCap(village) - populationUsed(village));
});

test('askerler nüfusu doldurunca nüfus isteyen yükseltmeler de kilitlenir', () => {
  const { state, village } = armyGame();
  village.units.yaya = populationCap(village) - populationUsed(village);
  assert.equal(inspectTraining(village, state.world, 'yaya', 1, T0).code, 'population');
  assert.equal(startUpgrade(village, state.world, 'oduncu', T0).code, 'population');
  assert.ok(startUpgrade(village, state.world, 'ciftlik', T0).ok);
});

test('geçersiz sayı ve dolu kuyruk reddedilir', () => {
  const { state, village } = armyGame({ resources: 1000 });
  for (const bad of [0, -1, 1.5, NaN, GAME.maxTrainBatch + 1]) {
    assert.equal(inspectTraining(village, state.world, 'yaya', bad, T0).code, 'count', String(bad));
  }
  for (let i = 0; i < GAME.maxTrainQueue; i++) assert.ok(startTraining(village, state.world, 'yaya', 1, T0).ok);
  assert.equal(inspectTraining(village, state.world, 'yaya', 1, T0).code, 'queue');
});

test('bina seviyesi eğitimi hızlandırır', () => {
  assert.ok(trainDuration(UNITS.yaya, 10) < trainDuration(UNITS.yaya, 1));
  assert.equal(trainDuration(UNITS.yaya, 0, 1), UNITS.yaya.trainTime);
});

test('1. sürüm kayıt, asker alanlarıyla 2. sürüme taşınır', () => {
  const v1 = {
    version: 1,
    createdAt: T0,
    world: { speed: 1, seed: 1 },
    player: { name: 'Bey' },
    activeVillageId: 'v1',
    villages: {
      v1: {
        id: 'v1', name: 'Eski', x: 500, y: 500,
        resources: { odun: 1, kil: 2, demir: 3 },
        buildings: { konak: 4, oduncu: 2, kilocagi: 1, demirmadeni: 1, ambar: 1, ciftlik: 1, gizlidepo: 0, kisla: 1, sur: 0 },
        buildQueue: [],
        lastUpdate: T0,
      },
    },
  };
  const state = migrate(v1);
  const village = state.villages.v1;
  assert.equal(state.version, GAME.saveVersion);
  assert.equal(village.buildings.konak, 4);
  assert.equal(village.buildings.ahir, 0);
  assert.equal(village.units.yaya, 0);
  assert.deepEqual(village.trainQueues, { kisla: [], ahir: [], atolye: [] });
});
