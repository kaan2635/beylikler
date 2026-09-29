// Oyuncunun sunucuda çalıştırabileceği eylemler. Her eylem argümanlarını denetler ve oyunun
// kendi kurallarını (Game → systems/) sunucu saatiyle çağırır. Listede olmayan hiçbir şey
// (dünya hızı, zorluk, sıfırlama, kayıt içe aktarma) istemciden değiştirilemez.

const fail = (message) => {
  throw new Error(message);
};

function str(value, max = 64) {
  if (typeof value !== 'string' || !value.length || value.length > max) fail('Geçersiz metin');
  return value;
}

function int(value) {
  if (!Number.isSafeInteger(value)) fail('Geçersiz sayı');
  return value;
}

function counts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Geçersiz liste');
  const out = {};
  for (const [key, n] of Object.entries(value)) {
    if (!/^[a-z]{2,20}$/.test(key)) fail('Geçersiz ad');
    out[key] = int(n);
  }
  return out;
}

function ids(value) {
  if (!Array.isArray(value) || value.length > 500) fail('Geçersiz liste');
  return value.map(int);
}

function options(value) {
  if (value == null) return {};
  if (typeof value !== 'object') fail('Geçersiz seçenek');
  return value.catapultTarget ? { catapultTarget: str(value.catapultTarget, 20) } : {};
}

function names(value) {
  if (value == null) return {};
  if (typeof value !== 'object') fail('Geçersiz ad');
  return {
    ...(value.playerName != null && { playerName: String(value.playerName).slice(0, 24) }),
    ...(value.villageName != null && { villageName: String(value.villageName).slice(0, 32) }),
  };
}

/** Sonucu {ok, reason} biçimine çevirir (bazı eylemler nesne yerine iş ya da boolean döndürür). */
const done = (value, reason = 'Yapılamadı') => (value && typeof value === 'object' && 'ok' in value ? value : value ? { ok: true, value } : { ok: false, reason });

export const ACTIONS = {
  upgrade: (g, [building], now) => g.upgrade(str(building, 20), now),
  cancelLastUpgrade: (g, [], now) => done(g.cancelLastUpgrade(now), 'İptal edilecek inşaat yok'),
  train: (g, [unit, count], now) => g.train(str(unit, 20), int(count), now),
  cancelLastTraining: (g, [building], now) => done(g.cancelLastTraining(str(building, 20), now), 'İptal edilecek eğitim yok'),
  research: (g, [unit], now) => g.research(str(unit, 20), now),
  cancelResearch: (g, [], now) => done(g.cancelResearch(now), 'Süren geliştirme yok'),
  trade: (g, [give, take, amount], now) => g.trade(str(give, 10), str(take, 10), int(amount), now),
  sendTransport: (g, [target, resources], now) => g.sendTransport(str(target, 40), counts(resources), now),
  withdrawSupport: (g, [home, host], now) => g.withdrawSupport(str(home, 40), str(host, 40), now),
  sendAttack: (g, [x, y, units, opts], now) => g.sendAttack(int(x), int(y), counts(units), now, options(opts)),
  repeatAttack: (g, [report], now) => g.repeatAttack(int(report), now),
  repeatAttacks: (g, [reports], now) => g.repeatAttacks(ids(reports), now),
  recallAttack: (g, [movement], now) => g.recallAttack(int(movement), now),
  sendExpedition: (g, [units, hold], now) => g.sendExpedition(counts(units), int(hold), now),
  repeatExpedition: (g, [report], now) => g.repeatExpedition(int(report), now),
  deleteReports: (g, [list]) => done((g.deleteReports(ids(list)), true)),
  markReportsRead: (g, [list]) => done((g.markReportsRead(ids(list)), true)),
  setActiveVillage: (g, [id]) => done(g.setActiveVillage(str(id, 40)), 'Köy seçilemedi'),
  renameVillage: (g, [name]) => done(g.renameVillage(str(name, 64)), 'Köy adı boş olamaz'),
  renamePlayer: (g, [name]) => done(g.renamePlayer(str(name, 64)), 'Bey adı boş olamaz'),
  chooseClass: (g, [classId, playerNames], now) => g.chooseClass(str(classId, 20), names(playerNames), now),
  changeClass: (g, [classId], now) => g.changeClass(str(classId, 20), now),
  hireOfficer: (g, [officer], now) => g.hireOfficer(str(officer, 20), now),
  finishBuilding: (g, [], now) => g.finishBuilding(now),
  finishResearch: (g, [], now) => g.finishResearch(now),
  buyResourcePack: (g, [], now) => g.buyResourcePack(now),
  claimQuest: (g, [quest], now) => g.claimQuest(str(quest, 40), now),
  claimDaily: (g, [], now) => g.claimDaily(now),
};
