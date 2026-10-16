// blocc_stats() 가 돌려준 원자료를 화면용 표로 묶는다. 순수 함수라서 따로 시험한다.
export const Q1_LABELS = {
  commute: '집↔회사',
  meeting: '미팅·외근',
  cafe: '카페·공유오피스',
  travel: '출장·여행',
  none: '무응답',
};

function unlinkedLabel(source, medium) {
  if (!source && !medium) return '(직접 방문·표시 없음)';
  return `(장부에 없는 링크) ${source || '-'} / ${medium || '-'}`;
}

export function composeStats(raw, channels) {
  const chanById = new Map(channels.map((c) => [c.id, c]));
  const signupsByLink = new Map(raw.signups_by_link.map((s) => [s.link_id, s.n]));

  const rows = new Map(); // key -> row
  const rowFor = (key, base) => {
    if (!rows.has(key)) rows.set(key, { key, clicks: 0, signups: 0, purchases: 0, funding_clicks: 0, ...base });
    return rows.get(key);
  };

  for (const c of channels) {
    rowFor(`c${c.id}`, { name: c.name, source: c.source, medium: c.medium, active: c.active, linked: true });
  }

  let signupLandingClicks = 0;
  let signupLandingSignups = 0;
  const contents = [];

  for (const l of raw.links) {
    const ch = chanById.get(l.channel_id);
    const row = rowFor(`c${l.channel_id}`, { name: ch?.name ?? `채널 ${l.channel_id}`, linked: true });
    const signups = signupsByLink.get(l.id) || 0;
    row.clicks += l.clicks;
    row.purchases += l.purchases_manual;
    if (l.landing_path === 'funding') row.funding_clicks += l.clicks;
    else {
      row.signups += signups;
      signupLandingClicks += l.clicks;
      signupLandingSignups += signups;
    }
    contents.push({
      link_id: l.id,
      channel: ch?.name ?? '',
      content: l.content,
      campaign: l.campaign,
      landing_path: l.landing_path,
      short_code: l.short_code,
      clicks: l.clicks,
      signups: l.landing_path === 'funding' ? 0 : signups,
      purchases: l.purchases_manual,
    });
  }

  for (const u of raw.unlinked) {
    const key = `u:${u.source || ''}/${u.medium || ''}`;
    rowFor(key, { name: unlinkedLabel(u.source, u.medium), source: u.source, medium: u.medium, linked: false }).signups += u.n;
  }

  // 세그먼트 표: Q1 × 처음 온 채널 (숫자만)
  const seg = new Map();
  for (const s of raw.segments) {
    let key;
    let label;
    const link = s.link_id != null ? raw.links.find((l) => l.id === s.link_id) : null;
    if (link) {
      key = `c${link.channel_id}`;
      label = chanById.get(link.channel_id)?.name ?? key;
    } else {
      key = `u:${s.source || ''}/${s.medium || ''}`;
      label = unlinkedLabel(s.source, s.medium);
    }
    if (!seg.has(key)) seg.set(key, { key, label, total: 0, q1: { commute: 0, meeting: 0, cafe: 0, travel: 0, none: 0 } });
    const r = seg.get(key);
    r.q1[s.q1 || 'none'] += s.n;
    r.total += s.n;
  }

  const channelRows = [...rows.values()].filter((r) => r.clicks || r.signups || r.purchases || r.active !== false || !r.linked);

  const summary = {
    clicks: raw.links.reduce((a, l) => a + l.clicks, 0),
    signups: raw.customers,
    purchases: raw.links.reduce((a, l) => a + l.purchases_manual, 0),
    // 신청 페이지로 가는 링크의 클릭 대비, 그 링크로 온 신청의 비율
    rate: signupLandingClicks > 0 ? signupLandingSignups / signupLandingClicks : null,
  };

  return {
    summary,
    channels: channelRows,
    daily: raw.daily,
    links: contents,
    top_contents: contents.filter((c) => c.clicks || c.signups).sort((a, b) => b.clicks - a.clicks).slice(0, 10),
    segments: [...seg.values()].sort((a, b) => b.total - a.total),
    q1_labels: Q1_LABELS,
  };
}
