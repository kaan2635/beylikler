import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { ranking } from '../js/systems/ranking.js';
import { lordsOf, lordAt, lordPowerIn, nearbyBarbarians, villagePoints } from '../js/systems/world.js';
import { sendAttack } from '../js/systems/movements.js';
import { setDifficulty } from '../js/systems/ai.js';
import { LORD } from '../js/config/lords.js';
import { UNITS } from '../js/config/units.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function game(difficulty = 'normal', seed = 21) {
  const state = createNewGame({ now: T0, seed, difficulty });
  return { state, village: state.villages[state.activeVillageId] };
}

test('sıralama oyuncuyu ve 6 beyi puana göre dizer', () => {
  const { state, village } = game();
  const table = ranking(state);
  assert.equal(table.length, 1 + LORD.count);
  assert.deepEqual(table.map((e) => e.rank), [1, 2, 3, 4, 5, 6, 7]);
  for (let i = 1; i < table.length; i++) assert.ok(table[i - 1].points >= table[i].points);
  const me = table.find((e) => e.kind === 'oyuncu');
  assert.equal(me.points, villagePoints(village.buildings));

  village.buildings.konak = 20;
  village.buildings.oduncu = 20;
  assert.equal(ranking(state)[0].kind, 'oyuncu', 'büyüyen oyuncu zirveye çıkar');
});

test('beyler barbar köylerini yağmalar: köyün garnizonu erir, bey güçlenir ve ganimet toplar', () => {
  const { state } = game('normal');
  advance(state, T0);
  advance(state, T0 + 10 * DAY);
  const entries = Object.values(state.ai.lords);
  assert.ok(entries.every((e) => e.raids > 0), 'her bey hareket etti');
  assert.ok(entries.some((e) => e.loot > 0 && e.kills > 0));
  assert.ok(entries.some((e) => e.bonus > 0), 'başarılı yağma gücü artırır');
  const raided = Object.keys(state.barbarians).filter((id) => id.startsWith('b'));
  assert.ok(raided.length > 0, 'yağmalanan barbar köyleri kayda geçti');
  for (const lord of lordsOf(state.world.seed)) {
    const d = (x, y) => Math.hypot(x - lord.x, y - lord.y);
    assert.ok(nearbyBarbarians(state, lord.x, lord.y, LORD.raidRadius).every((b) => d(b.x, b.y) <= LORD.raidRadius));
  }
});

test('beyler zamanla birbirine savaş açar; haberlere yazılır, kazanan güçlenir', () => {
  const { state } = game('normal', 5);
  advance(state, T0);
  advance(state, T0 + 40 * DAY);
  const wars = state.news.filter((n) => / → .+ Bey: /.test(n.text));
  assert.ok(wars.length > 0, 'en az bir beyler arası savaş olmalı');
  assert.ok(state.news.length <= LORD.newsMax);
  for (const entry of Object.values(state.ai.lords)) {
    assert.ok(entry.bonus >= LORD.bonusMin && entry.bonus <= LORD.bonusMax);
  }
});

test('Barış zorluğunda dünya sakindir: yağma da savaş da olmaz', () => {
  const { state } = game('baris');
  advance(state, T0 + 30 * DAY);
  assert.ok(Object.values(state.ai.lords).every((e) => e.raids === 0 && e.nextRaidAt === null));
  assert.deepEqual(state.barbarians, {});
  assert.deepEqual(state.news, []);
  setDifficulty(state, 'normal', T0 + 30 * DAY);
  assert.ok(Object.values(state.ai.lords).every((e) => e.nextRaidAt > T0 + 30 * DAY));
});

test('oyuncunun saldırıları savaş puanı ve ganimet kazandırır; bey hisarını yenmek beyi zayıflatır', () => {
  const { state, village } = game('baris');
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  village.units.baltaci = 60;
  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 60 }, T0);
  advance(state, sent.arriveAt);
  const report = state.reports[0];
  const expectedKills = Object.entries(report.defenderLosses).reduce((t, [id, n]) => t + n * UNITS[id].pop, 0);
  assert.equal(state.stats.kills, expectedKills);
  assert.equal(state.stats.loot, report.loot.odun + report.loot.kil + report.loot.demir);

  const lord = lordsOf(state.world.seed)[0];
  const powerBefore = lordPowerIn(state, lord);
  village.units.sipahi = 300;
  const strike = sendAttack(state, village, lord.x, lord.y, { sipahi: 300 }, sent.arriveAt);
  advance(state, strike.arriveAt);
  assert.ok(state.reports[0].attackerWins);
  assert.ok(lordPowerIn(state, lord) < powerBefore);
  assert.equal(state.news[0].text, `${village.name} → ${lordAt(state, lord.x, lord.y).owner}: hisar yenildi.`);
});

test('savunma savaş puanı getirir ve haberlere yazılır', () => {
  const { state, village } = game('normal');
  village.units.kilicci = 200;
  advance(state, T0);
  const first = Math.min(...Object.values(state.ai.lords).map((e) => e.nextAttackAt));
  advance(state, first);
  const attack = village.incoming[0];
  const killsBefore = state.stats.kills;
  advance(state, attack.arriveAt);
  const report = state.reports.find((r) => r.type === 'savunma');
  const killed = Object.entries(report.attackerLosses).reduce((t, [id, n]) => t + n * UNITS[id].pop, 0);
  assert.equal(state.stats.kills - killsBefore, killed);
  assert.ok(state.news.some((n) => n.text.startsWith(`${attack.from.owner} → ${village.name}`)));
});

test('6. sürüm kayda istatistik ve haberler eklenir', () => {
  const { state } = game('baris');
  const v6 = structuredClone(state);
  v6.version = 6;
  delete v6.stats;
  delete v6.news;
  const migrated = migrate(v6);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.deepEqual(migrated.stats, { kills: 0, loot: 0 });
  assert.deepEqual(migrated.news, []);
});
