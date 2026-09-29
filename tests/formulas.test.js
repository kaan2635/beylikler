import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/core/formulas.js';
import { BUILDINGS } from '../js/config/buildings.js';

test('ambar: 1. seviye 1000, 30. seviye ~400 bin', () => {
  assert.equal(F.storageCapacity(1), 1000);
  const cap30 = F.storageCapacity(30);
  assert.ok(cap30 > 390_000 && cap30 < 410_000, `beklenmeyen kapasite: ${cap30}`);
});

test('üretim: seviye 0 → 5/saat, seviye 1 → 30/saat, dünya hızıyla ölçeklenir', () => {
  assert.equal(F.productionPerHour(0), 5);
  assert.equal(F.productionPerHour(1), 30);
  assert.equal(F.productionPerHour(1, 10), 300);
  assert.ok(F.productionPerHour(30) > 2000);
});

test('maliyet ve süre seviyeyle artar, nüfus azalmaz', () => {
  for (const [id, def] of Object.entries(BUILDINGS)) {
    for (let lvl = 2; lvl <= def.maxLevel; lvl++) {
      const prev = F.upgradeCost(def, lvl - 1);
      const next = F.upgradeCost(def, lvl);
      for (const r of Object.keys(prev)) assert.ok(next[r] >= prev[r], `${id} ${r} seviye ${lvl}`);
      assert.ok(F.buildDuration(def, lvl, 1) >= F.buildDuration(def, lvl - 1, 1), `${id} süre ${lvl}`);
      assert.ok(F.buildingPopulation(def, lvl) >= F.buildingPopulation(def, lvl - 1), `${id} nüfus ${lvl}`);
    }
  }
});

test('her binanın azami seviyesi azami ambara sığar (oyun kilitlenmez)', () => {
  const maxCap = F.storageCapacity(BUILDINGS.ambar.maxLevel);
  for (const [id, def] of Object.entries(BUILDINGS)) {
    for (const [r, amount] of Object.entries(F.upgradeCost(def, def.maxLevel))) {
      assert.ok(amount <= maxCap, `${id} ${r}: ${amount} > ${maxCap}`);
    }
  }
});

test('ambar yükseltmesi hep bir önceki ambar kapasitesine sığar', () => {
  const def = BUILDINGS.ambar;
  for (let lvl = 2; lvl <= def.maxLevel; lvl++) {
    for (const amount of Object.values(F.upgradeCost(def, lvl))) {
      assert.ok(amount <= F.storageCapacity(lvl - 1), `ambar ${lvl}`);
    }
  }
});

test('konak inşaat süresini kısaltır', () => {
  const def = BUILDINGS.oduncu;
  assert.ok(F.buildDuration(def, 10, 20) < F.buildDuration(def, 10, 1));
  assert.ok(F.buildDuration(def, 1, 1, 1000) >= 1, 'süre en az 1 sn');
});
