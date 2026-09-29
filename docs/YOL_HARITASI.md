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
- [ ] Destek (kendi köyleri arasında asker gönderme) → Adım 8'de çoklu köyle birlikte

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

## ⬜ Adım 7 — Yapay zekâ beyler

- [ ] Kişilikli rakipler: saldırgan, tüccar, savunmacı
- [ ] Zorluk seviyeleri
- [ ] Rakiplerin oyuncuya saldırması ve oyuncu için uyarılar

## ⬜ Adım 8 — Fetih ve çoklu köy

- [ ] Elçi birimi ve köy bağlılığı
- [ ] Köy ele geçirme, köyler arası geçiş
- [ ] Köyler arası kaynak ve asker gönderme

## ⬜ Adım 9 — Oyunlaştırma ve PWA

- [ ] Görevler ve oyun içi eğitim
- [ ] Puan, sıralama, başarımlar, oyun sonu hedefi
- [ ] PWA: telefona kurulum, çevrimdışı açılış

## ⬜ Adım 10 — Çok oyunculu (isteğe bağlı)

- [ ] Supabase: kimlik doğrulama, Postgres şeması, satır düzeyi güvenlik
- [ ] Motoru sunucuya taşıma (Edge Functions): istemci yalnızca niyet gönderir
- [ ] Klanlar, mesajlaşma, gerçek zamanlı bildirimler

## Bilinen sınırlamalar

- Kayıt yalnızca o tarayıcıda durur. Başka cihaza geçmek için Ayarlar → Kayıt kodunu kullan.
- Sistem saati ileri alınarak zaman atlatılabilir. Tek oyunculuda bu bilerek kabul edildi.
- İnşaat ve eğitim kuyruklarında yalnızca son iş iptal edilebilir.
- Barbar köyleri henüz saldırmaz; saldıran rakipler Adım 7'de (yapay zekâ beyler) gelecek.
- Kuşatma araçları yalnızca kazanılan savaştan sonra yıkım yapar ve sur savaştan önce değil sonra düşer.
