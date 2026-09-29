import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { advance } from '../js/core/engine.js';
import { createNewGame } from '../js/core/state.js';
import { sendAttack, recallAttack } from '../js/systems/movements.js';
import { nearbyBarbarians } from '../js/systems/world.js';
import { populationUsed } from '../js/systems/economy.js';

const T0 = Date.UTC(2026, 0, 1);

/** Bellekte çalışan kayıt deposu: Game sınıfını tarayıcısız test etmek için. */
function memoryStore(initial = null) {
  let saved = initial ? structuredClone(initial) : null;
  return {
    saves: 0,
    load: () => (saved ? structuredClone(saved) : null),
    save(state) {
      saved = structuredClone(state);
      this.saves++;
    },
    clear: () => (saved = null),
  };
}

function setup(units) {
  const state = createNewGame({ now: T0, seed: 42 });
  const village = state.villages[state.activeVillageId];
  Object.assign(village.units, units);
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  return { state, village, target };
}

test('geri çağrılan saldırı savaşmadan, yolda geçen süre kadar sonra döner', () => {
  const { state, village, target } = setup({ baltaci: 30 });
  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 30 }, T0);
  const total = sent.seconds * 1000;
  const recallAt = T0 + Math.floor(total * 0.4);
  const popBefore = populationUsed(village);

  const result = recallAttack(village, sent.movement.id, recallAt);
  assert.ok(result.ok);
  const movement = village.movements[0];
  assert.equal(movement.type, 'donus');
  assert.equal(movement.arriveAt, recallAt + (recallAt - T0));
  assert.ok(Math.abs(movement.turnAt - 0.4) < 0.001);
  assert.equal(populationUsed(village), popBefore, 'yoldaki askerler nüfusta kalır');

  const events = advance(state, T0 + 10 * total);
  assert.deepEqual(events.map((e) => e.type), ['return']);
  assert.equal(village.units.baltaci, 30);
  assert.equal(state.reports.length, 0, 'savaş olmadı, rapor yok');
});

test('dönüş ya da hedefe varmış saldırı geri çağrılamaz', () => {
  const { state, village, target } = setup({ baltaci: 30 });
  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 30 }, T0);
  assert.equal(recallAttack(village, sent.movement.id, sent.arriveAt).ok, false);
  advance(state, sent.arriveAt); // savaş oldu, dönüşe geçti
  assert.equal(recallAttack(village, sent.movement.id, sent.arriveAt + 1).ok, false);
  assert.equal(recallAttack(village, 9999, T0).ok, false);
});

test('Game: rapordaki orduyla tekrar saldırı; asker yetmezse nedenini söyler', () => {
  const { state, target } = setup({ baltaci: 30 });
  const game = new Game(memoryStore(state));
  game.load(T0);

  const first = game.sendAttack(target.x, target.y, { baltaci: 20 }, T0);
  assert.ok(first.ok);
  game.tick(first.arriveAt + first.seconds * 1000); // savaş + dönüş
  const report = game.state.reports[0];
  assert.deepEqual(report.attackers, { baltaci: 20 });

  const now = first.arriveAt + first.seconds * 1000 + 1;
  const again = game.repeatAttack(report.id, now);
  assert.ok(again.ok, again.reason);
  assert.deepEqual(again.units, { baltaci: 20 });

  const tooMany = game.repeatAttack(report.id, now + 1); // köyde 20'den az kaldı
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.reason, /Baltacı/);
  assert.equal(game.repeatAttack(12345, now).ok, false);
});

test('Game: raporlar silinir ve okundu işaretlenir; değişiklik kaydedilir', () => {
  const { state, target } = setup({ yaya: 3 });
  const store = memoryStore(state);
  const game = new Game(store);
  game.load(T0);
  for (let i = 0; i < 3; i++) game.sendAttack(target.x, target.y, { yaya: 1 }, T0 + i);
  game.tick(T0 + 86_400_000);
  const ids = game.state.reports.map((r) => r.id);
  assert.equal(ids.length, 3);

  game.markReportsRead([ids[0]]);
  assert.equal(game.state.reports.filter((r) => !r.read).length, 2);

  const saves = store.saves;
  game.deleteReports([ids[0], ids[1]]);
  assert.deepEqual(game.state.reports.map((r) => r.id), [ids[2]]);
  assert.equal(store.saves, saves + 1);
  game.deleteReports([999]);
  assert.equal(store.saves, saves + 1, 'değişiklik yoksa kaydetmez');
});
