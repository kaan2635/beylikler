import { createNewGame } from './core/state.js';
import { advance } from './core/engine.js';
import { getVillage } from './core/village.js';
import { encodeSave, decodeSave } from './core/save-codec.js';
import { startUpgrade, cancelLastUpgrade } from './systems/construction.js';
import { startTraining, cancelLastTraining } from './systems/training.js';
import { sendAttack, recallAttack } from './systems/movements.js';
import { startResearch, cancelResearch } from './systems/research.js';
import { trade, sendTransport } from './systems/market.js';
import { withdrawSupport } from './systems/support.js';
import {
  chooseClass,
  changeClass,
  hireOfficer,
  finishBuilding,
  finishResearch,
  buyResourcePack,
} from './systems/premium.js';
import { bonusOf } from './systems/bonus.js';
import { sendExpedition } from './systems/expedition.js';
import { claimQuest, claimDaily } from './systems/quests.js';
import { setDifficulty, rescaleLordSchedules } from './systems/ai.js';
import { startIlim, cancelIlim } from './systems/ilim.js';
import { chooseEvent, rescaleEvents } from './systems/events.js';
import { sendGift, makePeace } from './systems/diplomacy.js';
import { syncBonuses, grantAkce } from './systems/premium.js';
import { spendPoint, equipItem, unequipItem, sellItem, renameHero, ensureHero } from './systems/hero.js';

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
      this.emit(events);
    }
    return events;
  }

  /** Olayları dinleyicilere iletir (çevrimiçi oyun sunucudan gelenler için de kullanır). */
  emit(events) {
    for (const listener of this.#listeners) listener(events);
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

  research(unitId, now) {
    this.tick(now);
    const result = startResearch(this.village, this.state.world, unitId, now);
    if (result.ok) this.save();
    return result;
  }

  cancelResearch(now) {
    this.tick(now);
    const research = cancelResearch(this.village);
    if (research) this.save();
    return research;
  }

  /** Pazarda `amount` kadar `give` kaynağını `take` kaynağına takas eder. */
  trade(give, take, amount, now) {
    this.tick(now);
    const result = trade(this.village, this.state.world, give, take, amount, now);
    if (result.ok) this.save();
    return result;
  }

  /** Yönetilen köyden başka bir köye tüccarlarla kaynak gönderir. */
  sendTransport(targetId, resources, now) {
    this.tick(now);
    const result = sendTransport(this.state, this.village, targetId, resources, now);
    if (result.ok) this.save();
    return result;
  }

  /** `homeId` köyünün `hostId` köyünde destek olarak duran askerlerini eve çağırır. */
  withdrawSupport(homeId, hostId, now) {
    this.tick(now);
    const home = this.state.villages[homeId];
    if (!home) return { ok: false, reason: 'Köy bulunamadı' };
    const result = withdrawSupport(this.state, home, hostId, now);
    if (result.ok) this.save();
    return result;
  }

  /**
   * Birlik gönderir: kendi köyüne destek, yalnız gözcülerden oluşan birlik casusluk, diğerleri
   * saldırı. options: { catapultTarget }
   */
  sendAttack(x, y, units, now, options = {}) {
    this.tick(now);
    const result = sendAttack(this.state, this.village, x, y, units, now, options);
    if (result.ok) this.save();
    return result;
  }

  /** Raporun birliğini (mancınık hedefiyle birlikte) aynı köye yeniden gönderir. */
  repeatAttack(reportId, now) {
    const report = this.state.reports.find((r) => r.id === reportId);
    if (!report) return { ok: false, reason: 'Rapor bulunamadı' };
    return this.sendAttack(report.target.x, report.target.y, report.attackers, now, { catapultTarget: report.catapultTarget });
  }

  /**
   * Yönetilen köyden keşif seferi düzenler; `holdHours` keşifte geçecek oyun saati.
   * `options`: { region, hero } (bölge ve kahramanın katılması).
   */
  sendExpedition(units, holdHours, now, options = {}) {
    return this.#act(now, () => sendExpedition(this.state, this.village, units, holdHours, now, options));
  }

  /** Keşif raporundaki birliği aynı bölgeye aynı süreyle yeniden sefere çıkarır (kahramansız). */
  repeatExpedition(reportId, now) {
    const report = this.state.reports.find((r) => r.id === reportId && r.type === 'kesif');
    if (!report) return { ok: false, reason: 'Rapor bulunamadı' };
    return this.sendExpedition(report.attackers, report.holdHours, now, { region: report.region ?? 'sinir' });
  }

  /** Yağma asistanı (Serasker): raporlardaki orduları kendi köylerine toplu olarak yeniden gönderir. */
  repeatAttacks(reportIds, now) {
    if (!bonusOf(this.village).farmAssistant) return { ok: false, sent: 0, reason: 'Toplu yağma için Serasker görevde olmalı' };
    let sent = 0;
    const failed = [];
    for (const id of reportIds) {
      const result = this.repeatAttack(id, now);
      if (result.ok) sent += 1;
      else failed.push(result.reason);
    }
    return { ok: sent > 0, sent, failed, reason: failed[0] ?? 'Gönderilecek ordu yok' };
  }

  recallAttack(movementId, now) {
    this.tick(now);
    const result = recallAttack(this.village, movementId, now, this.state);
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

  // ---------- Sınıf ve Akçe ----------

  /** Oyun başında sınıf seçimi; bey ve köy adı da verilebilir. */
  chooseClass(classId, names, now) {
    return this.#act(now, () => chooseClass(this.state, classId, names, now));
  }

  changeClass(classId, now) {
    return this.#act(now, () => changeClass(this.state, classId, now));
  }

  hireOfficer(officerId, now) {
    return this.#act(now, () => hireOfficer(this.state, officerId, now));
  }

  /** Yönetilen köyün sıradaki inşaatını Akçe ile anında bitirir. */
  finishBuilding(now) {
    const result = this.#act(now, () => finishBuilding(this.state, this.village, now));
    if (result.ok) this.tick(now);
    return result;
  }

  finishResearch(now) {
    const result = this.#act(now, () => finishResearch(this.state, this.village, now));
    if (result.ok) this.tick(now);
    return result;
  }

  buyResourcePack(now) {
    return this.#act(now, () => buyResourcePack(this.state, this.village, now));
  }

  // ---------- Divan, olaylar ve diplomasi ----------

  /** Divanda araştırma başlatır (maliyet yönetilen köyden). */
  startIlim(ilimId, now) {
    return this.#act(now, () => startIlim(this.state, this.village, this.state.world, ilimId, now));
  }

  cancelIlim(now) {
    this.tick(now);
    const current = cancelIlim(this.state);
    if (current) this.save();
    return current;
  }

  /** Bekleyen olayda bir seçenek seçer. */
  chooseEvent(choiceId, now) {
    return this.#act(now, () => chooseEvent(this.state, choiceId, now));
  }

  sendGift(lordId, tierId, now) {
    return this.#act(now, () => sendGift(this.state, this.village, lordId, tierId));
  }

  makePeace(lordId, now) {
    return this.#act(now, () => {
      const result = makePeace(this.state, this.village, lordId, now);
      if (result.ok) syncBonuses(this.state);
      return result;
    });
  }

  // ---------- Kahraman ----------

  /** Kahramanın bir özelliğine puan verir. */
  heroSpend(attr, now) {
    return this.#act(now, () => {
      const result = spendPoint(this.state, attr);
      if (result.ok) syncBonuses(this.state);
      return result;
    });
  }

  heroEquip(itemId, now) {
    return this.#act(now, () => {
      const result = equipItem(this.state, itemId);
      if (result.ok) syncBonuses(this.state);
      return result;
    });
  }

  heroUnequip(slot, now) {
    return this.#act(now, () => {
      const result = unequipItem(this.state, slot);
      if (result.ok) syncBonuses(this.state);
      return result;
    });
  }

  /** Heybedeki eşyayı satar; Akçe hazineye girer. */
  heroSell(itemId, now) {
    return this.#act(now, () => {
      const result = sellItem(this.state, itemId);
      if (result.ok) grantAkce(this.state, result.akce, `Eşya satıldı: ${result.item.name}`, now);
      return result;
    });
  }

  renameHero(name) {
    ensureHero(this.state);
    const ok = renameHero(this.state, name);
    if (ok) this.save();
    return ok;
  }

  // ---------- Görevler ----------

  claimQuest(questId, now) {
    const result = this.#act(now, () => claimQuest(this.state, this.village, questId, now));
    if (result.heroEvents?.length) this.emit(result.heroEvents);
    return result;
  }

  claimDaily(now) {
    return this.#act(now, () => claimDaily(this.state, this.village, now));
  }

  /** Önce zamanı ilerletir, eylemi uygular, başarılıysa kaydeder. */
  #act(now, action) {
    this.tick(now);
    const result = action();
    if (result.ok) this.save();
    return result;
  }

  /** Yönetilen köyü değiştirir (fethedilen köyler arasında geçiş). */
  setActiveVillage(id) {
    if (!this.state.villages[id] || this.state.activeVillageId === id) return false;
    this.state.activeVillageId = id;
    this.save();
    return true;
  }

  renamePlayer(name) {
    const clean = name.trim().slice(0, 24);
    if (!clean) return false;
    this.state.player.name = clean;
    this.save();
    return true;
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
    rescaleLordSchedules(this.state, now, this.state.world.speed, speed);
    rescaleEvents(this.state, now, this.state.world.speed, speed);
    this.state.world.speed = speed;
    this.save();
  }

  /** Rakip beylerin zorluğu: 'baris' | 'kolay' | 'normal' | 'zor'. */
  setDifficulty(key, now) {
    this.tick(now);
    const ok = setDifficulty(this.state, key, now);
    if (ok) this.save();
    return ok;
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
