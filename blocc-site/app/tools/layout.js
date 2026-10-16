import AdminNav from '@/components/AdminNav';

// 어드민은 검색에 나오지 않고, 사이트 메뉴에서 링크하지 않는다.
export const metadata = {
  title: 'blocc 어드민',
  robots: { index: false, follow: false, nocache: true },
};

export default function ToolsLayout({ children }) {
  return (
    <div className="admin">
      <AdminNav />
      {children}
    </div>
  );
}
