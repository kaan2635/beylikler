// Sunucu kayıtları: data/ klasöründe JSON dosyaları. Yazım önce geçici dosyaya yapılır, sonra
// yeniden adlandırılır; sunucu yazım sırasında kapanırsa eski dosya bozulmadan kalır.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeWorld, loadWorld } from '../js/systems/multiplayer.js';

export function createStore(dir) {
  const file = (name) => join(dir, `${name}.json`);

  async function write(name, text) {
    await mkdir(dir, { recursive: true });
    const tmp = `${file(name)}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, file(name));
  }

  async function read(name) {
    try {
      return await readFile(file(name), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  return {
    async load(name) {
      const text = await read(name);
      return text ? JSON.parse(text) : null;
    },
    save(name, value) {
      return write(name, JSON.stringify(value));
    },
    async loadWorld() {
      const text = await read('world');
      return text ? loadWorld(text) : null;
    },
    saveWorld(data) {
      return write('world', serializeWorld(data));
    },
  };
}
