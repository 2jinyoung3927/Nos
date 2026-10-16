'use client';
// 손님이 어디서 왔는지 브라우저에 30일 보관한다.
// first: 처음 한 번만 쓴다(30일이 지나면 새로). last: 주소에 UTM이 있을 때마다 새 값으로 바꾼다.
import { pickValidUtm } from './utm';

const KEY = 'blocc_attribution_v1';
const TTL_MS = 30 * 24 * 3600 * 1000;

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.savedAt !== 'number' || Date.now() - data.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function write(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장이 막힌 브라우저에서는 이번 방문 값만 쓴다 */
  }
}

// 주소의 utm_* 를 읽어 보관한다. 주소에 UTM이 있으면 항상 그 값이 우선.
export function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = pickValidUtm({
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
  });
  const saved = read();
  if (!fromUrl) return saved;
  const now = Date.now();
  const next = {
    first: saved && saved.first ? saved.first : { ...fromUrl, at: now },
    last: { ...fromUrl, at: now },
    savedAt: now,
  };
  write(next);
  return next;
}

export function getAttribution() {
  return read() || captureAttribution();
}
