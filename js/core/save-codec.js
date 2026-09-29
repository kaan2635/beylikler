import { migrate } from './state.js';

const PREFIX = 'BEY1:';

/** Kaydı kopyalanıp taşınabilecek tek satırlık metne çevirir (UTF-8 güvenli base64). */
export function encodeSave(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return PREFIX + btoa(binary);
}

/** encodeSave çıktısını geri çözer. Geçersiz metinde hata fırlatır. */
export function decodeSave(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error('Bu bir Beylikler kayıt kodu değil');
  const binary = atob(trimmed.slice(PREFIX.length));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return migrate(JSON.parse(new TextDecoder().decode(bytes)));
}
