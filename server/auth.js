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

export function validUsername(name) {
  return /^[\p{L}\p{N}_]{3,20}$/u.test(name);
}

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 200;
}
