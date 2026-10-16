// 어드민 공용 비밀번호 + 서명된 쿠키. Edge(middleware)와 Node 양쪽에서 동작하도록 Web Crypto 만 쓴다.
export const COOKIE_NAME = 'blocc_admin';
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret, now = Date.now()) {
  const exp = String(now + MAX_AGE_SEC * 1000);
  return `${exp}.${await hmacHex(secret, exp)}`;
}

export async function verifySessionToken(secret, token, now = Date.now()) {
  if (!secret || !token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < now) return false;
  return safeEqual(sig, await hmacHex(secret, exp));
}

export async function passwordMatches(input, expected) {
  if (!expected || typeof input !== 'string') return false;
  // 길이가 달라도 같은 시간이 걸리도록 해시끼리 비교한다.
  const [a, b] = await Promise.all([hmacHex('pw', input), hmacHex('pw', expected)]);
  return safeEqual(a, b);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: MAX_AGE_SEC,
};
