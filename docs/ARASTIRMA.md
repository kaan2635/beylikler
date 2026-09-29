# Beylikler — Araştırma Raporu

> Tarih: 29 Eylül 2026 · Kapsam: Klanlar (Tribal Wars), Travian ve OGame'in oyun tasarımı; GitHub Pages üzerinde yayınlanacak bir tarayıcı strateji oyununun teknik mimarisi.

## 1. Özet

- Üç oyun da **kalıcı dünyada, gerçek zamanlı ilerleyen tarayıcı strateji oyunu** türündedir. Oyuncu günde birkaç kez kısa süre girer, emir verir ve çıkar; oyun o yokken de ilerler.
- Ortak çekirdek döngü şudur: **kaynak üret → bina yükselt → asker eğit → keşfet/yağmala → büyü/fethet**. Bunun üzerine ittifak (klan) katmanı gelir.
- Oyunlar saniye saniye hesap yapmaz. **Olay tabanlı ve tembel (lazy) hesaplama** kullanırlar: bir köyün kaynağı, "son güncelleme zamanı + üretim oranı" ile istendiği anda hesaplanır.
- **GitHub Pages yalnızca statik dosya sunar**; sunucu kodu çalıştıramaz. Bu yüzden iki aşamalı bir strateji öneriyorum:
  1. **Tek oyunculu sürüm:** Tarayıcıda çalışır, `localStorage`'a kaydeder, rakipler yapay zekâ beylerdir.
  2. **İsteğe bağlı çok oyunculu sürüm:** Supabase gibi bir "arka uç hizmeti" (BaaS) eklenir; site yine GitHub Pages'te kalır.
- Oyun motoru, tarayıcıya bağımlı olmayan **saf JavaScript fonksiyonları** olarak yazıldı. Aynı kod ileride sunucuda (ör. Supabase Edge Functions, Deno) hakem olarak çalışabilir.

## 2. Referans oyunlar

### 2.1 Klanlar (Tribal Wars)

| Konu | Ayrıntı |
|---|---|
| Yapımcı / yıl | InnoGames, 2003 (Almanca adı *Die Stämme*). Türkiye sunucusunun adı *Klanlar*. |
| Tema | Ortaçağ köyleri |
| Kaynaklar | Odun, kil, demir. Ayrıca çiftliğin belirlediği **nüfus** sınırı var; hem binalar hem askerler nüfus kullanır. |
| Binalar | Ana bina (inşaatı hızlandırır), kışla, ahır, atölye, akademi, demirci, içtima meydanı, heykel, pazar, oduncu, kil ocağı, demir madeni, çiftlik, depo, gizli depo, sur, gözetleme kulesi (bazı dünyalarda kilise) |
| Birimler | Mızrakçı, kılıç ustası, baltacı, okçu, casus, hafif atlı, atlı okçu, ağır atlı, koçbaşı, mancınık, şövalye ve fetih birimi (asilzade) |
| Savaş | Birimlerin bir saldırı gücü ve üç savunma değeri vardır (piyade, süvari, okçu). Kazananın kayıp oranı yaklaşık **(kaybeden güç / kazanan güç)^1.5**. Sur hem yüzde hem sabit savunma verir. Koçbaşı suru, mancınık binaları yıkar. |
| Rastgelelik | ±%25 şans, moral (güçlü oyuncunun zayıfa saldırısını zayıflatır), gece bonusu (gece savunma ikiye katlanır). Hepsi dünya ayarıdır. |
| Fetih | Asilzade saldırısı köyün **sadakatini** 20–35 puan düşürür. Sadakat 0'a inince köy el değiştirir, sonra saatte yaklaşık 1 puan geri gelir. |
| Harita | 1000×1000 alan, 100×100'lük kıtalara (K55 gibi) bölünmüş. Sahipsiz barbar köyleri var. |
| Dünya ayarları | Dünya hızı, birlik hızı, başlangıç koruması, moral, gece bonusu, okçu ve şövalyenin açık olup olmadığı |
| Sosyal | Klan, diplomasi (müttefik, saldırmazlık, düşman), klan forumu, mesajlar |
| Gelir modeli | Premium hesap (uzun inşaat kuyruğu, toplu işlemler), premium puanla üretim artışı |

**Oyundan alınacak dersler:** 3 kaynak ve nüfus modeli sade ama derin. Dünya ayarlarıyla aynı motordan farklı deneyimler çıkıyor. Sadakat modeli basit ve heyecan verici.

### 2.2 Travian

| Konu | Ayrıntı |
|---|---|
| Yapımcı / yıl | Travian Games (Münih), 2004 |
| Kaynaklar | Odun, kil, demir, **tahıl**. Askerler her saat tahıl tüketir; tahıl üretimi eksiye düşerse askerler açlıktan ölür. |
| Köy | 18 kaynak tarlası (dış köy) ve ayrı bina alanları (iç köy) |
| Halklar | Romalılar, Cermenler, Galyalılar ve sonradan eklenenler. Her halkın birimleri, suru ve bonusları farklıdır. |
| Kahraman | Seviye atlar, eşya taşır, maceralara çıkar, vaha ele geçirir |
| Vahalar | Köye bağlanınca kaynak bonusu (%25 / %50) verir |
| Harita | 401×401 alan (−200…200), kenarlardan birbirine bağlanır |
| Savaş | Saldırı toplamı, savunmanın piyade/süvari değerlerinin saldıran ordunun bileşimine göre ağırlıklı toplamıyla karşılaştırılır. Sur halka göre yüzde bonus verir. Kayıplar üstel bir formülle hesaplanır. **Yağma** (kısmi savaş) ile **normal saldırı** ayrıdır. |
| Genişleme | Kültür puanı biriktirilerek yeni köy hakkı kazanılır. Fetih senatör ya da reis ile yapılır. |
| Oyun sonu | Sunucu aylar sürer; **Harika (World Wonder)** yarışıyla biter. Net bir hedef var. |
| Gelir modeli | Altın: Plus hesap, %25 üretim bonusu, NPC tüccar, anında bitirme |

**Oyundan alınacak dersler:** Asker bakım maliyeti (tahıl) sınırsız ordu büyümesini engeller. Belirli bir oyun sonu motivasyonu korur. Halk farklılıkları tekrar oynanabilirliği artırır.

### 2.3 OGame

| Konu | Ayrıntı |
|---|---|
| Yapımcı / yıl | Gameforge, 2002 · Uzay teması |
| Kaynaklar | Metal, kristal, döteryum ve santrallerin ürettiği **enerji** (madenler enerji harcar) |
| Harita | Galaksi : Sistem : Konum koordinatları, birden çok gezegen (koloni) ve aylar |
| Araştırma | Geniş teknoloji ağacı: silah, kalkan, zırh, motorlar… |
| Savaş | En fazla **6 turluk simülasyon**. Her birim her turda rastgele bir düşman birimine ateş eder. Kalkanlar her tur yenilenir. **Rapidfire** bazı gemilere aynı turda ek atış hakkı verir. |
| Enkaz | Yok edilen gemilerin maliyetinin %30'u enkaz alanına dönüşür ve toplanabilir. Yok edilen savunma yapıları enkaz bırakmaz. |
| Diğer | Casus sondaları, filoyu saldırıdan kaçırma ("fleetsave"), ittifak ortak saldırıları (ACS) |
| Gelir modeli | Karanlık Madde (premium para birimi) |

**Oyundan alınacak dersler:** Tur tabanlı simülasyon derin ama hesaplaması pahalı ve dengesi zor. Enkaz, savaşa ekonomik sonuç ekler. Araştırma ağacı uzun vadeli hedef sunar.

**Beylikler'e uyarlanan OGame mekanikleri (Adım 9–10):**

- **Sınıflar:** OGame'deki Toplayıcı / General / Kâşif üçlüsü, Tüccar Bey (ekonomi), Serdar (savaş) ve Kâşif (keşif) olarak uyarlandı. Etkiler çarpan olarak birleşir; sınıf Akçe karşılığında değiştirilir.
- **Premium para:** Karanlık Madde'nin karşılığı **Akçe**'dir. Farkı: yalnızca oyun içinde kazanılır (başlangıç, fetih, savunma, keşif). Harcama yerleri OGame'dekilere benzer: görevliler (Komutan → Vezir, Jeolog → Defterdar, Mühendis → Mimarbaşı, Amiral → Serasker), anında bitirme ve sınıf değişimi.
- **Keşif seferleri:** OGame'de filo 16. konuma gönderilir ve bekleme süresinin sonunda tek bir olay çekilir (kaynak, gemi, Karanlık Madde, korsan/uzaylı savaşı, gecikme, erken dönüş, kara delik). Beylikler'de birlik haritanın ötesindeki yabani topraklara gider; sonuçlar kaynak, paralı asker, Akçe, eşkıya pususu, gecikme, erken dönüş ve kaybolmadır. Bulunan kaynak birliğin taşıma kapasitesiyle sınırlıdır (OGame'deki yük sınırı gibi), bulgu ölçeği dünya günüyle büyür. Sefer sayısı Kervansaray seviyesine bağlıdır (OGame'de Astrofizik). Sonuç tohum ve hareket numarasından belirlenir; yeniden yüklemeyle "zar yeniden atılamaz".

## 3. Ortak çekirdek döngü

```
  ┌──────────── ganimet, yeni köyler, puan ◄────────────┐
  ▼                                                     │
Kaynak üret ─► Bina yükselt ─► Asker eğit ─► Keşfet ─► Saldır / Yağmala
  ▲                                                     │
  └──── savun: sur, gizli depo, destek askeri ◄─────────┘
```

**Bu oyunları çekici yapan etkenler:**
- **Kısa oturum, sık dönüş:** "10 dakika sonra inşaat biter" duygusu oyuncuyu geri getirir.
- **Uzun vadeli hedef:** Sıralama, fetih, oyun sonu.
- **Kayıp korkusu:** Yağmalanma riski oyuncuyu savunmaya ve planlamaya iter.
- **Sosyal bağ:** Klan arkadaşlarına karşı sorumluluk.

## 4. Mekaniklerin matematiği

### 4.1 Üstel büyüme

Hemen her değer aynı şekilde büyür: `değer(L) = taban × çarpan^(L−1)`

| Değer | Tipik çarpan | Örnek (Klanlar'a yakın) |
|---|---|---|
| Bina maliyeti | 1.25 – 1.30 | Her seviye %25–30 pahalı |
| Kaynak üretimi | ~1.163 | 1. seviye 30/saat, 30. seviye ~2.400/saat |
| Depo kapasitesi | ~1.2295 | 1. seviye 1.000, 30. seviye ~400.000 |
| Çiftlik nüfusu | ~1.172 | 1. seviye 240, 30. seviye ~24.000 |
| İnşaat süresi | ~1.2 | Ana bina her seviyede süreyi ~%5 kısaltır |

Maliyetler üretimden daha hızlı büyür. Bu yüzden ilerleme zamanla yavaşlar ve oyuncu tercih yapmak zorunda kalır: ekonomi mi, ordu mu?

### 4.2 Hareket süresi

```
mesafe       = √(dx² + dy²)
yolculuk     = mesafe × en yavaş birimin hızı (dakika/alan) ÷ (dünya hızı × birlik hızı)
```
Ordu en yavaş biriminin hızıyla hareket eder. Bu da "hızlı yağma birliği" ile "yavaş kuşatma ordusu" ayrımını doğurur.

### 4.3 Savaş (Beylikler için seçilen model)

Klanlar ve Travian'daki "kapalı form" yaklaşım: tek hesapta sonuç çıkar, hızlıdır, test edilebilir.

```
S = Σ saldırı gücü (piyade / süvari / okçu ayrı toplanır)
D = Σ savunma (saldıranın bileşimine göre ağırlıklı) × (1 + sur bonusu) + sur taban savunması
S, şans (±%25) ve moral ile çarpılır

S > D ise saldıran kazanır:  saldıran kayıp oranı = (D / S)^1.5,  savunan tümüyle yok olur
S ≤ D ise savunan kazanır:  savunan kayıp oranı = (S / D)^1.5,   saldıran tümüyle yok olur
```

OGame tarzı tur tabanlı simülasyon daha derin olsa da hem daha yavaştır hem de dengelenmesi zordur. İlk sürüm için kapalı form yeterli.

### 4.3.1 Casusluk ve kuşatma (Beylikler'de uygulanan)

- **Casusluk:** Yalnız gözcüden oluşan birlik savaşmaz. Saldıran gözcüler savunan gözcülerden fazlaysa görev başarılı olur ve kayıp oranı (savunan / saldıran)^1.5 olur. Değilse gözcülerin hepsi yakalanır. Başarılı rapor köyün askerlerini, kaynaklarını, gizli depo korumasını ve binalarını gösterir.
- **Kuşatma:** Yalnızca kazanılan savaştan sonra sağ kalan araçlar yıkım yapar. L seviyeli bir binayı L−1'e indirmek L araç ister. Böylece yüksek seviyeli binaları yıkmak hem daha zor hem daha pahalıdır; 10. seviye bir ambarı 7'ye indirmek 10 + 9 + 8 = 27 mancınık ister. Koçbaşı suru, mancınık oyuncunun seçtiği binayı hedefler.
- **Onarım:** Yıkılan barbar binaları her oyun günü bir seviye onarılır. Kayıtta yalnızca yıkım miktarı ve zamanı tutulur.

### 4.3.2 Rakip beyler (Beylikler'de uygulanan yapay zekâ)

- **Belirlenim:** Beylerin yerleri, adları ve kişilikleri yalnızca dünya tohumundan hesaplanır. Kayıtta yalnızca saldırı takvimi (`state.ai.lords`) ve hisarlarındaki değişiklikler tutulur.
- **Güç:** `güç = başlangıç (2–4) + kişiliğe göre günlük artış × dünya günü` (en fazla 25). Hisar, barbar köyleriyle aynı bina ve garnizon kurallarıyla üretilir; garnizon kişiliğe göre çarpılır (savunmacı ×2, tüccar ×0,7).
- **Saldırı ordusu:** `saldırı gücü = 50 × güç^1,5 × zorluk çarpanı`. Bu güç, kişiliğin birim dağılımına bölünür (saldırgan: %60 baltacı, %40 akıncı). Güçlenen saldırgan bey koçbaşı da getirir.
- **Takvim:** Saldırı aralıkları kişiliğe göre 36–192 oyun saati arasındadır ve zorlukla ölçeklenir. İlk saldırı başlangıç korumasından sonra gelir. Tüm rastgelelik tohumdan geldiği için aynı kayıt aynı saldırıları üretir.
- **Tasarım kararı:** Beyler gerçek bir oyuncu gibi kaynak toplayıp karar vermez; güçleri zamana bağlı bir eğridir. Bu hem hesaplaması ucuzdur hem de oyuncunun uzakta olduğu süreyi doğru biçimde yetiştirir.
- **Yaşayan dünya (7b):** Her bey ayrı bir takvimle yakındaki barbar köylerini yağmalar. Kişiliğine göre bazen başka bir beye savaş açar (saldırgan %25, savunmacı %10, tüccar %5). Bu hareketler yol süresi olmadan anında çözülür. Sonuçları temel güce eklenen bir **güç payını** değiştirir (−3…+4): başarılı yağma +0,03, savaş zaferi +0,4, yenilgi −0,4.
- **Denge ölçümü:** 60 oyun günlük benzetimde beyler 45–95 kez yağma yaptı. İlk ayarda güç payı hızla tavana vuruyordu ve 60. günde bütün beyler aynı puandaydı. Payı temel gücün üstüne ekleyip yağma kazancını düşürünce sıralama 1.190–4.006 puan arasına yayıldı.

### 4.4 Yağma ve fetih

- **Yağma:** Her birimin bir taşıma kapasitesi var. Gizli depodaki miktar düşüldükten sonra kalan kaynak, kapasite dolana kadar eşit oranda alınır.
- **Fetih:** Köyün sadakati 100'den başlar. Fetih birimi her saldırıda 20–35 puan düşürür. 0'a inince köy el değiştirir. Sadakat saatte yaklaşık 1 puan geri gelir.
- **Beylikler'de uygulanan (8a):** Fetih birimi **Elçi**'dir. Saray'da yetişir ve köy başına sayısı Saray seviyesiyle sınırlıdır (en fazla 5). Yalnızca **kazanılan** saldırıdan sağ çıkan Elçiler bağlılığı düşürür; her biri için düşüş tohumdan ve hareket numarasından belirlenir (20–35). Bağlılık kayıtta `{değer, dünya saati}` olarak tutulur ve okunduğu anda oyun saati başına +1 eklenerek hesaplanır (tembel hesaplama). Sıfırlanan köy yeni bir oyuncu köyü olur: kuşatmadan sonraki binalar, yağmadan kalan kaynaklar ve sağ kalan saldırganlar (Elçiler hariç) oraya yerleşir, bağlılık 25'ten başlar. Bey hisarı fethedilirse bey oyundan çekilir.
- **Birim çeşitliliği (8a):** Her bina iki rolü birbirinden ayıran birimler sunar. Kışla: Yaya, Kılıççı, Muhafız (savunma) ile Baltacı, Serdengeçti (saldırı) ve Okçu. Ahır: Gözcü, Deli (ucuz ve hızlı yağmacı), Akıncı, Atlı Okçu (süvari hızında okçu saldırısı; savunanın okçu savunmasına çarpar) ve Sipahi. Böylece savunan taraf tek bir savunma türüne yığılamaz.

## 5. Zaman ve simülasyon mimarisi

- **Tembel hesaplama:** `kaynak(t) = min(kapasite, kaynak(t₀) + oran × (t − t₀))`. Oyun her saniye bir şey kaydetmez; yalnızca son güncelleme zamanını saklar.
- **Olay kuyruğu:** İnşaat bitişi, eğitim bitişi, ordu varışı ve dönüşü birer olaydır. Olaylar zaman sırasıyla işlenir. Her olaydan önce üretim o ana kadar yürütülür, çünkü olay üretim oranını ya da kapasiteyi değiştirebilir.
- **Çevrimdışı ilerleme:** Tarayıcı kapalıyken de zaman geçer. Oyun açılınca aynı kod her şeyi yetiştirir.
- **`setInterval`'e güvenilmez:** Arka plandaki sekmelerde tarayıcı zamanlayıcıları yavaşlatır. Her hesap `Date.now()` farkına dayanmalıdır. Zamanlayıcı yalnızca ekranı yenilemek için kullanılır.

Beylikler'de bu yapı `js/core/engine.js` içinde uygulandı ve testlerle doğrulandı.

## 6. Teknik altyapı: GitHub Pages

### 6.1 Kısıtlar

- Yalnızca statik dosya (HTML, CSS, JS, görsel) sunar; sunucu kodu çalıştıramaz.
- Yayınlanan site en fazla **1 GB** olabilir. Aylık **100 GB** bant genişliği ve saatte **10 derleme** yumuşak sınırları var (GitHub Actions ile yayında derleme sınırı uygulanmaz).
- Ücretsiz GitHub hesabında Pages yalnızca **herkese açık** depolarda çalışır. Özel depodan yayın için ücretli plan gerekir.
- Derleme adımı gerektirmeyen tarayıcı ES modülleri doğrudan yayınlanabilir.
- ES modülleri `file://` üzerinden (dosyaya çift tıklayarak) yüklenmez. Yerel geliştirme için küçük bir sunucu gerekir (`tools/serve.js`).

### 6.2 Çok oyunculu için seçenekler

| Seçenek | Artıları | Eksileri | Maliyet |
|---|---|---|---|
| **A. Tek oyunculu + localStorage** | Sunucu yok, anında çalışır, hile sorun değil | Gerçek rakip yok; kayıt tek tarayıcıda kalır (dışa aktarma ile taşınır) | 0 |
| **B. Supabase** (Postgres, Auth, Realtime, Edge Functions) | İlişkisel veri (köy, ordu, hareket) SQL'e çok uygun. Satır düzeyi güvenlik (RLS). Sunucu mantığı JS/TS ile yazılır. | Ücretsiz planda 500 MB veritabanı, 50.000 aylık aktif kullanıcı. **1 hafta hareketsiz kalan proje duraklatılır.** | 0 → ~$25/ay |
| **C. Firebase** (Firestore) | Kolay kurulum, gerçek zamanlı dinleme | Ücretsiz planda günde 50.000 okuma / 20.000 yazma. Sunucu mantığı için Cloud Functions **Blaze (kullandıkça öde) planı ister.** Ekonomi/savaş hesabını istemcide yapmak hileye açık. | 0 → kullandıkça |
| **D. Kendi sunucusu** (Node + WebSocket + veritabanı, VPS) | Tam kontrol, zamanlanmış görevler | Bakım, güvenlik, sunucu yönetimi | ~$5+/ay |

**Hile konusu:** İstemcide hesaplanan her şey değiştirilebilir. Çok oyunculu sürümde istemci yalnızca **niyet** göndermeli ("Oduncuyu yükselt"). Kaynak, süre ve savaş hesabını sunucu yapmalı. Tembel hesaplama sayesinde zamanlanmış görev (cron) gerekmez: bir köy okunduğunda bekleyen olaylar o anda işlenir.

**Karar:** A ile başla. Motoru saf ve deterministik yaz. Böylece B'ye geçişte aynı motor sunucuya taşınabilir.

**Adım 13'te verilen karar: D (bağımlılıksız Node sunucusu).** Gerekçeler:

- Oyunun motoru zaten saf JavaScript; Node sunucusu onu olduğu gibi çalıştırır. Supabase Edge Functions (Deno) de çalıştırabilirdi ama oyuncular arası savaşta iki oyuncunun durumu aynı anda, zaman sırasıyla güncellenmeli. Bu, tek süreçte bellekte tutulan bir dünya ile çok daha basit ve tutarlı (bkz. `advanceMany`).
- Hesap açmadan yerelde ve aynı ağda hemen denenebilir; bir bulut hesabı gerekmez. İnternete açmak için herhangi bir Node/Docker barındırması yeter (depoda `Dockerfile`).
- Veri küçük: bir dünya birkaç yüz oyuncuya kadar tek bir JSON dosyasına sığar. Çok büyürse aynı `store.js` arayüzü bir veritabanına (SQLite, Postgres) bağlanabilir.
- Gerçek zamanlı bildirim için WebSocket yerine Server-Sent Events: tarayıcıda yerleşik, tek yönlü (sunucudan istemciye) ve proxy'lerle sorunsuz.

Ayrıntılar: [COK_OYUNCULU.md](COK_OYUNCULU.md).

## 7. Teknoloji kararları

| Karar | Gerekçe |
|---|---|
| Framework'süz JavaScript (ES modülleri), derleme adımı yok | GitHub Pages'e doğrudan yayın, sıfır bağımlılık, öğrenmesi ve incelemesi kolay |
| Motor (`core/`, `systems/`) DOM'a dokunmaz | Node'da test edilebilir, ileride sunucuda çalışabilir |
| Tek kapı: `Game` sınıfı | Arayüz durumu doğrudan değiştirmez; çok oyunculuda bu sınıfın eylemleri sunucu isteğine dönüşür |
| `localStorage` + sürümlü kayıt şeması + migrasyon | Güncellemelerde eski kayıtlar bozulmaz |
| Dışa/içe aktarma (base64 kayıt kodu) | Yedekleme ve cihaz değiştirme |
| Node'un yerleşik test koşucusu (`node --test`) | Ek paket gerekmez |
| Tohumlu rastgele sayı üreteci (harita adımında) | Aynı tohum aynı dünyayı üretir; kayıtta tüm haritayı saklamaya gerek kalmaz |
| İleride PWA (manifest + service worker) | Telefona kurulabilir, çevrimdışı açılabilir |

## 8. Veri modeli (Adım 4, kayıt şeması 3. sürüm)

```json
{
  "version": 3,
  "createdAt": 1790680000000,
  "world": { "speed": 1, "seed": 123456789, "clock": { "time": 259200000, "at": 1790940000000 } },
  "player": { "name": "Bey" },
  "activeVillageId": "v1",
  "villages": {
    "v1": {
      "id": "v1", "name": "Beyliğim", "x": 500, "y": 500,
      "resources": { "odun": 500, "kil": 500, "demir": 500 },
      "buildings": { "konak": 3, "oduncu": 2, "kilocagi": 1, "demirmadeni": 1, "ambar": 1, "ciftlik": 1, "gizlidepo": 0, "kisla": 1, "ahir": 0, "atolye": 0, "sur": 0 },
      "buildQueue": [
        { "building": "oduncu", "level": 3, "cost": { "odun": 78, "kil": 94, "demir": 63 }, "startAt": 0, "endAt": 85000 }
      ],
      "units": { "yaya": 12, "kilicci": 0, "baltaci": 0, "okcu": 0, "gozcu": 0, "akinci": 0, "sipahi": 0, "kocbasi": 0, "mancinik": 0 },
      "trainQueues": {
        "kisla": [{ "unit": "yaya", "count": 20, "trained": 3, "unitMs": 943000, "startAt": 0, "endAt": 18860000 }],
        "ahir": [],
        "atolye": []
      },
      "lastUpdate": 1790680000000
    }
  }
}
```

Eğitim partisi (`trainQueues` içindeki kayıt) askerleri birer birer yetiştirir: sıradaki asker `startAt + (trained + 1) × unitMs` anında hazır olur. Sonraki adımlarda dünyaya `movements` (ordu hareketleri) ve `reports` (savaş raporları) eklenecek.

### 8.1 Harita neden kayıtta yok?

Harita **prosedürel** üretilir: bir alanın arazisi ve orada barbar köyü olup olmadığı yalnızca `(tohum, x, y)` üçlüsünden hesaplanır. Böylece:

- Kayıt dosyası küçük kalır; 1000×1000'lik dünyanın tek bir alanı bile saklanmaz.
- Aynı tohum her cihazda aynı dünyayı verir. Çok oyunculu sürümde sunucu ve istemci aynı haritayı ayrı ayrı üretebilir.
- Göl, orman ve tepeler "değer gürültüsü" (value noise) ile üretilir. Yakın alanlar benzer değer aldığı için araziler tek tek dağılmaz, kümeler oluşturur.
- Barbar köylerinin gelişmişliği `başlangıç + günlük artış × dünya günü` formülüyle bulunur. Dünya günü, dünya hızıyla işleyen `world.clock` saatinden gelir.

Oyuncu bir barbar köyünü değiştirdiğinde (yağmaladığında, askerlerini öldürdüğünde) yalnızca bu **fark** kayda yazılır.

### 8.2 Savaş verisi (Adım 5, kayıt şeması 4. sürüm)

```json
{
  "villages": { "v1": { "movements": [
    { "id": 7, "type": "saldiri", "target": { "id": "b500_498", "name": "Akdere", "x": 500, "y": 498 },
      "units": { "baltaci": 20, "akinci": 10 }, "loot": null, "departAt": 0, "arriveAt": 2160000 }
  ] } },
  "barbarians": { "b500_498": { "units": { "yaya": 0, "kilicci": 0, "okcu": 0 }, "resources": { "odun": 12, "kil": 9, "demir": 30 }, "time": 7200000 } },
  "reports": [ { "id": 8, "attackerWins": true, "luck": -0.099, "attack": 1892, "defense": 138, "loot": { "odun": 334, "kil": 333, "demir": 333 } } ],
  "nextId": 9
}
```

- Hareket, çıktığı köyün `movements` listesinde durur. Varışta saldırı `donus` türüne çevrilir; sağ kalanlar aynı süreyle geri gelir.
- `barbarians` yalnızca saldırıya uğramış köyleri içerir. `time` dünya saatidir; köy bu andan itibaren üretmeye ve garnizonunu günde %25 toparlamaya devam eder.
- Şans, `(tohum, hareket numarası)` ile belirlenir. Aynı kayıt aynı savaşı her zaman aynı sonuçla çözer. Bu hem testleri kolaylaştırır hem de çok oyunculu sürümde sunucuyla istemcinin aynı sonucu bulmasını sağlar.

## 9. Beylikler'in oyun tasarımı

- **Tema:** Ortaçağ Anadolu'su esintili beylikler dönemi. Özgün isimler ve kendi grafiklerimiz (SVG/CSS) kullanılır.
- **Kaynaklar:** Odun, kil, demir ve nüfus (Çiftlik). Klanlar'ın sade modeli seçildi. Tahıl/bakım fikri ileride denge aracı olarak düşünülebilir.
- **Binalar (Adım 1):** Konak, Oduncu, Kil Ocağı, Demir Madeni, Ambar, Çiftlik, Gizli Depo, Kışla, Sur
- **Planlanan birimler:** Yaya (mızraklı), Kılıççı, Baltacı, Okçu, Gözcü (casus), Akıncı (hafif süvari), Sipahi (ağır süvari), Koçbaşı, Mancınık, Elçi (fetih birimi; köyün **bağlılığını** düşürür)
- **Farklılaştırıcı fikirler:**
  - Tek oyunculu modda **kişilikli yapay zekâ beyler** (saldırgan, tüccar, savunmacı) ve zorluk seviyeleri
  - Rastgele olaylar: kıtlık, bereketli hasat, tüccar kervanı, eşkıya baskını
  - Net bir oyun sonu hedefi (ör. "Başkenti fethet" ya da bir anıt yapı yarışı)

## 10. Yasal notlar

- "Klanlar", "Tribal Wars", "Travian" ve "OGame" tescilli markalardır. Adları, logoları, grafikleri ve metinleri kopyalanmamalıdır.
- Oyun mekanikleri (fikirler) genel olarak telifle korunmaz. Ancak ifade (sanat, metin, özgün adlandırma) korunur. Beylikler bu yüzden kendi adlarını, metinlerini ve grafiklerini kullanır. *Bu bir hukuki görüş değildir.*
- Hazır görsel kullanılacaksa lisansa dikkat edilmeli (ör. CC0 lisanslı varlıklar).

## 11. Riskler ve önlemler

| Risk | Önlem |
|---|---|
| Tek oyunculuda motivasyon düşer | Yapay zekâ beylerin kalitesi, görevler, oyun sonu hedefi |
| Tarayıcı verisi silinirse kayıt kaybolur | Dışa aktarma kodu; ileride bulut kaydı |
| Sistem saati ileri alınarak hile | Tek oyunculuda önemsiz; çok oyunculuda sunucu zamanı kullanılır |
| Kapsamın kontrolsüz büyümesi | Adım adım yol haritası, her adım oynanabilir bir sürümle biter |
| Denge sorunları | Tüm sayılar tek dosyada (`formulas.js`, `config/`); testler oyunun kilitlenmediğini doğrular |

## Kaynaklar

- [GitHub Pages limits — GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [What is GitHub Pages — GitHub Docs](https://help.github.com/articles/what-is-github-pages)
- [Supabase free tier limits 2026 — Automation Atlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)
- [Supabase Pricing 2026 Guide — Jetadmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [Firebase pricing — SuperTokens](https://supertokens.com/blog/firebase-pricing)
- [Firebase Cloud Functions deployment (Blaze gerekliliği)](https://fire-notifications-docs.readthedocs.io/en/latest/intro/cloud-functions-deployment.html)
- [Tribal Wars — Wikipedia](https://en.wikipedia.org/wiki/Tribal_Wars)
- [Tribal Wars: Timber camp / Warehouse — InnoGames Support](https://support.innogames.com/kb/TribalWars/en_DK/3020)
- [Tribal Wars speed rounds (dünya ayarları örnekleri)](https://www.tribalwars.co.uk/page/speed/rounds/past/386)
- [OGame — Wikipedia](https://www.wikipedia.org/wiki/OGame)
- [OGame Probabilistic Battle Engine (açık kaynak savaş motoru)](https://github.com/jstar88/opbe)
- [Travian: Kingdoms — Combat basics](https://support.kingdoms.com/en/articles/194-combat-basics)
