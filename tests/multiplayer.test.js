import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  advanceWorld,
  playerView,
  serializeWorld,
  loadWorld,
  postChat,
  worldRanking,
  invalidate,
  clientPeers,
} from '../js/systems/multiplayer.js';
import { createVillage } from '../js/core/state.js';
import { sendAttack, inspectAttack, recallAttack } from '../js/systems/movements.js';
import { barbarianAt, villageAt } from '../js/systems/world.js';
import { Game } from '../js/game.js';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;

function world() {
  const data = createWorld({ seed: 77, speed: 1, now: T0 });
  const a = addPlayer(data, { name: 'Osman', now: T0 });
  const b = addPlayer(data, { name: 'Orhan', now: T0 });
  // Koruma bitsin, iki taraf da güçlü olsun.
  for (const p of [a, b]) {
    p.state.player.protectUntil = 0;
    Object.assign(p.state.villages[p.state.activeVillageId].buildings, { ambar: 20, ciftlik: 25, kisla: 10, saray: 3, gizlidepo: 0 });
  }
  return { data, a, b, va: a.state.villages[a.state.activeVillageId], vb: b.state.villages[b.state.activeVillageId] };
}

test('oyuncular farklı yerlere yerleşir, birbirini haritada görür; paylaşılan dünya', () => {
  const { data, a, b, va, vb } = world();
  assert.notDeepEqual([va.x, va.y], [vb.x, vb.y]);
  assert.equal(va.id, 'p1v1');
  assert.equal(vb.id, 'p2v1');
  assert.equal(a.state.world, b.state.world, 'dünya saati ortak');
  assert.equal(a.state.barbarians, b.state.barbarians, 'barbar köyleri ortak');
  const seen = villageAt(a.state, vb.x, vb.y);
  assert.equal(seen.kind, 'rakip');
  assert.equal(seen.owner, 'Orhan');
  assert.equal(barbarianAt(a.state, vb.x, vb.y), null);
  assert.equal(a.state.peers.list().length, 1);
  assert.equal(JSON.stringify(a.state).includes('peers'), false, 'peers kayda yazılmaz');
});

test('yeni oyuncu koruması saldırıyı engeller; saldıran korumasını kaybeder', () => {
  const { data, a, b, va, vb } = world();
  b.state.player.protectUntil = data.world.clock.time + 10 * HOUR;
  va.units.baltaci = 10;
  assert.equal(inspectAttack(a.state, va, vb.x, vb.y, { baltaci: 10 }, T0).code, 'protected');
  b.state.player.protectUntil = 0;
  a.state.player.protectUntil = data.world.clock.time + 10 * HOUR;
  assert.ok(sendAttack(a.state, va, vb.x, vb.y, { baltaci: 10 }, T0).ok);
  assert.equal(a.state.player.protectUntil, 0);
});

test('oyuncu saldırısı: savunan gelen saldırıyı görür; savaş iki tarafa rapor ve olay yazar', () => {
  const { data, a, b, va, vb } = world();
  va.units.baltaci = 400;
  vb.units.yaya = 20;
  vb.resources = { odun: 5000, kil: 5000, demir: 5000 };
  const sent = sendAttack(a.state, va, vb.x, vb.y, { baltaci: 400 }, T0);
  assert.ok(sent.ok, sent.reason);
  assert.equal(vb.incoming.length, 1);
  assert.equal(vb.incoming[0].pvp, true);

  const events = advanceWorld(data, sent.arriveAt);
  assert.equal(vb.incoming.length, 0);
  assert.equal(events.p1.find((e) => e.type === 'attack-result').attackerWins, true);
  const defense = events.p2.find((e) => e.type === 'defense-result');
  assert.equal(defense.defended, false);
  assert.equal(defense.attacker, 'Osman');
  assert.equal(a.state.reports[0].target.owner, 'Orhan');
  assert.equal(b.state.reports[0].type, 'savunma');
  assert.equal(vb.units.yaya, 0);
  const loot = Object.values(a.state.reports[0].loot).reduce((x, y) => x + y, 0);
  assert.ok(loot > 0);
  assert.ok(vb.resources.odun < 5000);
  // Ganimet eve döner.
  const back = va.movements[0];
  advanceWorld(data, back.arriveAt);
  assert.equal(va.units.baltaci, 400 - a.state.reports[0].attackerLosses.baltaci);
});

test('geri çağrılan saldırı savunanın listesinden silinir', () => {
  const { a, va, vb } = world();
  va.units.baltaci = 10;
  const sent = sendAttack(a.state, va, vb.x, vb.y, { baltaci: 10 }, T0);
  assert.equal(vb.incoming.length, 1);
  assert.ok(recallAttack(va, sent.movement.id, T0 + 1000, a.state).ok);
  assert.equal(vb.incoming.length, 0);
});

test('başkent fethedilemez; öbür köy elçilerle fethedilir ve sahibi değişir', () => {
  const { data, a, b, va, vb } = world();
  va.units.baltaci = 2000;
  va.units.elci = 3;
  const capital = sendAttack(a.state, va, vb.x, vb.y, { baltaci: 500, elci: 1 }, T0);
  advanceWorld(data, capital.arriveAt);
  assert.equal(a.state.reports[0].conquest.capital, true);
  assert.ok(b.state.villages[vb.id], 'başkent yerinde');

  // Orhan'ın ikinci köyü
  const second = createVillage({ id: 'p2v9', name: 'Kalecik', x: vb.x + 2, y: vb.y + 1, now: T0 });
  b.state.villages[second.id] = second;
  invalidate(data);
  let at = capital.arriveAt;
  for (let i = 0; i < 6 && b.state.villages[second.id]; i++) {
    va.units.elci = Math.max(va.units.elci, 2);
    const sent = sendAttack(a.state, va, second.x, second.y, { baltaci: 200, elci: 2 }, at);
    assert.ok(sent.ok, sent.reason);
    advanceWorld(data, sent.arriveAt);
    at = sent.arriveAt;
  }
  assert.equal(b.state.villages[second.id], undefined, 'köy Orhan\'dan alındı');
  assert.ok(a.state.villages[second.id], 'köy Osman\'ın oldu');
  assert.equal(villageAt(b.state, second.x, second.y).owner, 'Osman');
  assert.equal(b.state.reports[0].conquest.lostVillage, true);
});

test('casus yakalanırsa savunan bildirim alır', () => {
  const { data, a, b, va, vb } = world();
  va.units.gozcu = 2;
  vb.units.gozcu = 10;
  const sent = sendAttack(a.state, va, vb.x, vb.y, { gozcu: 2 }, T0);
  const events = advanceWorld(data, sent.arriveAt);
  assert.equal(a.state.reports[0].attackerWins, false);
  assert.equal(b.state.reports[0].type, 'bildirim');
  assert.ok(events.p2.some((e) => e.type === 'spy-caught'));
});

test('dünya kaydı: paylaşılan nesneler korunur, peers yeniden kurulur', () => {
  const { data, a } = world();
  advanceWorld(data, T0 + 5 * HOUR);
  postChat(data, a.id, '  Selam   beyler!  ', T0);
  const loaded = loadWorld(serializeWorld(data));
  const [pa, pb] = Object.values(loaded.players);
  assert.equal(pa.state.world, pb.state.world);
  assert.equal(pa.state.world, loaded.world);
  assert.equal(pa.state.peers.list()[0].owner, 'Orhan');
  assert.equal(loaded.chat[0].text, 'Selam beyler!');
  const events = advanceWorld(loaded, T0 + 30 * HOUR);
  assert.equal(typeof events, 'object');
});

test('görünüm ve sıralama: barbar sırları gizli, bütün oyuncular listede', () => {
  const { data, a, va } = world();
  va.units.baltaci = 300;
  const target = Object.values(data.players)[0].state; // yalnızca yardımcı
  void target;
  const view = playerView(data, a.id, T0);
  assert.equal(view.playerId, 'p1');
  assert.equal(view.peers.length, 1);
  const rows = worldRanking(data);
  assert.equal(rows.filter((r) => r.kind === 'oyuncu').length, 2);
  const json = JSON.stringify(view);
  assert.ok(!json.includes('"peers":{'), 'peers nesnesi gönderilmez');
  // İstemci özetten peers kurar.
  const peers = clientPeers(view.peers);
  assert.equal(peers.villageAt(view.peers[0].x, view.peers[0].y).owner, 'Orhan');
});

test('sunucu eylemleri Game sınıfıyla, paylaşılan dünyada çalışır', () => {
  const { data, a } = world();
  const game = new Game({ load: () => null, save() {}, clear() {} });
  game.state = a.state;
  advanceWorld(data, T0 + 1000);
  const result = game.upgrade('oduncu', T0 + 1000);
  assert.ok(result.ok, result.reason);
  assert.equal(a.state.villages.p1v1.buildQueue.length, 1);
});
