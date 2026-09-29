import { GAME } from '../config/game.js';
import { migrate } from '../core/state.js';

/**
 * Tarayıcının localStorage'ına kayıt. Aynı arayüzü (load / save / clear) uygulayan başka
 * bir depo yazılarak (ör. bulut kaydı) oyunun geri kalanına dokunmadan değiştirilebilir.
 */
export const localStore = {
  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(GAME.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const savedVersion = data.version;
      const state = migrate(data);
      // Taşınan kaydı hemen yeni biçimde yaz; her açılışta yeniden taşınmasın.
      if (state.version !== savedVersion) this.save(state);
      return state;
    } catch (err) {
      console.error('Kayıt okunamadı, yeni oyun başlatılıyor.', err);
      // Bozuk kaydı silmeden kenara al ki elle kurtarılabilsin.
      try {
        if (raw) localStorage.setItem(`${GAME.saveKey}:yedek`, raw);
      } catch {}
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(GAME.saveKey, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('Kayıt yazılamadı.', err);
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(GAME.saveKey);
    } catch {}
  },
};
