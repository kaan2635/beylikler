import { h } from './dom.js';
import { icon } from './icons.js';

// Kısa oyun rehberi: tepe çubuğundaki "?" düğmesi açar.
const TOPICS = [
  {
    icon: 'nav-koy',
    title: 'Köyünü büyüt',
    text: 'Oduncu, Kil Ocağı ve Demir Madeni saatlik üretimi artırır. Ambar dolunca üretim durur; Çiftlik nüfusu artırır. Sahnede bir binaya tıkla, açılan pencereden yükselt. Aynı anda iki inşaat kuyruğa girer.',
  },
  {
    icon: 'nav-gorevler',
    title: 'Ne yapacağını Görevler söyler',
    text: 'Görev kutusundaki "Git →" seni doğru binaya ya da sayfaya götürür. Biten görevin ödülünü (kaynak, bazen Akçe) "Ödülü al" ile topla.',
  },
  {
    icon: 'nav-ordu',
    title: 'Ordu',
    text: 'Kışla kurunca Yaya ve Kılıççı eğit; köyünü savunurlar. Baltacı ve atlılar saldırı içindir. Bina listesindeki "Yükseltilebilir" süzgeci şu an parası yeten binaları gösterir.',
  },
  {
    icon: 'nav-harita',
    title: 'Yağma',
    text: 'Haritadan bir barbar köyü seç, göndereceğin askerleri yaz ve saldır. Ganimet ambarına gelir. Yakındaki köyler listesindeki "Tekrar" son orduyu yeniden yollar.',
  },
  {
    icon: 'savunma',
    title: 'Rakip beyler',
    text: 'Koruma süresinden sonra ara sıra saldırırlar (Normal\'de en az 40 oyun saati arayla); saldırının gücü köyünün büyüklüğüyle ölçülür. Gelen saldırıyı tepe çubuğundaki kırmızı uyarı gösterir. Sur, savunma askerleri ve Gizli Depo korur. Zorluğu Ayarlar\'dan değiştirebilirsin; Barış\'ta hiç saldırı olmaz.',
  },
  {
    icon: 'mevsim-ilkbahar',
    title: 'Mevsimler',
    text: 'Dünya her 4 oyun gününde bir mevsim değiştirir. İlkbahar üretimi, yaz yolları ve odunu, sonbahar kili ve keşfi artırır; kış üretimi düşürür, orduları yavaşlatır ama savunmaya güç katar. Tepe çubuğundaki mevsim simgesi kalan süreyi gösterir.',
  },
  {
    icon: 'nav-divan',
    title: 'Divan ve araştırmalar',
    text: "Konak üzerinden Divan'da kalıcı araştırmalar yaparsın: üretim, ambar, eğitim, savunma… Kademeler Konak seviyesiyle açılır; Yeniçeri Ocağı ve Tophane yeni birlikler getirir.",
  },
  {
    icon: 'olay',
    title: 'Olaylar',
    text: 'Ara sıra beyliğine bir olay gelir: kervan, kıtlık, haydutlar, usta bir mimar… Tepe çubuğundaki parşömene tıklayıp seçimini yap. Süresi içinde karar vermezsen olay kendi seyrine bırakılır.',
  },
  {
    icon: 'nav-diplomasi',
    title: 'Diplomasi',
    text: 'Beylere hediye göndererek ilişkini düzelt. İyi ilişkideki bey daha seyrek saldırır, müttefik bey hiç saldırmaz; barış antlaşması birkaç gün saldırıyı durdurur. Hisarına saldırırsan ilişki bozulur.',
  },
  {
    icon: 'akce',
    title: 'Akçe',
    text: 'Görev, başarım, savunma zaferi ve keşifle kazanılır. Hazine\'de görevli tutmak ya da inşaatı hemen bitirmek için harcanır.',
  },
];

let open = null;

/** Rehber penceresini açar; Esc, × ya da dışarı tıklamak kapatır. */
export function openHelp() {
  if (open) return;
  const close = h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Kapat' }, '×');
  const panel = h(
    'div',
    { class: 'picker help-dialog stack' },
    close,
    h('header', { class: 'picker-head' }, h('p', { class: 'eyebrow' }, 'Beylikler'), h('h1', { id: 'help-title' }, 'Nasıl oynanır?')),
    h(
      'div',
      { class: 'help-grid' },
      TOPICS.map((topic) => h('section', { class: 'help-topic' }, h('span', { class: 'help-icon' }, icon(topic.icon)), h('div', null, h('h3', null, topic.title), h('p', null, topic.text)))),
    ),
  );
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title' }, panel);
  const onKey = (event) => {
    if (event.key === 'Escape') shut();
  };
  function shut() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.classList.remove('has-overlay');
    open = null;
  }
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('.dialog-close')) shut();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  document.body.classList.add('has-overlay');
  close.focus();
  open = { close: shut };
}
