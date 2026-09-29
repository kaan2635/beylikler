const intFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function fmtInt(n) {
  return intFormat.format(Math.floor(n));
}

/** Tek ondalıklı sayı: 12,4 */
export function fmtDecimal(n) {
  return decimalFormat.format(n);
}

/** Saniyeyi "1:02:03" ya da "2g 1:02:03" biçimine çevirir. */
export function fmtDuration(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${days ? `${days}g ` : ''}${hours}:${minutes}:${secs}`;
}

/** Zaman damgasını "bugün 14:03:22", "yarın 09:00:00" ya da "03.10 12:00:00" olarak yazar. */
export function fmtClock(ts, now) {
  const date = new Date(ts);
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dayDiff = Math.round((startOfDay(date) - startOfDay(new Date(now))) / 86_400_000);
  if (dayDiff === 0) return `bugün ${time}`;
  if (dayDiff === 1) return `yarın ${time}`;
  return `${date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Bina etkisini tanımındaki biçime göre yazar (bkz. config/buildings.js). */
export function fmtEffect(effect, value) {
  switch (effect.format) {
    case 'rate':
      return `${fmtInt(value)}/saat`;
    case 'percent':
      return `%${Math.round(value * 100)}`;
    case 'bonus':
      return `+%${Math.round(value * 100)}`;
    default:
      return fmtInt(value);
  }
}
