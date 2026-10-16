// 서버 한 개 안에서 도는 간단한 속도 제한. 서버가 여러 개로 나뉘면 각각 따로 센다.
// (완전한 방어가 아니라 연타와 단순 도배를 막는 용도. 전화번호 unique 가 마지막 방어선이다.)
const buckets = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
