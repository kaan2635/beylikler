// Etki nesnesini (bkz. config/classes.js DEFAULT_BONUS) okunur metne çevirir:
// { production: 1.25, buildTime: 0.7 } → "üretim +%25, inşaat süresi −%30".

const LABELS = {
  production: 'üretim',
  prodOdun: 'odun',
  prodKil: 'kil',
  prodDemir: 'demir',
  storage: 'ambar',
  carry: 'ganimet',
  buildTime: 'inşaat süresi',
  trainTime: 'eğitim süresi',
  researchTime: 'geliştirme süresi',
  travel: 'yolculuk süresi',
  attack: 'saldırı',
  defense: 'savunma',
  merchantCapacity: 'tüccar kapasitesi',
  merchantTime: 'tüccar süresi',
  expeditionReward: 'keşif bulguları',
  expeditionRisk: 'keşif tehlikesi',
};

export function bonusText(bonus) {
  return Object.entries(bonus ?? {})
    .filter(([key, value]) => LABELS[key] && value !== 1)
    .map(([key, value]) => `${LABELS[key]} ${value > 1 ? '+' : '−'}%${Math.round(Math.abs(value - 1) * 100)}`)
    .join(', ');
}
