# Beylikler — Yol Haritası

Her adım sonunda oyun **oynanabilir** ve **testleri geçer** durumda olur. Arka plan ve kararlar için bkz. [ARASTIRMA.md](ARASTIRMA.md).

## ✅ Adım 0 — Araştırma ve iskelet

- [x] Klanlar, Travian ve OGame mekaniklerinin incelenmesi
- [x] GitHub Pages kısıtları ve çok oyunculu seçeneklerin karşılaştırması
- [x] Mimari: saf motor (`core/`, `systems/`) + arayüz (`ui/`) + depolama (`storage/`)
- [x] Klasör yapısı, yerel sunucu, test altyapısı

## ✅ Adım 1 — Çekirdek ekonomi

- [x] 3 kaynak (odun, kil, demir), zamana bağlı üretim, ambar kapasitesi
- [x] 9 bina: üstel maliyet ve süre, gereksinimler (Kışla için Konak 3), nüfus
- [x] İnşaat kuyruğu (2 sıra), geri sayım, ilerleme çubuğu, son işi iptal edip tam iade alma
- [x] "Kaynaklar şu saatte hazır" tahmini
- [x] Çevrimdışı ilerleme: sekme kapalıyken biten inşaatlar açılışta işlenir
- [x] Kayıt: localStorage, sürümlü şema + migrasyon, dışa/içe aktarma kodu, sıfırlama
- [x] Ayarlar: köy adı, dünya hızı (test için 100x'e kadar)
- [x] Telefon uyumlu arayüz, açık/koyu tema
- [x] 19 birim testi (`npm test`)

## ✅ Adım 2 — GitHub'da yayın

- [x] Depo oluşturma ve dosyaları yükleme → [github.com/kaan2635/beylikler](https://github.com/kaan2635/beylikler)
- [x] GitHub Actions: her gönderimde testleri çalıştır
- [x] GitHub Pages yayını → https://kaan2635.github.io/beylikler/

## ✅ Adım 3 — Ordu

- [x] 9 birim: Yaya, Kılıççı, Baltacı, Okçu, Gözcü, Akıncı, Sipahi, Koçbaşı, Mancınık (saldırı, 3 tür savunma, hız, taşıma)
- [x] Ahır ve Atölye binaları; birimlerin bina seviyesi gereksinimleri
- [x] Bina başına eğitim kuyruğu (5 parti), askerler birer birer yetişir, son partiyi iptal edip yetişmeyenlerin parasını geri alma
- [x] Askerler nüfus kullanır; "en fazla" düğmesi kaynak ve nüfusa göre hesaplar
- [x] Motor: inşaat ve eğitim olayları tek zaman çizelgesinde sırayla işlenir
- [x] Kayıt şeması 2. sürüm: eski kayıtlar otomatik taşınır
- [x] "Ordu" ekranı: köydeki birlikler, toplam saldırı/savunma/taşıma, eğitim kartları
- [x] 30 birim testi

## ✅ Adım 4 — Dünya haritası

- [x] Tohumlu rastgele sayı üreteci; harita kayda yazılmaz, tohumdan her seferinde aynen üretilir
- [x] Arazi: çayır, orman, tepelik, göl (kümeler hâlinde, göle köy kurulamaz)
- [x] Barbar köyleri: merkezden uzaklaştıkça seyrekleşir ve güçlenir, oyuncu köyünün dibinde çıkmaz
- [x] Dünya saati: barbar köyleri dünya hızıyla büyür, hız değişince geçmiş korunur
- [x] Köy puanı ve kıtalar (K55); köy başlığında gösterilir
- [x] Harita ekranı: sürükle, tekerlek ve düğmelerle yakınlaştır, ok tuşları, koordinata git, köyüne dön
- [x] Seçili alan kartı: sahibi, puan, mesafe, her birim için yolculuk süresi
- [x] Yakındaki barbar köyleri tablosu (tıklayınca haritada gösterir)
- [x] Kayıt şeması 3. sürüm; 39 birim testi

## ✅ Adım 5 — Hareket ve savaş

**5a:**

- [x] Haritadan barbar köyüne saldırı gönderme; en yavaş birimin hızıyla yolculuk, varış saati
- [x] Saldırı ve ganimetle dönüş hareketleri tek zaman çizelgesinde; yoldaki askerler nüfus kullanır
- [x] Savaş formülü (bkz. araştırma §4.3): tür karışımına göre ağırlıklı savunma, sur bonusu, köylü direnişi, tohumdan belirlenen ±%25 şans
- [x] Barbar köyleri: gelişmişliğe göre garnizon, zamanla dolan ambar; yenilen köy kayıtta tutulur ve toparlanır
- [x] Yağma: taşıma kapasitesi eşit dağıtılır, gizli depo korur, ambara sığmayan kaybolur
- [x] Raporlar ekranı (kayıplar, ganimet, şans, sur); okunmamış rapor rozeti
- [x] Ordu ekranında yoldaki birlikler; haritada hareket çizgileri
- [x] Kayıt şeması 4. sürüm; 52 birim testi

**5b:**

- [x] Yoldaki saldırıyı geri çağırma (ordu bulunduğu yerden, yolda geçen süre kadar sonra döner)
- [x] Rapordan tek tıkla aynı orduyla tekrar saldırma
- [x] Yağma asistanı: yakın köyler tablosunda son sonuç, "yolda" işareti ve tek tıkla "Tekrar"
- [x] Saldırı formunda "Son orduyu kullan"
- [x] Raporları süzme (tümü, okunmamış, zafer, yenilgi), tek tek ya da okunanları silme
- [x] 56 birim testi (Game sınıfı bellek içi depoyla da test ediliyor)
- [x] Destek (kendi köyleri arasında asker gönderme) → Adım 8b'de yapıldı

## ✅ Adım 6 — Derinlik

**6a: Casusluk ve kuşatma**

- [x] Yalnız gözcüden oluşan birlik casusluğa gider; nöbetçi gözcüleri geçerse köyün askerlerini, kaynaklarını, gizli depo korumasını ve binalarını görür
- [x] Barbar köylerinde gelişmişliğe göre nöbetçi gözcü
- [x] Casus raporu saldırı formunda özetlenir; "Casusluk" rapor süzgeci
- [x] Kazanılan savaştan sonra koçbaşı suru, mancınık seçilen binayı yıkar (L seviyeli binayı bir seviye indirmek L araç ister)
- [x] Yıkılan binalar barbar köyünde her oyun günü bir seviye onarılır; yıkım puanı düşürür
- [x] Tekrar saldırı mancınık hedefini korur; casus birliği de geri çağrılabilir
- [x] 64 birim testi

**6b: Demirci ve Pazar**

- [x] Demirci binası ve sayfası: her asker türü 3 seviyeye kadar geliştirilir, her seviye +%10 saldırı ve savunma
- [x] Geliştirme seviyeleri Demirci 1 / 5 / 10 ister; birimin kendi gereksinimleri de geçerli; aynı anda tek geliştirme, iptalde tam iade
- [x] Geliştirmeler savaşa, saldırı gücü önizlemesine ve Ordu ekranındaki toplamlara yansır
- [x] Pazar binası ve sayfası: kaynak takası; tüccar sayısı = Pazar seviyesi, her tüccar 1.000 taşır ve 30 dk yolda kalır
- [x] Komisyon %28,75'ten (1. seviye) %5'e (20. seviye) iner; ambara sığmayacak kısım önceden uyarılır
- [x] Kendi sayfası olan binalara Köy ekranından bağlantı; kayıt şeması 5. sürüm
- [x] 75 birim testi (sürüm damgası denetimi dahil)

## ✅ Adım 7 — Yapay zekâ beyler

**7a: Rakip beyler ve savunma**

- [x] Tohumdan belirlenen 6 rakip bey (Karaman, Germiyan, Aydın… beyleri); merkez çevresinde bir halkada, gölde değil
- [x] Kişilikler: saldırgan (sık saldırır, koçbaşı getirir), tüccar (hızlı büyür, akıncıyla yağmalar), savunmacı (güçlü garnizon, seyrek saldırı)
- [x] Beylerin gücü günle artar; ordusu güce, kişiliğe ve zorluğa göre kurulur, güçlendikçe Demirci geliştirmeleri de kazanır
- [x] Gelen saldırılar: tepe çubuğunda uyarı, Ordu ekranında tahmini güç ve köyün savunması, haritada yaklaşan ordular
- [x] Savunma savaşı: köydeki askerler, sur ve Demirci; yenilgide gizli depo dışındaki kaynaklar yağmalanır, koçbaşılar suru yıkar
- [x] Savunma raporları ve "Karşı saldırı"; oyuncu da bey hisarlarına saldırabilir, intikamcı bey erken karşılık verir
- [x] Zorluk: Barış / Kolay / Normal / Zor; başlangıç koruması; mevcut kayıtlarda en az 12 oyun saati süre
- [x] Kayıt şeması 6. sürüm; 86 birim testi

**7b: Canlı dünya ve sıralama**

- [x] Beyler yakınlarındaki barbar köylerini yağmalar; köylerin garnizonu erir, ambarı boşalır (oyuncunun yağma rotasını etkiler)
- [x] Saldırgan beyler başka beylere savaş açar; kazanan güçlenir, kaybeden zayıflar (güç payı −3…+4)
- [x] Oyuncunun bey hisarlarına karşı zaferleri de beyleri zayıflatır
- [x] Sıralama sekmesi: puan, savaş puanı (öldürülen askerlerin nüfus değeri) ve ganimet
- [x] Dünya olayları: beyler arası savaşlar ve oyuncuyla çatışmalar
- [x] Barış zorluğunda dünya tamamen sakin; 60 oyun günü 40 ms'de hesaplanır
- [x] Kayıt şeması 7. sürüm; 93 birim testi

## ✅ Adım 8 — Fetih ve çoklu köy

**8a: Fetih** ✅

- [x] Saray binası (Konak 12, Demirci 5, Pazar 5); her seviyesi bir Elçi hakkı verir
- [x] Elçi: pahalı, yavaş; kazanılan saldırıdan sağ çıkan her Elçi bağlılığı 20–35 düşürür
- [x] Bağlılık her oyun saati 1 dolar; sıfırlanan köy binaları, kalan kaynakları ve sağ kalan saldırganlarla oyuncuya geçer (bağlılık 25'ten başlar)
- [x] Hisarı fethedilen bey oyundan çekilir: saldırmaz, yağmalamaz, sıralamada üstü çizili görünür
- [x] Tepe çubuğunda köy seçici; Köy, Ordu, Demirci ve Pazar seçili köye göre çalışır; tüm köylere gelen saldırılar tek listede
- [x] 4 yeni asker: Muhafız (ağır savunma piyadesi), Serdengeçti (ağır saldırı piyadesi), Deli (hızlı ve ucuz hafif süvari), Atlı Okçu (okçu türünde süvari) → toplam 14 birim
- [x] Haritada ve saldırı formunda bağlılık bilgisi; raporlarda fetih satırı
- [x] 98 birim testi

**8b: Köyler arası lojistik** ✅

- [x] Pazar'dan kendi köylerine kaynak gönderme: tüccar başına 1.000, alan başına 6 dk, komisyonsuz; tüccarlar gidiş-dönüş meşgul
- [x] Destek: haritada kendi köyünü seçip asker gönderme; askerler orada durup savunur, nüfusları geldikleri köyde sayılır
- [x] Ordu ekranında "Destek" paneli: başka köylerdeki askerlerini geri çağır, köyündeki destek birliklerini geri gönder
- [x] Bey saldırısında kayıplar köy askerleri ile destek arasında oranla paylaşılır
- [x] Fetihten sağ çıkan askerler yeni köyde destek olarak kalır (çiftlik taşması sorunu çözüldü)
- [x] "Köyler" genel bakış ekranı: kaynaklar, nüfus, inşaat, eğitim, asker, tüccar ve gelen saldırılar tek tabloda
- [x] Haritada tüm köylerin hareketleri; nakliye ve destek ayrı renkte
- [x] 104 birim testi

## ✅ Adım 9 — Sınıf seçimi ve premium

- [x] Oyun başında sınıf seçimi penceresi (bey adı ve köy adıyla birlikte); eski kayıtlarda da bir kez açılır
- [x] Tüccar Bey: üretim +%20, tüccar kapasitesi +%50, tüccarlar 2 kat hızlı
- [x] Serdar: ordu yolculuğu −%25, eğitim −%15, saldırı +%10
- [x] Kâşif: keşif hakkı +1, bulgular +%50, tehlike −%50 (Adım 10), Demirci süresi −%25
- [x] Premium para "Akçe": başlangıçta 250; fetih +100, savunma zaferi +20; gerçek parayla satılmaz
- [x] Hazine sayfası ve tepe çubuğunda Akçe göstergesi; hesap dökümü
- [x] Görevliler (7 gün): Vezir (+1 inşaat, +2 eğitim sırası), Defterdar (üretim +%10), Mimarbaşı (inşaat −%15), Serasker (yolculuk −%10, yağma asistanında "Tümüne tekrar saldır")
- [x] Anında bitirme (inşaat ve Demirci; kalan her 3 oyun dakikası 1 Akçe), kaynak paketi, sınıf değiştirme (500 Akçe)
- [x] Görevlinin süresi dolunca motor üretimi o ana kadar eski oranla hesaplar
- [x] Kayıt şeması 8. sürüm; 115 birim testi

## ✅ Adım 10 — Keşif seferleri

- [x] Kervansaray binası: sefer hakkı 1 + her 5 seviyede 1 (Kâşif +1)
- [x] Keşif sayfası: birlik ve keşif süresi (1–8 oyun saati) seçimi, yolculuk/dönüş önizlemesi, olasılık tablosu, yoldaki seferler
- [x] OGame tarzı sonuçlar: boş dönüş, kaynak (taşıma sınırıyla), paralı asker, Akçe, gecikme, erken dönüş, eşkıya pususu (gerçek savaş), kaybolma
- [x] Uzun keşif daha çok bulur ve boş dönmeyi azaltır; bulgular dünya günüyle büyür; Kâşif bulgular +%50, tehlike −%50
- [x] Sonuç tohumdan belirlenir (aynı kayıt aynı sonucu verir); her sonuç için birkaç anlatım
- [x] Keşif raporları ve "Keşif" süzgeci; rapordan "Tekrar keşfe çık"
- [x] Haritada yerleşimin ötesi "Yabani topraklar" olarak sisle örtülü; seçilince keşif bağlantısı
- [x] 120 birim testi

## ✅ Adım 11 — Görsel yenileme

- [x] Özgün izometrik çizim sistemi (`js/ui/art/`): ortak ışık, çizgi ve renk; tüm çizimler kodla üretilen SVG
- [x] 15 binanın her biri üç kademede (1–4, 5–14, 15+) büyüyen çizimler: konakta cumba, sarayda kubbe ve kuleler, pazarda çizgili tenteler…
- [x] Köy sahnesi: binalar arsalarında, sur köyü çevreleyen bir halka; yapımı süren binada iskele, seviye levhaları; tıklayınca kartına gider
- [x] 14 birim portresi (börk, miğfer, sarık, kalpak; mızrak, kılıç-kalkan, yay, at…); kategori renginde madalyonlar
- [x] Harita imleri: kendi konağın, beylerin mor sancaklı kaleleri, barbar obaları
- [x] Yeni amblem (Selçuklu yıldızı ve lale), ahşap tepe çubuğu ve çini şerit, ambar doluluk çubukları
- [x] Simgeli sekmeler; telefonda ekranın altında sekme çubuğu
- [x] Gece teması: akşam gökyüzü altında köy
- [x] Çizim galerisi: `tools/sanat.html` (geliştirme için)

## ✅ Adım 12 — Oyunlaştırma ve PWA

- [x] 21 adımlık görev zinciri (oyun içi eğitim): ilk binalardan fethe; ödül kaynak ve Akçe; Köy ekranında görev kutusu, sekmede rozet
- [x] 8 başarım, her biri üç kademe (puan, ganimet, savaş, savunma, keşif, fetih, Demirci, casusluk); kademeler kendiliğinden Akçe verir
- [x] Günlük hazine: günde bir kez Akçe ve ambarın %10'u kadar kaynak
- [x] Oyun sonu hedefi: bütün beylerin hisarlarını fethet → Sultanlık ilanı ve kutlama penceresi (sonra oynamaya devam)
- [x] PWA: manifest, telefon simgeleri, service worker; ilk açılıştan sonra internetsiz açılır; Ayarlar'da "Ana ekrana ekle"
- [x] Kayıt şeması 9. sürüm; 126 birim testi

## ✅ Adım 13 — Çok oyunculu

- [x] Bağımlılıksız Node.js sunucusu (`server/`): hesaplar (scrypt), oturum jetonları, hız sınırı, JSON kayıt (bozulmaya karşı geçici dosya + yeniden adlandırma)
- [x] Sunucu otoriter: istemci yalnızca niyet gönderir, kurallar sunucuda aynı kodla (`js/`) ve sunucu saatiyle işler; tehlikeli eylemler (hız, sıfırlama, içe aktarma) kapalı
- [x] Ortak dünya motoru (`advanceMany`): bütün oyuncuların olayları tek zaman çizelgesinde; barbar köyleri ve beyler ortak
- [x] Oyuncular arası saldırı, casusluk, yağma, kuşatma ve elçiyle fetih (başkent fethedilemez); iki tarafa rapor; savunana gelen saldırı uyarısı
- [x] Yeni oyuncu koruması (3 oyun günü; saldıran korumasını kaybeder)
- [x] Çevrimiçi istemci: anında yerel önizleme + sunucu doğrulaması, canlı bildirim (SSE), bağlantı göstergesi, sohbet, oyunculu sıralama, haritada mavi çatılı rakip köyler
- [x] Giriş/kayıt: sınıf seçiminden ya da Ayarlar'dan; tek oyunculu kayıt silinmez
- [x] Dockerfile ve kurulum rehberi: [COK_OYUNCULU.md](COK_OYUNCULU.md)
- [x] 137 birim testi (çok oyunculu dünya, oyuncular arası savaş, fetih, kayıt/yükleme, şifreler, eylem denetimi)
- [ ] Sonraki adımlar: klanlar (ittifak, ortak sohbet), oyuncular arası ticaret ve destek, özel mesajlar, yönetici paneli

## ✅ Adım 14 — GitHub'dan çok oyunculu ve gerçekçi görseller (1.2.0)

- [x] Oda modu: sunucu kurmadan, GitHub Pages'teki oyundan "Oda kur" → oda kodu ve davet bağlantısı (`#/katil/KOD`); dünya ev sahibinin tarayıcısında (`js/net/host.js`), bağlantı tarayıcılar arası doğrudan (WebRTC, PeerJS; `js/net/p2p.js`)
- [x] Hesap yok: oyuncu adı + cihazda saklanan gizli anahtar; kopan bağlantı kendiliğinden yeniden kurulur; tepe çubuğunda oda ve oyuncu sayısı
- [x] Sunucu ve oda aynı eylem denetimini kullanır (`js/net/actions.js`); 141 birim testi
- [x] Önceden işlenmiş (Age of Empires tarzı) ücretsiz bina görselleri (OpenGameArt: feudalwars, Bleed, yd): bina kartları, köy sahnesi ve harita imleri
- [x] Köy sahnesi yeniden: dokulu çimen ve toprak yollar, taş sur halkası ve köşe kuleleri, doğal ağaçlar; binalar seviye kademesiyle büyür
- [x] game-icons.net simgeleri: 14 asker madalyonu ve kaynak simgeleri
- [x] Harita: köyler bina görselleriyle, sahibinin renginde halka ve sancakla; barbar köyleri çeşitli
- [x] Ayarlar → Emeği geçenler ve [EMEGI_GECENLER.md](EMEGI_GECENLER.md) (lisanslar ve atıflar)

## ✅ Adım 15 — Arayüz yenileme: "Saray" görünümü (1.3.0)

- [x] Yeni tasarım dili: koyu ahşap üst gösterge çubuğu (HUD), altın süs çizgileri, dokulu parşömen zemin (SVG gürültü dokusu, harici dosya yok)
- [x] Kaynaklar oyulmuş yuvalarda: madalyon simge, miktar, üretim ve ambar doluluk çubuğu; Akçe kesesi; sekmeler üst çubuğun alt katında, seçili sekmede altın ışık
- [x] Çift çerçeveli paneller (içte ince altın çizgi, köşelerde elmaslar), süslü başlık çizgileri, her sayfa başlığında simgeli madalyon
- [x] Laka kırmızısı ve altın düğmeler, parşömen ikincil düğmeler, oyuk ilerleme çubukları, rozetler, maliyet çipleri, şeritli başlıklı tablolar
- [x] Köy ekranı pano düzeni: geniş ekranda sahne ve binalar solda, inşaat kuyruğu ve görevler sağ sütunda; dar ekranda alt alta
- [x] Köy sahnesi ve harita ahşap-altın çerçevede; pencereler (sınıf seçimi, oda) çerçeveli parşömen; koyu bildirimler
- [x] Sıralamada ilk üçe altın, gümüş, bronz madalya
- [x] Karanlık tema: deri dokulu koyu zemin, koyu ahşap paneller; telefonda alt sekme çubuğu ve tek satırlık üst çubuk

## Bilinen sınırlamalar

- Kayıt yalnızca o tarayıcıda durur. Başka cihaza geçmek için Ayarlar → Kayıt kodunu kullan.
- Sistem saati ileri alınarak zaman atlatılabilir. Tek oyunculuda bu bilerek kabul edildi.
- İnşaat ve eğitim kuyruklarında yalnızca son iş iptal edilebilir.
- Barbar köyleri saldırmaz; yalnızca rakip beyler saldırır.
- Oyuncu uzun süre uzak kaldıysa aradaki bey saldırıları açılışta sırayla işlenir (çevrimdışı ilerleme).
- Kuşatma araçları yalnızca kazanılan savaştan sonra yıkım yapar ve sur savaştan önce değil sonra düşer.
- Destek birlikleri savunulan köyün Demirci geliştirmeleriyle savaşır.
- Günlük hazine UTC gece yarısında (Türkiye saatiyle 03.00) yenilenir.
- Görevlerin ve başarımların ilerlemesi oyunun durumundan ölçülür; 9. sürümden önceki kayıtlarda saldırı, keşif ve savunma sayaçları sıfırdan başlar.
- Yoldaki tüccarlar geri çağrılamaz.
- Oda modunda dünya ev sahibinin tarayıcısında işler; ev sahibinin sekmesi kapalıyken diğer oyuncular bağlanamaz.
- Demir madeni için bu tarzda ücretsiz bir maden görseli bulunamadı; en yakın yapı kullanıldı.
