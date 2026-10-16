import { db } from '@/lib/supabase';
import { pickValidUtm } from '@/lib/utm';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { json } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

const GENDERS = ['female', 'male', 'none'];
const Q1 = ['commute', 'meeting', 'cafe', 'travel'];
const Q2 = ['second-bag', 'shoulder', 'tangled', 'trolley'];

function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function attributionColumns(attr) {
  const first = pickValidUtm(attr?.first);
  const last = pickValidUtm(attr?.last);
  const seenAt = Number.isFinite(attr?.first?.at) ? new Date(attr.first.at) : null;
  return {
    first: first && {
      first_utm_source: first.source ?? null,
      first_utm_medium: first.medium ?? null,
      first_utm_campaign: first.campaign ?? null,
      first_utm_content: first.content ?? null,
      first_seen_at: (seenAt && seenAt <= new Date() ? seenAt : new Date()).toISOString(),
    },
    // 처음 경로만 있는 손님은 마지막 경로도 같은 값으로 본다.
    last: (last || first) && {
      last_utm_source: (last || first).source ?? null,
      last_utm_medium: (last || first).medium ?? null,
      last_utm_campaign: (last || first).campaign ?? null,
      last_utm_content: (last || first).content ?? null,
    },
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('요청을 읽을 수 없어요.');
  }
  if (!body || typeof body !== 'object') return fail('요청을 읽을 수 없어요.');

  // 허니팟: 사람 눈에 안 보이는 칸이 채워져 있으면 봇이다. 성공한 것처럼 돌려보내고 저장하지 않는다.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true });
  }

  if (!rateLimit(`signup:ip:${clientIp(request)}`, 8, 10 * 60 * 1000)) {
    return fail('잠시 후에 다시 시도해 주세요.', 429);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) return fail('이름을 입력해 주세요.');

  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
  if (!/^01[0-9][0-9]{7,8}$/.test(phone)) return fail('휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)');

  if (body.consentPrivacy !== true) return fail('개인정보 수집·이용에 동의해 주세요.');

  const gender = GENDERS.includes(body.gender) ? body.gender : null;
  const q1 = Q1.includes(body.q1) ? body.q1 : null;
  const q2 = Q2.includes(body.q2) ? body.q2 : null;
  const consentMarketing = body.consentMarketing === true;

  if (!rateLimit(`signup:phone:${phone}`, 3, 10 * 60 * 1000)) {
    return fail('잠시 후에 다시 시도해 주세요.', 429);
  }

  const attr = attributionColumns(body.attribution);
  const now = new Date().toISOString();
  const row = {
    name,
    phone,
    gender,
    q1,
    q2,
    consent_privacy: true,
    consent_privacy_at: now,
    consent_marketing: consentMarketing,
    consent_marketing_at: consentMarketing ? now : null,
    ...(attr.first || { first_seen_at: now }),
    ...(attr.last || {}),
  };

  const supabase = db();
  const { error: insertError } = await supabase.from('blocc_customers').insert(row);

  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('signup insert failed', insertError.code);
      return fail('신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 500);
    }
    // 이미 신청한 번호: 처음 경로(first_*)는 건드리지 않고, 마지막 경로(last_*)와 답변만 새로 쓴다.
    const update = {
      name,
      consent_marketing: consentMarketing,
      consent_marketing_at: consentMarketing ? now : null,
      updated_at: now,
      ...(gender ? { gender } : {}),
      ...(q1 ? { q1 } : {}),
      ...(q2 ? { q2 } : {}),
      ...(attr.last || {}),
    };
    const { error: updateError } = await supabase.from('blocc_customers').update(update).eq('phone', phone);
    if (updateError) {
      console.error('signup update failed', updateError.code);
      return fail('신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 500);
    }
  }

  return json({ ok: true, openchatUrl: process.env.OPENCHAT_URL || null });
}
