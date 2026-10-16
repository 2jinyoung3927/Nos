import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from './lib/auth';

// 어드민(/tools)과 어드민 API 는 로그인한 사람만 들어온다.
export async function proxy(request) {
  const { pathname } = request.nextUrl;
  if (pathname === '/tools/login') return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifySessionToken(process.env.ADMIN_SESSION_SECRET, token);
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/tools/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/tools/:path*', '/api/channels/:path*', '/api/utm-links/:path*', '/api/stats/:path*'],
};
