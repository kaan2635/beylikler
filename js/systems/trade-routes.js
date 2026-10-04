import { RESOURCE_IDS } from '../config/resources.js';
import { merchantCapacity, merchantsAvailable, inspectTransport, sendTransport, transportRoom } from './market.js';
import { storageCap } from './economy.js';

const HOUR = 3_600_000;
const INTERVALS = Object.freeze([1, 2, 4, 8, 12, 24]);
export const MAX_ROUTE_CATCH_UP = 3;

const sum = (values) => Object.values(values).reduce((total, amount) => total + amount, 0);

/** Pazar her üç seviyede bir yeni otomatik kervan hattı yönetebilir. */
export function maxTradeRoutes(village) {
  const level = village?.buildings?.pazar ?? 0;
  return level > 0 ? Math.floor((level + 2) / 3) : 0;
}

/** Kervan hattının bir sonraki çevrimi için gerçek zaman aralığı (ms). */
export function routePeriodMs(world, route) {
  return Math.max(1_000, (route.intervalHours * HOUR) / world.speed);
}

/**
 * Çevrimdışı çok uzun süre kalındığında motoru binlerce eski sevkiyatla doldurma.
 * Son üç çevrimi işler, daha eskileri atlar; yine de çevrimdışı üretim normal şekilde yürür.
 */
export function routeDueAt(route, world, now) {
  if (!route.enabled || !Number.isFinite(route.nextAt)) return Infinity;
  const period = routePeriodMs(world, route);
  if (route.nextAt > now) return route.nextAt;
  const dueCount = Math.floor((now - route.nextAt) / period) + 1;
  const skipped = Math.max(0, dueCount - MAX_ROUTE_CATCH_UP);
  return route.nextAt + skipped * period;
}

function resourceAmounts(requested) {
  const amounts = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) return { valid: false, amounts };
  for (const [id, value] of Object.entries(requested)) {
    if (!RESOURCE_IDS.includes(id) || !Number.isSafeInteger(value) || value < 0) return { valid: false, amounts };
    amounts[id] = value;
  }
  return { valid: true, amounts };
}

/** Hat oluşturma formu ve motor tarafından kullanılan ortak doğrulama. */
export function inspectTradeRoute(state, sourceId, targetId, cargoInput, reserveInput, intervalHours) {
  const source = state.villages[sourceId];
  const target = state.villages[targetId];
  const cargoResult = resourceAmounts(cargoInput);
  const reserveResult = resourceAmounts(reserveInput);
  const cargo = cargoResult.amounts;
  const reserve = reserveResult.amounts;
  const total = sum(cargo);
  const intervalValid = INTERVALS.includes(intervalHours);
  const slots = maxTradeRoutes(source);
  const used = (state.tradeRoutes ?? []).filter((route) => route.sourceId === sourceId).length;
  const capacity = source ? merchantCapacity(source) * source.buildings.pazar : 0;
  const info = { ok: false, source, target, cargo, reserve, total, slots, used, capacity, intervalHours };

  if (!source || !target || source.id === target.id) return { ...info, code: 'target', reason: 'Kervan için iki farklı kendi köyünü seç' };
  if (source.buildings.pazar < 1) return { ...info, code: 'market', reason: `${source.name} köyünde Pazar kurmadan kervan hattı açılamaz` };
  if (!intervalValid) return { ...info, code: 'interval', reason: 'Sefer aralığı 1, 2, 4, 8, 12 ya da 24 oyun saati olmalı' };
  if (!cargoResult.valid || !reserveResult.valid) return { ...info, code: 'count', reason: 'Yük ve ambar yedeği 0 ya da pozitif tam sayı olmalı' };
  if (total < 1) return { ...info, code: 'empty', reason: 'Kervana en az bir kaynak yükle' };
  if (total > capacity) return { ...info, code: 'capacity', reason: `Bu Pazar en çok ${capacity.toLocaleString('tr-TR')} kaynaklık tek seferlik yük taşıyabilir` };
  if (RESOURCE_IDS.some((id) => reserve[id] > storageCap(source))) {
    return { ...info, code: 'reserve', reason: 'Ambar yedeği, kaynak ambarı kapasitesini aşamaz' };
  }
  if (used >= slots) return { ...info, code: 'slots', reason: `${source.name} Pazarında hat yeri kalmadı (${used}/${slots}); Pazarını yükselt` };
  return { ...info, ok: true };
}

/** Yeni hat. Ücret alınmaz; sevkiyat anında kaynak ve tüccar kontrol edilir. */
export function createTradeRoute(state, sourceId, targetId, cargo, reserve, intervalHours, now) {
  const check = inspectTradeRoute(state, sourceId, targetId, cargo, reserve, intervalHours);
  if (!check.ok) return check;
  const route = {
    id: state.nextId++,
    sourceId,
    targetId,
    cargo: check.cargo,
    reserve: check.reserve,
    intervalHours,
    enabled: true,
    createdAt: now,
    nextAt: now + routePeriodMs(state.world, { intervalHours }),
    dispatches: 0,
    skipped: 0,
    lastAt: null,
    lastSent: 0,
    lastReason: null,
  };
  state.tradeRoutes ??= [];
  state.tradeRoutes.push(route);
  return { ok: true, route, slots: check.slots };
}

/** Hat sevkiyatlarını dünya hızına göre yeniden zamanlar (Ayarlar'da hız değişince). */
export function rescaleTradeRoutes(state, now, oldSpeed, newSpeed) {
  if (oldSpeed === newSpeed || oldSpeed <= 0 || newSpeed <= 0) return;
  for (const route of state.tradeRoutes ?? []) {
    if (!route.enabled || !Number.isFinite(route.nextAt)) continue;
    const remainingGameMs = Math.max(0, (route.nextAt - now) * oldSpeed);
    route.nextAt = now + remainingGameMs / newSpeed;
  }
}

/** Bir due-time anında hattı çalıştırır; eksik kaynak, tüccar ya da pazar varsa çevrimi atlar. */
export function dispatchTradeRoute(state, route, at) {
  const period = routePeriodMs(state.world, route);
  const missed = Math.max(0, Math.floor((at - route.nextAt) / period));
  route.skipped = (route.skipped ?? 0) + missed;
  route.nextAt = at + period;

  const source = state.villages[route.sourceId];
  const target = state.villages[route.targetId];
  if (!source || !target) {
    route.enabled = false;
    route.nextAt = null;
    route.lastAt = at;
    route.lastSent = 0;
    route.lastReason = 'Köy artık beyliğinin yönetiminde değil; hat durduruldu';
    return routeEvent(route, source, target, at, missed);
  }

  const requested = Object.fromEntries(
    RESOURCE_IDS.map((id) => [id, Math.max(0, Math.min(route.cargo?.[id] ?? 0, Math.floor(source.resources[id] - (route.reserve?.[id] ?? 0))))]),
  );
  const requestedTotal = sum(requested);
  const estimate = requestedTotal ? inspectTransport(state, source, target.id, requested, at) : null;
  const room = estimate ? transportRoom(state, target, at, estimate.arriveAt) : Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  const load = Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.min(requested[id], room[id])]));
  const loadTotal = sum(load);
  const limited = RESOURCE_IDS.some((id) => load[id] < requested[id]);
  let result = null;
  if (loadTotal > 0) result = sendTransport(state, source, target.id, load, at);

  route.lastAt = at;
  route.lastSent = result?.ok ? result.total : 0;
  route.lastReason = result?.ok
    ? limited ? 'Hedef ambardaki tahmini boş yere göre yük sınırlandı' : null
    : requestedTotal === 0
      ? 'Ambar yedeği korunuyor; gönderilebilir kaynak yok'
      : loadTotal === 0 && limited
        ? 'Hedef ambarında tahmini boş yer yok'
        : result?.reason ?? 'Kervan yola çıkamadı';
  if (result?.ok) {
    result.movement.routeId = route.id;
    route.dispatches += 1;
  }
  return routeEvent(route, source, target, at, missed);
}

function routeEvent(route, source, target, at, missed) {
  return {
    type: 'trade-route',
    routeId: route.id,
    source: source?.name ?? route.sourceId,
    target: target?.name ?? route.targetId,
    sent: route.lastSent,
    reason: route.lastReason,
    nextAt: route.nextAt,
    skipped: missed,
    at,
  };
}

/** Hatı durdurur ya da yeniden başlatır. Devam ettirilince aralık baştan sayılır. */
export function toggleTradeRoute(state, routeId, enabled, now) {
  const route = (state.tradeRoutes ?? []).find((item) => item.id === routeId);
  if (!route) return { ok: false, reason: 'Kervan hattı bulunamadı' };
  if (typeof enabled !== 'boolean') return { ok: false, reason: 'Hat durumu geçersiz' };
  route.enabled = enabled;
  route.nextAt = enabled ? now + routePeriodMs(state.world, route) : null;
  return { ok: true, route };
}

/** Hattı siler; yoldaki tüccarlar mevcut sevkiyatlarını tamamlar. */
export function deleteTradeRoute(state, routeId) {
  const index = (state.tradeRoutes ?? []).findIndex((route) => route.id === routeId);
  if (index < 0) return null;
  return state.tradeRoutes.splice(index, 1)[0];
}

/** Şu an hatta ayrılabilecek tüccar ve hattan doğabilecek azami yük için görünüm özeti. */
export function routeCapacity(village, now) {
  return {
    max: merchantCapacity(village) * village.buildings.pazar,
    availableMerchants: merchantsAvailable(village, now),
    slots: maxTradeRoutes(village),
  };
}
