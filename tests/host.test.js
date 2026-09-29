import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HostWorld, LocalApi, randomSecret, randomRoomCode } from '../js/net/host.js';

const T0 = Date.UTC(2026, 0, 1);

function memory() {
  let text = null;
  return { load: () => text, save: (value) => (text = value), get text() {
    return text;
  } };
}

test('oda kodu ve anahtarlar rastgele ve biçimli', () => {
  assert.match(randomRoomCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  assert.notEqual(randomSecret(), randomSecret());
  assert.equal(randomSecret().length, 48);
});

test('katılma: yeni oyuncu köy kurar; aynı anahtar aynı beye döner; ad çakışması engellenir', async () => {
  const host = new HostWorld(memory(), { now: T0, seed: 9 });
  const osman = randomSecret();
  const a = await host.join({ name: 'Osman', secret: osman }, T0);
  assert.ok(a.ok, a.reason);
  assert.equal(a.playerId, 'p1');
  const again = await host.join({ name: 'başka ad', secret: osman }, T0);
  assert.equal(again.playerId, 'p1');
  assert.equal(host.playerCount, 1);
  const clash = await host.join({ name: 'osman', secret: randomSecret() }, T0);
  assert.equal(clash.ok, false);
  const short = await host.join({ name: 'ab', secret: randomSecret() }, T0);
  assert.equal(short.ok, false);
  const bad = await host.join({ name: 'Orhan', secret: 'kısa' }, T0);
  assert.equal(bad.ok, false);
  const b = await host.join({ name: 'Orhan Gazi', secret: randomSecret() }, T0);
  assert.equal(b.playerId, 'p2');
  assert.equal(b.view.peers.length, 1);
});

test('eylem, sohbet ve bildirimler; kayıt ve yeniden yükleme', async () => {
  const storage = memory();
  const host = new HostWorld(storage, { now: T0, seed: 9 });
  const pushed = [];
  host.listeners.add((playerId, type) => pushed.push(`${playerId}:${type}`));
  const secret = randomSecret();
  const { playerId } = await host.join({ name: 'Osman', secret }, T0);
  const act = host.action(playerId, 'upgrade', ['oduncu'], T0 + 1000);
  assert.ok(act.ok && act.result.ok);
  assert.equal(host.action(playerId, 'setSpeed', [1000], T0).ok, false, 'hız istemciye kapalı');
  assert.equal(host.action(playerId, 'upgrade', [{ zararlı: 1 }], T0).ok, false);
  assert.ok(host.chat(playerId, 'Selam', T0).ok);
  assert.ok(pushed.includes('p1:chat'));

  assert.ok(host.save());
  assert.equal(host.save(), false, 'değişiklik yoksa yazmaz');
  const reopened = new HostWorld(storage, { now: T0 + 5000 });
  assert.equal(reopened.playerCount, 1);
  const back = await reopened.join({ name: 'Osman', secret }, T0 + 5000);
  assert.equal(back.playerId, playerId);
  assert.equal(back.view.state.villages.p1v1.buildQueue.length, 1);
});

test('LocalApi: ev sahibinin kendi oyunu aynı arayüzle bağlanır', async () => {
  const host = new HostWorld(memory(), { now: T0, seed: 3 });
  const api = new LocalApi(host);
  const joined = await api.join('Ertuğrul', randomSecret());
  assert.ok(joined.ok);
  assert.ok((await api.state()).ok);
  const got = [];
  const stream = api.events({ chat: (m) => got.push(m.text) });
  await api.chat('Hoş geldiniz');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(got, ['Hoş geldiniz']);
  stream.close();
});
