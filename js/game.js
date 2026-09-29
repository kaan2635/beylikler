import { createNewGame } from './core/state.js';
import { advance } from './core/engine.js';
import { getVillage } from './core/village.js';
import { encodeSave, decodeSave } from './core/save-codec.js';
import { startUpgrade, cancelLastUpgrade } from './systems/construction.js';

/**
 * Oyun durumu ile arayüz arasındaki tek kapı. Arayüz durumu doğrudan değiştirmez:
 * her eylem buradan geçer, önce zaman `now` anına ilerletilir, sonra eylem uygulanır.
 * Çok oyunculu sürümde bu sınıfın eylemleri sunucuya istek olarak gidecek.
 */
export class Game {
  #listeners = new Set();

  constructor(store) {
    this.store = store;
    this.state = null;
  }

  /** Kayıtlı oyunu yükler, yoksa yenisini başlatır. Yokken tamamlanan olayları da döndürür. */
  load(now) {
    const saved = this.store.load();
    this.state = saved ?? createNewGame({ now });
    const events = advance(this.state, now);
    // Salt üretim kaydedilmez: kayıttaki lastUpdate'ten her zaman aynen yeniden hesaplanır.
    if (!saved || events.length) this.save();
    return { isNew: !saved, events };
  }

  get village() {
    return getVillage(this.state);
  }

  /** Olay dinleyicisi ekler; kaldırmak için dönen fonksiyonu çağır. */
  on(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  tick(now) {
    const events = advance(this.state, now);
    if (events.length) {
      this.save();
      for (const listener of this.#listeners) listener(events);
    }
    return events;
  }

  upgrade(buildingId, now) {
    this.tick(now);
    const result = startUpgrade(this.village, this.state.world, buildingId, now);
    if (result.ok) this.save();
    return result;
  }

  cancelLastUpgrade(now) {
    this.tick(now);
    const job = cancelLastUpgrade(this.village);
    if (job) this.save();
    return job;
  }

  renameVillage(name) {
    const clean = name.trim().slice(0, 32);
    if (!clean) return false;
    this.village.name = clean;
    this.save();
    return true;
  }

  setSpeed(speed, now) {
    this.tick(now); // geçen süre eski hızla hesaplansın
    this.state.world.speed = speed;
    this.save();
  }

  reset(now) {
    this.store.clear();
    this.state = createNewGame({ now });
    this.save();
  }

  exportSave() {
    return encodeSave(this.state);
  }

  /** Geçersiz kodda hata fırlatır; mevcut oyun o durumda değişmez. */
  importSave(text, now) {
    this.state = decodeSave(text);
    this.tick(now);
    this.save();
  }

  save() {
    this.store.save(this.state);
  }
}
