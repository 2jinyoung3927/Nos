import { NextResponse } from 'next/server';
import { COOKIE_NAME, cookieOptions, createSessionToken, passwordMatches } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: '어드민 비밀번호가 설정되지 않았어요.' }, { status: 500 });
  }
  if (!rateLimit(`login:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: '잠시 후에 다시 시도해 주세요.' }, { status: 429 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청을 읽을 수 없어요.' }, { status: 400 });
  }
  if (!(await passwordMatches(body?.password, process.env.ADMIN_PASSWORD))) {
    return NextResponse.json({ error: '비밀번호가 맞지 않아요.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createSessionToken(process.env.ADMIN_SESSION_SECRET), cookieOptions);
  return res;
}
