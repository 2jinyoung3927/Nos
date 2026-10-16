import { db } from '@/lib/supabase';
import { composeStats } from '@/lib/statsCompose';
import { requireAdmin, json } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

function parseDate(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get('from')) ?? '-infinity';
  const to = parseDate(url.searchParams.get('to')) ?? 'infinity';

  const supabase = db();
  const [{ data: raw, error }, { data: channels, error: chErr }] = await Promise.all([
    supabase.rpc('blocc_stats', { p_from: from, p_to: to }),
    supabase.from('blocc_channels').select('*').order('sort').order('id'),
  ]);
  if (error || chErr) return json({ error: '집계를 불러오지 못했어요.' }, 500);
  return json(composeStats(raw, channels));
}
