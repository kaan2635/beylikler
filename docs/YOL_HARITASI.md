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
- [ ] Destek (kendi köyleri arasında asker gönderme) → Adım 8b

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

## 🔶 Adım 8 — Fetih ve çoklu köy

**8a: Fetih** ✅

- [x] Saray binası (Konak 12, Demirci 5, Pazar 5); her seviyesi bir Elçi hakkı verir
- [x] Elçi: pahalı, yavaş; kazanılan saldırıdan sağ çıkan her Elçi bağlılığı 20–35 düşürür
- [x] Bağlılık her oyun saati 1 dolar; sıfırlanan köy binaları, kalan kaynakları ve sağ kalan saldırganlarla oyuncuya geçer (bağlılık 25'ten başlar)
- [x] Hisarı fethedilen bey oyundan çekilir: saldırmaz, yağmalamaz, sıralamada üstü çizili görünür
- [x] Tepe çubuğunda köy seçici; Köy, Ordu, Demirci ve Pazar seçili köye göre çalışır; tüm köylere gelen saldırılar tek listede
- [x] 4 yeni asker: Muhafız (ağır savunma piyadesi), Serdengeçti (ağır saldırı piyadesi), Deli (hızlı ve ucuz hafif süvari), Atlı Okçu (okçu türünde süvari) → toplam 14 birim
- [x] Haritada ve saldırı formunda bağlılık bilgisi; raporlarda fetih satırı
- [x] 98 birim testi

**8b: Köyler arası lojistik**

- [ ] Kendi köyleri arasında kaynak gönderme (tüccarla)
- [ ] Destek: asker gönderme, geri çağırma, başka köyde duran askerler
- [ ] Köylere genel bakış ekranı

## ⬜ Adım 9 — Sınıf seçimi ve premium

- [ ] Oyun başında sınıf seçimi (OGame benzeri): ör. Tüccar (üretim ve tüccar), Sipahi Beyi (ordu hızı ve gücü), Kâşif (keşif seferleri)
- [ ] Premium para birimi "Akçe": oyun içinde kazanılır (keşif, görev, başarım); gerçek para yok
- [ ] Premium özellikler: inşaatı hızlandırma, ek kuyruk sırası, üretim bonusu, yağma asistanı eklentileri

## ⬜ Adım 10 — Keşif seferleri

- [ ] Haritanın kenarındaki bilinmeyen topraklara OGame tarzı keşif birliği gönderme
- [ ] Sonuçlar: kaynak, asker, Akçe, nadir eşya; ya da gecikme, pusu, kayıp
- [ ] Keşif raporları; sınıfa ve Kâşif bonusuna göre olasılıklar

## ⬜ Adım 11 — Görsel yenileme

- [ ] Bina ve birim görselleri (özgün, vektör tabanlı çizimler)
- [ ] Köy sahnesi: binalar seviyesine göre büyür
- [ ] Arayüz ve etkileşim tasarımının elden geçirilmesi

## ⬜ Adım 12 — Oyunlaştırma ve PWA

- [ ] Görevler ve oyun içi eğitim
- [ ] Başarımlar, oyun sonu hedefi
- [ ] PWA: telefona kurulum, çevrimdışı açılış

## ⬜ Adım 13 — Çok oyunculu

- [ ] Supabase: kimlik doğrulama, Postgres şeması, satır düzeyi güvenlik
- [ ] Motoru sunucuya taşıma (Edge Functions): istemci yalnızca niyet gönderir
- [ ] Ortak dünya, oyuncular arası saldırı ve ticaret
- [ ] Klanlar, mesajlaşma, gerçek zamanlı bildirimler

## Bilinen sınırlamalar

- Kayıt yalnızca o tarayıcıda durur. Başka cihaza geçmek için Ayarlar → Kayıt kodunu kullan.
- Sistem saati ileri alınarak zaman atlatılabilir. Tek oyunculuda bu bilerek kabul edildi.
- İnşaat ve eğitim kuyruklarında yalnızca son iş iptal edilebilir.
- Barbar köyleri saldırmaz; yalnızca rakip beyler saldırır.
- Oyuncu uzun süre uzak kaldıysa aradaki bey saldırıları açılışta sırayla işlenir (çevrimdışı ilerleme).
- Kuşatma araçları yalnızca kazanılan savaştan sonra yıkım yapar ve sur savaştan önce değil sonra düşer.
- Fethedilen köye yerleşen garnizon çiftlik sınırını aşabilir; çiftlik yükseltilene ya da askerler başka yere gönderilene kadar o köyde nüfus isteyen inşaat yapılamaz.
- Oyuncunun köyleri henüz birbirine asker ve kaynak gönderemez (Adım 8b).
