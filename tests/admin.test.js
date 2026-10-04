import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ADMIN_NAME = 'sahip';
const ADMIN_PASSWORD = 'yerel-test-parolasi-2026';

function startServer(dataDir, configured = true) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      DATA_DIR: dataDir,
      WORLD_SEED: '77',
      ADMIN_USERNAME: configured ? ADMIN_NAME : '',
      ADMIN_PASSWORD: configured ? ADMIN_PASSWORD : '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Sunucu zamanında başlamadı: ${output}\n${errors}`)), 12_000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/Beylikler sunucusu: http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    child.stderr.on('data', (chunk) => (errors += chunk.toString()));
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Sunucu erken kapandı (${code}): ${output}\n${errors}`));
    });
  });
  return { child, ready };
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await exited;
}

async function call(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

test('yönetim API yalnız yönetici oturumu kabul eder; oyuncu ve sohbet işlemleri sunucuda korunur', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'beylikler-admin-'));
  const { child, ready } = startServer(dataDir);
  try {
    const base = await ready;
    assert.equal((await call(base, '/api/admin/overview')).status, 401);
    assert.equal((await call(base, '/api/admin/login', { method: 'POST', body: { username: ADMIN_NAME, password: 'yanlis-parola' } })).status, 401);

    const adminLogin = await call(base, '/api/admin/login', { method: 'POST', body: { username: ADMIN_NAME, password: ADMIN_PASSWORD } });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.data.token;
    assert.ok(adminToken);
    assert.equal((await call(base, `/api/admin/overview?token=${adminToken}`)).status, 401);

    const reservedName = await call(base, '/api/register', { method: 'POST', body: { username: ADMIN_NAME, password: 'oyuncu-parolasi-1' } });
    assert.equal(reservedName.status, 409);
    const register = await call(base, '/api/register', { method: 'POST', body: { username: 'Bey01', password: 'oyuncu-parolasi-1' } });
    assert.equal(register.status, 200);
    const playerToken = register.data.token;
    const playerId = register.data.view.playerId;

    const playerCannotAdmin = await call(base, '/api/admin/overview', { token: playerToken });
    assert.equal(playerCannotAdmin.status, 401);
    assert.equal((await call(base, '/api/state', { token: adminToken })).status, 401);

    const dashboard = await call(base, '/api/admin/overview', { token: adminToken });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.data.overview.stats.players, 1);
    assert.equal(dashboard.data.overview.players[0].username, 'bey01');
    assert.equal(JSON.stringify(dashboard.data.overview).includes('hash'), false);
    assert.equal(JSON.stringify(dashboard.data.overview).includes('salt'), false);

    const announcement = await call(base, '/api/admin/announcement', {
      method: 'POST', token: adminToken, body: { text: '  Dünya  bakımı   bu gece.  ' },
    });
    assert.equal(announcement.status, 200);
    assert.equal(announcement.data.message.text, 'Dünya bakımı bu gece.');
    assert.equal(announcement.data.message.system, true);
    const playerState = await call(base, '/api/state', { token: playerToken });
    assert.ok(playerState.data.view.chat.some((message) => message.name === 'Yönetim' && message.text === 'Dünya bakımı bu gece.'));

    const ban = await call(base, `/api/admin/players/${playerId}/ban`, {
      method: 'POST', token: adminToken, body: { reason: 'Test moderasyonu' },
    });
    assert.equal(ban.status, 200);
    assert.equal((await call(base, '/api/state', { token: playerToken })).status, 401);
    assert.equal((await call(base, '/api/login', { method: 'POST', body: { username: 'Bey01', password: 'oyuncu-parolasi-1' } })).status, 403);
    const suspended = await call(base, '/api/admin/overview', { token: adminToken });
    assert.equal(suspended.data.overview.players[0].banned, true);

    const unban = await call(base, `/api/admin/players/${playerId}/unban`, { method: 'POST', token: adminToken, body: {} });
    assert.equal(unban.status, 200);
    const playerLogin = await call(base, '/api/login', { method: 'POST', body: { username: 'Bey01', password: 'oyuncu-parolasi-1' } });
    assert.equal(playerLogin.status, 200);

    const cleared = await call(base, '/api/admin/chat/clear', { method: 'POST', token: adminToken, body: {} });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.removed, 1);
    const afterClear = await call(base, '/api/admin/overview', { token: adminToken });
    assert.equal(afterClear.data.overview.stats.chatMessages, 0);

    assert.equal((await call(base, '/api/admin/logout', { method: 'POST', token: adminToken, body: {} })).status, 200);
    assert.equal((await call(base, '/api/admin/overview', { token: adminToken })).status, 401);
  } finally {
    await stopServer(child);
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('yönetici girişi sunucuda kimlik bilgileri ayarlanmadan kapalıdır', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'beylikler-admin-off-'));
  const { child, ready } = startServer(dataDir, false);
  try {
    const base = await ready;
    const response = await call(base, '/api/admin/login', {
      method: 'POST',
      body: { username: ADMIN_NAME, password: ADMIN_PASSWORD },
    });
    assert.equal(response.status, 503);
    assert.match(response.data.reason, /yapılandırılmamış/);
  } finally {
    await stopServer(child);
    await rm(dataDir, { recursive: true, force: true });
  }
});
