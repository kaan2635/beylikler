import { Game } from '../game.js';
import { produce } from '../systems/economy.js';
import { advanceClock } from '../systems/world.js';
import { syncBonuses } from '../systems/premium.js';
import { clientPeers } from '../systems/multiplayer.js';
import { nextUnitAt } from '../systems/training.js';

/**
 * Çok oyunculu oyun: sunucu otoritedir. Arayüz tek oyunculudaki Game sınıfını kullanır;
 * burada eylemler önce yerelde (aynı kurallarla) denenir ki arayüz anında yanıt versin, sonra
 * sunucuya gönderilir. Sunucunun yanıtı gelince durum onunkiyle değiştirilir. Olaylar (savaş,
 * inşaat bitişi…) yalnızca sunucuda işlenir; istemci aradaki sürede yalnız üretimi yürütür.
 *
 * Eylem adı → sunucuya giden argüman sayısı (sondaki `now` gönderilmez; sunucu kendi saatini
 * kullanır). sendAttack'ta `now` arada olduğu için ayrı ele alınır.
 */
const REMOTE = {
  upgrade: 1,
  cancelLastUpgrade: 0,
  train: 2,
  cancelLastTraining: 1,
  research: 1,
  cancelResearch: 0,
  trade: 3,
  sendTransport: 2,
  withdrawSupport: 2,
  sendAttack: 'attack',
  repeatAttack: 1,
  repeatAttacks: 1,
  recallAttack: 1,
  sendExpedition: 2,
  repeatExpedition: 1,
  deleteReports: 1,
  markReportsRead: 1,
  setActiveVillage: 1,
  renameVillage: 1,
  renamePlayer: 1,
  chooseClass: 2,
  changeClass: 1,
  hireOfficer: 1,
  finishBuilding: 0,
  finishResearch: 0,
  buyResourcePack: 0,
  claimQuest: 1,
  claimDaily: 0,
};

export class OnlineGame extends Game {
  constructor(api, view, username) {
    super({ load: () => null, save() {}, clear() {} });
    this.api = api;
    this.username = username;
    this.online = true;
    this.pending = 0;
    this.depth = 0;
    this.queue = Promise.resolve();
    this.lastSync = 0;
    this.chatLog = [];
    this.applyView(view);
  }

  /** Sunucunun gönderdiği görünümü uygular. */
  applyView(view) {
    this.state = view.state;
    Object.defineProperty(this.state, 'peers', { value: clientPeers(view.peers ?? []), enumerable: false, configurable: true });
    syncBonuses(this.state);
    this.ranking = view.ranking ?? [];
    this.playerCount = view.players ?? 0;
    this.playerId = view.playerId;
    if (view.chat) this.chatLog = view.chat;
    this.offset = (view.serverNow ?? Date.now()) - Date.now();
  }

  /** Sunucudan güncel durumu çeker (bekleyen eylem yoksa). */
  async sync() {
    if (this.syncing || this.pending) return;
    this.syncing = true;
    this.lastSync = Date.now();
    try {
      const response = await this.api.state();
      if (response.ok && !this.pending) this.applyView(response.view);
      else if (response.status === 401) this.emit([{ type: 'session-expired' }]);
    } finally {
      this.syncing = false;
    }
  }

  /** Canlı bildirimleri dinlemeye başlar; bağlantı koparsa tarayıcı kendisi yeniden dener. */
  listen() {
    this.source = this.api.events({
      changed: async ({ events }) => {
        await this.sync();
        if (events?.length) this.emit(events);
      },
      chat: (message) => {
        if (!message.system) this.chatLog = [...this.chatLog, message].slice(-50);
        this.emit([{ type: 'chat', message }]);
      },
      disconnected: () => {
        this.connected = false;
        this.emit([{ type: 'connection-lost' }]);
      },
      reconnected: () => {
        this.connected = true;
        this.emit([{ type: 'connection-back' }]);
      },
    });
    this.connected = true;
    // Yedek: bildirim gelmese de arada bir durumu tazele.
    this.poll = setInterval(() => this.sync(), 20_000);
  }

  /**
   * Yalnız görüntü: üretim ve dünya saati yürür, olaylar işlenmez. Bilinen bir olayın zamanı
   * geldiyse sunucudan tazelenir.
   */
  tick(now) {
    if (!this.state) return [];
    const at = now + (this.offset ?? 0);
    for (const village of Object.values(this.state.villages)) produce(village, this.state.world, at);
    advanceClock(this.state.world, at);
    if (!this.pending && Date.now() - this.lastSync > 1500 && this.dueAt() <= at) this.sync();
    return [];
  }

  /** Kendi köylerindeki en erken olayın zamanı. */
  dueAt() {
    let next = Infinity;
    for (const village of Object.values(this.state.villages)) {
      if (village.buildQueue[0]) next = Math.min(next, village.buildQueue[0].endAt);
      for (const queue of Object.values(village.trainQueues)) if (queue.length) next = Math.min(next, nextUnitAt(queue[0]));
      for (const movement of village.movements) next = Math.min(next, movement.arriveAt);
      if (village.research) next = Math.min(next, village.research.endAt);
      for (const attack of village.incoming) next = Math.min(next, attack.arriveAt);
    }
    for (const until of Object.values(this.state.player?.officers ?? {})) next = Math.min(next, until);
    return next;
  }

  /** Eylemi sırayla sunucuya gönderir; bekleyen başka eylem kalmayınca sunucunun durumunu uygular. */
  remote(name, args) {
    this.pending += 1;
    this.queue = this.queue.then(async () => {
      const response = await this.api.action(name, args);
      this.pending -= 1;
      if (!response.ok || response.result?.ok === false) {
        const reason = response.reason ?? response.result?.reason ?? 'Sunucu eylemi reddetti';
        this.emit([{ type: 'server-error', reason }]);
      }
      if (response.view && !this.pending) this.applyView(response.view);
      else if (!this.pending) this.sync();
    });
    return this.queue;
  }

  async sendChat(text) {
    const response = await this.api.chat(text);
    return response.ok ? { ok: true } : { ok: false, reason: response.reason ?? 'Mesaj gönderilemedi' };
  }

  async logout() {
    this.source?.close();
    clearInterval(this.poll);
    await this.api.logout();
  }

  // Çok oyunculu dünyada bunlar sunucunun elindedir.
  setSpeed() {}
  setDifficulty() {
    return false;
  }
  reset() {}
  importSave() {
    throw new Error('Çok oyunculu dünyada kayıt içe aktarılamaz');
  }
}

// Eylemler: önce yerelde dene, başarılıysa sunucuya gönder. İç içe eylemler (ör. tekrar saldır
// → saldırı gönder) yalnız en dıştaki adla bir kez gönderilir.
for (const [name, spec] of Object.entries(REMOTE)) {
  OnlineGame.prototype[name] = function remoteAction(...args) {
    this.depth += 1;
    let result;
    try {
      result = Game.prototype[name].apply(this, args);
    } finally {
      this.depth -= 1;
    }
    const ok = result === true || result?.ok === true || (result && typeof result === 'object' && !('ok' in result));
    const always = name === 'deleteReports' || name === 'markReportsRead';
    if (this.depth === 0 && (ok || always)) {
      const sent = spec === 'attack' ? [args[0], args[1], args[2], args[4] ?? {}] : args.slice(0, spec);
      this.remote(name, sent);
    }
    return result;
  };
}
