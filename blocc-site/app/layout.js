import './globals.css';

export const metadata = {
  title: '올데이 3way백 오픈 알림',
  description: '숄더, 크로스, 백팩으로 바꿔 메는 블랙 가방. 펀딩이 열리는 날 문자로 가장 먼저 알려드려요.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

// 브라우저에 나가도 되는 값은 GA 측정 ID 하나뿐이다.
const GA_ID = /^G-[A-Z0-9]{4,20}$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '')
  ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  : null;

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
