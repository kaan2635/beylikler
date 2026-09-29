import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import { sendAttack } from '../js/systems/movements.js';
import { inspectTraining, startTraining, maxTrainable } from '../js/systems/training.js';
import { loyaltyDrop } from '../js/systems/conquest.js';
import { loyaltyOf } from '../js/systems/barbarians.js';
import { nearbyBarbarians, barbarianAt, villageAt, lordsOf, lordAt } from '../js/systems/world.js';
import { ranking } from '../js/systems/ranking.js';
import { CONQUEST } from '../js/config/combat.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;

function game(difficulty = 'baris') {
  const state = createNewGame({ now: T0, seed: 9, difficulty });
  const village = state.villages[state.activeVillageId];
  Object.assign(village.buildings, { konak: 12, kisla: 10, ahir: 5, demirci: 5, pazar: 5, saray: 1, ciftlik: 25, ambar: 20 });
  village.resources = { odun: 200_000, kil: 200_000, demir: 200_000 };
  return { state, village };
}

/** Birliği gönderip varışa (ve gerekiyorsa dönüşe) kadar ilerletir. */
function strike(state, village, target, units, at = T0) {
  const sent = sendAttack(state, village, target.x, target.y, units, at);
  assert.ok(sent.ok, sent.reason);
  advance(state, sent.arriveAt);
  return { sent, report: state.reports[0] };
}

test('Elçi yalnızca Sarayda ve Saray seviyesi kadar eğitilir', () => {
  const { state, village } = game();
  village.buildings.saray = 0;
  assert.equal(inspectTraining(village, state.world, 'elci', 1, T0).code, 'requires');
  village.buildings.saray = 2;
  assert.equal(maxTrainable(village, 'elci'), 2);
  assert.ok(startTraining(village, state.world, 'elci', 1, T0).ok);
  village.units.elci = 1; // biri köyde, biri eğitimde
  assert.equal(inspectTraining(village, state.world, 'elci', 1, T0).code, 'limit');
  assert.equal(maxTrainable(village, 'elci'), 0);
});

test('Elçi bağlılığı 20–35 düşürür; bağlılık saatte 1 toparlanır; yenilgide düşmez', () => {
  for (let id = 1; id < 100; id++) {
    const drop = loyaltyDrop(9, id, 1);
    assert.ok(drop >= CONQUEST.loyaltyDrop[0] && drop <= CONQUEST.loyaltyDrop[1]);
  }
  const { state, village } = game();
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  village.units.elci = 1;
  village.units.baltaci = 200;
  const { report, sent } = strike(state, village, target, { elci: 1, baltaci: 200 });
  assert.ok(report.attackerWins);
  assert.equal(report.conquest.from, CONQUEST.loyaltyMax);
  assert.equal(report.conquest.to, CONQUEST.loyaltyMax - loyaltyDrop(state.world.seed, sent.movement.id, 1));
  const after = loyaltyOf(state, target.id);
  state.world.clock.time += 10 * HOUR;
  assert.equal(loyaltyOf(state, target.id), Math.min(100, after + 10));

  // Elçi dönünce yenilecek bir saldırıyla tekrar gönder: bağlılık değişmez.
  const home = { ...village.units };
  village.units.elci = 1;
  village.units.yaya = 1;
  const before = loyaltyOf(state, target.id);
  const lost = strike(state, village, target, { elci: 1, yaya: 1 }, sent.arriveAt + 20 * HOUR).report;
  if (!lost.attackerWins) assert.equal(lost.conquest, undefined);
  assert.ok(loyaltyOf(state, target.id) >= before - 1e-9 || lost.attackerWins);
  Object.assign(village.units, home);
});

test('bağlılığı sıfırlanan barbar köyü fethedilir: binalar korunur, birlikler kalır, komşular yerinde', () => {
  const { state, village } = game();
  const target = nearbyBarbarians(state, village.x, village.y, 12).find((b) => Math.hypot(b.x - village.x, b.y - village.y) > 3);
  const neighbours = nearbyBarbarians(state, target.x, target.y, 2).filter((b) => b.id !== target.id);
  village.units.elci = 5;
  village.buildings.saray = 5;
  village.units.baltaci = 500;
  const { report } = strike(state, village, target, { elci: 5, baltaci: 500 });

  assert.equal(report.conquest.conquered, true);
  const conquered = state.villages[report.conquest.villageId];
  assert.equal(conquered.name, target.name);
  assert.deepEqual([conquered.x, conquered.y], [target.x, target.y]);
  assert.equal(conquered.buildings.oduncu, target.buildings.oduncu);
  assert.equal(conquered.units.baltaci, 500 - report.attackerLosses.baltaci);
  assert.equal(conquered.units.elci, 0, 'elçiler görevini tamamladı');
  assert.equal(village.movements.length, 0, 'fethedilen köyden kimse dönmez');
  assert.equal(barbarianAt(state, target.x, target.y), null);
  assert.equal(villageAt(state, target.x, target.y).kind, 'oyuncu');
  for (const n of neighbours) assert.ok(barbarianAt(state, n.x, n.y), `${n.name} yerinde kalmalı`);

  // Yeni köy de üretir ve olayları işlenir.
  const odun = conquered.resources.odun;
  advance(state, report.at + HOUR);
  assert.ok(conquered.resources.odun > odun);
});

test('bey hisarını fethetmek beyi oyundan çıkarır', () => {
  const { state, village } = game('normal');
  advance(state, T0);
  const lord = lordsOf(state.world.seed).find((l) => l.personality === 'tuccar');
  village.units.elci = 5;
  village.buildings.saray = 5;
  village.units.sipahi = 600;
  const { report } = strike(state, village, lord, { elci: 5, sipahi: 600 });
  assert.equal(report.conquest.conquered, true);
  const entry = state.ai.lords[lord.id];
  assert.equal(entry.defeated, true);
  assert.equal(entry.nextAttackAt, null);
  assert.equal(entry.nextRaidAt, null);
  assert.equal(lordAt(state, lord.x, lord.y), null);
  const row = ranking(state).find((r) => r.id === lord.id);
  assert.ok(row.defeated && row.points === 0 && row.rank === 7);
  assert.equal(ranking(state).find((r) => r.kind === 'oyuncu').villages, 2);
  assert.match(state.news[0].text, /oyundan çekildi/);
});

test('Game: köyler arasında geçiş', () => {
  const { state, village } = game();
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  village.units.elci = 5;
  village.buildings.saray = 5;
  village.units.baltaci = 500;
  const sent = sendAttack(state, village, target.x, target.y, { elci: 5, baltaci: 500 }, T0);
  const g = new Game({ load: () => structuredClone(state), save() {}, clear() {} });
  g.load(T0);
  g.tick(sent.arriveAt);
  const ids = Object.keys(g.state.villages);
  assert.equal(ids.length, 2);
  assert.ok(g.setActiveVillage(ids[1]));
  assert.equal(g.village.name, target.name);
  assert.equal(g.setActiveVillage('yok'), false);
});
