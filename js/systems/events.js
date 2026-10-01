import { EVENTS } from '../config/events.js';
import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { UNITS } from '../config/units.js';
import { DIFFICULTIES } from '../config/lords.js';
import { hiddenCapacity } from '../core/formulas.js';
import { hash3, mulberry32 } from '../core/random.js';
import { canAfford, spend, deposit, storageCap, populationCap, populationUsed, produce } from './economy.js';
import { villagePoints, worldDays, lordsOf, lordDefeated, distance } from './world.js';
import { resolveBattle } from './combat.js';
import { armyAttack, subtractUnits, luckFor, addReport, battlePoints, resourceTotal } from './army.js';
import { grantAkce, spendAkce, syncBonuses } from './premium.js';
import { adjustRelation, relationOf } from './diplomacy.js';
import { bonusOf } from './bonus.js';
import { BUILDINGS } from '../config/buildings.js';
import { rollItem, giveItem, addHeroXp, heroHealthy } from './hero.js';

/**
 * Olaylar ve kararlar. Oyuncunun kaydında:
 *   state.events = { nextAt, count, pending, history }
 *   state.player.modifiers = [{ id, name, bonus, until }]   (olaylardan gelen geçici etkiler)
 * Olay geldiğinde seçenekleri o anki köye göre hesaplanır ve `pending`e yazılır (maliyetler,
 * kazançlar, etkiler); oyuncu seçince aynen uygulanır. Süre dolarsa `fallback` seçeneği işler.
 * Bütün rastgelelik tohumdan ve olay sayacından gelir.
 */

const HOUR = 3_600_000;
const EVENT_SALT = 0x5eed1e57;
const NOT_FIGHTERS = new Set(['gozcu', 'kocbasi', 'mancinik', 'topcu', 'elci']);

const toReal = (world, gameMs) => gameMs / world.speed;
const between = ([min, max], r) => min + r * (max - min);
const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);

function playerSalt(state) {
  let h = 0;
  for (const ch of String(state.idPrefix ?? 'v')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

function rngFor(state, n) {
  return mulberry32(hash3(state.world.seed ^ EVENT_SALT, state.events.count, n ^ playerSalt(state)));
}

export function ensureEvents(state, now) {
  state.events ??= { nextAt: null, count: 0, pending: null, history: [] };
  state.player.modifiers ??= [];
  const events = state.events;
  if (events.disabled) return; // olaysız oyun (testler)
  if (events.nextAt == null && !events.pending) {
    events.nextAt = now + toReal(state.world, between(EVENTS.firstHours, rngFor(state, 1)()) * HOUR);
  }
}

/** Dünya hızı değişince bekleyen süreler aynı oranda ölçeklenir. */
export function rescaleEvents(state, now, oldSpeed, newSpeed) {
  const scale = (t) => (t > now ? now + ((t - now) * oldSpeed) / newSpeed : t);
  const events = state.events;
  if (!events) return;
  if (events.nextAt) events.nextAt = scale(events.nextAt);
  if (events.pending) events.pending.expiresAt = scale(events.pending.expiresAt);
  for (const modifier of state.player.modifiers ?? []) modifier.until = scale(modifier.until);
}

// ---------- Seçenek yardımcıları ----------

const share = (ctx, part) => round10(ctx.storage * part);
const each = (ctx, part) => Object.fromEntries(RESOURCE_IDS.map((id) => [id, share(ctx, part)]));
const modifier = (name, bonus, hours) => ({ kind: 'modifier', name, bonus, hours });
const choice = (id, label, { cost = {}, effects = [], note = '', disabled = null } = {}) => ({ id, label, cost, effects, note, disabled });

/** En bol ve en az kaynak. */
function extremes(village) {
  const sorted = [...RESOURCE_IDS].sort((a, b) => village.resources[b] - village.resources[a]);
  return { most: sorted[0], least: sorted[sorted.length - 1] };
}

function fighters(village) {
  return Object.fromEntries(Object.entries(village.units).filter(([id, n]) => n > 0 && UNITS[id].attack > 0 && !NOT_FIGHTERS.has(id)));
}

// ---------- Olaylar ----------
// when(ctx): olay şu an gelebilir mi; build(ctx): başlık, metin, seçenekler ve kendi seyri.

const CATALOG = [
  {
    id: 'kervan',
    weight: 3,
    when: () => true,
    build(ctx) {
      const { most, least } = extremes(ctx.village);
      const give = share(ctx, 0.12);
      const get = round10(give * 1.6);
      return {
        title: 'Gezgin kervan',
        text: `Uzak diyarlardan bir kervan köyüne uğradı. ${RESOURCES[most].name} karşılığında ${RESOURCES[least].name} öneriyorlar.`,
        icon: 'tasima',
        choices: [
          choice('takas', `${give} ${RESOURCES[most].name} ver, ${get} ${RESOURCES[least].name} al`, { cost: { [most]: give }, effects: [{ kind: 'resources', resources: { [least]: get } }] }),
          choice('ugurla', 'Kervanı uğurla'),
        ],
        fallback: 'ugurla',
      };
    },
  },
  {
    id: 'yagmur',
    weight: 2,
    when: () => true,
    build(ctx) {
      return {
        title: 'Bereket yağmuru',
        text: 'Günlerdir beklenen yağmur nihayet geldi. Tarlalar yeşeriyor, halk sevinçli.',
        icon: 'odun',
        choices: [
          choice('senlik', 'Şükran şenliği düzenle', { cost: { odun: share(ctx, 0.08), kil: share(ctx, 0.04) }, effects: [modifier('Şükran şenliği', { production: 1.25 }, 24)] }),
          choice('tarla', 'Herkes tarlaya', { effects: [modifier('Bereket yağmuru', { production: 1.1 }, 24)] }),
        ],
        fallback: 'tarla',
      };
    },
  },
  {
    id: 'kitlik',
    weight: 2,
    when: (ctx) => ctx.day >= 2,
    build(ctx) {
      return {
        title: 'Kıtlık',
        text: 'Kuraklık yüzünden hasat az oldu; halk aç. Ambarları açarsan bu kış atlatılır, açmazsan halk ağır işe gücü yetmez.',
        icon: 'ambar',
        choices: [
          choice('ambar', 'Ambarları halka aç', { cost: each(ctx, 0.08) }),
          choice('sabir', 'Halk sabretsin', { effects: [modifier('Kıtlık', { production: 0.85 }, 24)] }),
        ],
        fallback: 'sabir',
      };
    },
  },
  {
    id: 'salgin',
    weight: 1.5,
    when: (ctx) => Object.values(ctx.village.units).reduce((a, b) => a + b, 0) >= 20,
    build(ctx) {
      return {
        title: 'Salgın',
        text: 'Kışlada bir salgın baş gösterdi. Hekimbaşı tedavi edebilir; yoksa hasta askerler ayrılacak.',
        icon: 'nufus',
        choices: [
          choice('hekim', 'Hekimbaşını getir', { cost: { akce: 12 } }),
          choice('sifahane', 'Şifahane kur', { cost: { kil: share(ctx, 0.1), demir: share(ctx, 0.06) } }),
          choice('karantina', 'Karantinaya al (askerlerin %12\'si ayrılır)', { effects: [{ kind: 'loseUnits', share: 0.12 }] }),
        ],
        fallback: 'karantina',
      };
    },
  },
  {
    id: 'mimar',
    weight: 2,
    when: () => true,
    build(ctx) {
      return {
        title: 'Usta mimar',
        text: 'Ünlü bir mimar yolu üstünde köyüne uğradı. Ağırlarsan bir gün boyunca ustalarına yol gösterecek.',
        icon: 'saat',
        choices: [
          choice('agirla', 'Mimarı ağırla (24 saat başlayan inşaatlar %30 kısa)', { cost: { odun: share(ctx, 0.08), kil: share(ctx, 0.08) }, effects: [modifier('Usta mimar', { buildTime: 0.7 }, 24)] }),
          choice('ugurla', 'Mimarı uğurla'),
        ],
        fallback: 'ugurla',
      };
    },
  },
  {
    id: 'dervis',
    weight: 1.5,
    when: () => true,
    build(ctx) {
      return {
        title: 'Gezgin derviş',
        text: 'Uzun yollardan gelen bir derviş köyünde konakladı. Duası bereket, sofrası gönül açar derler.',
        icon: 'kupa',
        choices: [
          choice('dua', 'Duasını al (2 gün savunma +%15)', { cost: { akce: 10 }, effects: [modifier('Dervişin duası', { defense: 1.15 }, 48)] }),
          choice('sofra', 'Sofra kur (1 gün eğitim %15 kısa)', { cost: { odun: share(ctx, 0.05), kil: share(ctx, 0.05) }, effects: [modifier('Derviş sofrası', { trainTime: 0.85 }, 24)] }),
          choice('gecsin', 'Yoluna devam etsin'),
        ],
        fallback: 'gecsin',
      };
    },
  },
  {
    id: 'haydut',
    weight: 2.5,
    when: (ctx) => ctx.day >= 2,
    build(ctx) {
      const strength = Math.round(60 + 1.5 * ctx.points);
      const army = fighters(ctx.village);
      const power = Math.round(armyAttack(army, ctx.village.tech) * bonusOf(ctx.village).attack);
      const reward = each(ctx, 0.12);
      const wall = ctx.village.buildings.sur;
      return {
        title: 'Haydut çetesi',
        text: `Yakındaki ormanda bir haydut çetesi kamp kurmuş, kervanları soyuyor. Çetenin gücü ~${strength}; senin savaşabilecek askerlerinin gücü ${power}.`,
        icon: 'saldiri',
        choices: [
          choice('saldir', 'Üstlerine yürü (kazanırsan ganimet ve Akçe; kaybedersen gidenler ölür)', {
            effects: [{ kind: 'battle', strength, reward, akce: 6 }],
            disabled: power > 0 ? null : 'Savaşabilecek askerin yok',
          }),
          choice('harac', 'Haraç ver, köyden uzak dursunlar', { cost: each(ctx, 0.06) }),
          choice('sur', wall >= 3 ? 'Surlara güven (surun sağlam)' : 'Surlara güven (sur zayıf: yağma riski)', { effects: wall >= 3 ? [] : [{ kind: 'loseResources', share: 0.15 }] }),
        ],
        fallback: 'sur',
      };
    },
  },
  {
    id: 'gocmen',
    weight: 1.5,
    when: (ctx) => ctx.village.buildings.kisla >= 1 && populationCap(ctx.village) - populationUsed(ctx.village) >= 10,
    build(ctx) {
      const free = populationCap(ctx.village) - populationUsed(ctx.village);
      const n = Math.max(5, Math.min(free, 40, Math.round(ctx.points / 25)));
      return {
        title: 'Göçmenler',
        text: `Savaştan kaçan ${n} genç köyüne sığınmak istiyor; yerleştirirsen mızrak tutmaya hazırlar.`,
        icon: 'yaya',
        choices: [
          choice('yerlestir', `Yerleştir (${n} Yaya)`, { cost: { odun: share(ctx, 0.06) }, effects: [{ kind: 'units', units: { yaya: n } }] }),
          choice('gecir', 'Yollarına devam etsinler'),
        ],
        fallback: 'gecir',
      };
    },
  },
  {
    id: 'panayir',
    weight: 1.5,
    when: (ctx) => ctx.day >= 1,
    build(ctx) {
      const { most } = extremes(ctx.village);
      const sell = share(ctx, 0.15);
      return {
        title: 'Panayır',
        text: 'Köy meydanında panayır kuruldu; uzak beyliklerden tüccarlar geldi.',
        icon: 'akce',
        choices: [
          choice('sat', `${sell} ${RESOURCES[most].name} sat, 6 Akçe al`, { cost: { [most]: sell }, effects: [{ kind: 'akce', amount: 6 }] }),
          choice('al', 'Mal al: 8 Akçeye her kaynaktan', { cost: { akce: 8 }, effects: [{ kind: 'resources', resources: each(ctx, 0.08) }] }),
          choice('seyret', 'Uzaktan seyret'),
        ],
        fallback: 'seyret',
      };
    },
  },
  {
    id: 'elci',
    weight: 2,
    when: (ctx) => DIFFICULTIES[ctx.state.ai?.difficulty]?.attacks && !!pickLord(ctx),
    build(ctx) {
      const lord = pickLord(ctx);
      return {
        title: `${lord.name} Beyin elçisi`,
        text: `${lord.name} Bey bir elçi gönderdi: armağan karşılığında üç gün barış öneriyor. Geri çevirirsen gücenecek.`,
        icon: 'elci',
        choices: [
          choice('kabul', 'Armağanı gönder, barışı imzala', { cost: each(ctx, 0.07), effects: [{ kind: 'relation', lordId: lord.id, delta: 25 }, { kind: 'peace', lordId: lord.id, days: 3 }] }),
          choice('red', 'Elçiyi geri çevir', { effects: [{ kind: 'relation', lordId: lord.id, delta: -10 }] }),
        ],
        fallback: 'red',
        lord: lord.id,
      };
    },
  },
  {
    id: 'maden',
    weight: 1.5,
    when: (ctx) => ctx.village.buildings.demirmadeni >= 3,
    build(ctx) {
      return {
        title: 'Yeni maden damarı',
        text: 'Madenciler zengin bir demir damarına rastladı. Kazmak için kereste gerekiyor.',
        icon: 'demir',
        choices: [
          choice('kaz', 'Kazıya başla (2 gün demir +%40)', { cost: { odun: share(ctx, 0.1) }, effects: [modifier('Zengin damar', { prodDemir: 1.4 }, 48)] }),
          choice('birak', 'Şimdilik bırak'),
        ],
        fallback: 'birak',
      };
    },
  },
  {
    id: 'yangin',
    weight: 1.5,
    when: (ctx) => ctx.day >= 2,
    build() {
      return {
        title: 'Yangın',
        text: 'Kereste deposunda yangın çıktı! Herkes kovaya koşarsa söndürülür ama işler aksar.',
        icon: 'odun',
        choices: [
          choice('kova', 'Kova zinciri kur (12 saat üretim −%10)', { effects: [modifier('Yangın sonrası', { production: 0.9 }, 12)] }),
          choice('yansin', 'Bırak yansın (açıktaki odunun %25\'i gider)', { effects: [{ kind: 'loseResources', share: 0.25, only: 'odun' }] }),
        ],
        fallback: 'kova',
      };
    },
  },
  {
    id: 'kup',
    weight: 1,
    when: (ctx) => ctx.day >= 1,
    build(ctx) {
      const akce = 8 + Math.floor(ctx.rng() * 10);
      return {
        title: 'Toprak altından küp',
        text: 'Çiftçiler tarla sürerken içi eski sikkelerle dolu bir küp buldu.',
        icon: 'sandik',
        choices: [
          choice('hazine', `Hazineye kat (${akce} Akçe)`, { effects: [{ kind: 'akce', amount: akce }] }),
          choice('dagit', 'Halka dağıt (1 gün üretim +%15)', { effects: [modifier('Halkın sevinci', { production: 1.15 }, 24)] }),
        ],
        fallback: 'hazine',
      };
    },
  },
  {
    id: 'demirciusta',
    weight: 1.5,
    when: (ctx) => !!ctx.state.hero && ctx.day >= 2,
    build(ctx) {
      return {
        title: 'Usta demirci',
        text: `Ünlü bir usta demirci köyünden geçiyor; demir ve kereste verirsen ${ctx.state.hero.name} için bir şey dövecek.`,
        icon: 'saldiri',
        choices: [
          choice('dov', 'Dövsün (kahramana bir eşya)', { cost: { demir: share(ctx, 0.12), odun: share(ctx, 0.06) }, effects: [{ kind: 'item', quality: 1.8 }] }),
          choice('gec', 'Yoluna devam etsin'),
        ],
        fallback: 'gec',
      };
    },
  },
  {
    id: 'ozan',
    weight: 1.5,
    when: () => true,
    build() {
      return {
        title: 'Gezgin ozan',
        text: 'Kopuzlu bir ozan meydanda beyliğin destanını yakmak istiyor. Destan dilden dile yayılırsa şanın artar.',
        icon: 'kupa',
        choices: [
          choice('destan', 'Destanını yaksın (şan +12)', { cost: { akce: 8 }, effects: [{ kind: 'renown', amount: 12 }] }),
          choice('dinle', 'Meydanda dinlensin (12 saat üretim +%5)', { effects: [modifier('Ozanın türküsü', { production: 1.05 }, 12)] }),
        ],
        fallback: 'dinle',
      };
    },
  },
  {
    id: 'dugun',
    weight: 1.5,
    when: (ctx) => !!pickLord(ctx),
    build(ctx) {
      const lord = pickLord(ctx);
      return {
        title: `${lord.name} Beyin düğünü`,
        text: `${lord.name} Bey oğlunu evlendiriyor ve seni düğüne çağırdı. Hediyeyle gitmek bütün beylere iyi görünür.`,
        icon: 'nav-diplomasi',
        choices: [
          choice('hediye', 'Hediyeyle git', { cost: each(ctx, 0.06), effects: [{ kind: 'relation', lordId: lord.id, delta: 30 }, { kind: 'relationAll', delta: 6, except: lord.id }] }),
          choice('gitme', 'Gitme', { effects: [{ kind: 'relation', lordId: lord.id, delta: -10 }] }),
        ],
        fallback: 'gitme',
      };
    },
  },
  {
    id: 'zelzele',
    weight: 1.2,
    when: (ctx) => ctx.day >= 3 && !!crackedBuilding(ctx.village),
    build(ctx) {
      const building = crackedBuilding(ctx.village);
      return {
        title: 'Zelzele',
        text: `Yer sarsıldı! ${BUILDINGS[building].name} duvarlarında derin çatlaklar var; hemen onarılmazsa bir katı çökecek.`,
        icon: 'ambar',
        choices: [
          choice('onar', 'Hemen onar', { cost: { kil: share(ctx, 0.12), odun: share(ctx, 0.06) } }),
          choice('bekle', `Bekle (${BUILDINGS[building].name} bir seviye düşer)`, { effects: [{ kind: 'damageBuilding', building }] }),
        ],
        fallback: 'bekle',
      };
    },
  },
  {
    id: 'yabanci',
    weight: 1.2,
    when: (ctx) => !!ctx.state.hero && ctx.day >= 3,
    build() {
      return {
        title: 'Yabancı tüccar',
        text: 'Uzak diyarlardan gelen bir tüccar heybesinden nadir eşyalar çıkardı. Fiyatı yüksek ama malı sağlam.',
        icon: 'akce',
        choices: [
          choice('al', 'Bir eşya satın al (en az nadir)', { cost: { akce: 15 }, effects: [{ kind: 'item', quality: 2, minRarity: 'nadir' }] }),
          choice('gec', 'Teşekkür et, geç'),
        ],
        fallback: 'gec',
      };
    },
  },
  {
    id: 'kurultay',
    weight: 1.2,
    when: (ctx) => ctx.day >= 4 && !!pickLord(ctx),
    build(ctx) {
      return {
        title: 'Kurultay',
        text: 'Beyler büyük kurultayda toplanıyor. Bir ziyafet verirsen sözün dinlenir, şanın artar.',
        icon: 'nav-siralama',
        choices: [
          choice('ziyafet', 'Ziyafet ver (bütün beylerle ilişki +10, şan +10)', { cost: each(ctx, 0.08), effects: [{ kind: 'relationAll', delta: 10 }, { kind: 'renown', amount: 10 }] }),
          choice('katilma', 'Katılma (beyler biraz gücenir)', { effects: [{ kind: 'relationAll', delta: -4 }] }),
        ],
        fallback: 'katilma',
      };
    },
  },
  {
    id: 'ustalar',
    weight: 1.2,
    when: (ctx) => ctx.village.buildings.kisla >= 1,
    build(ctx) {
      const n = Math.max(3, Math.min(30, Math.round(ctx.points / 40)));
      return {
        title: 'Sığınmacı ustalar',
        text: 'Savaştan kaçan taş ustaları ve kılıç ustaları köyüne sığındı. İnşaatta çalışabilirler ya da sancağa katılabilirler.',
        icon: 'nufus',
        choices: [
          choice('insaat', 'İnşaatta çalışsınlar (2 gün inşaat %15 kısa)', { cost: { odun: share(ctx, 0.05) }, effects: [modifier('Usta eller', { buildTime: 0.85 }, 48)] }),
          choice('asker', `Sancağa katılsınlar (${n} Kılıççı)`, { cost: { demir: share(ctx, 0.05) }, effects: [{ kind: 'units', units: { kilicci: n } }] }),
          choice('gonder', 'Yollarına devam etsinler'),
        ],
        fallback: 'gonder',
      };
    },
  },
  {
    id: 'av',
    weight: 1.2,
    when: (ctx) => !!ctx.state.hero && !ctx.state.hero.away && heroHealthy(ctx.state.hero, ctx.state.world.clock.at) && !!pickLord(ctx),
    build(ctx) {
      const lord = pickLord(ctx);
      return {
        title: 'Sürek avı',
        text: `${lord.name} Bey büyük bir sürek avı düzenliyor; ${ctx.state.hero.name}'ı da çağırdı.`,
        icon: 'tasima',
        choices: [
          choice('katil', 'Kahraman ava katılsın (tecrübe +80, ilişki +8)', { effects: [{ kind: 'heroXp', amount: 80 }, { kind: 'relation', lordId: lord.id, delta: 8 }] }),
          choice('gecme', 'Katılma'),
        ],
        fallback: 'gecme',
      };
    },
  },
];

/** Zelzelede çatlayacak bina: kuyruğu olmayan, 3. seviye ve üstü bir bina (Konak hariç). */
function crackedBuilding(village) {
  const busy = new Set(village.buildQueue.map((job) => job.building));
  const candidates = Object.entries(village.buildings).filter(([id, level]) => id !== 'konak' && level >= 3 && !busy.has(id) && BUILDINGS[id]);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/** Elçisini gönderecek bey: ilişkisi en kötü, fethedilmemiş, barışta olmayan. */
function pickLord(ctx) {
  const { state, village } = ctx;
  const time = state.world.clock.time;
  const lords = lordsOf(state.world.seed).filter((lord) => !lordDefeated(state, lord.id) && !((state.diplomacy?.[lord.id]?.peaceUntil ?? 0) > time));
  if (!lords.length) return null;
  return lords.sort((a, b) => relationOf(state, a.id) - relationOf(state, b.id) || distance(a.x, a.y, village.x, village.y) - distance(b.x, b.y, village.x, village.y))[0];
}

export const EVENT_IDS = CATALOG.map((def) => def.id);

function context(state, village, rng) {
  return { state, village, rng, storage: storageCap(village), points: villagePoints(village.buildings), day: worldDays(state.world) };
}

/** Yeni olay gelir (motor `nextAt` anında çağırır). `forceId` testler içindir. */
export function spawnEvent(state, at, forceId = null) {
  const events = state.events;
  const village = state.villages[state.activeVillageId] ?? Object.values(state.villages)[0];
  const rng = rngFor(state, 2);
  const ctx = context(state, village, rng);
  const candidates = forceId ? CATALOG.filter((def) => def.id === forceId) : CATALOG.filter((def) => def.when(ctx));
  events.count += 1;
  events.nextAt = null;
  if (!candidates.length) {
    events.nextAt = at + toReal(state.world, between(EVENTS.intervalHours, rng()) * HOUR);
    return null;
  }
  const total = candidates.reduce((sum, def) => sum + def.weight, 0);
  let pick = rng() * total;
  const def = candidates.find((d) => (pick -= d.weight) < 0) ?? candidates[candidates.length - 1];
  const built = def.build(ctx);
  events.pending = {
    id: events.count,
    type: def.id,
    villageId: village.id,
    at,
    expiresAt: at + toReal(state.world, EVENTS.expiryHours * HOUR),
    ...built,
  };
  return { type: 'event', event: def.id, title: built.title, at };
}

/** Seçeneğin bedeli şu an ödenebilir mi; ödenemiyorsa nedeni. */
export function choiceBlocked(state, choiceDef) {
  if (choiceDef.disabled) return choiceDef.disabled;
  const village = state.villages[state.events.pending.villageId] ?? state.villages[state.activeVillageId];
  const { akce = 0, ...resources } = choiceDef.cost;
  if (akce > (state.player.akce ?? 0)) return `${akce} Akçe gerekir`;
  if (!canAfford(village, resources)) return 'Kaynak yetmiyor';
  return null;
}

/**
 * Oyuncu karar verdi (ya da süre doldu: `auto`). Bedel ödenir, etkiler uygulanır, olay kronikte
 * saklanır ve bir sonraki olay takvime yazılır.
 */
export function chooseEvent(state, choiceId, now, { auto = false } = {}) {
  const events = state.events;
  const pending = events?.pending;
  if (!pending) return { ok: false, code: 'none', reason: 'Bekleyen bir olay yok' };
  const picked = pending.choices.find((c) => c.id === choiceId);
  if (!picked) return { ok: false, code: 'choice', reason: 'Geçerli bir seçenek seç' };
  if (!auto) {
    const blocked = choiceBlocked(state, picked);
    if (blocked) return { ok: false, code: 'cost', reason: blocked };
  }
  const village = state.villages[pending.villageId] ?? state.villages[state.activeVillageId];
  const { akce = 0, ...resources } = picked.cost;
  if (akce) spendAkce(state, akce, `Olay: ${pending.title}`, now);
  spend(village, resources);

  const results = picked.effects.map((effect) => applyEffect(state, village, effect, pending, now)).filter(Boolean);
  const result = results.join(' ') || 'Olay geride kaldı.';
  events.history.unshift({ at: now, title: pending.title, choice: picked.label, result, auto });
  events.history.length = Math.min(events.history.length, EVENTS.historyMax);
  events.pending = null;
  events.nextAt = now + toReal(state.world, between(EVENTS.intervalHours, rngFor(state, 3)()) * HOUR);
  if (!auto) state.stats.events = (state.stats.events ?? 0) + 1;
  syncBonuses(state);
  return { ok: true, title: pending.title, choice: picked.label, result, auto };
}

/** Süre doldu: olay kendi seyrine bırakılır (motor çağırır). */
export function expireEvent(state, at) {
  const pending = state.events.pending;
  const result = chooseEvent(state, pending.fallback, at, { auto: true });
  return { type: 'event-expired', title: pending.title, result: result.result, at };
}

function applyEffect(state, village, effect, pending, at) {
  switch (effect.kind) {
    case 'resources': {
      const added = deposit(village, effect.resources);
      return `${RESOURCE_IDS.filter((id) => added[id]).map((id) => `${Math.round(added[id])} ${RESOURCES[id].name}`).join(', ') || 'Hiçbir şey'} ambara girdi.`;
    }
    case 'akce':
      grantAkce(state, effect.amount, `Olay: ${pending.title}`, at);
      return `${effect.amount} Akçe hazineye girdi.`;
    case 'modifier': {
      state.player.modifiers ??= [];
      state.player.modifiers.push({ id: `${pending.type}-${pending.id}`, name: effect.name, bonus: effect.bonus, until: at + toReal(state.world, effect.hours * HOUR) });
      return `${effect.name}: ${effect.hours} oyun saati sürecek.`;
    }
    case 'loseResources': {
      const hidden = hiddenCapacity(village.buildings.gizlidepo);
      const lost = {};
      for (const id of effect.only ? [effect.only] : RESOURCE_IDS) {
        lost[id] = Math.floor(Math.max(0, village.resources[id] - hidden) * effect.share);
        village.resources[id] -= lost[id];
      }
      return `Kayıp: ${Object.entries(lost).map(([id, n]) => `${n} ${RESOURCES[id].name}`).join(', ')} (gizli depodaki korundu).`;
    }
    case 'loseUnits': {
      const lost = {};
      for (const [id, n] of Object.entries(village.units)) {
        const k = Math.floor(n * effect.share);
        if (k > 0) {
          lost[id] = k;
          village.units[id] -= k;
        }
      }
      const total = Object.values(lost).reduce((a, b) => a + b, 0);
      return total ? `${total} asker ayrıldı.` : 'Kimse ayrılmadı.';
    }
    case 'units': {
      const free = Math.max(0, populationCap(village) - populationUsed(village));
      const added = {};
      for (const [id, n] of Object.entries(effect.units)) {
        const k = Math.min(n, Math.floor(free / UNITS[id].pop));
        if (k > 0) {
          village.units[id] += k;
          added[id] = k;
        }
      }
      const parts = Object.entries(added).map(([id, n]) => `${n} ${UNITS[id].name}`);
      return parts.length ? `${parts.join(', ')} köyüne katıldı.` : 'Nüfus yetmediği için kimse yerleşemedi.';
    }
    case 'relation': {
      adjustRelation(state, effect.lordId, effect.delta);
      return effect.delta > 0 ? 'Beyle ilişkin iyileşti.' : 'Bey gücendi.';
    }
    case 'peace': {
      state.diplomacy ??= {};
      const entry = (state.diplomacy[effect.lordId] ??= { relation: 0, at: state.world.clock.time, peaceUntil: 0 });
      entry.peaceUntil = Math.max(entry.peaceUntil ?? 0, state.world.clock.time) + effect.days * 86_400_000;
      state.stats.treaties = (state.stats.treaties ?? 0) + 1;
      return `${effect.days} gün barış.`;
    }
    case 'battle':
      return banditBattle(state, village, effect, pending, at);
    case 'item': {
      const rng = mulberry32(hash3(state.world.seed ^ EVENT_SALT, pending.id, 991));
      const given = giveItem(state, rollItem(rng, { quality: effect.quality ?? 1, minRarity: effect.minRarity ?? 'siradan' }));
      if (!given.stored) {
        grantAkce(state, given.akce, 'Heybe dolu: eşya satıldı', at);
        return `${given.item.name} bulundu ama heybe dolu; ${given.akce} Akçeye satıldı.`;
      }
      return `Kahramanın heybesine yeni bir eşya girdi: ${given.item.name}.`;
    }
    case 'heroXp': {
      if (!state.hero) return null;
      addHeroXp(state, effect.amount, at, bonusOf(village).heroXp);
      return `${state.hero.name} tecrübe kazandı.`;
    }
    case 'renown':
      state.stats.renownBonus = (state.stats.renownBonus ?? 0) + effect.amount;
      return `Şanın ${effect.amount} arttı.`;
    case 'relationAll': {
      for (const lord of lordsOf(state.world.seed)) {
        if (lord.id !== effect.except && !lordDefeated(state, lord.id)) adjustRelation(state, lord.id, effect.delta);
      }
      return effect.delta > 0 ? 'Beylerin gözünde itibarın arttı.' : 'Beyler biraz gücendi.';
    }
    case 'damageBuilding': {
      const level = village.buildings[effect.building] ?? 0;
      if (level > 0) village.buildings[effect.building] = level - 1;
      return `${BUILDINGS[effect.building].name} bir seviye çöktü (${level} → ${Math.max(0, level - 1)}).`;
    }
    default:
      return null;
  }
}

/** Haydut çetesine karşı köyün savaşabilen bütün askerleri yürür. */
function banditBattle(state, village, effect, pending, at) {
  const army = fighters(village);
  const each = Math.max(1, Math.round(effect.strength / 58));
  const bandits = { yaya: each, kilicci: each };
  const battle = resolveBattle({
    attackers: army,
    defenders: bandits,
    luck: luckFor(state.world.seed, 900_000 + pending.id),
    attackerTech: village.tech,
    attackerBonus: bonusOf(village).attack,
  });
  for (const [id, n] of Object.entries(battle.attackerLosses)) village.units[id] -= n;
  let loot = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  if (battle.attackerWins) {
    loot = deposit(village, effect.reward);
    grantAkce(state, effect.akce, 'Haydut çetesi dağıtıldı', at);
  }
  state.stats.kills += battlePoints(battle.defenderLosses);
  state.stats.loot += resourceTotal(loot);
  addReport(state, {
    type: 'saldiri',
    at,
    origin: { id: village.id, name: village.name, x: village.x, y: village.y },
    target: { id: 'haydut', kind: 'barbar', name: 'Haydut çetesi', x: village.x, y: village.y },
    attackerWins: battle.attackerWins,
    luck: battle.luck,
    wallLevel: 0,
    attack: Math.round(battle.attack),
    defense: Math.round(battle.defense),
    attackers: army,
    attackerLosses: battle.attackerLosses,
    defenders: bandits,
    defenderLosses: battle.defenderLosses,
    loot,
    siege: {},
  });
  return battle.attackerWins
    ? `Çete dağıtıldı! Ganimet ambara girdi, ${effect.akce} Akçe kazandın.`
    : 'Askerlerin çeteye yenildi; hiçbiri dönmedi.';
}

/** Süresi biten geçici etki kalkar (motor çağırır). Önce bütün köylerin üretimi o ana yürür. */
export function expireModifier(state, modifier, at) {
  for (const village of Object.values(state.villages)) produce(village, state.world, at);
  state.player.modifiers = (state.player.modifiers ?? []).filter((m) => m !== modifier);
  syncBonuses(state);
  return { type: 'modifier-expired', name: modifier.name, at };
}
