// Kahraman portresi: sivri miğferli, zırh yakalıklı bir alp. Kuşandığı eşyaların nadirliği
// kaftanın ve süslerin rengini, seviyesi miğferin sorgucunu belirler. Yaralıyken soluk ve
// sargılı görünür. Yalnız şekil çizer; içine hiçbir oyuncu metni girmez.

const RARITY_COLORS = { siradan: '#8a8170', nadir: '#2f6fae', efsanevi: '#c27a1a' };
let uid = 0;

export function heroPortrait(hero, { wounded = false } = {}) {
  const id = `hp${++uid}`;
  const armor = hero.equipment?.zirh?.rarity;
  const weapon = hero.equipment?.silah?.rarity;
  const charm = hero.equipment?.nisan?.rarity;
  const kaftan = armor === 'efsanevi' ? '#6c2a7a' : armor === 'nadir' ? '#24508a' : armor ? '#6b4a2a' : '#8f2f1d';
  const kaftanDark = armor === 'efsanevi' ? '#4a1c55' : armor === 'nadir' ? '#173860' : armor ? '#4a321c' : '#5f1e12';
  const trim = hero.level >= 20 || weapon === 'efsanevi' ? '#f0c95a' : hero.level >= 10 || weapon === 'nadir' ? '#d9ae4a' : '#b08a4a';
  const plume = hero.level >= 10;
  const glow = charm ? RARITY_COLORS[charm] : null;
  return `<svg viewBox="0 0 120 120" role="img" aria-label="Kahraman portresi"${wounded ? ' class="wounded"' : ''}>
  <defs>
    <radialGradient id="${id}-bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#f7e9c6"/><stop offset=".7" stop-color="#d8b672"/><stop offset="1" stop-color="#a77e3a"/></radialGradient>
    <linearGradient id="${id}-helm" x1="0" x2="1"><stop offset="0" stop-color="#5d646c"/><stop offset=".42" stop-color="#e3e7ea"/><stop offset=".6" stop-color="#b7bec5"/><stop offset="1" stop-color="#4f555c"/></linearGradient>
    <linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6b688"/><stop offset="1" stop-color="#c98f62"/></linearGradient>
    <clipPath id="${id}-clip"><circle cx="60" cy="60" r="57"/></clipPath>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#${id}-bg)"/>
  ${glow ? `<circle cx="60" cy="60" r="54" fill="none" stroke="${glow}" stroke-width="3" opacity=".55"/>` : ''}
  <g clip-path="url(#${id}-clip)">
    <path d="M8 124c2-24 20-38 52-38s50 14 52 38z" fill="${kaftan}"/>
    <path d="M8 124c2-24 20-38 52-38" fill="none" stroke="${kaftanDark}" stroke-width="4" opacity=".6"/>
    <path d="M60 90l-14 34h28z" fill="${kaftanDark}"/>
    <path d="M44 92c5 7 11 10 16 10s11-3 16-10" fill="none" stroke="${trim}" stroke-width="3.2"/>
    <path d="M30 104l8 14M90 104l-8 14" stroke="${trim}" stroke-width="2.2" opacity=".8"/>
    <circle cx="60" cy="108" r="2.6" fill="${trim}"/><circle cx="60" cy="117" r="2.6" fill="${trim}"/>
    <path d="M36 50c0 24 10 40 24 40s24-16 24-40z" fill="#868d95"/>
    <path d="M38 62h44M37 70h46M39 78h42M43 86h34" stroke="#5f666d" stroke-width="1.3" stroke-dasharray="2 1.6"/>
    <path d="M50 72h20v14c-4 3-16 3-20 0z" fill="#c08758"/>
    <ellipse cx="60" cy="59" rx="16.5" ry="19.5" fill="url(#${id}-skin)"/>
    <path d="M48.5 50.5l8.5 1.6M71.5 50.5l-8.5 1.6" stroke="#3a2412" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M51 56.5c1.6-1.4 4.4-1.4 6 0M63 56.5c1.6-1.4 4.4-1.4 6 0" fill="none" stroke="#24170c" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M60 57v8.5l-2.4 1.6" fill="none" stroke="#a46d45" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M45 66c0 11 6.5 18 15 18s15-7 15-18c-3.5 5.5-8.5 7.5-15 7.5S48.5 71.5 45 66z" fill="#3f2713"/>
    <path d="M60 69c-4.5-2.8-11-2-15.5 3.8 4.8-1 10-1.2 15.5-2.3 5.5 1.1 10.7 1.3 15.5 2.3C71 67 64.5 66.2 60 69z" fill="#2c1a0c"/>
    <path d="M56.5 75.5c2.2 1 4.8 1 7 0" stroke="#7a3d26" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M40 51c0-15 8.5-27 20-35 11.5 8 20 20 20 35z" fill="url(#${id}-helm)" stroke="#3a3f45" stroke-width="1.2"/>
    <path d="M60 16c-3 9-4 21-4 35M60 16c3 9 4 21 4 35" stroke="#7d848b" stroke-width="1" fill="none" opacity=".7"/>
    <path d="M37.5 49h45v6h-45z" fill="${trim}" stroke="#6b5220" stroke-width=".8"/>
    <path d="M41 52h3M48 52h3M55 52h3M62 52h3M69 52h3M76 52h3" stroke="#6b5220" stroke-width="1.4"/>
    <path d="M58.4 55h3.2v13.5l-1.6 2-1.6-2z" fill="#767d84" stroke="#3a3f45" stroke-width=".7"/>
    <path d="M60 16V7" stroke="#3a3f45" stroke-width="2.2"/>
    <circle cx="60" cy="7" r="2.6" fill="${trim}"/>
    ${plume ? `<path d="M61 9c5-7 15-8.5 20-4-6.5-.3-11.5 2.2-15.5 7.2" fill="#a3321f" stroke="#6e1f12" stroke-width=".8"/><path d="M62 10c4-4.5 10-6 14-4.8" stroke="#d55a3a" stroke-width="1" fill="none"/>` : ''}
    ${wounded ? `<path d="M64 58.5l11 4.5-1.6 3.6-11-4.5z" fill="#efe6d6" stroke="#b7a98f" stroke-width=".7"/><path d="M66.5 58.8l-1.4 3.4M70 60.2l-1.4 3.4" stroke="#c9bca3" stroke-width=".7"/><circle cx="69" cy="61.6" r="1.5" fill="#b2402a" opacity=".75"/>` : ''}
  </g>
  <circle cx="60" cy="60" r="57.5" fill="none" stroke="#7d5a1e" stroke-width="2"/>
</svg>`;
}
