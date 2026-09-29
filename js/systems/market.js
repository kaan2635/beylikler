import { MARKET } from '../config/tech.js';
import { RESOURCES, RESOURCE_IDS } from '../config/resources.js';
import { travelSeconds } from '../core/formulas.js';
import { deposit, storageCap, produce } from './economy.js';
import { distance } from './world.js';

/**
 * Pazar: tüccarlar bir kaynağı başka bir kaynağa anında takas eder, komisyonu alıp giderler.
 * Tüccar sayısı Pazar seviyesine eşittir; her biri 1.000 kaynak taşır ve takastan sonra bir
 * süre yolda kalır. Yoldaki tüccarlar `village.merchants` listesinde durur: { count, returnAt }
 */

/** Pazar seviyesine göre komisyon oranı (0,2875 = %28,75). */
export function marketFee(level) {
  return Math.max(MARKET.feeMin, MARKET.feeStart - MARKET.feePerLevel * level);
}

/** Şu an köyde bekleyen tüccar sayısı. */
export function merchantsAvailable(village, now) {
  const busy = village.merchants.filter((m) => m.returnAt > now).reduce((total, m) => total + m.count, 0);
  return Math.max(0, village.buildings.pazar - busy);
}

/**
 * Takasın yapılıp yapılamayacağını inceler.
 * Dönen `code`: 'market' | 'same' | 'count' | 'resources' | 'merchants' (ok ise yok)
 */
export function inspectTrade(village, give, take, amount, now) {
  const level = village.buildings.pazar;
  const fee = marketFee(level);
  const valid = Number.isInteger(amount) && amount >= 1;
  const merchants = valid ? Math.ceil(amount / MARKET.merchantCapacity) : 0;
  const receive = valid ? Math.floor(amount * (1 - fee)) : 0;
  const room = Math.max(0, storageCap(village) - (village.resources[take] ?? 0));
  const info = {
    ok: false,
    fee,
    merchants,
    receive,
    lost: Math.max(0, receive - room), // ambara sığmayacak kısım
    available: merchantsAvailable(village, now),
    max: Math.min(Math.floor(village.resources[give] ?? 0), merchantsAvailable(village, now) * MARKET.merchantCapacity),
  };

  if (level < 1) return { ...info, code: 'market', reason: 'Takas için Pazar inşa et' };
  if (!RESOURCES[give] || !RESOURCES[take] || give === take) return { ...info, code: 'same', reason: 'Farklı iki kaynak seç' };
  if (!valid) return { ...info, code: 'count', reason: 'Takas miktarı pozitif bir tam sayı olmalı' };
  if (amount > village.resources[give]) return { ...info, code: 'resources', reason: `Yeterli ${RESOURCES[give].name.toLocaleLowerCase('tr')} yok` };
  if (merchants > info.available) {
    return { ...info, code: 'merchants', reason: `Bu takas ${merchants} tüccar ister; köyde ${info.available} tüccar var` };
  }
  return { ...info, ok: true };
}

export function trade(village, world, give, take, amount, now) {
  const check = inspectTrade(village, give, take, amount, now);
  if (!check.ok) return check;
  village.resources[give] -= amount;
  const stored = deposit(village, { [take]: check.receive });
  village.merchants = village.merchants.filter((m) => m.returnAt > now);
  village.merchants.push({ count: check.merchants, returnAt: now + (MARKET.tripSeconds / world.speed) * 1000 });
  return { ...check, stored: stored[take] };
}

// ---------- Nakliye: kendi köyleri arasında kaynak gönderme ----------

/**
 * Kaynakların başka bir köye gönderilip gönderilemeyeceğini inceler. Tüccarlar yükü götürür,
 * boş döner; gidiş-dönüş boyunca köyde yoktur. Komisyon alınmaz.
 * Dönen `code`: 'market' | 'target' | 'count' | 'empty' | 'resources' | 'merchants'
 */
export function inspectTransport(state, village, targetId, requested, now) {
  const target = state.villages[targetId];
  const amounts = {};
  let total = 0;
  let valid = true;
  for (const id of RESOURCE_IDS) {
    const n = requested[id] ?? 0;
    if (!Number.isInteger(n) || n < 0) valid = false;
    else if (n > 0) {
      amounts[id] = n;
      total += n;
    }
  }
  const merchants = Math.ceil(total / MARKET.merchantCapacity);
  const seconds = target
    ? Math.max(1, travelSeconds(distance(village.x, village.y, target.x, target.y), MARKET.merchantSpeed, state.world.speed))
    : 0;
  const room = target ? storageCap(target) : 0;
  const info = {
    ok: false,
    amounts,
    total,
    merchants,
    available: merchantsAvailable(village, now),
    seconds,
    arriveAt: now + seconds * 1000,
    lost: target ? RESOURCE_IDS.reduce((sum, id) => sum + Math.max(0, (target.resources[id] ?? 0) + (amounts[id] ?? 0) - room), 0) : 0,
  };

  if (village.buildings.pazar < 1) return { ...info, code: 'market', reason: 'Kaynak göndermek için Pazar inşa et' };
  if (!target || target.id === village.id) return { ...info, code: 'target', reason: 'Kaynak gönderilecek başka bir köyün seç' };
  if (!valid) return { ...info, code: 'count', reason: 'Miktarlar 0 ya da pozitif tam sayı olmalı' };
  if (!total) return { ...info, code: 'empty', reason: 'Göndermek için kaynak gir' };
  const short = RESOURCE_IDS.find((id) => (amounts[id] ?? 0) > village.resources[id]);
  if (short) return { ...info, code: 'resources', reason: `Yeterli ${RESOURCES[short].name.toLocaleLowerCase('tr')} yok` };
  if (merchants > info.available) {
    return { ...info, code: 'merchants', reason: `Bu yük ${merchants} tüccar ister; köyde ${info.available} tüccar var` };
  }
  return { ...info, target, ok: true };
}

/** Kaynakları yola çıkarır: yük köyden düşer, tüccarlar gidiş-dönüş boyunca meşgul olur. */
export function sendTransport(state, village, targetId, requested, now) {
  const check = inspectTransport(state, village, targetId, requested, now);
  if (!check.ok) return check;
  for (const [id, n] of Object.entries(check.amounts)) village.resources[id] -= n;
  village.merchants = village.merchants.filter((m) => m.returnAt > now);
  village.merchants.push({ count: check.merchants, returnAt: now + 2 * check.seconds * 1000 });
  const { target } = check;
  const movement = {
    id: state.nextId++,
    type: 'nakliye',
    target: { id: target.id, name: target.name, x: target.x, y: target.y },
    units: {},
    resources: check.amounts,
    merchants: check.merchants,
    loot: null,
    departAt: now,
    arriveAt: check.arriveAt,
  };
  village.movements.push(movement);
  return { ...check, movement };
}

/** Nakliye hedefe vardı: kaynaklar köyün ambarına girer (sığmayan kaybolur). */
export function deliverTransport(state, village, movement) {
  const target = state.villages[movement.target.id];
  village.movements.splice(village.movements.indexOf(movement), 1);
  if (!target) return null;
  produce(target, state.world, movement.arriveAt);
  const stored = deposit(target, movement.resources);
  return {
    type: 'transport-arrived',
    villageId: village.id,
    targetId: target.id,
    target: target.name,
    resources: movement.resources,
    stored,
    at: movement.arriveAt,
  };
}
