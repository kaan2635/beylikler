import { produce } from '../systems/economy.js';
import { completeNextUpgrade } from '../systems/construction.js';
import { completeNextUnit, nextUnitAt } from '../systems/training.js';

/**
 * Oyun dünyasını `now` anına kadar ilerletir ve bu sırada gerçekleşen olayları döndürür.
 *
 * Oyun her saniye "tick" atarak değil, olaylarla ilerler: son güncellemeden bu yana geçen
 * süre tek seferde hesaplanır. Böylece sekme kapalıyken geçen zaman da (çevrimdışı ilerleme)
 * aynı kodla yetiştirilir.
 *
 * Tüm olay türleri (inşaat bitişi, bir askerin yetişmesi) tek bir zaman çizelgesinde en
 * erkenden başlayarak işlenir. Her olaydan önce o köyün üretimi olay anına kadar yürütülür,
 * çünkü olay (ör. oduncunun yükselmesi) üretim oranını değiştirebilir. Ordu hareketleri
 * eklendiğinde onlar da bu çizelgeye birer olay kaynağı olarak girecek.
 */
export function advance(state, now) {
  const events = [];
  for (let next = nextEvent(state, now); next; next = nextEvent(state, now)) {
    produce(next.village, state.world, next.at);
    const event = next.run();
    if (event) events.push(event);
  }
  for (const village of Object.values(state.villages)) produce(village, state.world, now);
  return events;
}

/** `now` anına kadar gerçekleşmiş en erken olayı bulur (yoksa null). Eşitlikte inşaat önce gelir. */
function nextEvent(state, now) {
  let next = null;
  const consider = (at, village, run) => {
    if (at <= now && (!next || at < next.at)) next = { at, village, run };
  };
  for (const village of Object.values(state.villages)) {
    const job = village.buildQueue[0];
    if (job) consider(job.endAt, village, () => completeNextUpgrade(village));
    for (const [buildingId, queue] of Object.entries(village.trainQueues)) {
      if (queue.length) consider(nextUnitAt(queue[0]), village, () => completeNextUnit(village, buildingId));
    }
  }
  return next;
}
