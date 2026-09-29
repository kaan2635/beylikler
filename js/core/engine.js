import { produce } from '../systems/economy.js';
import { completeUpgrade } from '../systems/construction.js';

/**
 * Oyun dünyasını `now` anına kadar ilerletir ve bu sırada gerçekleşen olayları döndürür.
 *
 * Oyun her saniye "tick" atarak değil, olaylarla ilerler: son güncellemeden bu yana geçen
 * süre tek seferde hesaplanır. Böylece sekme kapalıyken geçen zaman da (çevrimdışı ilerleme)
 * aynı kodla yetiştirilir. Olaylar zaman sırasıyla işlenir ve her olaydan önce üretim o ana
 * kadar yürütülür, çünkü olay (ör. oduncunun yükselmesi) üretim oranını değiştirir.
 *
 * Asker eğitimi ve ordu hareketleri eklendiğinde tüm olay türleri tek bir zaman
 * çizelgesinde birleştirilecek.
 */
export function advance(state, now) {
  const events = [];
  for (const village of Object.values(state.villages)) {
    const queue = village.buildQueue;
    while (queue.length && queue[0].endAt <= now) {
      const job = queue.shift();
      produce(village, state.world, job.endAt);
      completeUpgrade(village, job);
      events.push({
        type: 'build-complete',
        villageId: village.id,
        building: job.building,
        level: job.level,
        at: job.endAt,
      });
    }
    produce(village, state.world, now);
  }
  return events;
}
