// 한국 시간(KST) 날짜 기준 기간 계산. 반환값은 서버로 보낼 ISO 문자열.
const DAY = 24 * 3600 * 1000;

export function kstYmd(date) {
  const k = new Date(date.getTime() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}

export function kstMidnight(ymd) {
  return new Date(`${ymd}T00:00:00+09:00`);
}

export function rangeFor(kind, custom, now = new Date()) {
  const today = kstMidnight(kstYmd(now));
  const tomorrow = new Date(today.getTime() + DAY);
  if (kind === 'today') return { from: today.toISOString(), to: tomorrow.toISOString() };
  if (kind === '7d') return { from: new Date(today.getTime() - 6 * DAY).toISOString(), to: tomorrow.toISOString() };
  if (kind === '30d') return { from: new Date(today.getTime() - 29 * DAY).toISOString(), to: tomorrow.toISOString() };
  if (kind === 'custom' && custom?.from && custom?.to) {
    const from = kstMidnight(custom.from);
    const to = new Date(kstMidnight(custom.to).getTime() + DAY);
    if (Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && to > from) return { from: from.toISOString(), to: to.toISOString() };
  }
  return { from: null, to: null }; // 전체
}
