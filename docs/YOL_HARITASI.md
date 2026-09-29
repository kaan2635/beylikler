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

## ⬜ Adım 4 — Dünya haritası

- [ ] Tohumlu rastgele sayı üreteciyle dünya üretimi (aynı tohum → aynı harita)
- [ ] Barbar köyleri (zamanla büyüyen)
- [ ] Harita görünümü (sürükle, yakınlaştır), köy bilgi kartı, mesafe

## ⬜ Adım 5 — Hareket ve savaş

- [ ] Saldırı, destek, geri dönüş hareketleri; yolculuk süresi
- [ ] Savaş formülü (bkz. araştırma §4.3), sur bonusu, şans
- [ ] Yağma: taşıma kapasitesi, gizli depo koruması
- [ ] Savaş raporları ("Raporlar" ekranı)

## ⬜ Adım 6 — Derinlik

- [ ] Gözcü ile casusluk
- [ ] Demirci: birim geliştirme
- [ ] Pazar: kaynak takası
- [ ] Koçbaşı ile surun, mancınıkla binaların hasar görmesi

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
- Askerler henüz köyden ayrılamaz; hareket ve savaş Adım 5'te gelecek.
