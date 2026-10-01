import { produce } from '../systems/economy.js';
import { completeNextUpgrade } from '../systems/construction.js';
import { completeNextUnit, nextUnitAt } from '../systems/training.js';
import { completeMovement } from '../systems/movements.js';
import { completeResearch } from '../systems/research.js';
import { ensureLordSchedules, launchLordAttack, lordRaid, resolveIncoming } from '../systems/ai.js';
import { advanceClock, lordsOf } from '../systems/world.js';
import { syncBonuses, expireOfficer } from '../systems/premium.js';
import { checkAchievements, checkVictory } from '../systems/quests.js';
import { ensureSeason, nextSeasonAt, advanceSeason } from '../systems/seasons.js';
import { completeIlim } from '../systems/ilim.js';
import { ensureEvents, spawnEvent, expireEvent, expireModifier } from '../systems/events.js';
import { ensureHero, healHero } from '../systems/hero.js';
import { ensureInvasion, startInvasion, launchWave, endInvasion } from '../systems/sites.js';
import { checkTitle } from '../systems/renown.js';
import { recordHistory } from '../systems/history.js';

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
 *
 * Bazı olaylar (mevsim değişimi, araştırmanın bitmesi, geçici etkinin kalkması) bütün köylerin
 * üretim oranını değiştirir; onlardan önce bütün köylerin üretimi olay anına yürütülür
 * (`scope`: 'player' bu oyuncunun köyleri, 'world' çok oyunculu dünyada herkesin köyleri).
 */
export function advance(state, now) {
  prepare(state, now);
  const events = [];
  for (let next = nextEvent(state, now); next; next = nextEvent(state, now)) {
    advanceClock(state.world, next.at);
    if (next.scope) for (const village of Object.values(state.villages)) produce(village, state.world, next.at);
    else produce(next.village, state.world, next.at);
    const event = next.run();
    if (event) {
      const { others, also, ...own } = event; // tek oyunculuda başka oyuncu yok
      events.push(own, ...(also ?? []));
    }
    syncBonuses(state); // fetihle yeni köy gelmiş ya da bir görevli ayrılmış olabilir
  }
  for (const village of Object.values(state.villages)) produce(village, state.world, now);
  advanceClock(state.world, now);
  events.push(...checkAchievements(state, now));
  events.push(...checkTitle(state, now));
  recordHistory(state);
  // Sultanlık tek oyunculu bir hedeftir; çok oyunculu dünyada beyler herkesin ortak rakibidir.
  if (!state.peers) events.push(...checkVictory(state, now));
  return events;
}

/**
 * Çok oyunculu dünya: birden çok oyuncunun durumunu tek bir zaman çizelgesinde ilerletir.
 * Oyuncuların `world`, `barbarians`, `ai` ve `news` alanları aynı (paylaşılan) nesnelerdir;
 * her adımda tüm oyuncular arasındaki en erken olay işlenir. Bir olay başka bir oyuncuyu da
 * etkilediyse (oyuncular arası savaş) onun olayı `others` ile gelir ve o oyuncunun listesine
 * yazılır. Dönen: Map<durum, olaylar[]>.
 */
export function advanceMany(states, now) {
  const results = new Map(states.map((state) => [state, []]));
  for (const state of states) prepare(state, now);
  for (;;) {
    let next = null;
    let owner = null;
    for (const state of states) {
      const candidate = nextEvent(state, now);
      if (candidate && (!next || candidate.at < next.at)) {
        next = candidate;
        owner = state;
      }
    }
    if (!next) break;
    advanceClock(owner.world, next.at);
    const affected = next.scope === 'world' ? states : next.scope ? [owner] : [];
    for (const state of affected) for (const village of Object.values(state.villages)) produce(village, state.world, next.at);
    if (!affected.length) produce(next.village, owner.world, next.at);
    const event = next.run();
    if (event) {
      const { others, also, ...own } = event;
      results.get(owner).push(own, ...(also ?? []));
      for (const other of others ?? []) results.get(other.state)?.push(other.event);
    }
    for (const state of states) syncBonuses(state); // köy el değiştirmiş olabilir
  }
  for (const state of states) {
    for (const village of Object.values(state.villages)) produce(village, state.world, now);
    advanceClock(state.world, now);
    results.get(state).push(...checkAchievements(state, now));
    results.get(state).push(...checkTitle(state, now));
    recordHistory(state);
  }
  return results;
}

/** Takvimleri eksik olanları kurar (yeni oyun, eski kayıt) ve etkileri yeniler. */
function prepare(state, now) {
  ensureSeason(state.world);
  ensureHero(state);
  ensureEvents(state, now);
  ensureInvasion(state, now);
  ensureLordSchedules(state, now);
  syncBonuses(state);
}

/** `now` anına kadar gerçekleşmiş en erken olayı bulur (yoksa null). Eşitlikte ilk bulunan önce gelir. */
function nextEvent(state, now) {
  let next = null;
  const consider = (at, village, run, scope = null) => {
    if (at <= now && (!next || at < next.at)) next = { at, village, run, scope };
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
      // Oyuncu saldırıları saldıranın hareketiyle çözülür; burada yalnızca bey saldırıları.
      if (!attack.pvp) consider(attack.arriveAt, village, () => resolveIncoming(state, village, attack));
    }
  }
  for (const lord of lordsOf(state.world.seed)) {
    const entry = state.ai.lords[lord.id];
    const attackAt = entry?.nextAttackAt;
    if (attackAt != null) consider(attackAt, villages[0], () => launchLordAttack(state, lord, attackAt));
    const raidAt = entry?.nextRaidAt;
    if (raidAt != null) consider(raidAt, villages[0], () => lordRaid(state, lord, raidAt));
  }
  for (const [officer, until] of Object.entries(state.player?.officers ?? {})) {
    consider(until, villages[0], () => expireOfficer(state, officer, until));
  }
  // Mevsim değişimi (bütün dünyanın köyleri), Divan araştırmasının bitişi, olaylar ve
  // olaylardan gelen geçici etkilerin bitişi.
  const seasonAt = nextSeasonAt(state.world);
  consider(seasonAt, villages[0], () => advanceSeason(state.world, seasonAt), 'world');
  const ilim = state.player?.ilim?.current;
  if (ilim) consider(ilim.endAt, state.villages[ilim.villageId] ?? villages[0], () => completeIlim(state), 'player');
  const events = state.events;
  if (events?.pending) consider(events.pending.expiresAt, villages[0], () => expireEvent(state, events.pending.expiresAt), 'player');
  else if (events?.nextAt != null) consider(events.nextAt, villages[0], () => spawnEvent(state, events.nextAt));
  for (const modifier of state.player?.modifiers ?? []) {
    consider(modifier.until, villages[0], () => expireModifier(state, modifier, modifier.until), 'player');
  }
  // Yaralı kahramanın iyileşmesi (köyünün üretimi ve savunması geri gelir)
  const hero = state.hero;
  if (hero?.woundedUntil > 0) consider(hero.woundedUntil, state.villages[hero.home] ?? villages[0], () => healHero(state, hero.woundedUntil), 'player');
  // Moğol akını: ordugâh kurulur, dalgalar yola çıkar, ordugâh çekilir
  const invasion = state.invasion;
  if (invasion?.phase === 'idle' && invasion.nextAt != null) consider(invasion.nextAt, villages[0], () => startInvasion(state, invasion.nextAt));
  if (invasion?.phase === 'active') {
    if (invasion.nextWaveAt != null) consider(invasion.nextWaveAt, villages[0], () => launchWave(state, invasion.nextWaveAt));
    if (invasion.leaveAt != null) consider(invasion.leaveAt, villages[0], () => endInvasion(state, 'left', invasion.leaveAt));
  }
  return next;
}
