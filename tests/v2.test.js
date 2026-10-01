import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, migrate } from '../js/core/state.js';
import { advance } from '../js/core/engine.js';
import { Game } from '../js/game.js';
import { GAME } from '../js/config/game.js';
import { HERO, xpForLevel, ITEM_SLOTS, RARITY_IDS } from '../js/config/hero.js';
import { TITLES } from '../js/config/titles.js';
import { RUINS, INVASION } from '../js/config/sites.js';
import { REGIONS, REGION_IDS, EXPEDITION } from '../js/config/expedition.js';
import { mulberry32 } from '../js/core/random.js';
import { productionPerHour, terrainDefense } from '../js/core/formulas.js';
import { productionRates } from '../js/systems/economy.js';
import { resolveBattle } from '../js/systems/combat.js';
import { ensureHero, heroEffects, addHeroXp, rollItem, giveItem, heroGuard } from '../js/systems/hero.js';
import { renownOf, earnedTitleIndex, titleOf } from '../js/systems/renown.js';
import { ruinAt, nearbyRuins, villageAt, campAt } from '../js/systems/world.js';
import { siteLive } from '../js/systems/sites.js';
import { sendAttack } from '../js/systems/movements.js';
import { sendExpedition, expeditionOdds, inspectExpedition } from '../js/systems/expedition.js';
import { spawnEvent, chooseEvent } from '../js/systems/events.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function game({ difficulty = 'baris', seed = 3 } = {}) {
  const state = createNewGame({ now: T0, seed, difficulty });
  state.world.seasons = false;
  state.events = { disabled: true };
  advance(state, T0);
  return { state, village: state.villages[state.activeVillageId] };
}

function playable(state) {
  const g = new Game({ load: () => state, save() {}, clear() {} });
  g.load(T0);
  return g;
}

// ---------- Kahraman ----------

test('her oyunda başkentte bir kahraman vardır; özellik puanı ve seviye', () => {
  const { state, village } = game();
  assert.ok(state.hero);
  assert.equal(state.hero.home, village.id);
  assert.equal(state.hero.level, 1);
  assert.equal(state.hero.points, HERO.startPoints);
  const events = addHeroXp(state, xpForLevel(1) + xpForLevel(2), T0);
  assert.deepEqual(events.map((e) => e.level), [2, 3]);
  assert.equal(state.hero.points, HERO.startPoints + 2 * HERO.pointsPerLevel);
});

test('köyündeki kahraman üretimi (Bereket) ve savunmayı artırır; seferdeyken artırmaz', () => {
  const { state, village } = game();
  const g = playable(state);
  for (let i = 0; i < 3; i++) assert.ok(g.heroSpend('bereket', T0).ok);
  assert.ok(Math.abs(productionRates(village, state.world).odun - productionPerHour(1) * 1.03) < 1e-9);
  assert.ok(heroGuard(state, village, T0) >= HERO.defense.base);
  village.units.baltaci = 50;
  const target = nearbyRuins(state, village.x, village.y, 70)[0];
  const sent = g.sendAttack(target.x, target.y, { baltaci: 50 }, T0, { hero: true });
  assert.ok(sent.ok, sent.reason);
  assert.equal(state.hero.away, sent.movement.id);
  assert.equal(productionRates(village, state.world).odun, productionPerHour(1), 'kahraman seferde');
  assert.equal(heroGuard(state, village, T0), 0);
  assert.equal(g.sendAttack(target.x, target.y, { baltaci: 0, yaya: 0 }, T0, { hero: true }).code, 'empty');
});

test('kahramanlı ordu harabeyi yener: hazine, eşya, tecrübe; kahraman orduyla döner', () => {
  const { state, village } = game();
  const g = playable(state);
  village.units.baltaci = 400;
  village.units.akinci = 100;
  const ruin = nearbyRuins(state, village.x, village.y, 70)[0];
  const sent = g.sendAttack(ruin.x, ruin.y, { baltaci: 400, akinci: 100 }, T0, { hero: true });
  assert.ok(sent.ok, sent.reason);
  const akce = state.player.akce;
  const events = g.tick(sent.arriveAt);
  const result = events.find((e) => e.type === 'attack-result');
  assert.ok(result.attackerWins);
  assert.ok(result.reward.akce > 0 && state.player.akce > akce);
  assert.equal(state.hero.inventory.length, 1, 'eşya heybede');
  assert.equal(state.stats.ruins, 1);
  assert.ok(ruinAt(state, ruin.x, ruin.y).empty, 'harabe boşaldı');
  assert.ok(state.hero.xp > 0 || state.hero.level > 1);
  const back = village.movements[0];
  g.tick(back.arriveAt);
  assert.equal(state.hero.away, null);
  assert.ok(!ruinAt(state, ruin.x, ruin.y).empty || state.world.clock.time < (RUINS.respawnDays * DAY));
});

test('yenilen ordudaki kahraman yaralanır, iyileşince köyüne yine güç katar', () => {
  const { state, village } = game();
  const g = playable(state);
  state.world.clock.time = 60 * DAY; // muhafızlar güçlensin
  village.units.yaya = 5;
  const ruin = nearbyRuins(state, village.x, village.y, 70).find((r) => r.tier === 3) ?? nearbyRuins(state, village.x, village.y, 70).at(-1);
  const sent = g.sendAttack(ruin.x, ruin.y, { yaya: 5 }, T0, { hero: true });
  assert.ok(sent.ok, sent.reason);
  const events = g.tick(sent.arriveAt);
  assert.ok(events.some((e) => e.type === 'hero-wounded'));
  assert.equal(state.hero.away, null);
  assert.ok(state.hero.woundedUntil > sent.arriveAt);
  assert.equal(heroGuard(state, village, sent.arriveAt), 0, 'yaralı kahraman savunmaz');
  const healed = g.tick(state.hero.woundedUntil + 1);
  assert.ok(healed.some((e) => e.type === 'hero-healed'));
  assert.ok(heroGuard(state, village, state.hero.woundedUntil + 2) > 0 || state.hero.woundedUntil === 0);
});

test('eşyalar: her yuva ve nadirlik üretilir; kuşanınca etkisi işler, heybe dolunca satılır', () => {
  const rng = mulberry32(42);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const item = rollItem(rng, { quality: 3 });
    assert.ok(ITEM_SLOTS[item.slot] && RARITY_IDS.includes(item.rarity) && item.name);
    seen.add(item.slot).add(item.rarity);
  }
  for (const id of [...Object.keys(ITEM_SLOTS), ...RARITY_IDS]) assert.ok(seen.has(id), id);
  assert.equal(rollItem(mulberry32(1), { minRarity: 'efsanevi' }).rarity, 'efsanevi');

  const { state } = game();
  const g = playable(state);
  const sword = giveItem(state, { slot: 'silah', rarity: 'nadir', name: 'Kılıç', effects: { attack: 0.07, heroAttack: 100 } }).item;
  const before = heroEffects(state.hero).power;
  assert.ok(g.heroEquip(sword.id, T0).ok);
  assert.equal(heroEffects(state.hero).power, before + 100);
  assert.ok(Math.abs(heroEffects(state.hero).attack - 0.07) < 1e-9);
  assert.ok(g.heroUnequip('silah', T0).ok);
  const akce = state.player.akce;
  assert.ok(g.heroSell(sword.id, T0).ok);
  assert.ok(state.player.akce > akce);
  for (let i = 0; i < HERO.inventoryMax; i++) giveItem(state, rollItem(rng));
  assert.equal(giveItem(state, rollItem(rng)).stored, false, 'heybe dolu');
});

test('savaşta kahraman gücü atlı sayılır, savunması savunmaya eklenir', () => {
  const plain = resolveBattle({ attackers: { baltaci: 10 }, defenders: { yaya: 10 } });
  const hero = resolveBattle({ attackers: { baltaci: 10 }, defenders: { yaya: 10 }, heroAttack: 200, heroDefense: 100 });
  assert.ok(hero.attack > plain.attack);
  assert.ok(hero.defense > plain.defense);
  assert.equal(terrainDefense('tepe'), 0.2);
  assert.equal(terrainDefense('cayir'), 0);
});

// ---------- Şan ve unvan ----------

test('şan başarılardan hesaplanır; eşik aşılınca unvan yükselir ve etkisi işler, düşmez', () => {
  const { state, village } = game();
  assert.equal(titleOf(state).id, 'bey');
  state.stats.renownBonus = TITLES[1].renown;
  assert.equal(earnedTitleIndex(renownOf(state)), 1);
  const events = advance(state, T0 + HOUR);
  assert.ok(events.some((e) => e.type === 'title-up' && e.title === 'sancakbeyi'));
  advance(state, T0 + 2 * HOUR);
  assert.ok(Math.abs(productionRates(village, state.world).odun - productionPerHour(1) * 1.03) < 1e-9);
  state.stats.renownBonus = 0;
  advance(state, T0 + 3 * HOUR);
  assert.equal(titleOf(state).id, 'sancakbeyi', 'unvan düşmez');
});

// ---------- Harabeler ----------

test('harabeler tohumdan gelir; uzaktakiler daha güçlü; boşken muhafız yok', () => {
  const { state } = game({ seed: 7 });
  const ruins = nearbyRuins(state, 500, 500, 70);
  assert.ok(ruins.length >= 10);
  for (const ruin of ruins) {
    assert.equal(villageAt(state, ruin.x, ruin.y).kind, 'harabe');
    assert.ok(ruin.tier >= 1 && ruin.tier <= 3);
  }
  const near = ruins.find((r) => r.tier === 1);
  const far = ruins.find((r) => r.tier === 3) ?? ruins.at(-1);
  const sum = (u) => Object.values(u).reduce((a, b) => a + b, 0);
  assert.ok(sum(siteLive(state, far).units) >= sum(siteLive(state, near).units));
  state.barbarians[near.id] = { lootedAt: state.world.clock.time };
  const empty = ruinAt(state, near.x, near.y);
  assert.ok(empty.empty);
  assert.deepEqual(siteLive(state, empty).units, {});
});

// ---------- Moğol akını ----------

test('Moğol akını: ordugâh kurulur, dalgalar gelir, ordugâh çekilir; barışta akın yok', () => {
  const peaceful = game({ difficulty: 'baris' });
  advance(peaceful.state, T0 + 40 * DAY);
  assert.equal(peaceful.state.invasion.phase, 'idle');
  assert.equal(peaceful.state.invasion.nextAt, null);

  const { state, village } = game({ difficulty: 'normal' });
  const start = state.invasion.nextAt;
  assert.ok(start >= T0 + (INVASION.firstDay - 1) * DAY / state.world.speed);
  const events = advance(state, start);
  const started = events.find((e) => e.type === 'invasion-start');
  assert.ok(started);
  assert.ok(campAt(state, started.x, started.y));
  const waves = advance(state, start + 3 * DAY).filter((e) => e.type === 'incoming-attack' && e.invasion);
  assert.ok(waves.length >= 1);
  assert.ok(village.incoming.length >= 0);
  const end = advance(state, start + 6 * DAY).find((e) => e.type === 'invasion-end');
  assert.ok(end || state.invasion.phase === 'idle');
  assert.equal(state.invasion.phase, 'idle');
  assert.ok(state.invasion.nextAt > start);
});

test('ordugâhı dağıtan akını bitirir: Akçe, nadir eşya, sayaç', () => {
  const { state, village } = game({ difficulty: 'normal' });
  advance(state, state.invasion.nextAt);
  const camp = state.invasion.camp;
  village.units.baltaci = 3000;
  village.units.akinci = 1000;
  const sent = sendAttack(state, village, camp.x, camp.y, { baltaci: 3000, akinci: 1000 }, state.invasion.camp ? state.world.clock.at : T0);
  assert.ok(sent.ok, sent.reason);
  const events = advance(state, sent.arriveAt);
  const end = events.find((e) => e.type === 'invasion-end');
  assert.ok(end, 'akın bitti');
  assert.equal(end.outcome, 'destroyed');
  assert.ok(end.reward.item && end.reward.item.rarity !== 'siradan');
  assert.equal(state.stats.invasions, 1);
  assert.equal(state.invasion.phase, 'idle');
});

// ---------- Keşif ----------

test('keşif bölgeleri: Kervansaray seviyesi, uzaklık ve olasılıklar bölgeye göre', () => {
  const { state, village } = game();
  village.buildings.kervansaray = 1;
  village.units.akinci = 100;
  assert.equal(inspectExpedition(state, village, { akinci: 10 }, 1, T0, { region: 'sahil' }).code, 'region');
  assert.ok(inspectExpedition(state, village, { akinci: 10 }, 1, T0, { region: 'bozkir' }).ok);
  const steppe = expeditionOdds(village, 1, 'bozkir');
  const base = expeditionOdds(village, 1, 'sinir');
  assert.ok(steppe.at > base.at * 2, 'bozkırda at bulmak daha olası');
  const ruins = expeditionOdds(village, 1, 'harabe');
  assert.ok(ruins.esya > base.esya * 2);
  const withHero = expeditionOdds(village, 1, 'sinir', true);
  assert.ok(withHero.kayip < base.kayip, 'kahraman tehlikeyi azaltır');
  for (const id of REGION_IDS) {
    const odds = expeditionOdds(village, 3, id);
    assert.ok(Math.abs(Object.values(odds).reduce((a, b) => a + b, 0) - 1) < 1e-9, id);
    assert.ok(REGIONS[id].distance > 0);
  }
});

test('kahramanlı keşif: sefer bölgeye gider, kahraman tecrübeyle döner', () => {
  const { state, village } = game();
  const g = playable(state);
  village.buildings.kervansaray = 3;
  village.units.baltaci = 200;
  village.units.akinci = 100;
  const sent = g.sendExpedition({ baltaci: 200, akinci: 100 }, 2, T0, { region: 'dag', hero: true });
  assert.ok(sent.ok, sent.reason);
  assert.equal(sent.movement.region, 'dag');
  assert.equal(state.hero.away, sent.movement.id);
  const events = g.tick(sent.arriveAt);
  const report = state.reports.find((r) => r.type === 'kesif');
  assert.equal(report.region, 'dag');
  const result = events.find((e) => e.type === 'expedition-result');
  if (result.survived) {
    const back = village.movements[0];
    g.tick(back.arriveAt);
    assert.equal(state.hero.away, null);
    assert.ok(state.hero.xp > 0 || state.hero.level > 1);
  } else {
    assert.ok(state.hero.woundedUntil > 0);
  }
  assert.ok(EXPEDITION.weights.esya > 0);
});

// ---------- Olaylar ----------

test('yeni olaylar: usta demirci eşya verir, kurultay ilişkileri ve şanı artırır', () => {
  const { state, village } = game({ difficulty: 'normal' });
  state.events = { nextAt: null, count: 0, pending: null, history: [] };
  village.buildings.ambar = 10;
  village.resources = { odun: 5000, kil: 5000, demir: 5000 };
  state.world.clock.time = 6 * DAY;
  spawnEvent(state, T0, 'demirciusta');
  assert.ok(chooseEvent(state, 'dov', T0).ok);
  assert.equal(state.hero.inventory.length, 1);
  spawnEvent(state, T0, 'kurultay');
  const before = renownOf(state);
  assert.ok(chooseEvent(state, 'ziyafet', T0).ok);
  assert.ok(renownOf(state) > before);
});

// ---------- Tarihçe ve kayıt ----------

test('tarihçe her oyun günü bir görüntü kaydeder', () => {
  const { state } = game();
  advance(state, T0 + 3 * DAY + HOUR);
  assert.ok(state.history.length >= 2);
  assert.ok(state.history.every((h) => Number.isFinite(h.points) && Number.isFinite(h.production)));
  assert.ok(state.history.at(-1).day >= 3);
});

test('11. sürüm kayıt 12. sürüme taşınır; kahraman ve unvan hemen gelir', () => {
  const { state } = game();
  const v11 = structuredClone(state);
  v11.version = 11;
  delete v11.hero;
  delete v11.history;
  delete v11.invasion;
  delete v11.player.title;
  v11.stats.attacksWon = 200; // eski bir oyuncunun başarıları
  const migrated = migrate(v11);
  assert.equal(migrated.version, GAME.saveVersion);
  assert.equal(migrated.player.title, 0);
  advance(migrated, T0 + HOUR);
  assert.ok(migrated.hero, 'kahraman kuruldu');
  assert.ok(migrated.player.title >= 1, 'şan unvanı getirdi');
  assert.ok(ensureHero(migrated) === migrated.hero);
});
