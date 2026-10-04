# Beylikler — Çok oyunculu

Beylikler üç biçimde oynanır:

| Kip | Nasıl | Ne gerekir |
|---|---|---|
| **Tek oyunculu** | https://kaan2635.github.io/beylikler/ adresini aç | Hiçbir şey |
| **Oda (önerilen)** | Bir oyuncu tarayıcısında oda kurar, arkadaşları oda koduyla katılır | Hiçbir şey: hesap, sunucu, kurulum yok |
| **Kendi sunucun** | Node.js sunucusu sürekli açık bir dünya tutar | Bir bilgisayar ya da barındırma hesabı |

## Oda: GitHub Pages'ten doğrudan çok oyunculu

1. Oyunu aç: https://kaan2635.github.io/beylikler/
2. Sınıf seçim penceresinde **"Arkadaşlarınla oyna"** (ya da **Ayarlar → Çok oyunculu**) → **Oda kur**. Bey adını ve dünya hızını seç.
3. Oyun 6 harfli bir **oda kodu** verir (tepe çubuğunda görünür). **Ayarlar → Davet bağlantısını kopyala** ile bağlantıyı arkadaşlarına gönder.
4. Arkadaşların bağlantıyı açar (ya da **Odaya katıl**'a kodu yazar), bey adını girer ve katılır.

Nasıl çalışır:

- Dünya **ev sahibinin tarayıcısında** tutulur ve kaydedilir. Ev sahibinin sekmesi sunucu gibi çalışır: bütün oyuncuların eylemlerini oyunun kurallarıyla uygular.
- Oyuncular ev sahibine **doğrudan** bağlanır (WebRTC). Bağlantıyı kurmak için yalnızca [PeerJS](https://peerjs.com)'in ücretsiz, herkese açık tanışma sunucusu kullanılır; oyun verisi tarayıcılar arasında şifreli akar. PeerJS kütüphanesi (MIT) jsDelivr'den bütünlük özetiyle (SRI) yüklenir.
- **Ev sahibi oyunu kapatınca dünya bekler**; ev sahibi açınca her şey kaldığı yerden sürer (üretim, ordular, savaşlar arada birikmiş olarak işlenir). Bağlantısı kopan oyuncu kendiliğinden yeniden bağlanır.
- Her tarayıcı o oda için gizli bir anahtar saklar; aynı tarayıcıyla dönen oyuncu kendi köyüne döner. Başka cihazdan girmek için şimdilik yeni bir bey açılır.
- Ev sahibi dünyayı "hileyle" değiştirebilir (dünya onun tarayıcısında). Arkadaş grupları için sorun değil; herkese açık, hilesiz bir dünya için kendi sunucunu kullan.

Sürekli açık bir dünya (ev sahibi olmadan) istiyorsan aşağıdaki sunucuyu kur.

## Kendi sunucun

Sunucu **bağımlılıksızdır**: yalnızca [Node.js](https://nodejs.org) (20 ya da üstü) gerekir, `npm install` bile gerekmez.

## 1. Kendi bilgisayarında çalıştır

```bash
npm run server
```

Tarayıcıda `http://localhost:8787` adresini aç. Sınıf seçim penceresinde **"Arkadaşlarınla oyna (çok oyunculu)"** düğmesine bas, kullanıcı adı ve şifreyle hesap aç. İstersen önce tek oyunculu devam edip sonra **Ayarlar → Çok oyunculu** bölümünden de giriş yapabilirsin.

Test için dünyayı hızlandırmak istersen (PowerShell):

```powershell
$env:WORLD_SPEED = "10"; npm run server
```

## 2. Aynı ağdaki arkadaşlarınla oyna (ev, okul, kafe)

```powershell
$env:HOST = "0.0.0.0"; npm run server
```

Bilgisayarının yerel IP adresini öğren (`ipconfig` → "IPv4 Address", ör. `192.168.1.20`). Arkadaşların tarayıcıda `http://192.168.1.20:8787` adresini açar. Windows Güvenlik Duvarı ilk seferde izin sorarsa **Özel ağ** için izin ver.

## 3. İnternette herkese aç

Sunucunun sürekli açık kalan bir bilgisayarda (bulut sunucusu) çalışması ve **kalıcı bir diske** yazabilmesi gerekir. Dünya, hesaplar, oturumlar ve yönetici askı listesi `data/` klasöründeki JSON dosyalarındadır.

### Seçenek A: Docker destekleyen bir barındırma (Render, Railway, Fly.io…)

Depoda hazır bir `Dockerfile` var. Genel adımlar:

1. Barındırma sitesinde hesap aç (bunu senin yapman gerekir) ve bu GitHub deposunu bağla.
2. "Docker" ile dağıtmayı seç.
3. **Kalıcı disk (volume)** ekle ve `/data` yoluna bağla. Disk yoksa sunucu her yeniden başladığında dünya silinir.
4. Ortam değişkenleri: `WORLD_SPEED=1` (isteğe bağlı), `ALLOWED_ORIGINS=https://kaan2635.github.io` (bkz. aşağıda).
5. Site sana `https://...` ile başlayan bir adres verir. Oyuncular bu adresi doğrudan açabilir.

Ücretsiz planlar çoğunlukla sunucuyu bir süre kullanılmayınca uyutur ve kalıcı disk vermez. Sürekli açık bir dünya için genellikle küçük bir ücretli plan gerekir; güncel fiyatları barındırma sitesinden kontrol et.

### Seçenek B: Kendi sanal sunucun (VPS)

1. Ubuntu kurulu bir VPS'e Node.js 20+ yükle, depoyu klonla.
2. Sunucuyu bir servis olarak çalıştır (ör. `systemd`), `HOST=127.0.0.1 PORT=8787`.
3. Önüne **HTTPS** için [Caddy](https://caddyserver.com) koy: `alanadin.com { reverse_proxy 127.0.0.1:8787 }`. Caddy sertifikayı kendiliğinden alır.
4. `data/` klasörünü düzenli yedekle.

### GitHub Pages'teki oyunla bağlanmak

`https://kaan2635.github.io/beylikler/` adresindeki oyun da çok oyunculu sunucuya bağlanabilir. Bunun için:

- Sunucu **HTTPS** ile yayınlanmalı. Tarayıcılar HTTPS bir sayfadan HTTP bir sunucuya bağlanmayı engeller.
- Sunucuda `ALLOWED_ORIGINS=https://kaan2635.github.io` ayarlanmalı.
- Oyuncu **Ayarlar → Çok oyunculu** bölümünde sunucu adresini (ör. `https://beylikler-sunucu.onrender.com`) yazar.

En kolayı, oyuncuların oyunu doğrudan sunucunun adresinden açmasıdır; o zaman bu iki ayar gerekmez.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `8787` | Sunucunun dinlediği kapı |
| `HOST` | `127.0.0.1` | `0.0.0.0` yaparsan ağdaki başka cihazlar da bağlanır |
| `DATA_DIR` | `./data` | Dünya, hesap, oturum ve yönetici askı-listesi dosyaları |
| `WORLD_SPEED` | `1` | Yalnızca **yeni** dünya kurulurken kullanılır (1, 2, 5, 10…) |
| `WORLD_SEED` | rastgele | Yeni dünyanın harita tohumu |
| `ALLOWED_ORIGINS` | boş | Başka adresteki oyun sayfalarına izin (virgülle) |
| `SERVE_STATIC` | `true` | `false` ise yalnızca API sunar |
| `ADMIN_USERNAME` | boş | Yönetici paneli kullanıcı adı; boşsa panel girişi kapalı |
| `ADMIN_PASSWORD` | boş | En az 16 karakterlik gizli yönetici parolası; sunucu ortamında tutulur |

Dünyayı sıfırlamak için sunucuyu durdurup `data/world.json` dosyasını silersin; hesaplar da silinsin istersen `data/` klasörünün tamamını sil.

## Nasıl çalışır?

- **Sunucu otoritedir.** Tarayıcı yalnızca "şunu inşa et", "şuraya saldır" gibi niyetler gönderir. Sunucu bunları oyunun kendi kurallarıyla (`js/` klasörü, tek oyunculuyla aynı kod) ve kendi saatiyle uygular. Konsoldan kaynak yazmak, saati ileri almak işe yaramaz.
- Arayüz hızlı yanıt versin diye eylem önce tarayıcıda da denenir. Sunucunun yanıtı gelince tarayıcıdaki durum onunkiyle değiştirilir. Sunucu reddederse bir uyarı çıkar.
- **Tek zaman çizelgesi:** Bütün oyuncuların olayları (inşaat, eğitim, savaş, keşif, beylerin yağmaları) tek bir sırayla işlenir. Böylece iki oyuncunun aynı barbar köyüne saldırısı ya da birbirine saldırıları tutarlı çözülür.
- **Ortak dünya:** Barbar köyleri ve rakip beyler herkes için aynıdır. Bir oyuncunun yağmaladığı köy, öbürü için de boşalmıştır.
- **Canlı bildirim:** Tarayıcı sunucuya açık bir bağlantıyla (Server-Sent Events) bağlanır. Saldırı gelince, savaş bitince ya da sohbete mesaj düşünce hemen haberdar olur.

## Yalnız sunucu sahibine açık yönetici paneli

Panel yalnızca kendi Node sunucusunda çalışır; GitHub Pages ve statik `npm start` sunucusu yönetim API'si sunmaz. Sunucuyu başlatırken iki gizli ortam değişkeni tanımla:

```powershell
$env:ADMIN_USERNAME = "senin_yonetici_adin"
$env:ADMIN_PASSWORD = "en_az_16_karakterlik_rastgele_parola"
npm run server
```

Linux/macOS:

```bash
ADMIN_USERNAME='senin_yonetici_adin' ADMIN_PASSWORD='en_az_16_karakterlik_rastgele_parola' npm run server
```

Oyunu kendi sunucu adresinden HTTPS ile aç, alt kısımdaki **Yönetici girişi** bağlantısına bas ve bu bilgileri kullan. Arayüz parolayı saklamaz; yönetici oturumu sekmede tutulur ve 8 saat sonra sona erer. Başka bir siteden (ör. GitHub Pages) bağlanıyorsan sunucuda `ALLOWED_ORIGINS` içine o sitenin tam adresini ekle.

Panel dünya/oyuncu özetini ve sohbet geçmişini gösterir; oyuncu erişimini askıya alıp yeniden açabilir, dünyaya duyuru gönderebilir ve sohbet geçmişini temizleyebilir. Askıya alma hesabı veya köyleri silmez. Yönetici adı/parolası kaynak koda, depoya ya da istemci tarafı ayarlara konmamalıdır; güçlü parolayı yalnızca barındırma ortam değişkenlerinde tut.

## Kurallar (çok oyunculu dünyaya özel)

- **Yeni oyuncu koruması:** İlk 3 oyun günü sana saldırılamaz. Sen başka bir oyuncuya saldırırsan korumanın süresi hemen biter.
- **Başkent fethedilemez:** Her oyuncunun ilk köyü başkenttir. Elçiler başkentte işe yaramaz; oyuncu hiçbir zaman köysüz kalmaz. Sonradan fethedilen köyler fethedilebilir.
- **Beyler oyunculara saldırmaz:** Rakiplerin gerçek oyunculardır. Beyler dünyada yaşamaya devam eder (barbar yağmalar, birbirine savaş açar) ve hisarları fethedilebilir.
- **Sultanlık** tek oyunculu bir hedeftir; çok oyunculu dünyada sıralama esastır.
- Dünya hızını, zorluğu, kayıt içe aktarmayı ve sıfırlamayı yalnızca sunucuyu yöneten kişi değiştirebilir.

## Güvenlik ve gizlilik

- Şifreler düz metin olarak saklanmaz; `scrypt` ile tuzlanıp özetlenir.
- Oyuncu oturumu 30 gün, ayrı yönetici oturumu 8 saat geçerlidir; **Çıkış yap** jetonu geçersiz kılar.
- Yönetici parolası yalnızca sunucu ortamında tutulur; yönetici giriş denemeleri IP başına sınırlandırılır.
- Hesap için yalnızca kullanıcı adı ve şifre istenir; e-posta ya da kişisel veri toplanmaz.
- Giriş denemeleri, eylemler ve sohbet için hız sınırı vardır.
- Sunucu yalnızca oyunun dosyalarını (`index.html`, `css/`, `js/`, `assets/`…) sunar; `server/` ve `data/` klasörleri dışarıdan görünmez.
- Sohbet mesajları ekrana düz metin olarak yazılır; kimse başkasının tarayıcısında kod çalıştıramaz.

Herkese açık bir sunucu işletirsen, kullanıcı adları ve sohbet kayıtları kişisel veri sayılabilir. Türkiye'deki oyuncular için KVKK kapsamında basit bir aydınlatma metni yayınlaman iyi olur.
