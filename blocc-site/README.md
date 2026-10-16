# blocc-site

올데이 3way백 알림 신청 페이지 + 어드민(UTM 링크 빌더, 단축 링크, 채널별 대시보드).
손님이 어디서 왔는지(UTM)를 고객 한 줄에 남겨서, 나중에 채널별로 다른 메시지를 보낼 수 있게 한다.

## 무엇이 들어 있나

| 주소 | 하는 일 |
|---|---|
| `/` | 알림 신청 페이지. 주소의 `utm_*` 를 30일 보관하고, 신청할 때 고객 줄에 남긴다 |
| `/l/코드` | 짧은 링크. 클릭 1 올리고 로그 남긴 뒤 302 로 넘긴다 (봇·HEAD 는 세지 않음) |
| `/tools/utm` | UTM 링크 빌더 + 링크 장부 + 채널 관리 (로그인 필요) |
| `/tools/dashboard` | 채널별 클릭 → 신청 → 구매, 일별 추이, 소재 상위, 세그먼트 표 (로그인 필요) |

경로 기록 규칙
- `first_utm_*`: 손님의 첫 신청 때 한 번만 쓰고 절대 덮어쓰지 않는다.
- `last_utm_*`: 같은 번호로 다시 신청할 때마다 새로 쓴다.
- 구매(와디즈)는 내 DB로 들어오지 않는다. 링크 장부의 "구매(직접 입력)" 칸에 와디즈 데이터플러스의 링크별 숫자를 적는다.

## 만든 테이블 (이름 앞에 `blocc_`)

`blocc_channels`, `blocc_links`, `blocc_clicks`, `blocc_customers` + 함수 `blocc_record_click`, `blocc_stats`.
전부 RLS 를 켜 두었고 정책은 없다. 서버(service_role)만 읽고 쓴다.
SQL 은 `supabase/migrations/` 에 있다 (001 테이블·함수, 002 처음 채널 9개).

## 환경변수

`.env.example` 참고. 서버에서만 쓰는 값에는 `NEXT_PUBLIC_` 을 붙이지 않는다.

| 이름 | 설명 |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel–Supabase 연동을 켜면 자동으로 들어온다 |
| `ADMIN_PASSWORD` | 어드민 공용 비밀번호 |
| `ADMIN_SESSION_SECRET` | 로그인 쿠키 서명용 긴 무작위 문자열 (32자 이상) |
| `SITE_URL` | 배포된 사이트 주소. 짧은 링크와 도착지 주소를 만들 때 쓴다 |
| `WADIZ_FUNDING_URL` | (선택) 와디즈 펀딩 주소. 도착지 "와디즈" 링크에 쓴다 |
| `OPENCHAT_URL` | (선택) 신청 완료 화면에 보여줄 오픈채팅방 주소 |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | (선택) GA4 측정 ID. 브라우저로 나가도 되는 유일한 값 |

## 처음 세팅 순서

1. Supabase 프로젝트를 만든다 (무료 플랜).
2. Supabase 의 SQL Editor 에 `supabase/migrations/001_blocc_admin.sql`, `002_blocc_seed_channels.sql` 을 차례로 붙여 넣어 실행한다.
3. Vercel 에서 이 저장소를 가져오고 **Root Directory 를 `blocc-site`** 로 정한다.
4. Vercel 의 Storage/Integrations 에서 Supabase 를 연결한다 (키를 직접 붙여 넣지 않아도 된다).
5. 위 표의 나머지 환경변수를 Vercel 에 넣고 다시 배포한다.
6. `/tools/login` 으로 들어가 링크를 만들고, 휴대폰으로 눌러 신청을 1건 해 본다.

## 개발과 시험

```
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
npm test                     # 순수 함수 시험 (UTM 규칙, 봇 판별, 로그인 서명, 집계, 기간 계산)
```

## 알아둘 한계

- 신청 API 의 속도 제한은 서버 한 개 안에서만 센다. 서버가 여러 개로 나뉘면 각각 센다. 전화번호 unique 가 마지막 방어선이다.
- 와디즈 안의 알림 신청·후원은 내 DB 와 연결되지 않는다. 와디즈 후원자 정보는 홍보·마케팅에 쓸 수 없다(와디즈 안내).
- 개인정보 동의 문구는 초안이다. 공개 전에 직접 확인한다.
