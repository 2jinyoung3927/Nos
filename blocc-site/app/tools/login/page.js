'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push('/tools/utm');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || '로그인하지 못했어요.');
    }
  }

  return (
    <main className="wrap" style={{ paddingTop: 80 }}>
      <form className="card" onSubmit={submit}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>blocc 어드민</h1>
        <div className="field">
          <label htmlFor="pw">비밀번호</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn block" disabled={busy || !password}>{busy ? '확인 중…' : '들어가기'}</button>
      </form>
    </main>
  );
}
