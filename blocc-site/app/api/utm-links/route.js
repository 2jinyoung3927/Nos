import { randomInt } from 'node:crypto';
import { db } from '@/lib/supabase';
import { isValidUtm, normalizeUtm } from '@/lib/utm';
import { buildTargetUrl, shortUrl, landingBase } from '@/lib/links';
import { requireAdmin, json } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 헷갈리는 글자(i, l, o, 0, 1) 제외
function newCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

function present(row) {
  const { blocc_channels: ch, ...link } = row;
  return { ...link, channel_name: ch?.name ?? null, channel_code: ch?.code ?? null, short_url: shortUrl(row.short_code), long_url: buildTargetUrl(row) };
}

export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await db()
    .from('blocc_links')
    .select('*, blocc_channels(code, name)')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return json({ error: '링크를 불러오지 못했어요.' }, 500);
  return json({ links: data.map(present) });
}

// 한 번에 여러 채널의 링크를 만든다. 같은 UTM 조합은 장부에 한 번만: 이미 있으면 기존 링크를 돌려준다.
export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) {
    return json({ error: '만들 링크를 1~30개 골라 주세요.' }, 400);
  }
  const campaign = normalizeUtm(body.campaign);
  const landing = body.landing_path === 'funding' ? 'funding' : '/';
  if (!isValidUtm(campaign)) return json({ error: '캠페인 이름을 확인해 주세요.' }, 400);
  if (!landingBase(landing)) {
    return json({ error: landing === 'funding' ? 'WADIZ_FUNDING_URL 환경변수가 없어요.' : 'SITE_URL 환경변수가 없어요.' }, 500);
  }

  const supabase = db();
  const results = [];
  for (const item of body.items) {
    const { data: ch } = await supabase.from('blocc_channels').select('*').eq('id', item.channel_id).maybeSingle();
    if (!ch) { results.push({ error: '채널을 찾을 수 없어요.', channel_id: item.channel_id }); continue; }
    const content = item.content ? normalizeUtm(item.content) : '';
    if (ch.content_mode === 'free' && !content) { results.push({ error: `${ch.name}: 소재 코드를 입력해 주세요.`, channel_id: ch.id }); continue; }
    if (item.content && !isValidUtm(content)) { results.push({ error: `${ch.name}: 소재 코드는 영어 소문자·숫자·하이픈만 쓸 수 있어요.`, channel_id: ch.id }); continue; }

    const combo = { landing_path: landing, source: ch.source, medium: ch.medium, campaign, content: content || null, term: null };
    const find = async () => {
      let q = supabase.from('blocc_links').select('*, blocc_channels(code, name)')
        .eq('landing_path', landing).eq('source', ch.source).eq('medium', ch.medium).eq('campaign', campaign);
      q = combo.content ? q.eq('content', combo.content) : q.is('content', null);
      q = q.is('term', null);
      const { data } = await q.maybeSingle();
      return data;
    };

    const existing = await find();
    if (existing) { results.push({ link: present(existing), existing: true }); continue; }

    const label = item.label ? String(item.label).slice(0, 100) : null;
    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const row = { ...combo, channel_id: ch.id, short_code: newCode(), label, url: buildTargetUrl(combo) };
      const { data, error } = await supabase.from('blocc_links').insert(row).select('*, blocc_channels(code, name)').single();
      if (!error) { created = data; break; }
      if (error.code !== '23505') { results.push({ error: '링크를 만들지 못했어요.', channel_id: ch.id }); created = false; break; }
      const raced = await find(); // 동시에 같은 조합을 만든 경우
      if (raced) { results.push({ link: present(raced), existing: true }); created = false; break; }
      // 짧은 코드가 겹친 경우: 다시 뽑는다
    }
    if (created) results.push({ link: present(created), existing: false });
    else if (created === null) results.push({ error: '링크를 만들지 못했어요.', channel_id: ch.id });
  }
  return json({ results }, 201);
}

// 삭제 대신 보관. 메모와 와디즈 구매 수(직접 입력)도 고칠 수 있다.
export async function PATCH(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.id)) return json({ error: 'id 가 필요해요.' }, 400);
  const update = {};
  if (typeof body.archived === 'boolean') update.archived = body.archived;
  if (typeof body.label === 'string') update.label = body.label.slice(0, 100) || null;
  if (body.purchases_manual !== undefined) {
    if (!Number.isInteger(body.purchases_manual) || body.purchases_manual < 0 || body.purchases_manual > 100000) {
      return json({ error: '구매 수는 0 이상의 정수여야 해요.' }, 400);
    }
    update.purchases_manual = body.purchases_manual;
  }
  if (Object.keys(update).length === 0) return json({ error: '바꿀 값이 없어요.' }, 400);
  const { data, error } = await db().from('blocc_links').update(update).eq('id', body.id).select('*, blocc_channels(code, name)').single();
  if (error) return json({ error: '링크를 고치지 못했어요.' }, 500);
  return json({ link: present(data) });
}
