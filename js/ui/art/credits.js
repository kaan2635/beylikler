/**
 * Oyunda kullanılan hazır görsellerin ve kütüphanelerin sahipleri. CC-BY lisanslı eserlerde
 * yazarın adı ve lisans gösterilmek zorundadır; Ayarlar → Emeği geçenler bu listeyi gösterir.
 * Ayrıntılı döküm: docs/EMEGI_GECENLER.md
 */

const OGA = 'https://opengameart.org/content/';
const CC0 = { name: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const BY3 = { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' };
const BY4 = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

export const CREDITS = [
  {
    title: 'Bina görselleri',
    note: 'OpenGameArt.org. Görseller kırpıldı, küçültüldü ve WebP biçimine çevrildi.',
    items: [
      { work: 'Western European Medieval Houses', for: 'Konak, Ambar, Çiftlik', author: 'feudalwars', license: CC0, url: `${OGA}western-european-medieval-houses-isometric-25d` },
      { work: 'Medieval Barracks', for: 'Kışla', author: 'feudalwars', license: CC0, url: `${OGA}medieval-barracks-isometric-25d` },
      { work: 'Medieval Stable', for: 'Ahır', author: 'feudalwars', license: CC0, url: `${OGA}medieval-stable-isometric-25d` },
      { work: 'Medieval Blacksmith', for: 'Demirci', author: 'feudalwars', license: CC0, url: `${OGA}medieval-blacksmith-isometric-25d` },
      { work: 'Medieval Archery Range', for: 'Kervansaray', author: 'feudalwars', license: CC0, url: `${OGA}medieval-archery-range-isometric-25d` },
      { work: 'Western European Castle', for: 'Saray, bey hisarları', author: 'feudalwars', license: CC0, url: `${OGA}western-european-castle-isometric-25d` },
      { work: 'Medieval Stone Guard Tower', for: 'Sur (taş)', author: 'feudalwars', license: CC0, url: `${OGA}medieval-stone-guard-tower-isometric-25d` },
      { work: 'Medieval Wooden Guard Tower', for: 'Sur (ahşap)', author: 'feudalwars', license: CC0, url: `${OGA}medieval-wooden-guard-tower-isometric-25d` },
      { work: 'Medieval Building 06', for: 'Oduncu', author: 'Bleed', authorUrl: 'http://remusprites.carbonmade.com/', license: BY3, url: `${OGA}medieval-building-06` },
      { work: 'Simple Isometric Hovel', for: 'Kil ocağı, barbar obaları', author: 'Bleed', authorUrl: 'http://remusprites.carbonmade.com/', license: BY4, url: `${OGA}simple-isometric-hovel` },
      { work: 'Medieval Building 03', for: 'Demir madeni', author: 'Bleed', authorUrl: 'http://remusprites.carbonmade.com/', license: BY3, url: `${OGA}medieval-building-03-bleeds-game-art` },
      { work: 'Old Well', for: 'Gizli depo', author: 'Bleed', authorUrl: 'http://remusprites.carbonmade.com/', license: BY3, url: `${OGA}old-well-bleeds-game-art` },
      { work: 'Merchant tent', for: 'Atölye', author: 'yd', license: CC0, url: `${OGA}merchant-tent` },
      { work: 'Merchant tent v2', for: 'Pazar', author: 'yd', license: CC0, url: `${OGA}merchant-tent-v2` },
    ],
  },
  {
    title: 'Asker ve kaynak simgeleri',
    note: 'game-icons.net. Simgeler oyunun renklerine boyandı.',
    items: [
      { work: 'Pikeman, Guards, Cavalry, Archer, Wood pile, Brick pile, Person, Barn, Two coins', for: 'Birlikler ve kaynaklar', author: 'Delapouite', authorUrl: 'https://delapouite.com/', license: BY3, url: 'https://game-icons.net/' },
      { work: 'Battle axe, Bowman, Dervish swords, Spyglass, Metal bar, Scroll unfurled', for: 'Birlikler ve kaynaklar', author: 'Lorc', authorUrl: 'https://lorcblog.blogspot.com/', license: BY3, url: 'https://game-icons.net/' },
      { work: 'Swordman', for: 'Kılıççı', author: 'Cathelineau', license: BY3, url: 'https://game-icons.net/' },
      { work: 'Cloaked figure on horseback', for: 'Deli', author: 'Caro Asercion', license: BY3, url: 'https://game-icons.net/' },
      { work: 'Mounted knight, Siege ram', for: 'Sipahi, Koçbaşı', author: 'Skoll', license: BY3, url: 'https://game-icons.net/' },
      { work: 'Catapult', for: 'Mancınık', author: 'HeavenlyDog', license: BY3, url: 'https://game-icons.net/' },
    ],
  },
  {
    title: 'Yazılım',
    note: null,
    items: [
      { work: 'PeerJS', for: 'Oda modunda tarayıcılar arası bağlantı', author: 'PeerJS ekibi', license: { name: 'MIT', url: 'https://github.com/peers/peerjs/blob/master/LICENSE' }, url: 'https://peerjs.com/' },
    ],
  },
];
