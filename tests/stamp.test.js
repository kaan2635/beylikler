import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stampedIndex } from '../tools/stamp.js';

test('index.html sürüm damgası güncel (değilse: npm run stamp)', async () => {
  const current = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(current === (await stampedIndex()), 'index.html damgası eski; "npm run stamp" çalıştırıp yeniden gönder');
});

test('damga her JS modülünü ve stil dosyasını kapsar', async () => {
  const html = await stampedIndex();
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const [from, to] of Object.entries(map.imports)) {
    assert.match(from, /^\.\/js\/.+\.js$/);
    assert.match(to, new RegExp(`^${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=[0-9a-f]{10}$`));
  }
  assert.ok(map.imports['./js/main.js']);
  assert.match(html, /<script type="module" src="js\/main\.js\?v=[0-9a-f]{10}"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=[0-9a-f]{10}" \/>/);
});
