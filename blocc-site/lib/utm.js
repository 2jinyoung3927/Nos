// UTM 값 규칙: 소문자, 띄어쓰기 대신 하이픈, 영문·숫자·. _ - 만, 한글 금지.
export const UTM_PATTERN = /^[a-z0-9._-]{1,40}$/;

// 입력을 규칙에 맞게 고친다. 규칙에 맞출 수 없으면 빈 문자열.
export function normalizeUtm(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

export function isValidUtm(value) {
  return typeof value === 'string' && UTM_PATTERN.test(value);
}

export const UTM_KEYS = ['source', 'medium', 'campaign', 'content'];

// 주소에서 받은 utm 이 규칙에 맞는 것만 남긴다.
export function pickValidUtm(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const k of UTM_KEYS) {
    const v = obj[k];
    if (typeof v === 'string' && isValidUtm(v)) out[k] = v;
  }
  // 어디서 왔는지(source)가 없는 꼬리표는 경로로 보지 않는다.
  return out.source ? out : null;
}

export const CAMPAIGNS = [
  { code: 'prelaunch', label: '알림 신청 모집' },
  { code: 'tester-recruit', label: '체험단 모집' },
  { code: 'funding-open', label: '펀딩 오픈' },
  { code: 'funding-lastcall', label: '마감 임박' },
  { code: 'review-ask', label: '후기 요청' },
];

// 채널 방식에 따른 소재 코드 제안. existingContents: 같은 채널 링크들의 content 목록.
export function suggestContent(channel, existingContents, now = new Date()) {
  const prefix = channel.content_prefix || '';
  if (channel.content_mode === 'none') return prefix;
  if (channel.content_mode === 'date') {
    // 한국 날짜 기준 월일 4자리
    const kst = new Date(now.getTime() + 9 * 3600 * 1000);
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    return `${prefix}${mm}${dd}`;
  }
  if (channel.content_mode === 'serial') {
    let max = 0;
    for (const c of existingContents) {
      if (c && c.startsWith(prefix)) {
        const n = parseInt(c.slice(prefix.length), 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return `${prefix}${String(max + 1).padStart(2, '0')}`;
  }
  return prefix; // free: 접두사만 미리 채워 주고 나머지는 직접 입력
}
