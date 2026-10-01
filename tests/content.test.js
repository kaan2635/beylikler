import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import { GAME } from '../js/config/game.js';
import { SEASONS, SEASON_DAYS } from '../js/config/seasons.js';
import { ILIM, ILIM_IDS } from '../js/config/ilim.js';
import { UNITS } from '../js/config/units.js';
import { BUILDINGS } from '../js/config/buildings.js';
import { DIPLOMACY, DIFFICULTIES } from '../js/config/lords.js';
import { EVENTS } from '../js/config/events.js';
import { productionPerHour, towerDefense } from '../js/core/formulas.js';
import { productionRates, storageCap } from '../js/systems/economy.js';
import { seasonOf } from '../js/systems/seasons.js';
import { inspectIlim } from '../js/systems/ilim.js';
import { inspectTraining } from '../js/systems/training.js';
import { siegeEngines } from '../js/systems/army.js';
import { spawnEvent, chooseEvent, EVENT_IDS } from '../js/systems/events.js';
import { relationOf, adjustRelation, relationLevel } from '../js/systems/diplomacy.js';
import { lordsOf } from '../js/systems/world.js';
import { sendAttack } from '../js/systems/movements.js';
import { SLOTS } from '../js/ui/art/scene.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function game({ difficulty = 'baris', seed = 3, events = true } = {}) {
  const state = createNewGame({ now: T0, seed, difficulty });
  if (!events) state.events = { disabled: true };
  return { state, village: state.villages[state.activeVillageId] };
}

function rich(village, buildings = {}) {
  Object.assign(village.buildings, { ambar: 20, ciftlik: 20, konak: 12, ...buildings });
  village.resources = { odun: 30000, kil: 30000, demir: 30000 };
}

function playable(state) {
  const store = { load: () => state, save() {}, clear() {} };
  const g = new Game(store);
  g.load(T0);
  return g;
}

// ---------- Mevsimler ----------

test('dünya ilkbaharla başlar; her mevsim SEASON_DAYS gün sürer ve etkisi üretime işler', () => {
  const { state, village } = game();
  advance(state, T0);
  assert.equal(seasonOf(state.world).id, 'ilkbahar');
  assert.ok(Math.abs(productionRates(village, state.world).odun - productionPerHour(1) * 1.1) < 1e-9);

  const events = advance(state, T0 + SEASON_DAYS * DAY + 1);
  assert.equal(seasonOf(state.world).id, 'yaz');
  assert.deepEqual(events.filter((e) => e.type === 'season').map((e) => e.season), ['yaz']);
  assert.ok(Math.abs(productionRates(village, state.world).odun - productionPerHour(1) * 1.15) < 1e-9, 'yazın odun +%15');

  advance(state, T0 + 4 * SEASON_DAYS * DAY + 1);
  assert.equal(seasonOf(state.world).id, 'ilkbahar', 'dört mevsim döner');
  assert.equal(SEASONS.length, 4);
});

test('mevsim sınırında üretim parça parça hesaplanır', () => {
  const { state, village } = game({ events: false });
  village.buildings.ambar = 30;
  village.resources = { odun: 0, kil: 0, demir: 0 };
  advance(state, T0);
  advance(state, T0 + SEASON_DAYS * DAY + 10 * HOUR);
  const spring = productionPerHour(1) * 1.1 * SEASON_DAYS * 24;
  const summer = productionPerHour(1) * 1.15 * 10;
  assert.ok(Math.abs(village.resources.odun - (spring + summer)) < 1e-6, `${village.resources.odun} ≠ ${spring + summer}`);
});

test('mevsimsiz dünyada etki ve mevsim olayı yoktur', () => {
  const { state, village } = game();
  state.world.seasons = false;
  const events = advance(state, T0 + 20 * DAY);
  assert.equal(seasonOf(state.world), null);
  assert.equal(events.filter((e) => e.type === 'season').length, 0);
  assert.equal(productionRates(village, state.world).odun, productionPerHour(1));
});

// ---------- Divan araştırmaları ----------

test('araştırma: Konak, önkoşul ve kaynak denetlenir; bitince etkisi işler', () => {
  const { state, village } = game();
  state.world.seasons = false;
  const g = playable(state);
  assert.equal(inspectIlim(state, village, state.world, 'bickihane', T0).code, 'konak');
  rich(village);
  assert.equal(inspectIlim(state, village, state.world, 'ambarmimarisi', T0).code, 'requires');

  const before = village.resources.odun;
  const result = g.startIlim('bickihane', T0);
  assert.ok(result.ok, result.reason);
  assert.equal(village.resources.odun, before - ILIM.bickihane.cost.odun);
  assert.equal(g.startIlim('sulama', T0).code, 'busy');

  const events = g.tick(T0 + result.duration * 1000);
  assert.ok(events.some((e) => e.type === 'ilim-complete' && e.ilim === 'bickihane'));
  assert.deepEqual(state.player.ilim.done, ['bickihane']);
  assert.ok(Math.abs(productionRates(village, state.world).odun - productionPerHour(1) * 1.1) < 1e-9);
  assert.equal(inspectIlim(state, village, state.world, 'bickihane', T0).code, 'done');
});

test('araştırma iptal edilince maliyet iade edilir', () => {
  const { state, village } = game();
  rich(village);
  const g = playable(state);
  const before = { ...village.resources };
  assert.ok(g.startIlim('sulama', T0).ok);
  assert.ok(g.cancelIlim(T0));
  assert.deepEqual(village.resources, before);
  assert.equal(state.player.ilim.current, null);
});

test('her araştırmanın önkoşulları var olan araştırmalardır ve kademeli Konak ister', () => {
  for (const id of ILIM_IDS) {
    for (const req of ILIM[id].requires) {
      assert.ok(ILIM[req], `${id} → ${req}`);
      assert.ok(ILIM[req].konak <= ILIM[id].konak, `${req} kademesi ${id}'den yüksek olmamalı`);
    }
  }
  for (const [unitId, unit] of Object.entries(UNITS)) {
    if (unit.ilim) assert.ok(ILIM[unit.ilim].unlocks?.includes(unitId), `${unitId} araştırmasıyla açılmalı`);
  }
});

test('Yeniçeri araştırmasız eğitilemez; araştırınca Kışla 12 ile eğitilir', () => {
  const { state, village } = game();
  rich(village, { kisla: 12 });
  const g = playable(state);
  const locked = inspectTraining(village, state.world, 'yeniceri', 1, T0);
  assert.equal(locked.code, 'requires');
  assert.match(locked.reason, /Yeniçeri Ocağı/);
  state.player.ilim.done.push('yeniceriocagi');
  g.tick(T0); // motor etkileri yeniler
  assert.ok(inspectTraining(village, state.world, 'yeniceri', 1, T0).ok);
});

test('Topçu suru ve binayı dört koçbaşı / mancınık gibi döver', () => {
  assert.deepEqual(siegeEngines({ topcu: 2, kocbasi: 1 }), { rams: 9, catapults: 8 });
  const { state, village } = game({ seed: 11 });
  state.world.clock.time = 30 * DAY;
  advance(state, T0);
  village.units.topcu = 6;
  village.units.baltaci = 400;
  const target = lordsOf(state.world.seed)[0];
  const sent = sendAttack(state, village, target.x, target.y, { topcu: 6, baltaci: 400 }, T0, { catapultTarget: 'ambar' });
  assert.ok(sent.ok, sent.reason);
  advance(state, sent.arriveAt);
  const report = state.reports.find((r) => r.type === 'saldiri');
  assert.ok(report.attackerWins);
  assert.ok(report.siege.wall.to < report.siege.wall.from || report.siege.wall.from === 0);
  assert.equal(report.siege.catapult.building, 'ambar');
});

// ---------- Gözetleme Kulesi ----------

test('Gözetleme Kulesi seviyesi savunmaya katılır; sahnede yeri vardır', () => {
  assert.ok(BUILDINGS.kule);
  assert.ok(SLOTS.kule);
  assert.equal(towerDefense(0), 0);
  assert.ok(Math.abs(towerDefense(10) - 0.15) < 1e-12);
});

// ---------- Olaylar ----------

test('ilk olay firstHours içinde gelir; karar verince kronikte kalır ve yenisi takvime girer', () => {
  const { state } = game();
  advance(state, T0);
  const first = state.events.nextAt;
  assert.ok(first >= T0 + EVENTS.firstHours[0] * HOUR && first <= T0 + EVENTS.firstHours[1] * HOUR);
  const events = advance(state, first);
  assert.ok(events.some((e) => e.type === 'event'));
  const pending = state.events.pending;
  assert.ok(pending && pending.choices.length >= 2);
  const free = pending.choices.find((c) => !Object.keys(c.cost).length && !c.disabled);
  const result = chooseEvent(state, free.id, first);
  assert.ok(result.ok, result.reason);
  assert.equal(state.events.pending, null);
  assert.ok(state.events.nextAt >= first + EVENTS.intervalHours[0] * HOUR);
  assert.equal(state.events.history[0].choice, free.label);
  assert.equal(state.stats.events, 1);
});

test('karar verilmezse süre dolunca olay kendi seyrine bırakılır', () => {
  const { state } = game();
  advance(state, T0);
  advance(state, state.events.nextAt);
  const { expiresAt, fallback } = state.events.pending;
  const events = advance(state, expiresAt);
  assert.ok(events.some((e) => e.type === 'event-expired'));
  assert.equal(state.events.pending, null);
  assert.equal(state.events.history[0].auto, true);
  assert.equal(state.stats.events ?? 0, 0, 'kendiliğinden çözülen olay karar sayılmaz');
  assert.ok(fallback);
});

test('her olay kurulabilir; seçenekleri ve kendi seyri geçerlidir', () => {
  const { state, village } = game({ difficulty: 'normal' });
  rich(village, { kisla: 5, demirmadeni: 5, sur: 2 });
  village.units.yaya = 200;
  advance(state, T0);
  state.world.clock.time = 5 * DAY;
  for (const id of EVENT_IDS) {
    state.events.pending = null;
    const event = spawnEvent(state, T0, id);
    assert.ok(event, id);
    const pending = state.events.pending;
    assert.equal(pending.type, id);
    assert.ok(pending.choices.some((c) => c.id === pending.fallback), `${id}: kendi seyri seçeneklerde`);
    for (const c of pending.choices) {
      for (const key of Object.keys(c.cost)) assert.ok(['odun', 'kil', 'demir', 'akce'].includes(key), `${id}: ${key}`);
    }
  }
});

test('olay etkisi geçicidir: süre dolunca üretim eski hâline döner', () => {
  const { state, village } = game();
  state.world.seasons = false;
  advance(state, T0);
  spawnEvent(state, T0, 'kup');
  assert.ok(chooseEvent(state, 'dagit', T0).ok);
  assert.ok(Math.abs(productionRates(village, state.world).odun - productionPerHour(1) * 1.15) < 1e-9);
  const until = state.player.modifiers[0].until;
  const events = advance(state, until + 1);
  assert.ok(events.some((e) => e.type === 'modifier-expired'));
  assert.equal(productionRates(village, state.world).odun, productionPerHour(1));
});

test('bedeli ödenemeyen seçenek reddedilir; haydutlara güçlü ordu yürürse ganimet gelir', () => {
  const { state, village } = game();
  advance(state, T0);
  state.player.akce = 0;
  spawnEvent(state, T0, 'dervis');
  assert.equal(chooseEvent(state, 'dua', T0).code, 'cost');

  state.events.pending = null;
  village.units.baltaci = 300;
  village.buildings.ambar = 10;
  const before = village.resources.odun;
  spawnEvent(state, T0, 'haydut');
  const result = chooseEvent(state, 'saldir', T0);
  assert.ok(result.ok, result.reason);
  assert.match(result.result, /dağıtıldı/);
  assert.ok(village.resources.odun > before);
  assert.equal(state.reports[0].target.name, 'Haydut çetesi');
});

// ---------- Diplomasi ----------

test('ilişki her gün sıfıra yaklaşır; hediye artırır, saldırı düşürür', () => {
  const { state, village } = game({ difficulty: 'normal' });
  rich(village);
  advance(state, T0);
  const lord = lordsOf(state.world.seed)[0];
  const g = playable(state);
  const gift = g.sendGift(lord.id, 'gorkemli', T0);
  assert.ok(gift.ok, gift.reason);
  assert.equal(relationOf(state, lord.id), 40);
  state.world.clock.time += 5 * DAY;
  assert.equal(relationOf(state, lord.id), 40 - 5 * DIPLOMACY.decayPerDay);
  adjustRelation(state, lord.id, DIPLOMACY.attackPenalty);
  assert.equal(relationOf(state, lord.id), 30 + DIPLOMACY.attackPenalty);
  assert.equal(relationLevel(-80).id, 'dusman');
  assert.equal(relationLevel(80).interval, Infinity);
});

test('barış antlaşması ilişki ve Akçe ister; barışta bey saldırmaz', () => {
  const { state, village } = game({ difficulty: 'zor' });
  rich(village);
  advance(state, T0);
  const g = playable(state);
  const lords = lordsOf(state.world.seed);
  assert.equal(g.makePeace(lords[0].id, T0).code, 'relation');
  for (const lord of lords) {
    village.resources = { odun: 30000, kil: 30000, demir: 30000 };
    adjustRelation(state, lord.id, 30);
    const peace = g.makePeace(lord.id, T0);
    assert.ok(peace.ok, peace.reason);
  }
  const events = g.tick(T0 + (DIPLOMACY.peace.days - 0.5) * DAY / state.world.speed);
  assert.equal(events.filter((e) => e.type === 'incoming-attack' && !e.invasion).length, 0, 'barışta saldırı yok');
  assert.equal(state.stats.treaties, lords.length);
});

test('müttefik bey hiç saldırmaz', () => {
  const { state } = game({ difficulty: 'zor' });
  advance(state, T0);
  for (const lord of lordsOf(state.world.seed)) adjustRelation(state, lord.id, 100);
  // İlişki günde 2 düşer; 10 günde müttefiklikten (70) düşmez.
  const events = advance(state, T0 + 10 * DAY);
  assert.equal(events.filter((e) => e.type === 'incoming-attack' && !e.invasion).length, 0);
  assert.ok(DIFFICULTIES.zor.attacks);
});

// ---------- Kayıt ----------

test('10. sürüm kayda araştırma, geçici etki ve diplomasi alanları eklenir', () => {
  const { state } = game();
  const v10 = structuredClone(state);
  v10.version = 10;
  delete v10.player.ilim;
  delete v10.player.modifiers;
  delete v10.diplomacy;
  const migrated = migrate(v10);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.deepEqual(migrated.player.ilim, { done: [], current: null });
  assert.deepEqual(migrated.player.modifiers, []);
  assert.deepEqual(migrated.diplomacy, {});
  assert.ok(storageCap(migrated.villages.v1) > 0);
});
