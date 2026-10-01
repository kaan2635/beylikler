# Emeği geçenler

Beylikler'deki hazır görseller ücretsiz lisanslı eserlerdir. CC-BY lisanslı eserlerde yazarın adı,
eserin bağlantısı ve lisans gösterilmelidir; oyunda bu döküm **Ayarlar → Emeği geçenler**
bölümünde de vardır (`js/ui/art/credits.js`).

## Bina görselleri — [OpenGameArt.org](https://opengameart.org/)

Değişiklikler: görseller saydam kenarlarından kırpıldı, en fazla 360 piksele küçültüldü ve WebP
biçimine çevrildi (`assets/gorsel/binalar/`).

| Oyundaki yeri | Eser | Yazar | Lisans |
| --- | --- | --- | --- |
| Konak, Ambar, Çiftlik | [Western European Medieval Houses (Isometric 2.5D)](https://opengameart.org/content/western-european-medieval-houses-isometric-25d) | feudalwars | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Kışla | [Medieval Barracks (Isometric 2.5D)](https://opengameart.org/content/medieval-barracks-isometric-25d) | feudalwars | CC0 |
| Ahır | [Medieval Stable (Isometric 2.5D)](https://opengameart.org/content/medieval-stable-isometric-25d) | feudalwars | CC0 |
| Demirci | [Medieval Blacksmith (Isometric 2.5D)](https://opengameart.org/content/medieval-blacksmith-isometric-25d) | feudalwars | CC0 |
| Kervansaray | [Medieval Archery Range (Isometric 2.5D)](https://opengameart.org/content/medieval-archery-range-isometric-25d) | feudalwars | CC0 |
| Saray, bey hisarları | [Western European Castle (Isometric 2.5D)](https://opengameart.org/content/western-european-castle-isometric-25d) | feudalwars | CC0 |
| Sur (taş kule) | [Medieval Stone Guard Tower (Isometric 2.5D)](https://opengameart.org/content/medieval-stone-guard-tower-isometric-25d) | feudalwars | CC0 |
| Sur (ahşap kule) | [Medieval Wooden Guard Tower (Isometric 2.5D)](https://opengameart.org/content/medieval-wooden-guard-tower-isometric-25d) | feudalwars | CC0 |
| Oduncu | [Medieval Building 06](https://opengameart.org/content/medieval-building-06) | Bleed — http://remusprites.carbonmade.com/ | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Kil ocağı, barbar obaları | [Simple Isometric Hovel](https://opengameart.org/content/simple-isometric-hovel) | Bleed — http://remusprites.carbonmade.com/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Demir madeni | [Medieval Building 03](https://opengameart.org/content/medieval-building-03-bleeds-game-art) | Bleed — http://remusprites.carbonmade.com/ | CC BY 3.0 |
| Gizli depo | [Old Well](https://opengameart.org/content/old-well-bleeds-game-art) | Bleed — http://remusprites.carbonmade.com/ | CC BY 3.0 |
| Atölye | [Merchant tent](https://opengameart.org/content/merchant-tent) | yd | CC0 |
| Pazar | [Merchant tent v2](https://opengameart.org/content/merchant-tent-v2) | yd | CC0 |

Bu tarzda ücretsiz bir maden girişi görseli bulunamadı; Demir madeni için en yakın yapı
(Medieval Building 03) kullanıldı. "Isometric Medieval Tavern" (Bleed) sayfada CC-BY yazsa da
paketin kendi lisans dosyası dağıtımı yasakladığı için kullanılmadı.

## Asker ve kaynak simgeleri — [game-icons.net](https://game-icons.net/)

Lisans: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Değişiklik: simgeler oyunun
renklerine boyandı, madalyon içine yerleştirildi (`js/ui/art/game-icons.js`).

| Simge | Oyundaki yeri | Yazar |
| --- | --- | --- |
| pikeman, guards, cavalry, archer | Yaya, Muhafız, Akıncı, Atlı okçu | Delapouite |
| wood-pile, brick-pile, person, barn, two-coins | Odun, Kil, Nüfus, Ambar, Akçe | Delapouite |
| battle-axe, bowman, dervish-swords, spyglass, scroll-unfurled | Baltacı, Okçu, Serdengeçti, Gözcü, Elçi | Lorc |
| metal-bar | Demir | Lorc |
| swordman | Kılıççı | Cathelineau |
| cloaked-figure-on-horseback | Deli | Caro Asercion |
| mounted-knight, siege-ram | Sipahi, Koçbaşı | Skoll |
| catapult | Mancınık | HeavenlyDog |

Yeniçeri ve Topçu simgeleri ile mevsim, olay, Divan ve diplomasi simgeleri oyun için özgün
olarak çizildi (`js/ui/art/custom-icons.js`, `js/ui/icons.js`). Gözetleme Kulesi, sur kulelerinin
görselini (feudalwars, CC0) kullanır.

2.0 ile gelen görseller de oyun için özgün olarak kodla çizildi; dışarıdan yeni dosya
eklenmedi: kahraman portresi (`js/ui/art/portrait.js`), harabeler, Moğol ordugâhı, bey
toprakları ve yürüyen ordular (`js/ui/art/map-sites.js`), binaların görünüş aşamaları
(`js/ui/art/stages.js`; yukarıdaki bina görselleri çit, taş avlu, sancak, fener ve yan yapılarla
birleştirilir), canlı köy sahnesi (`js/ui/art/scene.js`) ve kahraman, eşya, şan, harabe,
ordugâh ve tarihçe simgeleri (`js/ui/icons.js`).

## Yazılım

- [PeerJS](https://peerjs.com/) 1.5.5 — MIT lisansı. Oda modunda tarayıcılar arası bağlantı için
  jsDelivr'dan (SRI doğrulamalı) yüklenir; bağlantı kurulumunda PeerJS'in ücretsiz sunucusu
  (0.peerjs.com) kullanılır.
