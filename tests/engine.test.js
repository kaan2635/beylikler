import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { encodeSave, decodeSave } from '../js/core/save-codec.js';
import { startUpgrade, cancelLastUpgrade, inspectUpgrade } from '../js/systems/construction.js';
import { storageCap, populationUsed } from '../js/systems/economy.js';
import { upgradeCost, productionPerHour } from '../js/core/formulas.js';
import { BUILDINGS } from '../js/config/buildings.js';
import { GAME } from '../js/config/game.js';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 0, 1);

function newGame(speed = 1) {
  const state = createNewGame({ now: T0, speed, seed: 1 });
  return { state, village: state.villages[state.activeVillageId] };
}

test('bir saatte 1. seviye kaynak binaları 30 birim üretir', () => {
  const { state, village } = newGame();
  advance(state, T0 + HOUR);
  assert.equal(Math.round(village.resources.odun), 530);
  assert.equal(Math.round(village.resources.kil), 530);
  assert.equal(Math.round(village.resources.demir), 530);
});

test('dünya hızı üretimi ölçekler', () => {
  const { state, village } = newGame(10);
  advance(state, T0 + HOUR / 10);
  assert.equal(Math.round(village.resources.odun), 530);
});

test('üretim ambar kapasitesinde durur', () => {
  const { state, village } = newGame();
  advance(state, T0 + 1000 * HOUR);
  assert.equal(village.resources.odun, storageCap(village));
});

test('saat geri alınırsa hiçbir şey değişmez', () => {
  const { state, village } = newGame();
  const before = structuredClone(village);
  assert.deepEqual(advance(state, T0 - HOUR), []);
  assert.deepEqual(village, before);
});

test('yükseltme kaynağı düşer, süre dolunca tamamlanır ve olay üretir', () => {
  const { state, village } = newGame();
  const result = startUpgrade(village, state.world, 'oduncu', T0);
  assert.ok(result.ok);
  assert.equal(village.resources.odun, 500 - upgradeCost(BUILDINGS.oduncu, 2).odun);

  const end = T0 + result.duration * 1000;
  assert.deepEqual(advance(state, end - 1), []);
  assert.equal(village.buildings.oduncu, 1);

  const events = advance(state, end);
  assert.equal(events.length, 1);
  assert.equal(events[0].building, 'oduncu');
  assert.equal(village.buildings.oduncu, 2);
});

test('çevrimdışı ilerleme: kuyruk sırayla işlenir, üretim her yükseltmede hızlanır', () => {
  const { state, village } = newGame();
  const a = startUpgrade(village, state.world, 'oduncu', T0);
  const b = startUpgrade(village, state.world, 'oduncu', T0);
  assert.equal(b.level, 3);
  const woodAfterSpending = village.resources.odun;

  const events = advance(state, T0 + (a.duration + b.duration) * 1000 + HOUR);
  assert.deepEqual(events.map((e) => e.level), [2, 3]);

  const expected =
    woodAfterSpending +
    productionPerHour(1) * (a.duration / 3600) +
    productionPerHour(2) * (b.duration / 3600) +
    productionPerHour(3) * 1;
  assert.ok(Math.abs(village.resources.odun - expected) < 1e-6, `${village.resources.odun} ≠ ${expected}`);
});

test('kuyruk dolunca yeni yükseltme reddedilir', () => {
  const { state, village } = newGame();
  for (let i = 0; i < GAME.maxBuildQueue; i++) assert.ok(startUpgrade(village, state.world, 'ambar', T0).ok);
  assert.equal(startUpgrade(village, state.world, 'ambar', T0).code, 'queue');
});

test('gereksinimler: Kışla için Konak 3 gerekir', () => {
  const { state, village } = newGame();
  assert.equal(inspectUpgrade(village, state.world, 'kisla', T0).code, 'requires');
  village.buildings.konak = 3;
  assert.ok(inspectUpgrade(village, state.world, 'kisla', T0).ok);
});

test('nüfus dolunca nüfus kullanan binalar kilitlenir, çiftlik açık kalır', () => {
  const { state, village } = newGame();
  village.buildings.demirmadeni = 25;
  assert.ok(populationUsed(village) > 240);
  assert.equal(inspectUpgrade(village, state.world, 'oduncu', T0).code, 'population');
  assert.ok(inspectUpgrade(village, state.world, 'ciftlik', T0).ok);
});

test('ambarı aşan maliyet "storage", yetersiz kaynak "resources" + hazır olma zamanı verir', () => {
  const { state, village } = newGame();
  village.buildings.ciftlik = 20;
  village.buildings.konak = 25;
  assert.equal(inspectUpgrade(village, state.world, 'konak', T0).code, 'storage');

  village.resources.odun = 0;
  const check = inspectUpgrade(village, state.world, 'oduncu', T0);
  assert.equal(check.code, 'resources');
  const expectedWait = (check.cost.odun / productionPerHour(1)) * HOUR;
  assert.ok(Math.abs(check.readyAt - (T0 + expectedWait)) <= 1);
});

test('son iş iptal edilince maliyet tamamen iade edilir', () => {
  const { state, village } = newGame();
  startUpgrade(village, state.world, 'kilocagi', T0);
  const job = cancelLastUpgrade(village);
  assert.equal(job.building, 'kilocagi');
  assert.deepEqual(village.resources, { odun: 500, kil: 500, demir: 500 });
  assert.equal(village.buildQueue.length, 0);
  assert.equal(cancelLastUpgrade(village), null);
});

test('kayıt kodu Türkçe karakterlerle birlikte bozulmadan geri çözülür', () => {
  const { state, village } = newGame();
  village.name = 'Söğüt Beyliği ığüşöç';
  startUpgrade(village, state.world, 'oduncu', T0);
  assert.deepEqual(decodeSave(encodeSave(state)), state);
  assert.throws(() => decodeSave('rastgele metin'));
});

test('gelecekteki sürüme ait kayıt reddedilir', () => {
  const { state } = newGame();
  assert.throws(() => migrate({ ...state, version: GAME.saveVersion + 1 }));
  assert.throws(() => migrate(null));
});
