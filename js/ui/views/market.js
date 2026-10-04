import { RESOURCES, RESOURCE_IDS } from '../../config/resources.js';
import { inspectTrade, marketFee, inspectTransport, merchantCapacity } from '../../systems/market.js';
import { inspectTradeRoute, maxTradeRoutes } from '../../systems/trade-routes.js';
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
  const routes = createTradeRoutesPanel({ game, refresh });
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
    routes.el,
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
          h('div', null, `${m.merchants} tüccar → ${m.target.name}: ${fmtInt(Object.values(m.resources).reduce((a, b) => a + b, 0))} kaynak${m.routeId != null ? ` · otomatik hat #${m.routeId}` : ''}`),
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
      routes.update(now);
    },
  };
}

/** Düzenli kaynak sevkiyatı: eşik korumalı, tekrarlanan kervan hatları. */
function createTradeRoutesPanel({ game, refresh }) {
  const source = h('select', { id: 'route-source' });
  const target = h('select', { id: 'route-target' });
  const interval = h(
    'select',
    { id: 'route-interval' },
    [1, 2, 4, 8, 12, 24].map((hours) => h('option', { value: hours }, `Her ${hours} oyun saati`)),
  );
  const cargo = {};
  const reserve = {};
  const resourceRows = RESOURCE_IDS.map((id) => {
    const row = h(
      'div',
      { class: 'route-resource-row' },
      h('span', { class: 'unit-icon small' }, icon(id)),
      h('strong', null, RESOURCES[id].name),
      h('label', { for: `route-load-${id}` }, 'Sefer yükü'),
      h('input', { type: 'number', id: `route-load-${id}`, min: 0, step: 1, value: 0, inputmode: 'numeric', dataset: { resource: id, field: 'cargo' }, 'aria-label': `${RESOURCES[id].name} kervan yükü` }),
      h('label', { for: `route-reserve-${id}` }, 'Ambarda kalsın'),
      h('input', { type: 'number', id: `route-reserve-${id}`, min: 0, step: 1, value: 0, inputmode: 'numeric', dataset: { resource: id, field: 'reserve' }, 'aria-label': `${RESOURCES[id].name} ambar yedeği` }),
    );
    cargo[id] = row.querySelector('[data-field="cargo"]');
    reserve[id] = row.querySelector('[data-field="reserve"]');
    return row;
  });
  const capacityNote = h('p', { class: 'muted' });
  const preview = h('div', { class: 'trade-preview' });
  const status = h('p', { class: 'card-status' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Kervan hattı kur');
  const emptySource = h('p', { class: 'muted' }, 'Önce en az bir köyünde Pazar kur. Pazar 1 ilk hat yerini, her üç ek seviye yeni bir yer açar.');
  const list = h('div', { class: 'queue route-list' });
  const form = h(
    'form',
    { class: 'stack-sm', onsubmit: onCreate },
    h('div', { class: 'route-select-row' }, h('label', { for: 'route-source' }, 'Çıkış köyü'), source, h('label', { for: 'route-target' }, 'Hedef köy'), target),
    h('div', { class: 'route-resource-grid' }, resourceRows),
    h('div', { class: 'form-row route-interval' }, h('label', { for: 'route-interval' }, 'Gönderim'), interval),
    capacityNote,
    preview,
    h('div', { class: 'form-row' }, submit),
    status,
  );
  const el = h(
    'section',
    { class: 'panel stack-sm trade-routes-panel' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Kervan hatları'), h('span', { class: 'muted' }, 'Otomatik köyler arası sevkiyat')),
    h('p', { class: 'muted' }, 'Hat, belirlediğin miktarı seçilen aralıkla yollar. Her kaynak için ambar yedeği ayarla; hedefteki tahmini boş alan ve yoldaki kervanlar hesaba katılarak yük otomatik azaltılır. Tüccar ya da kaynak yetmezse çevrim atlanır.'),
    emptySource,
    form,
    h('h3', { class: 'info-subtitle' }, 'Kurulu hatlar'),
    list,
  );
  let sourceSignature = null;
  let targetSignature = null;

  source.addEventListener('change', () => refresh());
  target.addEventListener('change', () => refresh());
  interval.addEventListener('change', () => refresh());
  for (const input of [...Object.values(cargo), ...Object.values(reserve)]) input.addEventListener('input', () => refresh());

  function readAmounts(inputs) {
    return Object.fromEntries(RESOURCE_IDS.map((id) => [id, Number(inputs[id].value || 0)]));
  }

  function onCreate(event) {
    event.preventDefault();
    const now = Date.now();
    const result = game.createTradeRoute(source.value, target.value, readAmounts(cargo), readAmounts(reserve), Number(interval.value), now);
    if (result.ok) {
      const from = game.state.villages[result.route.sourceId]?.name ?? result.route.sourceId;
      const to = game.state.villages[result.route.targetId]?.name ?? result.route.targetId;
      toast(`${from} → ${to} kervan hattı kuruldu. İlk sefer ${fmtClock(result.route.nextAt, now)}.`, 'success');
      for (const input of [...Object.values(cargo), ...Object.values(reserve)]) input.value = '0';
    } else {
      toast(result.reason, 'error');
    }
    refresh(now);
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-route-action]');
    if (!button) return;
    const now = Date.now();
    const id = Number(button.dataset.routeId);
    if (button.dataset.routeAction === 'delete') {
      const result = game.deleteTradeRoute(id, now);
      if (result.ok) toast('Kervan hattı silindi. Yoldaki tüccarlar seferini tamamlar.', 'info');
      else toast(result.reason, 'error');
    } else {
      const enabled = button.dataset.routeAction === 'resume';
      const result = game.toggleTradeRoute(id, enabled, now);
      if (result.ok) toast(enabled ? 'Kervan hattı yeniden başlatıldı.' : 'Kervan hattı durduruldu.', 'success');
      else toast(result.reason, 'error');
    }
    refresh(now);
  });

  function routeRow(route, state, now) {
    const from = state.villages[route.sourceId];
    const to = state.villages[route.targetId];
    const load = RESOURCE_IDS.filter((id) => route.cargo?.[id] > 0).map((id) => `${fmtInt(route.cargo[id])} ${RESOURCES[id].name.toLocaleLowerCase('tr')}`).join(' · ') || 'Yük yok';
    const held = RESOURCE_IDS.filter((id) => route.reserve?.[id] > 0).map((id) => `${fmtInt(route.reserve[id])} ${RESOURCES[id].name.toLocaleLowerCase('tr')}`).join(' · ');
    const last = route.lastAt == null
      ? 'Henüz sefer yapılmadı.'
      : route.lastReason
        ? `${fmtClock(route.lastAt, now)} · ${route.lastSent > 0 ? `${fmtInt(route.lastSent)} kaynak yola çıktı; ` : 'Atlandı: '}${route.lastReason}.`
        : `${fmtClock(route.lastAt, now)} · ${fmtInt(route.lastSent)} kaynak yola çıktı.`;
    const next = route.enabled && route.nextAt != null ? `Sonraki sefer ${fmtDuration(Math.max(0, route.nextAt - now) / 1000)} sonra` : 'Durduruldu';
    return h(
      'article',
      { class: `route-entry${route.enabled ? '' : ' is-paused'}` },
      h('div', { class: 'route-entry-head' }, h('strong', null, `${from?.name ?? 'Kayıp köy'} → ${to?.name ?? 'Kayıp köy'}`), h('span', { class: `badge${route.enabled ? '' : ' badge-muted'}` }, route.enabled ? 'Etkin' : 'Duraklatıldı')),
      h('p', { class: 'muted route-entry-meta' }, `Her ${route.intervalHours} oyun saati · ${load}${held ? ` · Ambar yedeği: ${held}` : ''}`),
      h('div', { class: 'route-entry-foot' }, h('span', { class: 'muted' }, `${last} ${next}`), h('div', { class: 'form-row' }, h('button', { type: 'button', class: 'btn btn-small btn-ghost', dataset: { routeId: route.id, routeAction: route.enabled ? 'pause' : 'resume' } }, route.enabled ? 'Durdur' : 'Sürdür'), h('button', { type: 'button', class: 'btn btn-small btn-ghost btn-quiet', dataset: { routeId: route.id, routeAction: 'delete' } }, 'Sil'))),
    );
  }

  return {
    el,
    update(now) {
      const state = game.state;
      const villages = Object.values(state.villages);
      el.hidden = villages.length < 2;
      if (el.hidden) return;
      const sources = villages.filter((village) => village.buildings.pazar > 0);
      emptySource.hidden = sources.length > 0;
      form.hidden = sources.length === 0;

      const newSourceSignature = sources.map((village) => `${village.id}:${village.name}:${village.buildings.pazar}`).join('|');
      if (newSourceSignature !== sourceSignature) {
        sourceSignature = newSourceSignature;
        const chosen = source.value;
        source.replaceChildren(...sources.map((village) => h('option', { value: village.id }, `${village.name} · Pazar ${village.buildings.pazar}`)));
        source.value = sources.some((village) => village.id === chosen) ? chosen : sources[0]?.id ?? '';
        targetSignature = null;
      }

      const sourceVillage = state.villages[source.value];
      const targets = villages.filter((village) => village.id !== source.value);
      const newTargetSignature = `${source.value}|${targets.map((village) => `${village.id}:${village.name}`).join('|')}`;
      if (newTargetSignature !== targetSignature) {
        targetSignature = newTargetSignature;
        const chosen = target.value;
        target.replaceChildren(...targets.map((village) => h('option', { value: village.id }, `${village.name} (${village.x}|${village.y})`)));
        target.value = targets.some((village) => village.id === chosen) ? chosen : targets[0]?.id ?? '';
      }

      if (sourceVillage) {
        const used = (state.tradeRoutes ?? []).filter((route) => route.sourceId === sourceVillage.id).length;
        setText(capacityNote, `Pazar ${sourceVillage.buildings.pazar}: ${used}/${maxTradeRoutes(sourceVillage)} hat yeri · tek seferde en çok ${fmtInt(merchantCapacity(sourceVillage) * sourceVillage.buildings.pazar)} kaynak. Hedefteki tahmini boş alana göre sevkiyat küçültülür.`);
        const check = inspectTradeRoute(state, source.value, target.value, readAmounts(cargo), readAmounts(reserve), Number(interval.value));
        submit.disabled = !check.ok;
        setText(status, check.ok ? '' : check.reason);
        if (check.ok) {
          preview.replaceChildren(h('span', { class: 'muted trade-meta' }, `${fmtInt(check.total)} kaynaklık yük · ilk sefer ${fmtClock(now + (check.intervalHours * 3_600_000) / state.world.speed, now)} · Pazar ${check.used}/${check.slots} hat dolu`));
        } else {
          preview.replaceChildren();
        }
      }

      const routes = [...(state.tradeRoutes ?? [])].sort((a, b) => (a.nextAt ?? Infinity) - (b.nextAt ?? Infinity));
      list.replaceChildren(...(routes.length ? routes.map((route) => routeRow(route, state, now)) : [h('p', { class: 'muted' }, 'Henüz otomatik kervan hattı yok. İki köyün arasında düzenli kaynak akışı kur.')]));
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
        if (check.lost) parts.push(h('p', { class: 'card-status warn' }, `Varışta hedef ambarını aşması beklenen ${fmtInt(check.lost)} kaynak kaybolabilir; yükü azalt.`));
        preview.replaceChildren(...parts);
      } else {
        preview.replaceChildren();
      }
      submit.disabled = !check.ok;
      setText(status, check.ok || check.code === 'empty' ? '' : check.reason);
    },
  };
}
