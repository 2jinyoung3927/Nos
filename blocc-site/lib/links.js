// 링크 장부의 한 줄에서 실제 도착 주소를 만든다.
// 도착지는 이 파일의 허용 목록(내 신청 페이지, 와디즈 펀딩 주소)뿐이다.
// 요청으로 받은 외부 주소로는 절대 넘기지 않는다.
export function landingBase(landingPath, env = process.env) {
  const site = (env.SITE_URL || '').replace(/\/+$/, '');
  if (landingPath === 'funding') {
    const funding = env.WADIZ_FUNDING_URL || '';
    return funding || null;
  }
  return site ? `${site}/` : null;
}

export function buildTargetUrl(link, env = process.env) {
  const base = landingBase(link.landing_path, env);
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set('utm_source', link.source);
  u.searchParams.set('utm_medium', link.medium);
  u.searchParams.set('utm_campaign', link.campaign);
  if (link.content) u.searchParams.set('utm_content', link.content);
  if (link.term) u.searchParams.set('utm_term', link.term);
  return u.toString();
}

export function shortUrl(code, env = process.env) {
  const site = (env.SITE_URL || '').replace(/\/+$/, '');
  return site ? `${site}/l/${code}` : `/l/${code}`;
}

// 모르는 코드: 내 랜딩으로 보내되 흔적을 남긴다.
export function unknownCodeUrl(env = process.env) {
  const base = landingBase('/', env);
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set('utm_source', 'short-link');
  u.searchParams.set('utm_medium', 'unknown');
  return u.toString();
}
