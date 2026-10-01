import { RESOURCE_IDS, RESOURCES } from '../../config/resources.js';
import { VICTORY } from '../../config/quests.js';
import {
  activeQuests,
  questProgress,
  achievementStatus,
  dailyStatus,
  victoryProgress,
} from '../../systems/quests.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';
import { openBuildingDialog } from '../building-dialog.js';

// Görevin hedefine götüren yer: bina görevlerinde bina penceresi, diğerlerinde ilgili sayfa.
const STAT_PAGES = { attacksWon: '#/harita', loot: '#/harita', spies: '#/harita', expeditions: '#/kesif', defenses: '#/ordu' };

function questDestination(state, goal) {
  const level = (id) => Math.max(0, ...Object.values(state.villages).map((v) => v.buildings[id] ?? 0));
  switch (goal.kind) {
    case 'building':
      return { building: goal.id };
    case 'buildings':
      return { building: goal.ids.find((id) => level(id) < goal.target) ?? goal.ids[0] };
    case 'units':
      return { href: '#/ordu' };
    case 'tech':
      return level('demirci') > 0 ? { href: '#/demirci' } : { building: 'demirci' };
    case 'stat':
      if (goal.id === 'expeditions' && level('kervansaray') === 0) return { building: 'kervansaray' };
      return { href: STAT_PAGES[goal.id] ?? '#/koy' };
    case 'villages':
    case 'lords':
      return level('saray') > 0 ? { href: '#/harita' } : { building: 'saray' };
    default:
      return { href: '#/koy' };
  }
}

/** Görev kartı listesi: hem Köy ekranındaki özet hem Görevler sayfası kullanır. */
export function createQuestList({ game, refresh, compact = false }) {
  const list = h('div', { class: 'quest-list' });
  let signature = null;

  list.addEventListener('click', (event) => {
    const go = event.target.closest('button[data-goto]');
    if (go) {
      const quest = activeQuests(game.state).find((q) => q.quest.id === go.dataset.goto)?.quest;
      const where = quest && questDestination(game.state, quest.goal);
      if (where?.building) openBuildingDialog({ game, refresh }, where.building);
      else if (where?.href) location.hash = where.href;
      return;
    }
    const button = event.target.closest('button[data-quest]');
    if (!button) return;
    const now = Date.now();
    const result = game.claimQuest(button.dataset.quest, now);
    if (result.ok) {
      const total = Object.values(result.stored).reduce((a, b) => a + b, 0);
      toast(`Görev tamamlandı: ${result.quest.title}. ${fmtInt(total)} kaynak${result.akce ? ` ve ${result.akce} Akçe` : ''} kazandın.`, 'success');
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
  });

  return {
    el: list,
    update() {
      const active = activeQuests(game.state);
      const next = active.map((q) => `${q.quest.id}:${q.value}:${q.done}`).join('|');
      if (next === signature) return;
      signature = next;
      if (!active.length) {
        list.replaceChildren(h('p', { class: 'muted' }, 'Bütün görevleri tamamladın. Artık hedef: Sultanlık!'));
        return;
      }
      list.replaceChildren(
        ...(compact ? active.slice(0, 2) : active).map(({ quest, value, done }) => {
          const reward = RESOURCE_IDS.filter((id) => quest.reward[id]).map((id) => h('span', { class: 'cost-item', title: RESOURCES[id].name }, icon(id), fmtInt(quest.reward[id])));
          if (quest.akce) reward.push(h('span', { class: 'cost-item', title: 'Akçe' }, icon('akce'), String(quest.akce)));
          return h(
            'article',
            { class: `quest${done ? ' done' : ''}` },
            h('span', { class: 'quest-seal' }, icon(done ? 'kupa' : 'nav-gorevler')),
            h(
              'div',
              { class: 'quest-body' },
              h('strong', null, quest.title),
              h('p', { class: 'card-desc' }, quest.text),
              h('div', { class: 'quest-progress' }, h('span', { style: `width:${Math.round((value / quest.goal.target) * 100)}%` })),
              h('div', { class: 'cost quest-reward' }, h('span', { class: 'muted' }, `${fmtInt(value)}/${fmtInt(quest.goal.target)} · Ödül:`), reward),
            ),
            done
              ? h('button', { type: 'button', class: 'btn btn-small btn-gold', dataset: { quest: quest.id } }, 'Ödülü al')
              : h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { goto: quest.id }, title: 'Görevin yapılacağı yere git' }, 'Git →'),
          );
        }),
      );
    },
  };
}

/** Görevler sayfası: günlük hazine, görevler, başarımlar ve Sultanlık hedefi. */
export function createQuestsView({ game, refresh }) {
  const quests = createQuestList({ game, refresh });
  const count = h('span', { class: 'muted' });

  // Günlük hazine
  const dailyText = h('p', { class: 'muted' });
  const dailyButton = h('button', { type: 'button', class: 'btn btn-gold' }, icon('sandik'), 'Hazineyi aç');
  dailyButton.addEventListener('click', () => {
    const now = Date.now();
    const result = game.claimDaily(now);
    if (result.ok) toast(`Günlük hazine: ${result.akce} Akçe ve ${fmtInt(Object.values(result.stored).reduce((a, b) => a + b, 0))} kaynak.`, 'success');
    else toast(result.reason, 'error');
    refresh(now);
  });

  // Sultanlık
  const victoryBar = h('span');
  const victoryText = h('p', { class: 'muted' });

  // Başarımlar
  const achievements = h('div', { class: 'achievement-grid' });

  // Olay kroniği: verilen kararlar ve kendi seyrine bırakılan olaylar
  const chronicle = h('ul', { class: 'news-list chronicle' });
  let chronicleSignature = null;
  let achievementSignature = null;

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Görevler')),
    h(
      'div',
      { class: 'settings-grid' },
      h('section', { class: 'panel stack-sm daily-panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Günlük hazine')), dailyText, h('div', { class: 'form-row' }, dailyButton)),
      h(
        'section',
        { class: 'panel stack-sm victory-panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Hedef: Sultanlık')),
        h('p', null, `Bütün rakip beylerin hisarlarını fethet; beyliğin sultanlığa dönüşsün. Ödül: ${VICTORY.akce} Akçe ve Sultan unvanı.`),
        h('div', { class: 'quest-progress large' }, victoryBar),
        victoryText,
      ),
    ),
    h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Görev zinciri'), count), quests.el),
    h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Başarımlar'), h('span', { class: 'muted' }, 'Her kademe kendiliğinden Akçe kazandırır')), achievements),
    h('section', { class: 'panel stack-sm' }, h('div', { class: 'panel-head' }, h('h2', null, 'Olay kroniği'), h('span', { class: 'muted' }, 'Beyliğine gelen son olaylar ve kararların')), chronicle),
  );

  return {
    el,
    update(now) {
      const history = game.state.events?.history ?? [];
      const nextChronicle = history.map((e) => e.at).join('|');
      if (nextChronicle !== chronicleSignature) {
        chronicleSignature = nextChronicle;
        chronicle.replaceChildren(
          ...(history.length
            ? history.map((e) =>
                h(
                  'li',
                  null,
                  h('span', { class: 'muted news-time' }, fmtClock(e.at, now)),
                  h('span', null, h('strong', null, e.title), ` — ${e.auto ? 'karar verilmedi' : `“${e.choice}”`}. ${e.result}`),
                ),
              )
            : [h('li', { class: 'muted' }, 'Henüz bir olay yaşanmadı. Olaylar ara sıra gelir; tepe çubuğundaki parşömene tıklayıp karar verirsin.')]),
        );
      }
      const state = game.state;
      quests.update();
      const progress = questProgress(state);
      setText(count, `${progress.claimed}/${progress.total} tamamlandı`);

      const daily = dailyStatus(state, game.village, now);
      dailyButton.disabled = !daily.available;
      setText(
        dailyText,
        daily.available
          ? `Bugün ${daily.akce} Akçe ve her kaynaktan ${fmtInt(daily.resources.odun)} (ambarın %10'u) seni bekliyor.`
          : `Bugünün hazinesini aldın. Yenisi ${fmtDuration((daily.nextAt - now) / 1000)} sonra.`,
      );

      const victory = victoryProgress(state);
      victoryBar.style.width = `${Math.round((victory.done / victory.total) * 100)}%`;
      setText(victoryText, victory.won ? 'Sultanlık ilan edildi! Oynamaya devam edebilirsin.' : `${victory.done}/${victory.total} bey düştü.`);

      const status = achievementStatus(state);
      const next = status.map((s) => `${s.achievement.id}:${s.tier}:${Math.floor(s.value)}`).join('|');
      if (next !== achievementSignature) {
        achievementSignature = next;
        achievements.replaceChildren(
          ...status.map(({ achievement, value, tier, next: target }) =>
            h(
              'article',
              { class: `achievement tier-${tier}` },
              h('span', { class: 'achievement-medal' }, icon('kupa'), h('span', { class: 'achievement-stars' }, '★'.repeat(tier) + '☆'.repeat(achievement.tiers.length - tier))),
              h('div', null, h('strong', null, achievement.title), h('p', { class: 'card-desc' }, achievement.text)),
              h('div', { class: 'quest-progress' }, h('span', { style: `width:${target ? Math.min(100, Math.round((value / target) * 100)) : 100}%` })),
              h('span', { class: 'muted achievement-next' }, target ? `${fmtInt(value)} / ${fmtInt(target)} · +${achievement.akce[tier]} Akçe` : 'Tüm kademeler tamam'),
            ),
          ),
        );
      }
    },
  };
}

/** Tamamlanmış (ödülü bekleyen) görev sayısı: sekme rozeti için. */
export function claimableQuests(state) {
  return activeQuests(state).filter((q) => q.done).length;
}
