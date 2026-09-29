/**
 * Küçük bir DOM oluşturucu: h('div', { class: 'kart' }, 'metin', başkaEleman).
 * Metinler her zaman textContent olarak eklenir; kullanıcı verisi (köy adı, içe aktarılan
 * kayıt) asla HTML olarak yorumlanmaz.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((child) => child != null && child !== false));
  return el;
}

/** Metin değiştiyse günceller; her saniyelik yenilemede gereksiz DOM yazımını önler. */
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
