import { h } from './dom.js';
import { icon } from './icons.js';

// Yeni oyunda kısa bir giriş hikâyesi; eski oyunculara 2.0 sürümünün yenilikleri (bir kez).

const SEEN_KEY = 'beylikler:surum-notu';
const VERSION = '2.0';

const NEWS = [
  ['nav-kahraman', 'Kahraman', 'Beyliğinin alpı seviye atlar, özellik puanı dağıtır, kılıç, zırh, at ve nişan kuşanır. Orduya önderlik eder, köyünü korur.'],
  ['san', 'Şan ve unvan', 'Zaferler ve başarılar şan getirir: Sancakbeyi, Beylerbeyi, Paşa, Hünkâr. Her unvan bütün köylere ayrıcalık sağlar.'],
  ['harabe', 'Harabeler', 'Haritaya dağılmış kadim harabelerin muhafızlarını yen; hazine, Akçe ve eşya kazan.'],
  ['ordugah', 'Moğol akını', 'Bozkırdan gelen Moğollar köyünün yakınına ordugâh kurar ve dalga dalga saldırır. Ordugâhı dağıtanı büyük ödül bekler.'],
  ['nav-kesif', 'Yeni keşif', 'Altı bölge (orman, bozkır, dağ, harabe, sahil…), kahramanla keşif, ustalık ve eşya, hazine, kervan, yılkı atı gibi yeni bulgular.'],
  ['nav-koy', 'Büyüyen binalar', 'Binalar 5, 10, 15 ve 20. seviyelerde görünüş değiştirir: kulübe ev olur, ev konak, konak köşk. Köyde gece-gündüz, duman, hava ve köylüler.'],
  ['nav-harita', 'Canlı harita', 'Beylerin toprakları, yürüyen ordular, harabeler, ordugâh ve arazinin savunmaya etkisi (tepe +%20, orman +%10).'],
  ['nav-tarihce', 'Tarihçe', 'Beyliğinin günden güne büyümesi grafiklerle: puan, üretim, ordu, şan.'],
  ['nav-divan', 'Daha çok içerik', 'Divan’da 6. kademe araştırmalar, 8 yeni olay, yeni görev ve başarımlar.'],
];

function overlayWith(content, onClose) {
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'news-title' }, content);
  const close = () => {
    overlay.remove();
    document.body.classList.remove('has-overlay');
    onClose?.();
  };
  document.body.append(overlay);
  document.body.classList.add('has-overlay');
  return close;
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, VERSION);
  } catch {
    // Depolama kapalıysa pencere bir sonraki açılışta yeniden görünür; sorun değil.
  }
}

function seen() {
  try {
    return localStorage.getItem(SEEN_KEY) === VERSION;
  } catch {
    return true;
  }
}

/** Eski bir kayıtla gelen oyuncuya 2.0 yeniliklerini bir kez gösterir. */
export function maybeShowWhatsNew() {
  if (seen() || document.querySelector('.overlay')) return;
  const ok = h('button', { type: 'button', class: 'btn btn-large btn-gold' }, 'Beyliğime dön');
  const hero = h('a', { class: 'btn btn-large btn-ghost', href: '#/kahraman' }, 'Kahramanımı gör');
  const close = overlayWith(
    h(
      'div',
      { class: 'picker news stack' },
      h('header', { class: 'picker-head' }, h('p', { class: 'eyebrow' }, 'Beylikler 2.0'), h('h1', { id: 'news-title' }, 'Beyliğin büyüdü!'), h('p', { class: 'muted' }, 'Kaydın güvende; bütün yenilikler mevcut oyununa eklendi. Kazandığın şan, unvanını hemen belirledi.')),
      h('ul', { class: 'news-grid' }, NEWS.map(([iconName, title, text]) => h('li', null, h('span', { class: 'news-icon' }, icon(iconName)), h('div', null, h('strong', null, title), h('span', null, text))))),
      h('div', { class: 'picker-foot' }, hero, ok),
    ),
    markSeen,
  );
  ok.addEventListener('click', close);
  hero.addEventListener('click', close);
  ok.focus();
}

/** Yeni oyunun açılış hikâyesi; kapanınca `onDone` (sınıf seçimi) çağrılır. */
export function openIntro(onDone) {
  markSeen(); // yeni oyuncuya ayrıca "yenilikler" penceresi açılmaz
  const go = h('button', { type: 'button', class: 'btn btn-large btn-gold' }, 'Beyliğimi kur');
  const close = overlayWith(
    h(
      'div',
      { class: 'picker intro stack' },
      h('div', { class: 'intro-art', 'aria-hidden': 'true' }, introArt()),
      h('p', { class: 'eyebrow' }, 'Anadolu, 13. yüzyılın sonu'),
      h('h1', { id: 'news-title' }, 'Bir beylik doğuyor'),
      h('p', { class: 'intro-text' }, 'Selçuklu’nun gücü dağıldı. Uç boylarında her bey kendi sancağını dikti; yollar eşkıyaya, ovalar akıncıya kaldı. Doğudan Moğol tozu yükseliyor.'),
      h('p', { class: 'intro-text' }, 'Sana küçük bir köy, bir avuç yiğit ve sadık bir alp kaldı. Odun kes, kil çıkar, demir dök. Köyünü büyüt, harabelerin sırrını çöz, komşu beylerle dost ol ya da onları diz çöktür.'),
      h('p', { class: 'intro-text' }, 'Şanın yayıldıkça Sancakbeyi, Beylerbeyi, Paşa olacaksın. Ve bir gün bütün beyler sana bağlanırsa, Sultan.'),
      h('div', { class: 'picker-foot' }, go),
    ),
    onDone,
  );
  go.addEventListener('click', close);
  go.focus();
}

/** Giriş hikâyesinin ufuk resmi: tepeler, hisar, sancak ve doğan güneş. */
function introArt() {
  const span = h('span');
  span.innerHTML = `<svg viewBox="0 0 600 170" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="intro-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c77a"/><stop offset=".6" stop-color="#f6e2b4"/><stop offset="1" stop-color="#efe0bd"/></linearGradient>
  </defs>
  <rect width="600" height="170" fill="url(#intro-sky)"/>
  <circle cx="420" cy="120" r="46" fill="#f9d77e" opacity=".9"/>
  <path d="M0 130 C80 100 150 112 230 98 S380 84 460 104 560 96 600 92 V170 H0z" fill="#b9a476"/>
  <path d="M0 150 C100 128 200 138 300 126 S480 118 600 132 V170 H0z" fill="#8f7d52"/>
  <g fill="#5b4a30">
    <path d="M250 126v-34h10v-8h6v8h8v-8h6v8h8v-8h6v8h10v34z"/>
    <path d="M282 92v-30l12-10 12 10v30z"/>
    <rect x="290" y="72" width="8" height="12" fill="#2f2516"/>
  </g>
  <path d="M294 52V26" stroke="#3a2c18" stroke-width="2"/>
  <path d="M295 27c10 2 18-2 26 1-6 4-6 9 0 13-8-3-16 1-26-1z" fill="#a3321f"/>
  <circle cx="306" cy="34" r="3" fill="#f6e2b4"/>
  <g fill="#3d3220" opacity=".8">
    <path d="M110 140l6-14 6 14z"/><path d="M128 142l5-11 5 11z"/><path d="M470 140l6-13 6 13z"/><path d="M488 142l5-10 5 10z"/>
  </g>
  <path d="M60 60q8-6 16 0q8-6 16 0M500 46q6-5 12 0q6-5 12 0" fill="none" stroke="#5b4a30" stroke-width="2"/>
</svg>`;
  return span;
}
