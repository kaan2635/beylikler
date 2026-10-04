import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../js/core/state.js';
import { Game } from '../js/game.js';
import { advance } from '../js/core/engine.js';
import {
  inspectExpedition,
  sendExpedition,
  expeditionSlots,
  expeditionsUnderway,
  expeditionOdds,
  expeditionScale,
} from '../js/systems/expedition.js';
import { chooseClass } from '../js/systems/premium.js';
import { armyCarry, totalUnits } from '../js/systems/army.js';
import { EXPEDITION, EXPEDITION_FOCUSES } from '../js/config/expedition.js';
import { travelSeconds } from '../js/core/formulas.js';
import { UNITS } from '../js/config/units.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;

function game(seed = 3) {
  const state = createNewGame({ now: T0, seed, difficulty: 'baris' });
  const village = state.villages.v1;
  Object.assign(village.buildings, { kervansaray: 1, ambar: 20, ciftlik: 25, kisla: 5, ahir: 5 });
  Object.assign(village.units, { baltaci: 500, akinci: 300, yaya: 200 });
  return { state, village };
}

test('sefer hakkı Kervansaraya bağlı; Kâşif bir hak ekler', () => {
  const { state, village } = game();
  assert.equal(expeditionSlots(state, village), 1);
  village.buildings.kervansaray = 10;
  assert.equal(expeditionSlots(state, village), 3);
  chooseClass(state, 'kasif', {}, T0);
  assert.equal(expeditionSlots(state, village), 4);
  village.buildings.kervansaray = 0;
  assert.equal(expeditionSlots(state, village), 0);
});

test('sefer denetimleri ve süreler', () => {
  const { state, village } = game();
  assert.equal(inspectExpedition(state, village, {}, 1, T0).code, 'empty');
  assert.equal(inspectExpedition(state, village, { yaya: 1 }, 5, T0).code, 'hold');
  assert.equal(inspectExpedition(state, village, { elci: 1 }, 1, T0).code, 'excluded');
  assert.equal(inspectExpedition(state, village, { yaya: 999 }, 1, T0).code, 'units');
  const check = inspectExpedition(state, village, { yaya: 10, akinci: 10 }, 2, T0);
  assert.ok(check.ok);
  assert.equal(check.seconds, travelSeconds(EXPEDITION.distance, UNITS.yaya.speed, 1));
  assert.equal(check.arriveAt, T0 + check.seconds * 1000 + 2 * HOUR);

  const sent = sendExpedition(state, village, { yaya: 10 }, 1, T0);
  assert.ok(sent.ok);
  assert.equal(expeditionsUnderway(state), 1);
  assert.equal(inspectExpedition(state, village, { yaya: 10 }, 1, T0).code, 'slots');
  village.buildings.kervansaray = 0;
  assert.equal(inspectExpedition(state, village, { yaya: 10 }, 1, T0).code, 'building');
});

test('olasılıklar: toplam 1; Kâşif tehlikeyi yarıya indirir; uzun keşif boş dönmeyi azaltır', () => {
  const { state, village } = game();
  const base = expeditionOdds(village, 1);
  assert.ok(Math.abs(Object.values(base).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(expeditionOdds(village, 8).bos < base.bos);
  const scale = expeditionScale(state, village, 1);
  chooseClass(state, 'kasif', {}, T0);
  const kasif = expeditionOdds(village, 1);
  assert.ok(kasif.kayip < base.kayip);
  assert.ok(Math.abs(kasif.kayip / kasif.kaynak - (base.kayip / base.kaynak) * 0.5) < 1e-9);
  assert.ok(Math.abs(expeditionScale(state, village, 1) - scale * 1.5) < 1e-9);
});

test('sefer yaklaşımları olasılık ve ödülleri değiştirir, raporda saklanır', () => {
  const { state, village } = game();
  const base = expeditionOdds(village, 2, 'sinir', false, 'dengeli');
  const supplies = expeditionOdds(village, 2, 'sinir', false, 'kaynak');
  const recruits = expeditionOdds(village, 2, 'sinir', false, 'asker');
  const cautious = expeditionOdds(village, 2, 'sinir', false, 'temkinli');
  for (const focus of Object.keys(EXPEDITION_FOCUSES)) {
    assert.ok(Math.abs(Object.values(expeditionOdds(village, 2, 'sinir', false, focus)).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
  assert.ok(supplies.kaynak > base.kaynak);
  assert.ok(recruits.asker > base.asker);
  assert.ok(cautious.eskiya < base.eskiya);
  assert.ok(cautious.kayip < base.kayip);
  assert.ok(cautious.bos > base.bos);
  assert.ok(Math.abs(expeditionScale(state, village, 2, false, 'temkinli') - expeditionScale(state, village, 2) * 0.85) < 1e-9);
  assert.deepEqual(expeditionOdds(village, 2, 'sinir', false, 'unknown'), base, 'bilinmeyen yaklaşım dengeliye düşer');

  const sent = sendExpedition(state, village, { yaya: 10 }, 2, T0, { region: 'sinir', focus: 'kaynak' });
  assert.ok(sent.ok, sent.reason);
  assert.equal(sent.movement.focus, 'kaynak');
  advance(state, sent.arriveAt);
  const report = state.reports[0];
  assert.equal(report.focus, 'kaynak');
  const returnTrip = village.movements.find((movement) => movement.type === 'donus');
  assert.ok(returnTrip);
  advance(state, returnTrip.arriveAt);
  const session = new Game({ save() {} });
  session.state = state;
  const replay = session.repeatExpedition(report.id, returnTrip.arriveAt + 1);
  assert.ok(replay.ok, replay.reason);
  assert.equal(replay.movement.focus, 'kaynak', 'raporu tekrarlamak sefer yaklaşımını da korur');
});

test('her sonuç türü tutarlı çözülür; sağ kalanlar bulduklarıyla döner', () => {
  const seen = new Set();
  const required = ['bos', 'kaynak', 'asker', 'akce', 'gecikme', 'erken'];
  for (let seed = 1; seed <= 800 && !required.every((o) => seen.has(o)); seed++) {
    const { state, village } = game(seed);
    const before = { ...village.units };
    const akceBefore = state.player.akce;
    const units = { baltaci: 100, akinci: 50 };
    const sent = sendExpedition(state, village, units, 1, T0);
    assert.ok(sent.ok, sent.reason);
    const events = advance(state, sent.arriveAt);
    const result = events.find((e) => e.type === 'expedition-result');
    assert.ok(result, 'sefer sonucu olay olarak döner');
    const report = state.reports[0];
    assert.equal(report.type, 'kesif');
    assert.ok(report.text.length > 10);
    seen.add(report.outcome);

    const lootTotal = Object.values(report.loot).reduce((a, b) => a + b, 0);
    if (report.outcome === 'kaynak' || report.outcome === 'eskiyaZafer') {
      assert.ok(lootTotal <= armyCarry(units) + 3, 'taşıma sınırı aşılmaz');
    }
    if (report.outcome === 'akce') assert.ok(state.player.akce > akceBefore);
    if (report.outcome === 'kayip' || report.outcome === 'eskiyaYenilgi') {
      assert.equal(village.movements.length, 0);
      continue;
    }
    const back = village.movements[0];
    assert.equal(back.type, 'donus');
    assert.equal(back.mission, 'kesif');
    const travel = sent.exploreAt - T0;
    const expected = report.outcome === 'gecikme' ? travel * report.returnFactor : report.outcome === 'erken' ? travel * EXPEDITION.early : travel;
    assert.ok(Math.abs(back.arriveAt - back.departAt - expected) < 1);
    advance(state, back.arriveAt);
    assert.equal(expeditionsUnderway(state), 0);
    const home = totalUnits(village.units);
    const foundTotal = totalUnits(report.found);
    const lostTotal = totalUnits(report.attackerLosses);
    assert.equal(home, totalUnits(before) + foundTotal - lostTotal);
    if (report.outcome === 'kaynak') assert.ok(village.resources.odun > 0);
  }
  for (const outcome of ['bos', 'kaynak', 'asker', 'akce', 'gecikme', 'erken']) assert.ok(seen.has(outcome), `${outcome} görülmeli`);
});

test('sonuç tohumdan belirlenir: aynı kayıt aynı sonucu verir', () => {
  const run = () => {
    const { state, village } = game(42);
    const sent = sendExpedition(state, village, { baltaci: 100 }, 3, T0);
    advance(state, sent.arriveAt);
    return state.reports[0];
  };
  const a = run();
  const b = run();
  assert.equal(a.outcome, b.outcome);
  assert.deepEqual(a.loot, b.loot);
  assert.equal(a.text, b.text);
});
