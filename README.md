# Beylikler

Klanlar, Travian ve OGame'den esinlenen, tarayıcıda oynanan ortaçağ strateji oyunu. Köyünü kur, kaynak topla, binalarını yükselt ve beyliğini büyüt.

Saf HTML, CSS ve JavaScript ile yazıldı. Kurulum ya da derleme gerektirmez; GitHub Pages'te doğrudan yayınlanır.

**Oyna:** https://kaan2635.github.io/beylikler/

**Durum:** Yol haritasının 14 adımı tamamlandı. Tek oyunculu ya da **çok oyunculu** oynanır: GitHub'daki oyundan oda kurup arkadaşlarını davet et (sunucu gerekmez) ya da kendi sunucunu çalıştır → [Çok oyunculu rehberi](docs/COK_OYUNCULU.md). Görev zinciri, başarımlar, günlük hazine ve Sultanlık hedefi; telefona kurulabilir, internetsiz açılır (PWA). Ücretsiz lisanslı, Age of Empires tarzı bina görselleri, seviyeyle büyüyen köy sahnesi, asker madalyonları ve yenilenen arayüz ([emeği geçenler](docs/EMEGI_GECENLER.md)); OGame tarzı keşif seferleri (kaynak, paralı asker, Akçe ya da eşkıya ve fırtına), oyun başında sınıf seçimi (Tüccar Bey, Serdar, Kâşif), oyun içinde kazanılan premium para Akçe ile görevliler ve hızlandırmalar; kaynak ekonomisi, 14 bina, 14 asker türü, Demirci, Pazar ve Saray; barbar köyleri ve birbirleriyle de savaşan, kişilikli 6 rakip beyle yaşayan bir dünya; saldırı, savunma, yağma, casusluk, kuşatma, Elçiyle köy fethi, çoklu köy yönetimi, köyler arası kaynak nakliyesi ve destek, raporlar ve sıralama. Zorluk Ayarlar'dan seçilir (Barış'ta dünya sakin) → [Yol haritası](docs/YOL_HARITASI.md) · [Araştırma raporu](docs/ARASTIRMA.md)

## Yerelde çalıştırma

Geliştirme için [Node.js](https://nodejs.org) gerekir. Oyunun kendisi Node'a ihtiyaç duymaz.

```bash
npm start
```

Ardından tarayıcıda `http://localhost:8080` adresini aç.

> `index.html` dosyasına çift tıklamak işe yaramaz. Tarayıcılar JavaScript modüllerini `file://` üzerinden yüklemez; oyunu bir sunucu üzerinden açmak gerekir.

## Çok oyunculu

**En kolayı (kurulum yok):** Oyunu aç → **"Arkadaşlarınla oyna" → Oda kur**. Oyun bir oda kodu verir; arkadaşların GitHub Pages'teki aynı adresten bu kodla katılır. Dünya senin tarayıcında tutulur, bağlantı tarayıcılar arasında doğrudandır (WebRTC).

**Sürekli açık bir dünya için kendi sunucun:**

```bash
npm run server
```

Ayrıntılar (oda nasıl çalışır, aynı ağda oynama, internete açma): [docs/COK_OYUNCULU.md](docs/COK_OYUNCULU.md).

## Testler

```bash
npm test
```

Motor tarayıcıya bağımlı olmadığı için testler doğrudan Node'da çalışır. Testler şunları doğrular: üretim, kapasite, inşaat ve eğitim kuyrukları, olayların zaman sırası, çevrimdışı ilerleme, gereksinimler, nüfus, iade, kayıt kodu ve eski kayıtların taşınması, oyunun hiçbir seviyede kilitlenmemesi. GitHub'a her gönderimde testler GitHub Actions'ta da çalışır.

## GitHub Pages'te yayınlama

1. GitHub'da **herkese açık** yeni bir depo oluştur (ör. `beylikler`).
2. Bu klasördeki dosyaları depoya gönder (Git, GitHub Desktop ya da web arayüzüyle yükleme).
3. Depoda **Settings → Pages → Build and deployment** bölümünde *Source* olarak **Deploy from a branch**, dal olarak **main** ve klasör olarak **/ (root)** seç.
4. Birkaç dakika sonra oyun `https://KULLANICI_ADIN.github.io/beylikler/` adresinde yayında olur.

## Proje yapısı

```
index.html              Tek sayfa; tüm ekranlar JavaScript ile çizilir
manifest.webmanifest    Telefona kurulum bilgileri (PWA)
sw.js                   Service worker: sürüm damgalı dosyaları önbelleğe alır, çevrimdışı açılış
css/style.css           Arayüz stilleri (açık/koyu tema, telefon uyumu)
assets/                 Simge ve görseller (gorsel/binalar: bina görselleri, WebP)
js/
  main.js               Başlangıç noktası
  game.js               Arayüz ile oyun durumu arasındaki tek kapı (eylemler)
  config/               Oyun verisi: ayarlar, kaynaklar, binalar, birimler, dünya
  core/                 Motor: formüller, durum, zaman çizelgesi, tohumlu rastgelelik, kayıt kodu
  systems/              Oyun kuralları: ekonomi, inşaat, asker eğitimi, dünya, barbar köyleri, savaş, hareketler
  storage/              Kayıt deposu (localStorage)
  ui/                   Arayüz: kaynak çubuğu, ekranlar, bildirimler
  ui/art/               Köy sahnesi (SVG), görsel ve simge eşlemeleri, emeği geçenler listesi
  net/                  Çok oyunculu istemci: sunucu API'si ve çevrimiçi oyun
server/                 Çok oyunculu sunucu (Node.js, bağımlılıksız): API, hesaplar, kayıt
tests/                  Node testleri (node --test)
tools/serve.js          Bağımlılıksız yerel geliştirme sunucusu
docs/                   Araştırma raporu ve yol haritası
```

**Temel kural:** `core/` ve `systems/` klasörleri DOM'a dokunmaz. Böylece test edilebilirler ve ileride çok oyunculu sürümde sunucuda da çalışabilirler.

## Güncelleme yayınlarken

GitHub Pages dosyaları 10 dakika önbelleğe alınabilir işaretler. Güncellemeden sonra oyuncunun tarayıcısı eski ve yeni dosyaları karıştırmasın diye `index.html` içindeki her CSS ve JS adresine dosya içeriğinden türetilen bir sürüm damgası (`?v=…`) eklenir. Kod değiştiyse göndermeden önce:

```bash
npm run stamp
```

Damga eskiyse `npm test` bunu yakalar ve başarısız olur.

Service worker (`sw.js`) damgalı dosyaları kendiliğinden önbelleğe alır ve eski sürümlerini siler; oyuncular güncellemeyi bir sonraki açılışta alır. Yalnızca `sw.js`'nin kendi mantığı değişirse içindeki `CACHE` adını artır.

## Geliştirici ipuçları

- **Ayarlar → Dünya hızı** ile oyunu 100 kata kadar hızlandırabilirsin.
- Tarayıcı konsolunda `beylikler.state` tüm oyun durumunu gösterir.
- `http://localhost:8080/tools/sanat.html` tüm bina görsellerini, simgeleri ve köy sahnesini tek sayfada gösterir.
- Yeni bir hazır görsel eklerken lisansını [docs/EMEGI_GECENLER.md](docs/EMEGI_GECENLER.md) ve `js/ui/art/credits.js` dosyalarına yaz (CC-BY eserlerde atıf zorunludur).
- Denge değerleri `js/core/formulas.js` ve `js/config/` klasöründedir (binalar, birimler, savaş, Demirci ve Pazar).
- Kayıt şeması değişirse `js/config/game.js` içindeki `saveVersion` değerini artır ve `js/core/state.js` içine bir migrasyon ekle.
