import { createNewGame } from './core/state.js';
import { advance } from './core/engine.js';
import { getVillage } from './core/village.js';
import { encodeSave, decodeSave } from './core/save-codec.js';
import { startUpgrade, cancelLastUpgrade } from './systems/construction.js';
import { startTraining, cancelLastTraining } from './systems/training.js';
import { sendAttack, recallAttack } from './systems/movements.js';

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

  train(unitId, count, now) {
    this.tick(now);
    const result = startTraining(this.village, this.state.world, unitId, count, now);
    if (result.ok) this.save();
    return result;
  }

  cancelLastTraining(buildingId, now) {
    this.tick(now);
    const batch = cancelLastTraining(this.village, buildingId);
    if (batch) this.save();
    return batch;
  }

  sendAttack(x, y, units, now) {
    this.tick(now);
    const result = sendAttack(this.state, this.village, x, y, units, now);
    if (result.ok) this.save();
    return result;
  }

  /** Raporun ordusunu aynı hedefe yeniden gönderir (köyde yeterli asker varsa). */
  repeatAttack(reportId, now) {
    const report = this.state.reports.find((r) => r.id === reportId);
    if (!report) return { ok: false, reason: 'Rapor bulunamadı' };
    return this.sendAttack(report.target.x, report.target.y, report.attackers, now);
  }

  recallAttack(movementId, now) {
    this.tick(now);
    const result = recallAttack(this.village, movementId, now);
    if (result.ok) this.save();
    return result;
  }

  deleteReports(ids) {
    const before = this.state.reports.length;
    this.state.reports = this.state.reports.filter((report) => !ids.includes(report.id));
    if (this.state.reports.length !== before) this.save();
  }

  markReportsRead(ids) {
    let changed = false;
    for (const report of this.state.reports) {
      if (!report.read && ids.includes(report.id)) {
        report.read = true;
        changed = true;
      }
    }
    if (changed) this.save();
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
