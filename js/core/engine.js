import { produce } from '../systems/economy.js';
import { completeNextUpgrade } from '../systems/construction.js';
import { completeNextUnit, nextUnitAt } from '../systems/training.js';
import { completeMovement } from '../systems/movements.js';
import { completeResearch } from '../systems/research.js';
import { ensureLordSchedules, launchLordAttack, resolveIncoming } from '../systems/ai.js';
import { advanceClock, lordsOf } from '../systems/world.js';

/**
 * Oyun dünyasını `now` anına kadar ilerletir ve bu sırada gerçekleşen olayları döndürür.
 *
 * Oyun her saniye "tick" atarak değil, olaylarla ilerler: son güncellemeden bu yana geçen
 * süre tek seferde hesaplanır. Böylece sekme kapalıyken geçen zaman da (çevrimdışı ilerleme)
 * aynı kodla yetiştirilir.
 *
 * Tüm olay türleri (inşaat bitişi, bir askerin yetişmesi, geliştirme, ordunun hedefe ya da eve
 * varması, rakip beyin saldırı başlatması ve saldırısının köye varması) tek bir zaman
 * çizelgesinde en erkenden başlayarak işlenir. Her olaydan önce dünya saati ve o köyün üretimi
 * olay anına kadar yürütülür; çünkü olay üretim oranını değiştirebilir, savaş ise köylerin o
 * anki durumuna (dünya saatine) bakar.
 */
export function advance(state, now) {
  ensureLordSchedules(state, now);
  const events = [];
  for (let next = nextEvent(state, now); next; next = nextEvent(state, now)) {
    advanceClock(state.world, next.at);
    produce(next.village, state.world, next.at);
    const event = next.run();
    if (event) events.push(event);
  }
  for (const village of Object.values(state.villages)) produce(village, state.world, now);
  advanceClock(state.world, now);
  return events;
}

/** `now` anına kadar gerçekleşmiş en erken olayı bulur (yoksa null). Eşitlikte ilk bulunan önce gelir. */
function nextEvent(state, now) {
  let next = null;
  const consider = (at, village, run) => {
    if (at <= now && (!next || at < next.at)) next = { at, village, run };
  };
  const villages = Object.values(state.villages);
  for (const village of villages) {
    const job = village.buildQueue[0];
    if (job) consider(job.endAt, village, () => completeNextUpgrade(village));
    for (const [buildingId, queue] of Object.entries(village.trainQueues)) {
      if (queue.length) consider(nextUnitAt(queue[0]), village, () => completeNextUnit(village, buildingId));
    }
    for (const movement of village.movements) {
      consider(movement.arriveAt, village, () => completeMovement(state, village, movement));
    }
    if (village.research) consider(village.research.endAt, village, () => completeResearch(village));
    for (const attack of village.incoming) {
      consider(attack.arriveAt, village, () => resolveIncoming(state, village, attack));
    }
  }
  for (const lord of lordsOf(state.world.seed)) {
    const at = state.ai.lords[lord.id]?.nextAttackAt;
    if (at != null) consider(at, villages[0], () => launchLordAttack(state, lord, at));
  }
  return next;
}
