import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { travelSeconds } from '../js/core/formulas.js';
import { hash3, mulberry32 } from '../js/core/random.js';
import {
  barbarianAt,
  villageAt,
  terrainAt,
  nearbyBarbarians,
  villagePoints,
  continentOf,
  distance,
  worldDays,
} from '../js/systems/world.js';
import { WORLD } from '../js/config/world.js';
import { START, GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

function world(seed = 42, speed = 1) {
  const state = createNewGame({ now: T0, difficulty: 'baris', seed, speed });
  return { state, village: state.villages[state.activeVillageId] };
}

function barbariansIn(state, x0, y0, x1, y1) {
  const list = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const b = barbarianAt(state, x, y);
    if (b) list.push(b);
  }
  return list;
}

test('rastgele üreteçler deterministiktir', () => {
  assert.equal(hash3(1, 2, 3), hash3(1, 2, 3));
  assert.notEqual(hash3(1, 2, 3), hash3(1, 3, 2));
  const a = mulberry32(99);
  const b = mulberry32(99);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('aynı tohum aynı haritayı, farklı tohum farklı haritayı üretir', () => {
  const one = barbariansIn(world(7).state, 480, 480, 520, 520);
  const again = barbariansIn(world(7).state, 480, 480, 520, 520);
  const other = barbariansIn(world(8).state, 480, 480, 520, 520);
  assert.ok(one.length > 20, `yeterli köy yok: ${one.length}`);
  assert.deepEqual(one, again);
  assert.notDeepEqual(one.map((b) => b.id), other.map((b) => b.id));
});

test('barbar köyleri gölde, oyuncu köyünün dibinde ya da yerleşim sınırı dışında olmaz', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { state, village } = world(seed);
    for (const b of barbariansIn(state, 440, 440, 560, 560)) {
      assert.notEqual(terrainAt(seed, b.x, b.y), 'gol');
      assert.ok(distance(b.x, b.y, village.x, village.y) >= WORLD.ownVillageClearance);
      assert.ok(distance(b.x, b.y, WORLD.center, WORLD.center) <= WORLD.settledRadius);
    }
    assert.equal(barbarianAt(state, -1, 500), null);
    assert.equal(barbariansIn(state, 700, 700, 720, 720).length, 0, 'yabani topraklarda köy yok');
  }
});

test('her tohumda oyuncunun yakınında yağmalanacak köy bulunur', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { state, village } = world(seed);
    const near = nearbyBarbarians(state, village.x, village.y, 10);
    assert.ok(near.length >= 5, `tohum ${seed}: 10 alan içinde yalnızca ${near.length} köy`);
    assert.ok(near.every((b, i) => i === 0 || near[i - 1].distance <= b.distance), 'yakından uzağa sıralı');
  }
});

test('barbar köyleri dünya saatiyle büyür ama sınırı aşmaz', () => {
  const { state } = world(42);
  const sample = nearbyBarbarians(state, 500, 500, 12).slice(0, 10);
  let previous = sample.map((b) => b.points);
  for (const days of [3, 10, 30, 100, 1000]) {
    state.world.clock.time = days * DAY;
    const now = sample.map((b) => barbarianAt(state, b.x, b.y).points);
    now.forEach((p, i) => assert.ok(p >= previous[i], `${sample[i].name} küçüldü`));
    previous = now;
  }
  const maxed = barbarianAt(state, sample[0].x, sample[0].y);
  assert.ok(maxed.buildings.oduncu <= WORLD.barbarianMaxGrowth);
  assert.equal(maxed.name, sample[0].name, 'ad zamanla değişmez');
});

test('dünya saati dünya hızıyla işler; hız değişince geçmiş korunur', () => {
  const { state } = world(1, 2);
  advance(state, T0 + DAY);
  assert.equal(worldDays(state.world), 2);
  state.world.speed = 10;
  advance(state, T0 + 2 * DAY);
  assert.equal(worldDays(state.world), 12);
  advance(state, T0); // saat geri alınırsa dünya saati geri gitmez
  assert.equal(worldDays(state.world), 12);
});

test('villageAt oyuncu köyünü de döndürür; başlangıç köyü 39 puandır', () => {
  const { state, village } = world();
  const own = villageAt(state, village.x, village.y);
  assert.equal(own.kind, 'oyuncu');
  assert.equal(own.name, START.villageName);
  assert.equal(villagePoints(village.buildings), 39);
});

test('mesafe, kıta ve yolculuk süresi', () => {
  assert.equal(distance(500, 500, 503, 504), 5);
  assert.equal(continentOf(512, 487), 'K45');
  assert.equal(continentOf(0, 999), 'K90');
  assert.equal(travelSeconds(5, 18), 5 * 18 * 60);
  assert.equal(travelSeconds(5, 18, 10), 5 * 18 * 6);
});

test('2. sürüm kayda dünya saati eklenir, geçen süre ilk ilerlemede işlenir', () => {
  const { state } = world(3, 1);
  const v2 = structuredClone(state);
  v2.version = 2;
  delete v2.world.clock;
  const migrated = migrate(v2);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.deepEqual(migrated.world.clock, { time: 0, at: T0 });
  advance(migrated, T0 + 3 * DAY);
  assert.equal(worldDays(migrated.world), 3);
});
