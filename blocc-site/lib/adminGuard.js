import { COOKIE_NAME, verifySessionToken } from './auth';

// 어드민 API 는 프록시와 별개로 여기서도 한 번 더 확인한다.
export async function requireAdmin(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifySessionToken(process.env.ADMIN_SESSION_SECRET, token);
  if (ok) return null;
  return Response.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
