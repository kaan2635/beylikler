// Hesaplar: şifreler scrypt ile tuzlanıp özetlenir; düz şifre hiçbir yerde saklanmaz.

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt)).toString('hex');
  return { salt, hash };
}

export async function verifyPassword(password, { salt, hash }) {
  const expected = Buffer.from(hash, 'hex');
  const actual = await derive(password, salt);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newToken() {
  return randomBytes(32).toString('hex');
}

/** Gizli değerleri içerik ve uzunluk denetimiyle karşılaştır; zamanlama farkını azaltır. */
export function safeEqualText(left, right) {
  const a = Buffer.from(typeof left === 'string' ? left : '', 'utf8');
  const b = Buffer.from(typeof right === 'string' ? right : '', 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function validUsername(name) {
  return /^[\p{L}\p{N}_]{3,20}$/u.test(name);
}

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 200;
}
