# Beylikler

Klanlar, Travian ve OGame'den esinlenen, tarayıcıda oynanan ortaçağ strateji oyunu. Köyünü kur, kaynak topla, binalarını yükselt ve beyliğini büyüt.

Saf HTML, CSS ve JavaScript ile yazıldı. Kurulum ya da derleme gerektirmez; GitHub Pages'te doğrudan yayınlanır.

**Oyna:** https://kaan2635.github.io/beylikler/

**Durum:** Adım 6 (derinlik) tamamlandı: kaynak ekonomisi, 13 bina, 9 asker türü ve Demirci geliştirmeleri, Pazar takası; barbar köyleriyle dolu bir harita, saldırı, yağma, casusluk, kuşatma ve raporlar → [Yol haritası](docs/YOL_HARITASI.md) · [Araştırma raporu](docs/ARASTIRMA.md)

## Yerelde çalıştırma

Geliştirme için [Node.js](https://nodejs.org) gerekir. Oyunun kendisi Node'a ihtiyaç duymaz.

```bash
npm start
```

Ardından tarayıcıda `http://localhost:8080` adresini aç.

> `index.html` dosyasına çift tıklamak işe yaramaz. Tarayıcılar JavaScript modüllerini `file://` üzerinden yüklemez; oyunu bir sunucu üzerinden açmak gerekir.

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
css/style.css           Arayüz stilleri (açık/koyu tema, telefon uyumu)
assets/                 Simge ve görseller
js/
  main.js               Başlangıç noktası
  game.js               Arayüz ile oyun durumu arasındaki tek kapı (eylemler)
  config/               Oyun verisi: ayarlar, kaynaklar, binalar, birimler, dünya
  core/                 Motor: formüller, durum, zaman çizelgesi, tohumlu rastgelelik, kayıt kodu
  systems/              Oyun kuralları: ekonomi, inşaat, asker eğitimi, dünya, barbar köyleri, savaş, hareketler
  storage/              Kayıt deposu (localStorage)
  ui/                   Arayüz: kaynak çubuğu, ekranlar, bildirimler
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

## Geliştirici ipuçları

- **Ayarlar → Dünya hızı** ile oyunu 100 kata kadar hızlandırabilirsin.
- Tarayıcı konsolunda `beylikler.state` tüm oyun durumunu gösterir.
- Denge değerleri `js/core/formulas.js` ve `js/config/` klasöründedir (binalar, birimler, savaş, Demirci ve Pazar).
- Kayıt şeması değişirse `js/config/game.js` içindeki `saveVersion` değerini artır ve `js/core/state.js` içine bir migrasyon ekle.
