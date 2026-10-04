import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validUsername, validPassword, newToken, safeEqualText } from '../server/auth.js';
import { ACTIONS } from '../js/net/actions.js';
import { createWorld, addPlayer, advanceWorld } from '../js/systems/multiplayer.js';
import { Game } from '../js/game.js';

const T0 = Date.UTC(2026, 0, 1);

test('şifreler tuzlanıp özetlenir; doğru şifre doğrulanır', async () => {
  const account = await hashPassword('gizli-şifre-1');
  assert.notEqual(account.hash, 'gizli-şifre-1');
  assert.equal(account.salt.length, 32);
  assert.ok(await verifyPassword('gizli-şifre-1', account));
  assert.equal(await verifyPassword('yanlış', account), false);
  assert.notEqual(newToken(), newToken());
  assert.ok(safeEqualText('gizli', 'gizli'));
  assert.equal(safeEqualText('gizli', 'başka'), false);
  assert.equal(safeEqualText('', ''), false);
  assert.ok(validUsername('Osman_Gazi'));
  assert.ok(validUsername('Ertuğrul'));
  assert.equal(validUsername('ab'), false);
  assert.equal(validUsername('boşluk var'), false);
  assert.equal(validPassword('1234567'), false);
  assert.ok(validPassword('12345678'));
});

test('eylem listesi: argümanlar denetlenir; tehlikeli eylem yok', () => {
  const data = createWorld({ seed: 5, now: T0 });
  const player = addPlayer(data, { name: 'Osman', now: T0 });
  advanceWorld(data, T0);
  const game = new Game({ load: () => null, save() {}, clear() {} });
  game.state = player.state;
  assert.ok(ACTIONS.upgrade(game, ['oduncu'], T0).ok);
  assert.throws(() => ACTIONS.upgrade(game, [{ bad: 1 }], T0));
  assert.throws(() => ACTIONS.train(game, ['yaya', 1.5], T0));
  assert.throws(() => ACTIONS.sendAttack(game, [1, 2, { 'x"y': 1 }], T0));
  assert.equal(ACTIONS.cancelLastUpgrade(game, [], T0).ok, true);
  assert.equal(ACTIONS.cancelLastUpgrade(game, [], T0).ok, false);
  for (const forbidden of ['setSpeed', 'setDifficulty', 'reset', 'importSave', 'load', 'save']) {
    assert.equal(ACTIONS[forbidden], undefined, `${forbidden} istemciye kapalı`);
  }
  assert.ok(ACTIONS.chooseClass(game, ['tuccar', { playerName: 'Osman Bey' }], T0).ok);
  assert.equal(player.state.player.class, 'tuccar');
});
