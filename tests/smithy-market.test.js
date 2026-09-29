import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import {
  inspectResearch,
  startResearch,
  cancelResearch,
  researchCost,
  researchDuration,
  techMultiplier,
} from '../js/systems/research.js';
import { resolveBattle } from '../js/systems/combat.js';
import { inspectAttack } from '../js/systems/movements.js';
import { nearbyBarbarians } from '../js/systems/world.js';
import { marketFee, inspectTrade, trade, merchantsAvailable } from '../js/systems/market.js';
import { storageCap } from '../js/systems/economy.js';
import { UNITS } from '../js/config/units.js';
import { RESEARCH, MARKET } from '../js/config/tech.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);

function village(buildings = {}, resources = 20_000) {
  const state = createNewGame({ now: T0, seed: 3 });
  const v = state.villages[state.activeVillageId];
  Object.assign(v.buildings, { konak: 10, kisla: 5, ciftlik: 15, ambar: 20 }, buildings);
  v.resources = { odun: resources, kil: resources, demir: resources };
  return { state, v };
}

// ---------- Demirci ----------

test('geliştirme maliyeti ve süresi seviyeyle artar, Demirci süreyi kısaltır', () => {
  const unit = UNITS.yaya;
  assert.deepEqual(researchCost(unit, 1), { odun: 600, kil: 360, demir: 120 });
  assert.deepEqual(researchCost(unit, 3), { odun: 1800, kil: 1080, demir: 360 });
  assert.ok(researchDuration(unit, 1, 10) < researchDuration(unit, 1, 1));
  assert.equal(researchDuration(unit, 2, 0), unit.trainTime * RESEARCH.timeMultiplier * 2);
});

test('geliştirme Demirci seviyesi ve birimin kendi gereksinimlerini ister', () => {
  const { state, v } = village({ demirci: 0 });
  assert.equal(inspectResearch(v, state.world, 'yaya', T0).code, 'requires');
  v.buildings.demirci = 1;
  assert.ok(inspectResearch(v, state.world, 'yaya', T0).ok);
  assert.equal(inspectResearch(v, state.world, 'sipahi', T0).code, 'requires', 'Sipahi için Ahır 10 gerekir');
  v.tech.yaya = 1;
  assert.match(inspectResearch(v, state.world, 'yaya', T0).reason, /Demirci 5/);
});

test('geliştirme kaynağı düşer, süre dolunca seviye artar ve olay üretir; aynı anda tek geliştirme', () => {
  const { state, v } = village({ demirci: 1 });
  const result = startResearch(v, state.world, 'baltaci', T0);
  assert.ok(result.ok);
  assert.equal(v.resources.odun, 20_000 - UNITS.baltaci.cost.odun * RESEARCH.costMultiplier);
  assert.equal(inspectResearch(v, state.world, 'yaya', T0).code, 'busy');

  const end = T0 + result.duration * 1000;
  assert.deepEqual(advance(state, end - 1), []);
  const [event] = advance(state, end);
  assert.deepEqual([event.type, event.unit, event.level], ['research-complete', 'baltaci', 1]);
  assert.equal(v.tech.baltaci, 1);
  assert.equal(v.research, null);
});

test('geliştirme iptal edilince bedel tamamen iade edilir; 3. seviyeden sonrası yok', () => {
  const { state, v } = village({ demirci: 10 });
  startResearch(v, state.world, 'yaya', T0);
  cancelResearch(v);
  assert.deepEqual(v.resources, { odun: 20_000, kil: 20_000, demir: 20_000 });
  assert.equal(cancelResearch(v), null);
  v.tech.yaya = RESEARCH.maxLevel;
  assert.equal(inspectResearch(v, state.world, 'yaya', T0).code, 'max');
});

test('geliştirme saldırı ve savunmayı %10 / seviye artırır', () => {
  assert.equal(techMultiplier(0), 1);
  assert.equal(techMultiplier(3), 1 + 3 * RESEARCH.bonusPerLevel);
  const plain = resolveBattle({ attackers: { baltaci: 100 }, defenders: { yaya: 50 } });
  const forged = resolveBattle({ attackers: { baltaci: 100 }, defenders: { yaya: 50 }, attackerTech: { baltaci: 2 }, defenderTech: { yaya: 1 } });
  assert.equal(forged.attack, plain.attack * 1.2);
  assert.ok(Math.abs(forged.defense - ((plain.defense - 20) * 1.1 + 20)) < 1e-9);

  const { state, v } = village();
  v.units.baltaci = 10;
  v.tech.baltaci = 3;
  const target = nearbyBarbarians(state, v.x, v.y, 10)[0];
  assert.equal(inspectAttack(state, v, target.x, target.y, { baltaci: 10 }, T0).attack, 400 * 1.3);
});

// ---------- Pazar ----------

test('komisyon Pazar seviyesiyle düşer ve en az %5 olur', () => {
  assert.equal(marketFee(1), MARKET.feeStart - MARKET.feePerLevel);
  assert.ok(marketFee(10) < marketFee(1));
  assert.equal(marketFee(20), MARKET.feeMin);
});

test('takas: verilen düşer, komisyon sonrası miktar eklenir, tüccarlar yola çıkar', () => {
  const { state, v } = village({ pazar: 2 }, 5000);
  const result = trade(v, state.world, 'odun', 'demir', 1500, T0);
  assert.ok(result.ok, result.reason);
  const receive = Math.floor(1500 * (1 - marketFee(2)));
  assert.equal(result.receive, receive);
  assert.equal(result.merchants, 2);
  assert.equal(v.resources.odun, 3500);
  assert.equal(v.resources.demir, 5000 + receive);
  assert.equal(merchantsAvailable(v, T0), 0);
  assert.equal(inspectTrade(v, 'kil', 'odun', 100, T0).code, 'merchants');
  assert.equal(merchantsAvailable(v, T0 + MARKET.tripSeconds * 1000), 2, 'tüccarlar döner');
});

test('takas kontrolleri: pazar yok, aynı kaynak, geçersiz miktar, yetersiz kaynak; ambarı aşan kısım kaybolur', () => {
  const { state, v } = village({ pazar: 0 }, 1000);
  assert.equal(inspectTrade(v, 'odun', 'kil', 100, T0).code, 'market');
  v.buildings.pazar = 5;
  assert.equal(inspectTrade(v, 'odun', 'odun', 100, T0).code, 'same');
  assert.equal(inspectTrade(v, 'odun', 'kil', 0, T0).code, 'count');
  assert.equal(inspectTrade(v, 'odun', 'kil', 1.5, T0).code, 'count');
  assert.equal(inspectTrade(v, 'odun', 'kil', 1001, T0).code, 'resources');

  v.resources.kil = storageCap(v) - 10;
  const check = inspectTrade(v, 'odun', 'kil', 1000, T0);
  assert.equal(check.lost, check.receive - 10);
  const result = trade(v, state.world, 'odun', 'kil', 1000, T0);
  assert.equal(result.stored, 10);
  assert.equal(v.resources.kil, storageCap(v));
});

test('4. sürüm kayda geliştirme ve tüccar alanları eklenir', () => {
  const { state } = village();
  const v4 = structuredClone(state);
  v4.version = 4;
  delete v4.villages.v1.tech;
  delete v4.villages.v1.research;
  delete v4.villages.v1.merchants;
  delete v4.villages.v1.buildings.demirci;
  const migrated = migrate(v4);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.equal(migrated.villages.v1.tech.yaya, 0);
  assert.equal(migrated.villages.v1.research, null);
  assert.deepEqual(migrated.villages.v1.merchants, []);
  assert.equal(migrated.villages.v1.buildings.demirci, 0);
});
