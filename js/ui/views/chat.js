import { h, setText } from '../dom.js';
import { fmtClock } from '../format.js';
import { toast } from '../toast.js';

/** Dünya sohbeti (yalnız çok oyunculu). Mesajlar metin olarak eklenir; HTML yorumlanmaz. */
export function createChatView({ game, refresh }) {
  const list = h('ol', { class: 'chat-list', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', maxlength: 300, placeholder: 'Mesajını yaz…', 'aria-label': 'Mesaj', autocomplete: 'off' });
  const send = h('button', { type: 'submit', class: 'btn' }, 'Gönder');
  const info = h('span', { class: 'muted' });
  const el = h(
    'section',
    { class: 'stack' },
    h('header', { class: 'view-header' }, h('h1', null, 'Sohbet'), info),
    h(
      'section',
      { class: 'panel chat-panel' },
      list,
      h('form', { class: 'chat-form', onsubmit: onSend }, input, send),
      h('p', { class: 'muted hint' }, 'Kurallar: saygılı ol, kişisel bilgi (telefon, adres, şifre) paylaşma.'),
    ),
  );
  let signature = null;

  async function onSend(event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    const result = await game.sendChat(text);
    send.disabled = false;
    if (result.ok) input.value = '';
    else toast(result.reason, 'error');
    refresh();
  }

  return {
    el,
    onShow() {
      signature = null;
      setTimeout(() => input.focus(), 0);
    },
    update(now) {
      setText(info, `${game.playerCount ?? 0} oyuncu bu dünyada`);
      const log = game.chatLog ?? [];
      const next = log.map((m) => `${m.at}:${m.playerId ?? m.name ?? ''}:${m.text ?? ''}`).join('|');
      if (next === signature) return;
      signature = next;
      list.replaceChildren(
        ...(log.length
          ? log.map((m) =>
              h(
                'li',
                { class: `chat-message${m.playerId === game.playerId ? ' mine' : ''}` },
                h('span', { class: 'chat-meta' }, h('strong', null, m.name), ' ', h('span', { class: 'muted' }, fmtClock(m.at, now))),
                h('span', { class: 'chat-text' }, m.text),
              ),
            )
          : [h('li', { class: 'muted' }, 'Henüz mesaj yok. İlk selamı sen ver!')]),
      );
      list.scrollTop = list.scrollHeight;
    },
  };
}
