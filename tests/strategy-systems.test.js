import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, createVillage, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import { GAME } from '../js/config/game.js';
import { FORMATIONS } from '../js/config/formations.js';
import { EDICTS } from '../js/config/edicts.js';
import { SEASON_DAYS } from '../js/config/seasons.js';
import { COMBAT } from '../js/config/combat.js';
import { resolveBattle } from '../js/systems/combat.js';
import { inspectAttack, sendAttack } from '../js/systems/movements.js';
import { activeEdict, chooseEdict } from '../js/systems/edicts.js';
import { createTradeRoute, inspectTradeRoute, maxTradeRoutes, routeDueAt, toggleTradeRoute, deleteTradeRoute } from '../js/systems/trade-routes.js';
import { nearbyBarbarians } from '../js/systems/world.js';
import { storageCap } from '../js/systems/economy.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const DAY = 86_400_000;

function addSecondVillage(state) {
  const village = createVillage({ id: 'v2', name: 'Yaylak', x: 501, y: 500, now: T0 });
  state.villages[village.id] = village;
  return village;
}

function stopProduction(village) {
  village.buildings.oduncu = 0;
  village.buildings.kilocagi = 0;
  village.buildings.demirmadeni = 0;
}

test('kervan hattı doğrulanır, ambar yedeği korunur ve zamanında sevkiyat yapar', () => {
  const state = createNewGame({ now: T0, seed: 27, difficulty: 'baris' });
  const source = state.villages.v1;
  const target = addSecondVillage(state);
  source.buildings.pazar = 3;
  source.buildings.ambar = 3;
  stopProduction(source);
  source.resources.odun = 595; // bir oyun saatinde taban üretim 5 odun ekler

  assert.equal(maxTradeRoutes(source), 1);
  const cargo = { odun: 300, kil: 0, demir: 0 };
  const reserve = { odun: 550, kil: 0, demir: 0 };
  assert.equal(inspectTradeRoute(state, source.id, target.id, cargo, reserve, 3).code, 'interval');
  assert.equal(inspectTradeRoute(state, source.id, source.id, cargo, reserve, 1).code, 'target');
  assert.equal(inspectTradeRoute(state, source.id, target.id, { odun: 3_001 }, reserve, 1).code, 'capacity');

  const created = createTradeRoute(state, source.id, target.id, cargo, reserve, 1, T0);
  assert.ok(created.ok, created.reason);
  assert.equal(created.route.nextAt, T0 + HOUR);
  assert.equal(inspectTradeRoute(state, source.id, target.id, cargo, reserve, 1).code, 'slots');

  const events = advance(state, T0 + HOUR);
  const event = events.find((item) => item.type === 'trade-route');
  assert.ok(event, 'kervan sevkiyat olayı oluşur');
  assert.equal(event.sent, 50, '600 odunun 550si yedekte kalır');
  assert.equal(created.route.dispatches, 1);
  assert.equal(created.route.lastAt, T0 + HOUR);
  assert.ok(source.resources.odun >= reserve.odun, 'seferden sonra belirlenen ambar yedeği kalır');
  const movement = source.movements.find((item) => item.routeId === created.route.id);
  assert.ok(movement, 'yola çıkan tüccar hat kimliğini taşır');
  assert.equal(movement.resources.odun, 50);
});

test('kervan hattı hedefteki boş alanı ve yoldaki sevkiyatları hesaba katar', () => {
  const state = createNewGame({ now: T0, seed: 34, difficulty: 'baris' });
  const source = state.villages.v1;
  const target = addSecondVillage(state);
  source.buildings.pazar = 3;
  source.resources.odun = 500;
  stopProduction(source);
  stopProduction(target);
  const cap = storageCap(target);
  target.resources.odun = cap - 300;
  source.movements.push({
    id: 900,
    type: 'nakliye',
    target: { id: target.id, name: target.name, x: target.x, y: target.y },
    units: {},
    resources: { odun: 250, kil: 0, demir: 0 },
    arriveAt: T0 + 3 * HOUR,
  });

  const created = createTradeRoute(state, source.id, target.id, { odun: 100 }, {}, 1, T0);
  assert.ok(created.ok, created.reason);
  const event = advance(state, T0 + HOUR).find((item) => item.type === 'trade-route');
  assert.ok(event.sent > 0 && event.sent < 50, 'yoldaki sevkiyat ve varışa kadarki üretim hedefteki boş alanı daraltır');
  assert.match(event.reason, /yük sınırlandı/);
  const shipment = source.movements.find((movement) => movement.routeId === created.route.id);
  assert.equal(shipment.resources.odun, event.sent);
});

test('kervan çevrimdışı yakalaması en fazla son üç seferi işler; durdurma ve silme çalışır', () => {
  const state = createNewGame({ now: T0, seed: 28, difficulty: 'baris' });
  const source = state.villages.v1;
  const target = addSecondVillage(state);
  source.buildings.pazar = 3;
  source.buildings.ambar = 10;
  stopProduction(source);
  source.resources.odun = 5_000;

  const created = createTradeRoute(state, source.id, target.id, { odun: 10 }, {}, 1, T0);
  assert.ok(created.ok);
  const route = created.route;
  const end = T0 + 10 * HOUR;
  assert.equal(routeDueAt(route, state.world, end), T0 + 8 * HOUR);
  const events = advance(state, end).filter((item) => item.type === 'trade-route');
  assert.deepEqual(events.map((item) => item.at), [T0 + 8 * HOUR, T0 + 9 * HOUR, T0 + 10 * HOUR]);
  assert.equal(route.dispatches, 3);
  assert.equal(route.skipped, 7);

  const paused = toggleTradeRoute(state, route.id, false, end);
  assert.ok(paused.ok);
  assert.equal(route.enabled, false);
  assert.equal(route.nextAt, null);
  const resumed = toggleTradeRoute(state, route.id, true, end);
  assert.ok(resumed.ok);
  assert.equal(route.nextAt, end + HOUR);
  assert.equal(deleteTradeRoute(state, route.id), route);
  assert.equal(state.tradeRoutes.length, 0);
});

test('dünya hızı değişince kervan hattının oyun zamanı cinsinden kalan süresi korunur', () => {
  const state = createNewGame({ now: T0, seed: 33, difficulty: 'baris' });
  const source = state.villages.v1;
  const target = addSecondVillage(state);
  source.buildings.pazar = 3;
  const route = createTradeRoute(state, source.id, target.id, { odun: 10 }, {}, 2, T0).route;
  const game = new Game({ load: () => null, save() {} });
  game.state = state;

  game.setSpeed(2, T0 + HOUR / 2);
  assert.equal(state.world.speed, 2);
  assert.equal(route.nextAt, T0 + (5 * HOUR) / 4);
});

test('12. sürüm kaydı ferman ve kervan alanlarıyla 13. sürüme taşınır', () => {
  const state = createNewGame({ now: T0, seed: 29 });
  state.version = GAME.saveVersion - 1;
  delete state.player.edict;
  delete state.tradeRoutes;
  const migrated = migrate(state);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.equal(migrated.player.edict, null);
  assert.deepEqual(migrated.tradeRoutes, []);
});

test('mevsim fermanı tüm köylere işler, aynı mevsimde değişmez ve sonraki mevsimde yenilenir', () => {
  const state = createNewGame({ now: T0, seed: 30, difficulty: 'baris' });
  const capital = state.villages.v1;
  const second = addSecondVillage(state);
  const chosen = chooseEdict(state, 'bereket', T0);
  assert.ok(chosen.ok);
  assert.equal(activeEdict(state).id, 'bereket');
  assert.equal(capital.bonus.production, 1.1 * EDICTS.bereket.bonus.production);
  assert.equal(second.bonus.production, 1.1 * EDICTS.bereket.bonus.production);
  assert.equal(chooseEdict(state, 'imar', T0).code, 'chosen');

  advance(state, T0 + SEASON_DAYS * DAY);
  assert.equal(state.world.season, 1);
  assert.equal(activeEdict(state), null);
  assert.equal(capital.bonus.production, 1);
  const next = chooseEdict(state, 'imar', T0 + SEASON_DAYS * DAY);
  assert.ok(next.ok);
  assert.equal(activeEdict(state).id, 'imar');
  assert.equal(second.bonus.buildTime, EDICTS.imar.bonus.buildTime);
  assert.equal(second.bonus.storage, EDICTS.imar.bonus.storage);

  const noSeason = createNewGame({ now: T0, seed: 31 });
  noSeason.world.seasons = false;
  assert.equal(chooseEdict(noSeason, 'bereket', T0).code, 'season');
});

test('savaş düzenleri saldırı, zafer kaybı ve saldırı raporuna uygulanır', () => {
  const attackers = { baltaci: 100 };
  const defenders = { yaya: 10 };
  const balanced = resolveBattle({ attackers, defenders, luck: 0 });
  const kama = resolveBattle({ attackers, defenders, luck: 0, formation: 'kama' });
  const shield = resolveBattle({ attackers, defenders, luck: 0, formation: 'kalkan' });
  assert.equal(kama.attack, balanced.attack * FORMATIONS.kama.attack);
  assert.equal(shield.attack, balanced.attack * FORMATIONS.kalkan.attack);
  assert.equal(
    kama.attackerLosses.baltaci,
    Math.round(100 * (balanced.defense / kama.attack) ** COMBAT.lossExponent * FORMATIONS.kama.losses),
  );

  const state = createNewGame({ now: T0, seed: 32, difficulty: 'baris' });
  const village = state.villages.v1;
  village.units.baltaci = 10_000;
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  const planned = inspectAttack(state, village, target.x, target.y, { baltaci: 10 }, T0, { formation: 'kama' });
  const balancedPlan = inspectAttack(state, village, target.x, target.y, { baltaci: 10 }, T0);
  assert.ok(planned.ok);
  assert.equal(planned.attack, balancedPlan.attack * FORMATIONS.kama.attack);
  assert.equal(inspectAttack(state, village, target.x, target.y, { baltaci: 1 }, T0, { formation: 'bilinmeyen' }).code, 'formation');

  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 10_000 }, T0, { formation: 'akin' });
  assert.ok(sent.ok);
  assert.equal(village.movements[0].formation, 'akin');
  advance(state, sent.arriveAt);
  const report = state.reports[0];
  assert.equal(report.formation, 'akin');

  const returning = village.movements.find((movement) => movement.type === 'donus');
  assert.ok(returning);
  advance(state, returning.arriveAt);
  village.units.baltaci = 10_000;
  const game = new Game({ load: () => null, save() {} });
  game.state = state;
  const repeated = game.repeatAttack(report.id, returning.arriveAt + 1);
  assert.ok(repeated.ok, repeated.reason);
  assert.equal(village.movements.find((movement) => movement.type === 'saldiri').formation, 'akin');
});
