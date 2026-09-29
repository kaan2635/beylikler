import { MARKET } from '../config/tech.js';
import { RESOURCES } from '../config/resources.js';
import { deposit, storageCap } from './economy.js';

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
