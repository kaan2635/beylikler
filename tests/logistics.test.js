import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, createVillage } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { sendAttack, recallAttack, inspectAttack } from '../js/systems/movements.js';
import { inspectTransport, sendTransport, merchantsAvailable } from '../js/systems/market.js';
import { withdrawSupport, defendersOf, supportAt, stationedAway, applyDefenderLosses } from '../js/systems/support.js';
import { populationUsed } from '../js/systems/economy.js';
import { unitsOwned } from '../js/systems/training.js';
import { resolveIncoming } from '../js/systems/ai.js';
import { MARKET } from '../js/config/tech.js';
import { travelSeconds } from '../js/core/formulas.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;

/** İki köylü oyun: v1 (500|500) ve v2 (504|503, 5 alan uzakta). */
function twoVillages() {
  const state = createNewGame({ now: T0, seed: 21, difficulty: 'baris' });
  const home = state.villages.v1;
  Object.assign(home.buildings, { pazar: 5, ambar: 15, kisla: 5, ciftlik: 15 });
  home.resources = { odun: 20_000, kil: 20_000, demir: 20_000 };
  const other = createVillage({ id: 'v2', name: 'Yeşilova', x: 504, y: 503, now: T0 });
  other.buildings.ambar = 10;
  state.villages.v2 = other;
  return { state, home, other };
}

test('nakliye: tüccarlar yükü götürür, varınca ambara girer; tüccarlar gidiş-dönüş meşgul', () => {
  const { state, home, other } = twoVillages();
  const check = inspectTransport(state, home, 'v2', { odun: 1500, kil: 300 }, T0);
  assert.ok(check.ok, check.reason);
  assert.equal(check.merchants, 2);
  assert.equal(check.seconds, travelSeconds(5, MARKET.merchantSpeed, 1));

  const before = other.resources.odun;
  const sent = sendTransport(state, home, 'v2', { odun: 1500, kil: 300 }, T0);
  assert.ok(sent.ok);
  assert.equal(home.resources.odun, 20_000 - 1500);
  assert.equal(merchantsAvailable(home, T0), 3);

  const events = advance(state, sent.arriveAt);
  const arrived = events.find((e) => e.type === 'transport-arrived');
  assert.ok(arrived);
  assert.equal(arrived.stored.odun, 1500);
  // Hedef köy de o ana kadar üretti; gelen yük üstüne eklendi.
  assert.ok(other.resources.odun >= before + 1500);
  assert.equal(home.movements.length, 0);
  assert.equal(merchantsAvailable(home, sent.arriveAt), 3, 'tüccarlar henüz dönmedi');
  assert.equal(merchantsAvailable(home, T0 + 2 * sent.seconds * 1000), 5);
});

test('nakliye denetimleri: pazar, hedef, miktar, tüccar', () => {
  const { state, home } = twoVillages();
  assert.equal(inspectTransport(state, home, 'v1', { odun: 10 }, T0).code, 'target');
  assert.equal(inspectTransport(state, home, 'yok', { odun: 10 }, T0).code, 'target');
  assert.equal(inspectTransport(state, home, 'v2', {}, T0).code, 'empty');
  assert.equal(inspectTransport(state, home, 'v2', { odun: -1 }, T0).code, 'count');
  assert.equal(inspectTransport(state, home, 'v2', { odun: 50_000 }, T0).code, 'resources');
  assert.equal(inspectTransport(state, home, 'v2', { odun: 6000 }, T0).code, 'merchants');
  home.buildings.pazar = 0;
  assert.equal(inspectTransport(state, home, 'v2', { odun: 10 }, T0).code, 'market');
});

test('destek: kendi köyüne giden birlik orada durur, nüfusu evinde sayılır, geri çağrılır', () => {
  const { state, home, other } = twoVillages();
  home.units.kilicci = 100;
  const popBefore = populationUsed(home);
  const check = inspectAttack(state, home, other.x, other.y, { kilicci: 100 }, T0);
  assert.equal(check.mission, 'destek');
  assert.equal(inspectAttack(state, home, home.x, home.y, { kilicci: 1 }, T0).code, 'self');

  const sent = sendAttack(state, home, other.x, other.y, { kilicci: 100 }, T0);
  assert.ok(sent.ok);
  assert.equal(populationUsed(home), popBefore, 'yoldaki destek nüfus kullanır');
  const events = advance(state, sent.arriveAt);
  assert.ok(events.some((e) => e.type === 'support-arrived'));
  assert.deepEqual(home.stationed.v2, { kilicci: 100 });
  assert.equal(populationUsed(home), popBefore);
  assert.equal(unitsOwned(home, 'kilicci'), 100);
  assert.deepEqual(defendersOf(state, other), { kilicci: 100 });
  assert.equal(supportAt(state, 'v2').length, 1);
  assert.equal(stationedAway(state, home)[0].host, other);

  const back = withdrawSupport(state, home, 'v2', sent.arriveAt);
  assert.ok(back.ok);
  assert.equal(home.stationed.v2, undefined);
  assert.equal(back.movement.type, 'donus');
  advance(state, back.movement.arriveAt);
  assert.equal(home.units.kilicci, 100);
  assert.equal(withdrawSupport(state, home, 'v2', back.movement.arriveAt).ok, false);
});

test('yoldaki destek geri çağrılabilir', () => {
  const { state, home, other } = twoVillages();
  home.units.yaya = 10;
  const sent = sendAttack(state, home, other.x, other.y, { yaya: 10 }, T0);
  const halfway = T0 + (sent.arriveAt - T0) / 2;
  assert.ok(recallAttack(home, sent.movement.id, halfway).ok);
  advance(state, halfway + (halfway - T0));
  assert.equal(home.units.yaya, 10);
  assert.deepEqual(home.stationed, {});
});

test('savunma kayıpları köy askerleri ile destek arasında oranla paylaşılır', () => {
  const { state, home, other } = twoVillages();
  other.units.kilicci = 100;
  home.stationed = { v2: { kilicci: 300, muhafiz: 50 } };
  const defenders = defendersOf(state, other);
  assert.deepEqual(defenders, { kilicci: 400, muhafiz: 50 });
  applyDefenderLosses(state, other, defenders, { kilicci: 200, muhafiz: 50 });
  assert.equal(other.units.kilicci + home.stationed.v2.kilicci, 200);
  assert.equal(home.stationed.v2.kilicci, 150);
  assert.equal(other.units.kilicci, 50);
  assert.equal(home.stationed.v2.muhafiz, 0);
  applyDefenderLosses(state, other, defendersOf(state, other), { kilicci: 200 });
  assert.equal(home.stationed.v2, undefined, 'yok olan destek kaydı silinir');
});

test('bey saldırısında destek birlikleri de savunur', () => {
  const { state, home, other } = twoVillages();
  home.stationed = { v2: { muhafiz: 400 } };
  const attack = { id: 77, lordId: 'bey0', from: { id: 'bey0', kind: 'bey', name: 'X Hisarı', owner: 'X Bey', x: 480, y: 480 }, units: { baltaci: 300 }, tech: {}, departAt: T0, arriveAt: T0 + HOUR };
  other.incoming.push(attack);
  const event = resolveIncoming(state, other, attack);
  assert.equal(event.defended, true);
  const report = state.reports[0];
  assert.equal(report.defenders.muhafiz, 400);
  assert.equal(home.stationed.v2.muhafiz, 400 - report.defenderLosses.muhafiz);
});
