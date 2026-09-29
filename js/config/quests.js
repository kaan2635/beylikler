// Görevler (oyun içi eğitim), başarımlar, günlük hazine ve oyun sonu hedefi.
//
// Görevler sırayla açılır: aynı anda en fazla QUEST_WINDOW görev görünür; tamamlanan görevin
// ödülü oyuncu "Ödülü al"a basınca verilir. Her görevin `goal` alanı bir ölçüttür (bkz.
// systems/quests.js → measure): { kind, id?, target }.

export const QUEST_WINDOW = 3;

export const QUESTS = Object.freeze([
  { id: 'oduncu2', title: 'İlk kütükler', text: 'Oduncuyu 2. seviyeye yükselt. Odun hemen her yapının temelidir.', goal: { kind: 'building', id: 'oduncu', target: 2 }, reward: { odun: 120, kil: 120, demir: 60 } },
  { id: 'kaynak2', title: 'Üç kaynak', text: 'Kil Ocağı ve Demir Madeni 2. seviyeye ulaşsın.', goal: { kind: 'buildings', ids: ['kilocagi', 'demirmadeni'], target: 2 }, reward: { odun: 150, kil: 150, demir: 150 } },
  { id: 'ciftlik3', title: 'Doyan karınlar', text: 'Çiftliği 3. seviyeye yükselt; nüfus olmadan ne bina ne asker olur.', goal: { kind: 'building', id: 'ciftlik', target: 3 }, reward: { odun: 200, kil: 200, demir: 100 } },
  { id: 'ambar4', title: 'Dolu ambar', text: 'Ambarı 4. seviyeye yükselt. Ambar dolunca üretim durur.', goal: { kind: 'building', id: 'ambar', target: 4 }, reward: { odun: 250, kil: 250, demir: 250 } },
  { id: 'konak3', title: 'Beyin konağı', text: 'Konağı 3. seviyeye yükselt. Her seviye tüm inşaatları hızlandırır.', goal: { kind: 'building', id: 'konak', target: 3 }, reward: { odun: 300, kil: 300, demir: 200 }, akce: 10 },
  { id: 'kisla1', title: 'İlk sancak', text: 'Kışla inşa et.', goal: { kind: 'building', id: 'kisla', target: 1 }, reward: { odun: 300, kil: 250, demir: 250 } },
  { id: 'yaya10', title: 'Mızraklar hazır', text: '10 Yaya eğit. Ucuzdur ve süvariye karşı iyi savunur.', goal: { kind: 'units', id: 'yaya', target: 10 }, reward: { odun: 300, kil: 300, demir: 300 } },
  { id: 'saldiri1', title: 'İlk akın', text: 'Haritadan bir barbar köyü seç ve bir saldırı kazan.', goal: { kind: 'stat', id: 'attacksWon', target: 1 }, reward: { odun: 400, kil: 400, demir: 400 }, akce: 15 },
  { id: 'sur1', title: 'Taş duvar', text: 'Sur inşa et. Savunan askerlerine güç katar.', goal: { kind: 'building', id: 'sur', target: 1 }, reward: { odun: 300, kil: 500, demir: 200 } },
  { id: 'gizlidepo2', title: 'Mahzen', text: 'Gizli Depoyu 2. seviyeye yükselt; yağmacılar oradakini bulamaz.', goal: { kind: 'building', id: 'gizlidepo', target: 2 }, reward: { odun: 300, kil: 300, demir: 300 } },
  { id: 'yagma10', title: 'Yağma ustası', text: 'Toplam 5.000 ganimet topla.', goal: { kind: 'stat', id: 'loot', target: 5000 }, reward: { odun: 600, kil: 600, demir: 600 }, akce: 15 },
  { id: 'pazar1', title: 'Çarşı kuruldu', text: 'Pazar inşa et; tüccarların kaynakları takas eder.', goal: { kind: 'building', id: 'pazar', target: 1 }, reward: { odun: 400, kil: 400, demir: 400 } },
  { id: 'ahir1', title: 'Atlar', text: 'Ahır inşa et. Süvariler hızlıdır ve çok ganimet taşır.', goal: { kind: 'building', id: 'ahir', target: 1 }, reward: { odun: 500, kil: 500, demir: 500 } },
  { id: 'casus1', title: 'Gözler ve kulaklar', text: 'Gözcülerle bir köyü başarıyla gözetle.', goal: { kind: 'stat', id: 'spies', target: 1 }, reward: { odun: 500, kil: 500, demir: 500 } },
  { id: 'demirci1', title: 'Örsün sesi', text: 'Demirci inşa et ve bir asker türünü geliştir.', goal: { kind: 'tech', target: 1 }, reward: { odun: 700, kil: 700, demir: 700 }, akce: 20 },
  { id: 'kervansaray1', title: 'Yola çıkış', text: 'Kervansaray inşa et ve bir keşif seferi tamamla.', goal: { kind: 'stat', id: 'expeditions', target: 1 }, reward: { odun: 800, kil: 800, demir: 800 }, akce: 20 },
  { id: 'savunma1', title: 'Kale düşmez', text: 'Bir beyin saldırısını püskürt.', goal: { kind: 'stat', id: 'defenses', target: 1 }, reward: { odun: 1000, kil: 1000, demir: 1000 }, akce: 20 },
  { id: 'puan500', title: 'Büyüyen beylik', text: 'Beyliğin toplam 500 puana ulaşsın.', goal: { kind: 'points', target: 500 }, reward: { odun: 1500, kil: 1500, demir: 1500 }, akce: 25 },
  { id: 'saray1', title: 'Divan', text: 'Saray inşa et; elçiler köy fethetmenin anahtarıdır.', goal: { kind: 'building', id: 'saray', target: 1 }, reward: { odun: 3000, kil: 3000, demir: 3000 }, akce: 30 },
  { id: 'fetih1', title: 'İlk fetih', text: 'Elçilerle bir köyün bağlılığını sıfırla ve beyliğine kat.', goal: { kind: 'villages', target: 2 }, reward: { odun: 5000, kil: 5000, demir: 5000 }, akce: 50 },
  { id: 'bey1', title: 'Bir bey düştü', text: 'Rakip beylerden birinin hisarını fethet.', goal: { kind: 'lords', target: 1 }, reward: { odun: 8000, kil: 8000, demir: 8000 }, akce: 60 },
]);

// Başarımlar: her birinin kademeleri vardır; kademe aşılınca Akçe kendiliğinden verilir.
export const ACHIEVEMENTS = Object.freeze([
  { id: 'insaatci', title: 'Usta İnşaatçı', text: 'Beyliğin toplam puanı', goal: { kind: 'points' }, tiers: [300, 1500, 5000], akce: [15, 40, 100] },
  { id: 'yagmaci', title: 'Akıncı Ruhu', text: 'Toplam ganimet', goal: { kind: 'stat', id: 'loot' }, tiers: [10_000, 100_000, 1_000_000], akce: [15, 40, 100] },
  { id: 'savasci', title: 'Kılıç Ustası', text: 'Savaş puanı (öldürülen düşmanın nüfusu)', goal: { kind: 'stat', id: 'kills' }, tiers: [200, 2_000, 20_000], akce: [15, 40, 100] },
  { id: 'savunucu', title: 'Kale Muhafızı', text: 'Püskürtülen bey saldırısı', goal: { kind: 'stat', id: 'defenses' }, tiers: [3, 15, 50], akce: [15, 40, 100] },
  { id: 'kasif', title: 'Ufukların Kâşifi', text: 'Tamamlanan keşif seferi', goal: { kind: 'stat', id: 'expeditions' }, tiers: [5, 25, 100], akce: [15, 40, 100] },
  { id: 'fatih', title: 'Fatih', text: 'Yönetilen köy', goal: { kind: 'villages' }, tiers: [2, 5, 10], akce: [30, 80, 200] },
  { id: 'demirci', title: 'Demir Yumruk', text: 'Toplam Demirci geliştirme seviyesi', goal: { kind: 'tech' }, tiers: [5, 20, 42], akce: [15, 40, 100] },
  { id: 'casus', title: 'Gölgeler', text: 'Başarılı casusluk', goal: { kind: 'stat', id: 'spies' }, tiers: [5, 25, 100], akce: [10, 30, 80] },
]);

export const DAILY = Object.freeze({ akce: 10, resources: 0.1 }); // günlük hazine: Akçe + ambarın %10'u

// Oyun sonu: tüm rakip beylerin hisarlarını fethet → Sultanlık.
export const VICTORY = Object.freeze({ title: 'Sultan', akce: 500 });
