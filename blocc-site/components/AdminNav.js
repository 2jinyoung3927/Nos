'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/tools/login') return null;

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/tools/login');
    router.refresh();
  }

  const tab = (href, label) => (
    <Link className="tab" href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>
  );
  return (
    <nav className="nav" aria-label="어드민">
      {tab('/tools/utm', '링크 만들기')}
      {tab('/tools/dashboard', '대시보드')}
      <span className="grow" />
      <button className="btn ghost small" onClick={logout}>로그아웃</button>
    </nav>
  );
}
