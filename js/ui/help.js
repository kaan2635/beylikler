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
    title: 'Ordu ve savaş düzenleri',
    text: 'Kışla kurunca Yaya ve Kılıççı eğit; köyünü savunurlar. Ordu ekranındaki rol süzgeciyle birlik kartlarını ayıkla. Arbaletçi menzilli hücum, Tatar Atlısı hız, Lağımcı ise sur kuşatması için uzmanlaşır. Harita saldırısında Kama hücumu, Kalkan duvarı zaferde hayatta kalmayı, Akın kolu ganimeti artırır.',
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
    icon: 'mevsim-ilkbahar',
    title: 'Mevsim fermanları',
    text: "Divan'da her mevsim bir ferman seçebilirsin. Bereket üretimi, Seferberlik saldırı ve asker eğitimini, İmar inşaat ve ambarı güçlendirir. Etki tüm köylerine işler; seçimi mevsim bitene kadar değiştiremezsin.",
  },
  {
    icon: 'nav-divan',
    title: 'Divan ve araştırmalar',
    text: "Konak üzerinden Divan'da kalıcı araştırmalar yaparsın: üretim, ambar, eğitim, savunma… Kademeler Konak seviyesiyle açılır; Yeniçeri Ocağı ve Tophane yeni birlikler getirir.",
  },
  {
    icon: 'tasima',
    title: 'Otomatik kervan hatları',
    text: "İki köyün arasında Pazar sayfasından düzenli sevkiyat kur. Yükü ve ambarında kalacak yedeği belirle; hedef ambardaki boş yer ve yoldaki kervanlar hesaba katılarak yük otomatik azaltılır. Kaynak ya da tüccar yetmezse çevrim atlanır. Her üç Pazar seviyesi bir hat yeri sağlar.",
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
    icon: 'nav-kahraman',
    title: 'Kahraman',
    text: 'Beyliğinin alpı seviye atladıkça özellik puanı kazanır: Kılıç, Kalkan, Bereket, Akın. Köyündeyken üretime ve savunmaya güç katar; saldırı ya da keşif formunda "Kahraman katılsın" seçilirse orduya önderlik eder. Yenilen ordudaki kahraman yaralanır ve bir süre iyileşir. Kılıç, zırh, at ve nişan kuşanabilir.',
  },
  {
    icon: 'san',
    title: 'Şan ve unvan',
    text: 'Zaferler, savunmalar, fetihler, görevler, başarımlar, harabeler, Moğol akınları ve araştırmalar şan getirir. Şan arttıkça Sancakbeyi, Beylerbeyi, Paşa ve Hünkâr olursun; her unvan bütün köylerine kalıcı ayrıcalık sağlar.',
  },
  {
    icon: 'harabe',
    title: 'Harabeler ve arazi',
    text: 'Haritadaki kadim harabelerin eşkıya muhafızlarını yen: hazine, Akçe ve kahramana eşya. Yağmalanan harabe birkaç gün sonra yeniden dolar; uzaktakiler daha güçlüdür. Tepedeki köyler +%20, ormandakiler +%10 savunma kazanır.',
  },
  {
    icon: 'ordugah',
    title: 'Moğol akını',
    text: 'Bir haftadan sonra Moğollar köyünün yakınına ordugâh kurar ve dalga dalga saldırır. Tepe çubuğundaki uyarı ordugâhı gösterir. Ordugâhı dağıtırsan akın biter ve büyük ödül alırsın; bütün dalgaları püskürtmek de ödüllendirilir. Barış zorluğunda akın olmaz.',
  },
  {
    icon: 'nav-kesif',
    title: 'Keşif bölgeleri',
    text: 'Kervansaray seviyesi arttıkça yeni bölgeler açılır: ormanda kaynak, bozkırda at ve göçebeler, dağda hazine, harabelerde eşya ve harita, sahilde kervanlar. Sefer yaklaşımını Dengeli, Kaynak arayışı, Levent arayışı ya da Tedbirli seç; sonuç olasılıkları anında güncellenir ve raporda saklanır. Her sefer keşif ustalığını artırır; kahraman katılırsa bulgular artar, tehlike azalır.',
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
