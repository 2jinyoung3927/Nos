import { db } from '@/lib/supabase';
import { isValidUtm, normalizeUtm } from '@/lib/utm';
import { requireAdmin, json } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';
const MODES = ['none', 'serial', 'date', 'free'];

export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { data, error } = await db().from('blocc_channels').select('*').order('sort').order('id');
  if (error) return json({ error: '채널을 불러오지 못했어요.' }, 500);
  return json({ channels: data });
}

export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: '요청을 읽을 수 없어요.' }, 400);

  const name = String(body.name || '').trim();
  const code = normalizeUtm(body.code || name);
  const source = normalizeUtm(body.source);
  const medium = normalizeUtm(body.medium);
  const mode = MODES.includes(body.content_mode) ? body.content_mode : 'none';
  const prefix = body.content_prefix ? normalizeUtm(body.content_prefix) : null;
  if (!name || name.length > 60) return json({ error: '채널 이름을 입력해 주세요.' }, 400);
  if (!isValidUtm(code)) return json({ error: '채널 코드는 영어 소문자·숫자·하이픈만 쓸 수 있어요.' }, 400);
  if (!isValidUtm(source) || !isValidUtm(medium)) return json({ error: 'source 와 medium 은 영어 소문자·숫자·하이픈만 쓸 수 있어요.' }, 400);
  if (mode === 'none' && body.content_prefix && !prefix) return json({ error: '소재 코드를 확인해 주세요.' }, 400);

  const supabase = db();
  const { data: last } = await supabase.from('blocc_channels').select('sort').order('sort', { ascending: false }).limit(1);
  const sort = (last?.[0]?.sort ?? 0) + 10;
  const { data, error } = await supabase
    .from('blocc_channels')
    .insert({ code, name, source, medium, content_mode: mode, content_prefix: prefix, note: body.note ? String(body.note).slice(0, 200) : null, sort })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return json({ error: '같은 코드의 채널이 이미 있어요.' }, 409);
    return json({ error: '채널을 만들지 못했어요.' }, 500);
  }
  return json({ channel: data }, 201);
}

// source, medium, code 는 한 번 정하면 바꾸지 않는다. 이름·메모·소재 방식·숨김만 고칠 수 있다.
export async function PATCH(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.id)) return json({ error: 'id 가 필요해요.' }, 400);
  const update = {};
  if (typeof body.active === 'boolean') update.active = body.active;
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 60);
  if (typeof body.note === 'string') update.note = body.note.slice(0, 200) || null;
  if (MODES.includes(body.content_mode)) update.content_mode = body.content_mode;
  if (typeof body.content_prefix === 'string') {
    const p = normalizeUtm(body.content_prefix);
    update.content_prefix = p || null;
  }
  if (Object.keys(update).length === 0) return json({ error: '바꿀 값이 없어요.' }, 400);
  const { data, error } = await db().from('blocc_channels').update(update).eq('id', body.id).select().single();
  if (error) return json({ error: '채널을 고치지 못했어요.' }, 500);
  return json({ channel: data });
}
