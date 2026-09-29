import { RESOURCES, RESOURCE_IDS } from '../../config/resources.js';
import { MARKET } from '../../config/tech.js';
import { inspectTrade, marketFee, inspectTransport, merchantCapacity } from '../../systems/market.js';
import { h, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtInt, fmtDuration, fmtClock } from '../format.js';
import { toast } from '../toast.js';

const percent = (fee) => `%${(fee * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;

/** Pazar sayfası: kaynak takası ve yoldaki tüccarlar. */
export function createMarketView({ game, refresh }) {
  const badge = h('span', { class: 'badge' });
  const info = h('span', { class: 'muted' });
  const notBuilt = h(
    'section',
    { class: 'panel' },
    h('p', null, 'Pazar henüz inşa edilmedi. ', h('a', { class: 'card-link', href: '#/koy' }, 'Köy ekranından inşa et →')),
  );

  const resourceSelect = (id, selected) =>
    h('select', { id }, RESOURCE_IDS.map((r) => h('option', { value: r, selected: r === selected }, RESOURCES[r].name)));
  const give = resourceSelect('trade-give', 'odun');
  const take = resourceSelect('trade-take', 'kil');
  const amount = h('input', { type: 'number', id: 'trade-amount', min: 1, value: 1000, inputmode: 'numeric' });
  const maxButton = h('button', { type: 'button', class: 'btn btn-small btn-ghost' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Takas et');
  const preview = h('div', { class: 'trade-preview' });
  const status = h('p', { class: 'card-status' });
  const merchants = h('div', { class: 'queue' });

  const form = h(
    'form',
    { class: 'stack-sm', onsubmit: onTrade },
    h(
      'div',
      { class: 'trade-row' },
      h('label', { for: 'trade-give' }, 'Ver'),
      give,
      h('label', { for: 'trade-amount', class: 'visually-hidden' }, 'Miktar'),
      amount,
      maxButton,
    ),
    h('div', { class: 'trade-row' }, h('label', { for: 'trade-take' }, 'Al'), take),
    preview,
    h('div', { class: 'form-row' }, submit),
    status,
  );

  const transport = createTransportPanel({ game, refresh });
  const capacityNote = h('p', { class: 'muted' });

  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Pazar'), badge, info, h('a', { class: 'card-link', href: '#/koy' }, '← Köy')),
    notBuilt,
    h(
      'div',
      { class: 'settings-grid' },
      h('section', { class: 'panel stack-sm' }, h('h2', null, 'Takas'), capacityNote, form),
      transport.el,
      h('section', { class: 'panel stack-sm' }, h('h2', null, 'Tüccarlar'), merchants),
    ),
  );

  for (const control of [give, take, amount]) control.addEventListener('input', () => refresh());
  maxButton.addEventListener('click', () => {
    const check = inspectTrade(game.village, give.value, take.value, 1, Date.now());
    amount.value = String(Math.max(1, check.max));
    refresh();
  });

  function onTrade(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.trade(give.value, take.value, Number(amount.value), now);
    if (result.ok) {
      toast(`${fmtInt(Number(amount.value))} ${RESOURCES[give.value].name.toLocaleLowerCase('tr')} verildi, ${fmtInt(result.stored)} ${RESOURCES[take.value].name.toLocaleLowerCase('tr')} alındı.`, 'success');
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
  }

  function renderMerchants(village, now) {
    const level = village.buildings.pazar;
    const away = village.merchants.filter((m) => m.returnAt > now).sort((a, b) => a.returnAt - b.returnAt);
    const home = Math.max(0, level - away.reduce((total, m) => total + m.count, 0));
    const loads = village.movements.filter((m) => m.type === 'nakliye').sort((a, b) => a.arriveAt - b.arriveAt);
    merchants.replaceChildren(
      h('p', null, h('strong', null, `${home}/${level}`), ' tüccar köyde.'),
      ...loads.map((m) =>
        h(
          'div',
          { class: 'queue-row' },
          h('div', null, `${m.merchants} tüccar → ${m.target.name}: ${fmtInt(Object.values(m.resources).reduce((a, b) => a + b, 0))} kaynak`),
          h('div', { class: 'queue-time' }, h('span', { class: 'queue-remaining' }, fmtDuration((m.arriveAt - now) / 1000)), h('span', { class: 'muted' }, `varış ${fmtClock(m.arriveAt, now)}`)),
          h('span'),
        ),
      ),
      ...away.map((m) =>
        h(
          'div',
          { class: 'queue-row' },
          h('div', null, `${m.count} tüccar yolda`),
          h('div', { class: 'queue-time' }, h('span', { class: 'queue-remaining' }, fmtDuration((m.returnAt - now) / 1000)), h('span', { class: 'muted' }, `dönüş ${fmtClock(m.returnAt, now)}`)),
          h('span'),
        ),
      ),
    );
  }

  return {
    el,
    update(now) {
      const village = game.village;
      const level = village.buildings.pazar;
      setText(badge, level ? `${level}. seviye` : 'Yok');
      badge.classList.toggle('badge-muted', !level);
      setText(info, level ? `Komisyon ${percent(marketFee(level))}` : '');
      setText(capacityNote, `Her tüccar ${fmtInt(merchantCapacity(village))} kaynak taşır. Tüccarlar takastan sonra bir süre yolda kalır.`);
      notBuilt.hidden = level > 0;

      const check = inspectTrade(village, give.value, take.value, Number(amount.value), now);
      setText(maxButton, `En fazla ${fmtInt(check.max)}`);
      maxButton.disabled = check.max < 1;
      if (check.ok) {
        const takeName = RESOURCES[take.value].name.toLocaleLowerCase('tr');
        const parts = [
          h('span', { class: 'cost-item' }, icon(take.value), h('strong', null, fmtInt(check.receive)), ` ${takeName} alacaksın`),
          h('span', { class: 'muted trade-meta' }, `Komisyon ${percent(check.fee)} · ${check.merchants} tüccar`),
        ];
        if (check.lost) parts.push(h('p', { class: 'card-status warn' }, `Ambara sığmayan ${fmtInt(check.lost)} ${takeName} kaybolur.`));
        preview.replaceChildren(...parts);
      } else {
        preview.replaceChildren();
      }
      submit.disabled = !check.ok;
      setText(status, check.ok ? '' : check.reason);
      transport.update(now);
      renderMerchants(village, now);
    },
  };
}

/** Kendi köyleri arasında kaynak gönderme; birden fazla köy varken görünür. */
function createTransportPanel({ game, refresh }) {
  const target = h('select', { id: 'transport-target' });
  const inputs = {};
  const rows = RESOURCE_IDS.map((id) => {
    const input = h('input', { type: 'number', min: 0, value: 0, inputmode: 'numeric', id: `transport-${id}`, 'aria-label': `Gönderilecek ${RESOURCES[id].name}` });
    const all = h('button', { type: 'button', class: 'link-btn', title: `Tüm ${RESOURCES[id].name.toLocaleLowerCase('tr')}` });
    all.addEventListener('click', () => {
      input.value = String(Math.floor(game.village.resources[id]));
      refresh();
    });
    input.addEventListener('input', () => refresh());
    inputs[id] = { input, all };
    return h('div', { class: 'send-row' }, h('span', { class: 'unit-icon small' }, icon(id)), h('span', null, RESOURCES[id].name), all, input);
  });
  const preview = h('div', { class: 'trade-preview' });
  const status = h('p', { class: 'card-status' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Gönder');
  const form = h(
    'form',
    { class: 'stack-sm', onsubmit: onSend },
    h('div', { class: 'trade-row' }, h('label', { for: 'transport-target' }, 'Hedef köy'), target),
    h('div', { class: 'send-grid' }, rows),
    preview,
    h('div', { class: 'form-row' }, submit),
    status,
  );
  const el = h(
    'section',
    { class: 'panel stack-sm' },
    h('h2', null, 'Kaynak gönder'),
    h('p', { class: 'muted' }, 'Tüccarlar yükü kendi köylerinden birine götürür ve boş döner. Komisyon alınmaz.'),
    form,
  );
  target.addEventListener('change', () => refresh());
  let signature = null;

  const read = () => Object.fromEntries(RESOURCE_IDS.map((id) => [id, Number(inputs[id].input.value || 0)]));

  function onSend(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.sendTransport(target.value, read(), now);
    if (result.ok) {
      toast(`${result.merchants} tüccar ${result.target.name} köyüne yola çıktı. Varış ${fmtClock(result.arriveAt, now)}.`, 'success');
      for (const id of RESOURCE_IDS) inputs[id].input.value = '0';
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
  }

  return {
    el,
    update(now) {
      const state = game.state;
      const village = game.village;
      const others = Object.values(state.villages).filter((v) => v.id !== village.id);
      el.hidden = others.length === 0;
      if (!others.length) return;
      const next = `${village.id}|${others.map((v) => `${v.id}:${v.name}`).join('|')}`;
      if (next !== signature) {
        signature = next;
        const chosen = target.value;
        target.replaceChildren(...others.map((v) => h('option', { value: v.id }, `${v.name} (${v.x}|${v.y})`)));
        if (others.some((v) => v.id === chosen)) target.value = chosen;
      }
      for (const id of RESOURCE_IDS) setText(inputs[id].all, `(${fmtInt(village.resources[id])})`);
      const check = inspectTransport(state, village, target.value, read(), now);
      if (check.total > 0 && check.code !== 'count') {
        const parts = [
          h('span', { class: 'muted trade-meta' }, `${check.merchants} tüccar · yolculuk ${fmtDuration(check.seconds)} · varış ${fmtClock(check.arriveAt, now)}`),
        ];
        if (check.lost) parts.push(h('p', { class: 'card-status warn' }, `Hedef ambara şu an sığmayan ${fmtInt(check.lost)} kaynak kaybolur.`));
        preview.replaceChildren(...parts);
      } else {
        preview.replaceChildren();
      }
      submit.disabled = !check.ok;
      setText(status, check.ok || check.code === 'empty' ? '' : check.reason);
    },
  };
}
