// Her mevsimde bir kez seçilebilen, beyliğin tüm köylerine yayılan fermanlar.
export const EDICTS = Object.freeze({
  bereket: Object.freeze({
    name: 'Bereket Fermanı',
    icon: 'odun',
    description: 'Vergi yükünü hafiflet, üreticilere destek ver. Köylerin daha çok kaynak üretir.',
    effect: 'Tüm köylerde kaynak üretimi +%15',
    bonus: { production: 1.15 },
  }),
  seferberlik: Object.freeze({
    name: 'Seferberlik Fermanı',
    icon: 'nav-ordu',
    description: 'Ustalara ve komutanlara öncelik tanı. Askerler daha hızlı yetişir, saldırı orduların güçlenir.',
    effect: 'Saldırı +%10 · asker eğitimi %10 hızlı',
    bonus: { attack: 1.1, trainTime: 0.9 },
  }),
  imar: Object.freeze({
    name: 'İmar Fermanı',
    icon: 'ambar',
    description: 'Ustaları ve ambarları destekle. Yapılar hızla yükselir, depolar genişler.',
    effect: 'İnşaat %15 hızlı · ambar kapasitesi +%10',
    bonus: { buildTime: 0.85, storage: 1.1 },
  }),
});

export const EDICT_IDS = Object.freeze(Object.keys(EDICTS));
