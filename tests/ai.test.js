import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import { lordsOf, lordAt, barbarianAt, villageAt, terrainAt, distance, lordPower } from '../js/systems/world.js';
import { lordArmy, attackCap, incomingEstimate, setDifficulty, ensureLordSchedules } from '../js/systems/ai.js';
import { sendAttack } from '../js/systems/movements.js';
import { barbarianLive, barbarianGarrison } from '../js/systems/barbarians.js';
import { hiddenCapacity } from '../js/core/formulas.js';
import { LORD, PERSONALITIES, DIFFICULTIES } from '../js/config/lords.js';
import { WORLD } from '../js/config/world.js';
import { GAME } from '../js/config/game.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function game(difficulty = 'normal', seed = 11) {
  const state = createNewGame({ now: T0, seed, difficulty });
  return { state, village: state.villages[state.activeVillageId] };
}

/** İlk bey saldırısı yola çıkana kadar ilerletir; olayı ve saldırıyı döndürür. */
function untilFirstAttack(state, village) {
  advance(state, T0); // takvimi kur
  const first = Math.min(...Object.values(state.ai.lords).map((e) => e.nextAttackAt));
  const events = advance(state, first);
  return { first, event: events.find((e) => e.type === 'incoming-attack' && !e.invasion), attack: village.incoming[0] };
}

test('rakip beyler tohumdan belirlenir: 6 bey, her kişilikten ikişer, halkada, gölde değil', () => {
  for (const seed of [1, 2, 3, 42, 999]) {
    const lords = lordsOf(seed);
    assert.equal(lords.length, LORD.count);
    assert.deepEqual(lordsOf(seed), lords, 'aynı tohum aynı beyler');
    assert.equal(new Set(lords.map((l) => `${l.x}|${l.y}`)).size, lords.length, 'yerler farklı');
    assert.equal(new Set(lords.map((l) => l.name)).size, lords.length, 'adlar farklı');
    for (const kind of Object.keys(PERSONALITIES)) assert.equal(lords.filter((l) => l.personality === kind).length, 2);
    for (const lord of lords) {
      assert.notEqual(terrainAt(seed, lord.x, lord.y), 'gol');
      const d = distance(lord.x, lord.y, WORLD.center, WORLD.center);
      assert.ok(d >= LORD.ringMin - 5 && d <= LORD.ringMax + 5, `halka dışında: ${d}`);
    }
  }
});

test('bey hisarı haritada köy olarak görünür, o alanda barbar köyü olmaz', () => {
  const { state } = game();
  const lord = lordsOf(state.world.seed)[0];
  const village = villageAt(state, lord.x, lord.y);
  assert.equal(village.kind, 'bey');
  assert.equal(village.owner, `${lord.name} Bey`);
  assert.equal(village.name, `${lord.name} Hisarı`);
  assert.equal(barbarianAt(state, lord.x, lord.y), null);
  assert.deepEqual(lordAt(state, lord.x, lord.y), village);
});

test('beyin gücü günle artar ve sınırlıdır; ordusu güç ve zorlukla büyür, kişiliğe uyar', () => {
  const { state } = game();
  const lord = lordsOf(state.world.seed).find((l) => l.personality === 'saldirgan');
  const early = lordPower(lord, state.world);
  state.world.clock.time = 10 * DAY;
  assert.ok(lordPower(lord, state.world) > early);
  state.world.clock.time = 1000 * DAY;
  assert.equal(lordPower(lord, state.world), LORD.maxPower);

  const weak = lordArmy(lord, 3, DIFFICULTIES.normal);
  const strong = lordArmy(lord, 12, DIFFICULTIES.normal);
  const hard = lordArmy(lord, 12, DIFFICULTIES.zor);
  assert.ok(strong.baltaci > weak.baltaci && hard.baltaci > strong.baltaci);
  assert.ok(strong.kocbasi > 0 && !weak.kocbasi, 'saldırgan bey güçlenince koçbaşı getirir');
  const trader = lordsOf(state.world.seed).find((l) => l.personality === 'tuccar');
  const raid = lordArmy(trader, 12, DIFFICULTIES.normal);
  assert.ok(raid.akinci > (raid.baltaci ?? 0), 'tüccar bey akıncıyla gelir');
  assert.equal(lordArmy(lord, 12, DIFFICULTIES.baris).baltaci, undefined);
});

test('başlangıç korumasında saldırı olmaz; sonra saldırı yola çıkar, uyarı olayı gelir', () => {
  const { state, village } = game('normal');
  advance(state, T0);
  const protection = DIFFICULTIES.normal.protectionDays * DAY;
  for (const entry of Object.values(state.ai.lords)) assert.ok(entry.nextAttackAt >= T0 + protection);
  assert.deepEqual(advance(state, T0 + protection - 1).filter((e) => e.type === 'incoming-attack' && !e.invasion), []);

  const { event, attack } = untilFirstAttack(state, village);
  assert.equal(event.type, 'incoming-attack');
  assert.ok(attack && attack.arriveAt > event.at);
  assert.equal(event.arriveAt, attack.arriveAt);
  assert.ok(incomingEstimate(attack) > 0);
});

test('savunmasız köy yağmalanır; gizli depo korur; rapor savunma türündedir', () => {
  const { state, village } = game('normal');
  village.buildings.gizlidepo = 3;
  village.buildings.ambar = 10;
  village.resources = { odun: 5000, kil: 5000, demir: 5000 };
  const { attack } = untilFirstAttack(state, village);
  const [result] = advance(state, attack.arriveAt).filter((e) => e.type === 'defense-result');
  assert.equal(result.defended, false);
  const report = state.reports.find((r) => r.id === result.reportId);
  assert.equal(report.type, 'savunma');
  assert.ok(report.attackerWins);
  const taken = report.loot.odun + report.loot.kil + report.loot.demir;
  assert.ok(taken > 0);
  for (const id of ['odun', 'kil', 'demir']) assert.ok(village.resources[id] >= hiddenCapacity(3) - 1e-9, 'gizli depo korudu');
  assert.equal(village.incoming.length, 0);
});

test('güçlü savunma saldırıyı püskürtür; askerler kayıp verir ama kaynak gitmez', () => {
  const { state, village } = game('normal');
  village.units.kilicci = 300;
  village.units.yaya = 300;
  village.buildings.sur = 10;
  const { attack } = untilFirstAttack(state, village);
  const before = { ...village.resources };
  const [result] = advance(state, attack.arriveAt).filter((e) => e.type === 'defense-result');
  assert.equal(result.defended, true);
  const report = state.reports.find((r) => r.id === result.reportId);
  assert.deepEqual(report.attackerLosses, attack.units, 'saldıranların hepsi öldü');
  assert.equal(village.units.kilicci, 300 - (report.defenderLosses.kilicci ?? 0));
  assert.ok(village.resources.odun >= before.odun, 'yağma yok');
});

test('koçbaşılı güçlü saldırı kazanırsa oyuncunun surunu yıkar', () => {
  const { state, village } = game('zor');
  state.world.clock.time = 60 * DAY; // beyler güçlensin
  // Saldırı köyün büyüklüğüyle sınırlı: gelişmiş bir köy olsun ki tam ordu gelsin.
  Object.assign(village.buildings, { konak: 15, oduncu: 20, kilocagi: 20, demirmadeni: 20, ambar: 20, ciftlik: 15 });
  village.buildings.sur = 3;
  advance(state, T0);
  // Yalnızca saldırgan bir beyi hemen saldırtan bir takvim kur.
  const aggressor = lordsOf(state.world.seed).find((l) => l.personality === 'saldirgan');
  for (const [id, entry] of Object.entries(state.ai.lords)) entry.nextAttackAt = id === aggressor.id ? T0 + 1 : null;
  advance(state, T0 + 1);
  const attack = village.incoming[0];
  assert.ok(attack.units.kocbasi > 0);
  const [result] = advance(state, attack.arriveAt).filter((e) => e.type === 'defense-result');
  assert.equal(result.defended, false);
  assert.equal(result.siege.wall.from, 3);
  assert.ok(village.buildings.sur < 3);
});

test('Barış zorluğunda hiç saldırı olmaz; zorluk değişince takvim yeniden kurulur', () => {
  const { state, village } = game('baris');
  const events = advance(state, T0 + 60 * DAY);
  assert.equal(events.filter((e) => e.type === 'incoming-attack' && !e.invasion).length, 0);
  assert.equal(village.incoming.length, 0);

  const now = T0 + 60 * DAY;
  assert.ok(setDifficulty(state, 'zor', now));
  for (const entry of Object.values(state.ai.lords)) assert.ok(entry.nextAttackAt >= now + LORD.graceHours * HOUR);
  assert.equal(setDifficulty(state, 'olmayan', now), false);
});

test('dünya hızı artınca kalan bekleme aynı oranda kısalır', () => {
  const { state } = game('normal');
  const store = { load: () => structuredClone(state), save() {}, clear() {} };
  const g = new Game(store);
  g.load(T0);
  const before = Object.values(g.state.ai.lords).map((e) => e.nextAttackAt - T0);
  g.setSpeed(10, T0);
  Object.values(g.state.ai.lords).forEach((e, i) => assert.ok(Math.abs(e.nextAttackAt - T0 - before[i] / 10) < 1));
});

test('oyuncu bey hisarına saldırabilir; hisar kişiliğe göre garnizon besler; intikamcı bey erken gelir', () => {
  const { state, village } = game('normal');
  advance(state, T0);
  const defender = lordsOf(state.world.seed).find((l) => l.personality === 'savunmaci');
  const hisar = lordAt(state, defender.x, defender.y);
  assert.deepEqual(barbarianLive(state, hisar).units, barbarianGarrison(hisar.growth, PERSONALITIES.savunmaci.garrisonFactor));

  village.units.baltaci = 500;
  const plannedBefore = state.ai.lords[defender.id].nextAttackAt;
  const sent = sendAttack(state, village, defender.x, defender.y, { baltaci: 500 }, T0);
  assert.ok(sent.ok, sent.reason);
  advance(state, sent.arriveAt);
  const report = state.reports.find((r) => r.type === 'saldiri');
  assert.equal(report.target.kind, 'bey');
  assert.equal(report.target.owner, `${defender.name} Bey`);
  const revengeBy = sent.arriveAt + LORD.revengeHours * HOUR;
  assert.ok(state.ai.lords[defender.id].nextAttackAt <= Math.min(plannedBefore, revengeBy));
});

test('5. sürüm kayda yapay zekâ eklenir; eski oyuncuya hemen saldırılmaz', () => {
  const { state } = game('baris');
  state.world.clock.time = 30 * DAY; // koruma çoktan bitmiş eski bir oyun
  const v5 = structuredClone(state);
  v5.version = 5;
  delete v5.ai;
  delete v5.villages.v1.incoming;
  const migrated = migrate(v5);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.deepEqual(migrated.ai, { difficulty: 'normal', lords: {} });
  assert.deepEqual(migrated.villages.v1.incoming, []);
  ensureLordSchedules(migrated, T0);
  for (const entry of Object.values(migrated.ai.lords)) assert.ok(entry.nextAttackAt >= T0 + LORD.graceHours * HOUR);
});

test('saldırılar arasında en az minGapHours geçer; beyler sırayla gelir', () => {
  for (const difficulty of ['kolay', 'normal', 'zor']) {
    const { state } = game(difficulty, 7);
    advance(state, T0); // takvimi kur
    const launched = advance(state, T0 + 40 * DAY)
      .filter((e) => e.type === 'incoming-attack' && !e.invasion)
      .map((e) => e.at);
    assert.ok(launched.length > 0, `${difficulty}: hiç saldırı yok`);
    const gap = DIFFICULTIES[difficulty].minGapHours * HOUR;
    for (let i = 1; i < launched.length; i++) assert.ok(launched[i] - launched[i - 1] >= gap - 1, `${difficulty}: aralık kısa`);
  }
  // Zorluk sırası: kolay < normal < zor
  const count = (d) => {
    const { state } = game(d, 7);
    advance(state, T0);
    return advance(state, T0 + 40 * DAY).filter((e) => e.type === 'incoming-attack' && !e.invasion).length;
  };
  assert.ok(count('kolay') < count('normal') && count('normal') < count('zor'));
});

test('saldırı gücü hedef köyün büyüklüğüyle sınırlıdır; zayıf beyin ordusu sınırın altında kalır', () => {
  const lord = lordsOf(11).find((l) => l.personality === 'saldirgan');
  const strength = (units) => Object.entries(units).reduce((s, [id, n]) => s + (id === 'kocbasi' ? 0 : n * ({ baltaci: 40, akinci: 30 }[id] ?? 0)), 0);
  const small = lordArmy(lord, 20, DIFFICULTIES.normal, attackCap(39));
  const big = lordArmy(lord, 20, DIFFICULTIES.normal, attackCap(2000));
  assert.ok(strength(small) <= attackCap(39) * 1.15, 'küçük köye küçük ordu');
  assert.ok(strength(big) > strength(small) * 5);
  assert.ok((small.kocbasi ?? 0) < (big.kocbasi ?? 0), 'koçbaşı da sınırla azalır');
  const weak = lordArmy(lord, 3, DIFFICULTIES.normal, attackCap(2000));
  assert.deepEqual(weak, lordArmy(lord, 3, DIFFICULTIES.normal), 'sınırın altındaki ordu değişmez');

  // Yeni oyunda ilk saldırı küçük köye göre gelir.
  const { state, village } = game('normal');
  state.world.clock.time = 30 * DAY;
  const { attack } = untilFirstAttack(state, village);
  assert.ok(incomingEstimate(attack) <= attackCap(39) * 1.5);
});

test('intikam saldırısı sırayı beklemez', () => {
  const { state, village } = game('normal');
  advance(state, T0);
  const defender = lordsOf(state.world.seed).find((l) => l.personality === 'savunmaci');
  state.ai.lastAttackAt = T0; // az önce bir saldırı yola çıkmış olsun
  village.units.baltaci = 500;
  const sent = sendAttack(state, village, defender.x, defender.y, { baltaci: 500 }, T0);
  assert.ok(sent.ok, sent.reason);
  const events = advance(state, sent.arriveAt + LORD.revengeHours * HOUR);
  const revenge = events.find((e) => e.type === 'incoming-attack' && e.attacker === `${defender.name} Bey`);
  assert.ok(revenge, 'intikamcı bey aralığı beklemeden saldırdı');
});

test('9. sürüm kayıtta bey saldırı takvimleri yeniden kurulur; fethedilen bey dokunulmaz', () => {
  const { state } = game('normal');
  advance(state, T0);
  const ids = Object.keys(state.ai.lords);
  state.ai.lords[ids[0]].defeated = true;
  state.ai.lords[ids[0]].nextAttackAt = null;
  state.ai.lords[ids[1]].nextAttackAt = T0 + 1;
  const v9 = structuredClone(state);
  v9.version = 9;
  const migrated = migrate(v9);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.equal(migrated.ai.lords[ids[0]].defeated, true);
  assert.equal(migrated.ai.lords[ids[1]].nextAttackAt, undefined);
  ensureLordSchedules(migrated, T0);
  assert.ok(migrated.ai.lords[ids[1]].nextAttackAt >= T0 + LORD.graceHours * HOUR);
});
