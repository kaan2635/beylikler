// package.json'daki sürümü değiştirir: node tools/version.js 0.11.0
import { readFileSync, writeFileSync } from 'node:fs';

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next ?? '')) {
  console.error('Kullanım: node tools/version.js 1.2.3');
  process.exit(1);
}
const path = new URL('../package.json', import.meta.url);
const text = readFileSync(path, 'utf8');
writeFileSync(path, text.replace(/"version": "[^"]+"/, `"version": "${next}"`));
console.log(`Sürüm ${next} oldu.`);
