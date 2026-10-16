'use client';

import { useEffect, useRef, useState } from 'react';
import { captureAttribution, getAttribution } from '@/lib/attribution';
import { track, EVENTS } from '@/lib/track';

const GENDERS = [
  { v: 'female', t: '여성' },
  { v: 'male', t: '남성' },
  { v: 'none', t: '답하지 않을래요' },
];
const Q1 = [
  { v: 'commute', t: '집에서 회사까지만' },
  { v: 'meeting', t: '회사에서 미팅·외근까지' },
  { v: 'cafe', t: '카페나 공유오피스까지' },
  { v: 'travel', t: '출장이나 여행지까지' },
];
const Q2 = [
  { v: 'second-bag', t: '미팅 갈 때 가방을 따로 챙겨야 할 때' },
  { v: 'shoulder', t: '노트북 넣고 하루 종일 메서 어깨가 아플 때' },
  { v: 'tangled', t: '충전기나 서류가 가방 속에서 뒤엉킬 때' },
  { v: 'trolley', t: '캐리어 끌 때 가방이 자꾸 흘러내릴 때' },
];

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

export default function SignupForm() {
  const [form, setForm] = useState({
    name: '', phone: '', gender: '', q1: '', q2: '', consentPrivacy: false, consentMarketing: false, website: '',
  });
  const [status, setStatus] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const [openchatUrl, setOpenchatUrl] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    const attr = captureAttribution();
    track(EVENTS.landing_view, { utm_source: attr?.last?.source ?? 'direct' });
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onStart = () => {
    if (!started.current) {
      started.current = true;
      track(EVENTS.form_start);
    }
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('이름을 입력해 주세요.');
    if (!/^01[0-9][0-9]{7,8}$/.test(form.phone.replace(/\D/g, ''))) return setError('휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)');
    if (!form.consentPrivacy) return setError('개인정보 수집·이용에 동의해 주세요.');
    setStatus('sending');
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, attribution: getAttribution() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus('idle');
        return setError(data.error || '신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      track(EVENTS.prelaunch_signup, { q1: form.q1 || 'none' });
      setOpenchatUrl(data.openchatUrl);
      setStatus('done');
    } catch {
      setStatus('idle');
      setError('네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.');
    }
  }

  if (status === 'done') {
    return (
      <section className="card done" id="apply" aria-live="polite">
        <h2>신청이 끝났어요</h2>
        <p>펀딩이 열리는 날 문자로 가장 먼저 알려드릴게요.</p>
        {openchatUrl && (
          <p>
            <a className="btn" href={openchatUrl} target="_blank" rel="noopener noreferrer">오픈채팅방에서 같이 보기</a>
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="form" id="apply">
      <p>
        <a className="btn block" href="#apply-form" onClick={() => track(EVENTS.cta_click, { place: 'hero' })}>오픈 알림 받기</a>
      </p>
      <form id="apply-form" className="card" onSubmit={submit} onFocus={onStart} noValidate>
        <div className="field">
          <label htmlFor="name">이름</label>
          <input id="name" className="input" autoComplete="name" maxLength={40} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="phone">휴대폰 번호</label>
          <input id="phone" className="input" inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={form.phone} onChange={(e) => set('phone', formatPhone(e.target.value))} />
          <p className="help">펀딩 오픈 당일 문자로 알려드리고, 체험단에 뽑히시면 연락드려요.</p>
        </div>
        <fieldset className="field">
          <legend>성별<span className="opt">(선택)</span></legend>
          <div className="choices">
            {GENDERS.map((o) => (
              <label className="choice" key={o.v}>
                <input type="radio" name="gender" value={o.v} checked={form.gender === o.v} onChange={() => set('gender', o.v)} />
                {o.t}
              </label>
            ))}
          </div>
          <p className="help">어깨끈 길이와 크기 같은 디자인 방향을 정할 때 참고해요.</p>
        </fieldset>
        <fieldset className="field">
          <legend>평일에 노트북 들고 어디까지 가세요?<span className="opt">(선택)</span></legend>
          <div className="choices">
            {Q1.map((o) => (
              <label className="choice" key={o.v}>
                <input type="radio" name="q1" value={o.v} checked={form.q1 === o.v} onChange={() => set('q1', o.v)} />
                {o.t}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>가방 때문에 이럴 때 가장 짜증나요<span className="opt">(선택)</span></legend>
          <div className="choices">
            {Q2.map((o) => (
              <label className="choice" key={o.v}>
                <input type="radio" name="q2" value={o.v} checked={form.q2 === o.v} onChange={() => set('q2', o.v)} />
                {o.t}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="consent">
          <label className="choice">
            <input type="checkbox" checked={form.consentPrivacy} onChange={(e) => set('consentPrivacy', e.target.checked)} />
            <span><b>[필수]</b> 개인정보 수집·이용에 동의합니다</span>
          </label>
          <p className="fine">
            받는 정보: 이름, 휴대폰 번호, 선택 항목 답변, 어떤 링크를 통해 들어왔는지(유입 경로).
            쓰는 곳: 신청 확인, 펀딩 오픈 소식 전달, 체험단 연락, 문의 답변.
            보관 기간: 삭제를 요청할 때까지 (법에서 보관하라고 한 정보는 그 기간만큼).
            동의하지 않으면 신청할 수 없어요.
          </p>
          <label className="choice" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={form.consentMarketing} onChange={(e) => set('consentMarketing', e.target.checked)} />
            <span><b>[선택]</b> 신제품 소식과 혜택을 문자·카카오 채널로 받겠어요</span>
          </label>
          <p className="fine">오픈 알림, 얼리버드 혜택, 체험단 모집 소식을 보내 드려요. 동의하지 않아도 신청할 수 있고, 언제든 끌 수 있어요.</p>
        </div>

        {/* 허니팟: 사람에게는 보이지 않는 칸. 채워져 있으면 봇으로 본다. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="website">웹사이트</label>
          <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
        </div>

        {error && <p className="err" role="alert">{error}</p>}
        <p style={{ marginTop: 16 }}>
          <button className="btn block" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? '보내는 중…' : '오픈 알림 신청하기'}
          </button>
        </p>
      </form>
    </section>
  );
}
