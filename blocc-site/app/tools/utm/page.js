'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CAMPAIGNS, suggestContent, normalizeUtm } from '@/lib/utm';

const MODE_LABEL = { none: '고정', serial: '순번', date: '날짜', free: '자유 입력' };

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했어요.');
  return data;
}

function copy(text, setNote) {
  navigator.clipboard.writeText(text).then(
    () => setNote('복사했어요.'),
    () => setNote('복사하지 못했어요. 직접 선택해서 복사해 주세요.'),
  );
}

export default function UtmBuilder() {
  const [channels, setChannels] = useState([]);
  const [links, setLinks] = useState([]);
  const [signups, setSignups] = useState({});
  const [selected, setSelected] = useState({}); // channel_id -> content
  const [campaign, setCampaign] = useState('prelaunch');
  const [landing, setLanding] = useState('/');
  const [showArchived, setShowArchived] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [qr, setQr] = useState(null); // {code, dataUrl}
  const [panel, setPanel] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newChan, setNewChan] = useState({ name: '', source: '', medium: '', content_mode: 'none', content_prefix: '' });

  const load = useCallback(async () => {
    try {
      const [c, l, s] = await Promise.all([api('/api/channels'), api('/api/utm-links'), api('/api/stats')]);
      setChannels(c.channels);
      setLinks(l.links);
      setSignups(Object.fromEntries(s.links.map((x) => [x.link_id, x.signups])));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeChannels = channels.filter((c) => c.active);

  function toggle(ch) {
    setSelected((prev) => {
      const next = { ...prev };
      if (ch.id in next) delete next[ch.id];
      else {
        const mine = links.filter((l) => l.channel_id === ch.id).map((l) => l.content);
        next[ch.id] = suggestContent(ch, mine);
      }
      return next;
    });
  }

  async function create() {
    setError('');
    setResults([]);
    const items = Object.entries(selected).map(([id, content]) => ({ channel_id: Number(id), content }));
    try {
      const data = await api('/api/utm-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, landing_path: landing, items }),
      });
      setResults(data.results);
      setSelected({});
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function patchLink(id, body) {
    try {
      await api('/api/utm-links', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function patchChannel(id, body) {
    try {
      await api('/api/channels', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function addChannel(e) {
    e.preventDefault();
    try {
      await api('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newChan) });
      setNewChan({ name: '', source: '', medium: '', content_mode: 'none', content_prefix: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function showQr(link) {
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(link.short_url, { margin: 2, width: 320 });
    setQr({ code: link.short_code, url: link.short_url, dataUrl });
  }

  const visible = useMemo(() => links.filter((l) => showArchived || !l.archived), [links, showArchived]);

  return (
    <main>
      <h1>UTM 링크 만들기</h1>
      <p className="sub">채널을 고르면 어디서 왔는지 꼬리표(UTM)가 붙은 짧은 링크를 만들어요. 같은 조합은 장부에 한 번만 남고, 다시 만들면 기존 링크를 돌려줘요.</p>
      {error && <p className="err" role="alert">{error}</p>}
      {note && <p className="msg-ok" role="status">{note}</p>}

      <h2>1. 채널 고르기</h2>
      {!loaded ? <p className="note">불러오는 중…</p> : activeChannels.length === 0 ? (
        <p className="empty">쓸 수 있는 채널이 없어요. 아래 "채널 관리"에서 추가해 주세요.</p>
      ) : (
        <div className="grid">
          {activeChannels.map((ch) => (
            <button key={ch.id} className="chan" aria-pressed={ch.id in selected} onClick={() => toggle(ch)}>
              <b>{ch.name}</b>
              <span>{ch.source} / {ch.medium}</span>
              <span>소재 방식: {MODE_LABEL[ch.content_mode]}</span>
            </button>
          ))}
        </div>
      )}

      <h2>2. 캠페인과 도착지</h2>
      <div className="row">
        <label>캠페인
          <select className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            {CAMPAIGNS.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
          </select>
        </label>
        <label>도착지
          <select className="input" value={landing} onChange={(e) => setLanding(e.target.value)}>
            <option value="/">내 알림 신청 페이지</option>
            <option value="funding">와디즈 펀딩 페이지</option>
          </select>
        </label>
      </div>

      {Object.keys(selected).length > 0 && (
        <>
          <h2>3. 소재 코드 확인</h2>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>채널</th><th>소재 코드(utm_content)</th></tr></thead>
              <tbody>
                {Object.keys(selected).map((id) => {
                  const ch = channels.find((c) => c.id === Number(id));
                  return (
                    <tr key={id}>
                      <td>{ch.name}</td>
                      <td>
                        <input
                          className="input mono"
                          style={{ minHeight: 34 }}
                          value={selected[id]}
                          readOnly={ch.content_mode === 'none'}
                          onChange={(e) => setSelected((p) => ({ ...p, [id]: normalizeUtm(e.target.value) }))}
                          aria-label={`${ch.name} 소재 코드`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">소문자, 띄어쓰기 대신 하이픈, 영문·숫자·. _ - 만 써요. 한 번 정한 이름은 바꾸지 않아요.</p>
          <button className="btn" onClick={create}>링크 {Object.keys(selected).length}개 만들기</button>
        </>
      )}

      {results.length > 0 && (
        <>
          <h2>방금 만든 링크</h2>
          <div className="tbl-wrap">
            <table>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    {r.link ? (
                      <>
                        <td>{r.link.channel_name}</td>
                        <td className="mono">{r.link.short_url}</td>
                        <td>{r.existing ? <span className="chip">이미 있던 링크</span> : <span className="chip">새로 만듦</span>}</td>
                        <td><button className="btn small" onClick={() => copy(r.link.short_url, setNote)}>짧은 링크 복사</button></td>
                      </>
                    ) : (
                      <td className="err" colSpan={4}>{r.error}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>링크 장부</h2>
      <label className="note"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> 보관한 링크도 보기</label>
      {visible.length === 0 ? (
        <p className="empty">아직 만든 링크가 없어요.</p>
      ) : (
        <div className="tbl-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>채널</th><th>소재</th><th>캠페인</th><th>도착</th><th>짧은 링크</th>
                <th className="n">클릭</th><th className="n">신청</th><th className="n">구매(직접 입력)</th><th>만든 날</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} style={l.archived ? { opacity: 0.55 } : undefined}>
                  <td>{l.channel_name}</td>
                  <td className="mono">{l.content || '-'}</td>
                  <td className="mono">{l.campaign}</td>
                  <td>{l.landing_path === 'funding' ? '와디즈' : '신청 페이지'}</td>
                  <td className="mono">/l/{l.short_code}</td>
                  <td className="n">{l.clicks}</td>
                  <td className="n">{l.landing_path === 'funding' ? '-' : (signups[l.id] ?? 0)}</td>
                  <td className="n">
                    <input
                      className="input" style={{ width: 70, minHeight: 30, textAlign: 'right' }} type="number" min="0" defaultValue={l.purchases_manual}
                      aria-label="와디즈 데이터플러스에서 확인한 구매 수"
                      onBlur={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v !== l.purchases_manual) patchLink(l.id, { purchases_manual: v }); }}
                    />
                  </td>
                  <td>{new Date(l.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
                  <td>
                    <button className="btn small ghost" onClick={() => copy(l.short_url, setNote)}>짧은 링크</button>{' '}
                    <button className="btn small ghost" onClick={() => copy(l.long_url || '', setNote)}>긴 링크</button>{' '}
                    <button className="btn small ghost" onClick={() => showQr(l)}>QR</button>{' '}
                    <button className="btn small ghost" onClick={() => patchLink(l.id, { archived: !l.archived })}>{l.archived ? '보관 해제' : '보관'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">구매 수는 와디즈가 내 DB로 보내 주지 않아서, 와디즈 데이터플러스에서 링크별 숫자를 보고 직접 적어요.</p>

      {qr && (
        <div className="card" style={{ marginTop: 16, maxWidth: 360 }}>
          <p className="mono" style={{ wordBreak: 'break-all' }}>{qr.url}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.dataUrl} alt={`${qr.url} QR 코드`} width="240" height="240" />
          <p>
            <a className="btn small" href={qr.dataUrl} download={`blocc-${qr.code}.png`}>PNG 저장</a>{' '}
            <button className="btn small ghost" onClick={() => setQr(null)}>닫기</button>
          </p>
        </div>
      )}

      <h2>
        <button className="btn ghost small" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>채널 관리 {panel ? '접기' : '열기'}</button>
      </h2>
      {panel && (
        <>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>이름</th><th>source / medium</th><th>소재 방식</th><th>상태</th><th /></tr></thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="mono">{c.source} / {c.medium}</td>
                    <td>{MODE_LABEL[c.content_mode]}{c.content_prefix ? ` (${c.content_prefix})` : ''}</td>
                    <td>{c.active ? '사용 중' : '숨김'}</td>
                    <td><button className="btn small ghost" onClick={() => patchChannel(c.id, { active: !c.active })}>{c.active ? '숨기기' : '다시 보이기'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="row" onSubmit={addChannel}>
            <label>이름<input className="input" required value={newChan.name} onChange={(e) => setNewChan({ ...newChan, name: e.target.value })} /></label>
            <label>source<input className="input mono" required placeholder="예: youtube" value={newChan.source} onChange={(e) => setNewChan({ ...newChan, source: normalizeUtm(e.target.value) })} /></label>
            <label>medium<input className="input mono" required placeholder="예: social" value={newChan.medium} onChange={(e) => setNewChan({ ...newChan, medium: normalizeUtm(e.target.value) })} /></label>
            <label>소재 방식
              <select className="input" value={newChan.content_mode} onChange={(e) => setNewChan({ ...newChan, content_mode: e.target.value })}>
                {Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>접두사/고정값<input className="input mono" placeholder="예: post-" value={newChan.content_prefix} onChange={(e) => setNewChan({ ...newChan, content_prefix: normalizeUtm(e.target.value) })} /></label>
            <button className="btn small">채널 추가</button>
          </form>
          <p className="note">source, medium 은 한 번 정하면 바꾸지 않아요. 지우는 대신 "숨기기"를 써요.</p>
        </>
      )}
    </main>
  );
}
