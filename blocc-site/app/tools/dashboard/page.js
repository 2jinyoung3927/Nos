'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rangeFor, kstYmd } from '@/lib/range';

const RANGES = [
  { k: 'today', t: '오늘' },
  { k: '7d', t: '7일' },
  { k: '30d', t: '30일' },
  { k: 'all', t: '전체' },
  { k: 'custom', t: '직접' },
];
const SORTS = [
  { k: 'clicks', t: '클릭 순' },
  { k: 'signups', t: '신청 순' },
  { k: 'purchases', t: '구매 순' },
];
const Q1_ORDER = ['commute', 'meeting', 'cafe', 'travel', 'none'];

const pct = (v) => (v == null ? '-' : `${(v * 100).toFixed(1)}%`);

export default function Dashboard() {
  const [kind, setKind] = useState('30d');
  const today = kstYmd(new Date());
  const [custom, setCustom] = useState({ from: today, to: today });
  const [sort, setSort] = useState('clicks');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { from, to } = rangeFor(kind, custom);
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    try {
      const res = await fetch(`/api/stats?${q}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '불러오지 못했어요.');
      setData(body);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [kind, custom]);
  useEffect(() => { load(); }, [load]);

  const channels = useMemo(
    () => (data ? [...data.channels].sort((a, b) => b[sort] - a[sort] || b.clicks - a.clicks) : []),
    [data, sort],
  );
  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => Math.max(d.clicks, d.signups))) : 1;

  return (
    <main>
      <h1>채널별 성과</h1>
      <p className="sub">서버가 실제로 센 값만 보여줘요. 개인정보는 보여주지 않고 숫자만 보여줘요.</p>

      <div className="row" role="group" aria-label="기간">
        {RANGES.map((r) => (
          <button key={r.k} className={`btn small ${kind === r.k ? '' : 'ghost'}`} aria-pressed={kind === r.k} onClick={() => setKind(r.k)}>{r.t}</button>
        ))}
        {kind === 'custom' && (
          <>
            <input className="input" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="시작일" />
            <span>~</span>
            <input className="input" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="종료일" />
          </>
        )}
      </div>

      {error && <p className="err" role="alert">{error}</p>}
      {!data && !error && <p className="note">불러오는 중…</p>}

      {data && (
        <>
          <div className="kpis">
            <div className="kpi"><b>{data.summary.clicks.toLocaleString()}</b><span>클릭</span></div>
            <div className="kpi"><b>{data.summary.signups.toLocaleString()}</b><span>1차 전환 · 알림 신청</span></div>
            <div className="kpi"><b>{data.summary.purchases.toLocaleString()}</b><span>2차 전환 · 구매 (직접 입력)</span></div>
            <div className="kpi"><b>{pct(data.summary.rate)}</b><span>클릭 대비 신청 (신청 페이지 링크만)</span></div>
          </div>
          <p className="note">구매는 와디즈가 내 DB로 보내 주지 않아서 링크 장부에 직접 적은 값이고, 위에서 고른 기간과 상관없이 전체 합계예요.</p>

          <h2>채널별 표</h2>
          <div className="row" role="group" aria-label="정렬">
            {SORTS.map((s) => (
              <button key={s.k} className={`btn small ${sort === s.k ? '' : 'ghost'}`} aria-pressed={sort === s.k} onClick={() => setSort(s.k)}>{s.t}</button>
            ))}
          </div>
          {channels.length === 0 ? <p className="empty">아직 데이터가 없어요.</p> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>채널</th><th className="n">클릭</th><th className="n">와디즈로 간 클릭</th><th className="n">신청</th><th className="n">구매</th><th className="n">신청률</th></tr></thead>
                <tbody>
                  {channels.map((c) => {
                    const landingClicks = c.clicks - c.funding_clicks;
                    return (
                      <tr key={c.key}>
                        <td>{c.name}</td>
                        <td className="n">{c.clicks}</td>
                        <td className="n">{c.funding_clicks}</td>
                        <td className="n">{c.signups}</td>
                        <td className="n">{c.purchases}</td>
                        <td className="n">{c.linked && landingClicks > 0 ? pct(c.signups / landingClicks) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">많이 데려온 채널(클릭)과 사는 손님을 데려온 채널(구매)이 다를 수 있어서 정렬을 바꿔 볼 수 있게 했어요.</p>

          <h2>일별 추이</h2>
          {data.daily.length === 0 ? <p className="empty">이 기간에는 기록이 없어요.</p> : (
            <>
              <div className="legend"><span><i style={{ background: 'var(--bar)' }} />클릭</span><span><i style={{ background: 'var(--bar2)' }} />신청</span></div>
              <div className="tbl-wrap" style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, width: data.daily.length * 40 }} role="img" aria-label="일별 클릭과 신청 수 막대 그래프">
                  {data.daily.map((d) => (
                    <div key={d.day} title={`${d.day} 클릭 ${d.clicks}, 신청 ${d.signups}`} style={{ flex: '0 0 34px', display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%' }}>
                      <div style={{ flex: 1, height: `${(d.clicks / maxDaily) * 100}%`, minHeight: d.clicks ? 2 : 0, background: 'var(--bar)', borderRadius: '3px 3px 0 0' }} />
                      <div style={{ flex: 1, height: `${(d.signups / maxDaily) * 100}%`, minHeight: d.signups ? 2 : 0, background: 'var(--bar2)', borderRadius: '3px 3px 0 0' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, width: data.daily.length * 40, marginTop: 4 }}>
                  {data.daily.map((d) => <span key={d.day} className="note" style={{ flex: '0 0 34px', fontSize: 11, textAlign: 'center' }}>{d.day.slice(5)}</span>)}
                </div>
              </div>
            </>
          )}

          <h2>소재 상위</h2>
          {data.top_contents.length === 0 ? <p className="empty">아직 클릭이나 신청이 있는 소재가 없어요.</p> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>채널</th><th>소재</th><th>캠페인</th><th className="n">클릭</th><th className="n">신청</th><th className="n">구매</th></tr></thead>
                <tbody>
                  {data.top_contents.map((c) => (
                    <tr key={c.link_id}>
                      <td>{c.channel}</td><td className="mono">{c.content || '-'}</td><td className="mono">{c.campaign}</td>
                      <td className="n">{c.clicks}</td><td className="n">{c.signups}</td><td className="n">{c.purchases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>고객 나누는 기준 × 처음 온 채널</h2>
          <p className="note">기준은 "평일에 노트북 들고 어디까지 가세요?"(Q1)예요. 사람 수만 보여줘요.</p>
          {data.segments.length === 0 ? <p className="empty">이 기간에 신청한 사람이 아직 없어요.</p> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>처음 온 채널</th>{Q1_ORDER.map((q) => <th key={q} className="n">{data.q1_labels[q]}</th>)}<th className="n">합계</th></tr></thead>
                <tbody>
                  {data.segments.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      {Q1_ORDER.map((q) => <td key={q} className="n">{s.q1[q]}</td>)}
                      <td className="n">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
