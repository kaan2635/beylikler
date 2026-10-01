import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import {
  playerBonus,
  syncBonuses,
  chooseClass,
  changeClass,
  hireOfficer,
  finishCost,
  finishBuilding,
  finishResearch,
  buyResourcePack,
  grantAkce,
} from '../js/systems/premium.js';
import { bonusOf } from '../js/systems/bonus.js';
import { productionRates, storageCap } from '../js/systems/economy.js';
import { inspectUpgrade, startUpgrade, maxBuildQueue } from '../js/systems/construction.js';
import { inspectTraining } from '../js/systems/training.js';
import { startResearch } from '../js/systems/research.js';
import { inspectAttack, sendAttack } from '../js/systems/movements.js';
import { merchantCapacity } from '../js/systems/market.js';
import { nearbyBarbarians } from '../js/systems/world.js';
import { PREMIUM, CLASSES, OFFICERS } from '../js/config/classes.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function game() {
  const state = createNewGame({ now: T0, seed: 5, difficulty: 'baris' });
  state.world.seasons = false; // yalnız sınıf ve görevli etkileri
  return { state, village: state.villages.v1 };
}

test('yeni oyunda sınıf seçilmemiştir ve başlangıç Akçesi vardır', () => {
  const { state } = game();
  assert.equal(state.player.class, null);
  assert.equal(state.player.akce, PREMIUM.startAkce);
  assert.deepEqual(playerBonus(state.player).production, 1);
});

test('sınıf seçimi: etkiler köylere işler; seçim bir kez ücretsiz', () => {
  const { state, village } = game();
  const before = productionRates(village, state.world).odun;
  assert.equal(chooseClass(state, 'yok', {}, T0).ok, false);
  const result = chooseClass(state, 'tuccar', { playerName: '  Osman  ', villageName: 'Söğüt' }, T0);
  assert.ok(result.ok);
  assert.equal(state.player.name, 'Osman');
  assert.equal(village.name, 'Söğüt');
  assert.ok(Math.abs(productionRates(village, state.world).odun - before * 1.2) < 1e-9);
  assert.equal(merchantCapacity(village), 1500);
  assert.equal(chooseClass(state, 'serdar', {}, T0).code, 'chosen');
  // Kayıt JSON'unda bonus yok; yeniden yüklenince motor yeniler.
  assert.equal(JSON.stringify(village).includes('"bonus"'), false);
  const copy = JSON.parse(JSON.stringify(state));
  assert.equal(bonusOf(copy.villages.v1).production, 1);
  advance(copy, T0);
  assert.equal(bonusOf(copy.villages.v1).production, 1.2);
});

test('sınıf değiştirmek Akçe ister', () => {
  const { state } = game();
  chooseClass(state, 'serdar', {}, T0);
  state.player.akce = 100;
  assert.equal(changeClass(state, 'kasif', T0).code, 'akce');
  assert.equal(changeClass(state, 'serdar', T0).code, 'same');
  state.player.akce = 600;
  assert.ok(changeClass(state, 'kasif', T0).ok);
  assert.equal(state.player.class, 'kasif');
  assert.equal(state.player.akce, 100);
  assert.equal(state.player.akceLog[0].amount, -PREMIUM.classChangeCost);
});

test('Serdar: yolculuk kısalır, saldırı güçlenir, eğitim hızlanır', () => {
  const { state, village } = game();
  village.buildings.kisla = 5;
  village.units.baltaci = 100;
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  const plain = inspectAttack(state, village, target.x, target.y, { baltaci: 100 }, T0);
  const train = inspectTraining(village, state.world, 'yaya', 1, T0).unitSeconds;
  chooseClass(state, 'serdar', {}, T0);
  const boosted = inspectAttack(state, village, target.x, target.y, { baltaci: 100 }, T0);
  assert.equal(boosted.seconds, Math.round(plain.seconds * 0.75));
  assert.ok(Math.abs(boosted.attack - plain.attack * 1.1) < 1e-9);
  assert.equal(inspectTraining(village, state.world, 'yaya', 1, T0).unitSeconds, Math.round(train * 0.85));
});

test('görevliler: Vezir kuyruğu büyütür; süre dolunca motor görevliyi gönderir ve üretim eski hâline döner', () => {
  const { state, village } = game();
  assert.equal(maxBuildQueue(village), 2);
  const hired = hireOfficer(state, 'vezir', T0);
  assert.ok(hired.ok);
  assert.equal(hired.until, T0 + PREMIUM.officerDays * DAY);
  assert.equal(state.player.akce, PREMIUM.startAkce - OFFICERS.vezir.cost);
  assert.equal(maxBuildQueue(village), 3);

  // Uzatma: süre kalan sürenin üstüne eklenir.
  grantAkce(state, 1000, 'test', T0);
  hireOfficer(state, 'vezir', T0 + DAY);
  assert.equal(state.player.officers.vezir, T0 + 2 * PREMIUM.officerDays * DAY);

  // Defterdar üretimi artırır; süresi dolunca biter.
  hireOfficer(state, 'defterdar', T0);
  const boosted = productionRates(village, state.world).odun;
  const events = advance(state, T0 + PREMIUM.officerDays * DAY + HOUR);
  assert.ok(events.some((e) => e.type === 'officer-expired' && e.officer === 'defterdar'));
  assert.equal(state.player.officers.defterdar, undefined);
  assert.ok(Math.abs(productionRates(village, state.world).odun - boosted / 1.1) < 1e-9);
  assert.equal(maxBuildQueue(village), 3, 'Vezir hâlâ görevde');
});

test('görevli bitişinde üretim parça parça hesaplanır', () => {
  const { state, village } = game();
  village.buildings.ambar = 30; // ambar dolmasın
  village.resources.odun = 0;
  hireOfficer(state, 'defterdar', T0);
  const until = state.player.officers.defterdar;
  const rate = productionRates(village, state.world).odun; // bonuslu, saatlik
  advance(state, until + 10 * HOUR);
  const expected = rate * ((until - T0) / HOUR) + (rate / 1.1) * 10;
  assert.ok(Math.abs(village.resources.odun - expected) < 1e-6);
});

test('anında bitirme: bedel kalan oyun süresine göre; arkadaki işler öne kayar', () => {
  const { state, village } = game();
  assert.equal(finishCost(0, state.world), PREMIUM.finishMinCost);
  assert.equal(finishCost(HOUR, state.world), 20);
  assert.equal(finishCost(HOUR, { speed: 2 }), 40);

  village.resources = { odun: 10_000, kil: 10_000, demir: 10_000 };
  village.buildings.ambar = 10;
  const first = startUpgrade(village, state.world, 'oduncu', T0);
  const second = startUpgrade(village, state.world, 'kilocagi', T0);
  assert.ok(first.ok && second.ok);
  const secondDuration = village.buildQueue[1].endAt - village.buildQueue[1].startAt;
  const cost = finishCost(village.buildQueue[0].endAt - T0, state.world);
  const result = finishBuilding(state, village, T0);
  assert.ok(result.ok);
  assert.equal(result.cost, cost);
  assert.equal(village.buildQueue[0].endAt, T0);
  assert.equal(village.buildQueue[1].startAt, T0);
  assert.equal(village.buildQueue[1].endAt - village.buildQueue[1].startAt, secondDuration);
  advance(state, T0);
  assert.equal(village.buildings.oduncu, 2);

  state.player.akce = 0;
  assert.equal(finishBuilding(state, village, T0).code, 'akce');
});

test('Demirci geliştirmesi ve kaynak paketi', () => {
  const { state, village } = game();
  village.buildings.demirci = 1;
  village.buildings.kisla = 1;
  village.buildings.ambar = 10;
  village.resources = { odun: 5000, kil: 5000, demir: 5000 };
  assert.ok(startResearch(village, state.world, 'yaya', T0).ok);
  assert.ok(finishResearch(state, village, T0).ok);
  advance(state, T0);
  assert.equal(village.tech.yaya, 1);

  village.resources = { odun: 0, kil: 0, demir: storageCap(village) };
  state.player.akce = 500;
  const pack = buyResourcePack(state, village, T0);
  assert.ok(pack.ok);
  assert.equal(pack.stored.odun, Math.floor(storageCap(village) * 0.25));
  assert.equal(pack.stored.demir, 0);
  village.resources = { odun: storageCap(village), kil: storageCap(village), demir: storageCap(village) };
  assert.equal(buyResourcePack(state, village, T0).code, 'full');
});

test('fetih ve savunma zaferi Akçe kazandırır', () => {
  const { state, village } = game();
  Object.assign(village.buildings, { saray: 5, ambar: 20, ciftlik: 25 });
  village.units.elci = 5;
  village.units.baltaci = 500;
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  const sent = sendAttack(state, village, target.x, target.y, { elci: 5, baltaci: 500 }, T0);
  advance(state, sent.arriveAt);
  const conquest = state.player.akceLog.find((e) => /Fetih/.test(e.reason));
  assert.equal(conquest.amount, PREMIUM.rewards.conquest);
});

test('eski kayıt 8. sürüme taşınır: sınıf seçilmemiş, başlangıç Akçesi verilmiş', () => {
  const { state } = game();
  const old = JSON.parse(JSON.stringify(state));
  old.version = 7;
  old.player = { name: 'Orhan' };
  const migrated = migrate(old);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.equal(migrated.player.name, 'Orhan');
  assert.equal(migrated.player.class, null);
  assert.equal(migrated.player.akce, PREMIUM.startAkce);
});

test('Game: yağma asistanı toplu gönderim Serasker ister', () => {
  const { state, village } = game();
  village.units.baltaci = 50;
  const target = nearbyBarbarians(state, village.x, village.y, 10)[0];
  const sent = sendAttack(state, village, target.x, target.y, { baltaci: 10 }, T0);
  advance(state, sent.movement.arriveAt + (sent.arriveAt - T0));
  const g = new Game({ load: () => structuredClone(state), save() {}, clear() {} });
  const now = sent.arriveAt * 2;
  g.load(now);
  const reportId = g.state.reports[0].id;
  assert.equal(g.repeatAttacks([reportId], now).ok, false);
  assert.ok(g.hireOfficer('serasker', now).ok);
  const result = g.repeatAttacks([reportId], now);
  assert.equal(result.sent, 1, result.reason);
  assert.ok(CLASSES.kasif.bonus.expeditionSlots >= 1);
});
