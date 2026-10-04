// Saldırı birliklerinin hedefe yaklaşım biçimi. Çarpanlar yalnızca oyuncunun saldıran ordusuna uygulanır.
// Kalkan düzeni azaltılmış kayıpla risk yönetir; Kama daha yıkıcıdır; Akın ganimete odaklanır.
export const FORMATIONS = Object.freeze({
  dengeli: Object.freeze({
    name: 'Dengeli saf',
    description: 'Ek değişiklik yok; güvenilir ve öngörülebilir düzen.',
    attack: 1,
    losses: 1,
    carry: 1,
    effect: 'Temel saldırı, kayıp ve taşıma.',
  }),
  kama: Object.freeze({
    name: 'Kama düzeni',
    description: 'Öncü kuvvet düşman hattını deler; hücum gücü yükselir ama zaferde daha çok asker kaybedilebilir.',
    attack: 1.18,
    losses: 1.2,
    carry: 1,
    effect: 'Saldırı +%18 · zaferde kayıp +%20.',
  }),
  kalkan: Object.freeze({
    name: 'Kalkan duvarı',
    description: 'Sıkı saflar hücumu yavaşlatır ancak zaferde asker kaybını azaltır.',
    attack: 0.92,
    losses: 0.72,
    carry: 1,
    effect: 'Saldırı −%8 · zaferde kayıp −%28.',
  }),
  akin: Object.freeze({
    name: 'Akın kolu',
    description: 'Hafif ve çevik birlikler daha fazla ganimet taşır; ağır hücum gücünden feragat eder.',
    attack: 0.95,
    losses: 1,
    carry: 1.3,
    effect: 'Saldırı −%5 · taşıma +%30.',
  }),
});

export const FORMATION_IDS = Object.freeze(Object.keys(FORMATIONS));
export const DEFAULT_FORMATION = 'dengeli';
