import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { isBot, deviceOf, refererHost } from '@/lib/bots';
import { buildTargetUrl, unknownCodeUrl, landingBase } from '@/lib/links';

export const dynamic = 'force-dynamic';

const CODE = /^[a-z0-9]{4,12}$/;

// 302 + no-store: 301 은 브라우저가 기억해서 다음 클릭을 못 센다.
function go(url) {
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

function fallback() {
  const url = unknownCodeUrl() || landingBase('/');
  if (!url) return new NextResponse('SITE_URL 이 설정되지 않았어요.', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  return go(url);
}

async function handle(request, { params }, countable) {
  const { code } = await params;
  if (!CODE.test(code)) return fallback();

  const supabase = db();
  const ua = request.headers.get('user-agent');
  let link = null;

  if (countable && !isBot(ua)) {
    // 일반 브라우저: 클릭 1 올리기 + 로그를 한 번에(원자적으로)
    const { data, error } = await supabase.rpc('blocc_record_click', {
      p_code: code,
      p_device: deviceOf(ua),
      p_referer_host: refererHost(request.headers.get('referer')),
    });
    if (error) console.error('record click failed', error.code);
    link = Array.isArray(data) ? data[0] : data;
    if (error) {
      // 집계가 실패해도 손님은 목적지로 보낸다.
      const { data: row } = await supabase.from('blocc_links').select('*').eq('short_code', code).maybeSingle();
      link = row;
    }
  } else {
    // 봇, HEAD 요청: 세지 않고 넘기기만 한다.
    const { data: row } = await supabase.from('blocc_links').select('*').eq('short_code', code).maybeSingle();
    link = row;
  }

  if (!link) return fallback();
  const target = buildTargetUrl(link);
  return target ? go(target) : fallback();
}

export async function GET(request, ctx) {
  return handle(request, ctx, true);
}

export async function HEAD(request, ctx) {
  return handle(request, ctx, false);
}
