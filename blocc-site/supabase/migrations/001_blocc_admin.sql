-- blocc 어드민: 채널, 링크 장부, 클릭 로그, 고객(신청자) 테이블
-- 모든 테이블 이름 앞에 blocc_ 를 붙여 다른 사이트와 완전히 분리한다.
-- 읽기·쓰기는 서버(service_role)만 한다. RLS를 켜고 정책은 만들지 않는다.

create table if not exists blocc_channels (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9._-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  source text not null check (source ~ '^[a-z0-9._-]{1,40}$'),
  medium text not null check (medium ~ '^[a-z0-9._-]{1,40}$'),
  content_mode text not null default 'none' check (content_mode in ('none', 'serial', 'date', 'free')),
  content_prefix text check (content_prefix is null or content_prefix ~ '^[a-z0-9._-]{1,40}$'),
  note text check (note is null or char_length(note) <= 200),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists blocc_links (
  id bigint generated always as identity primary key,
  channel_id bigint not null references blocc_channels (id),
  -- '/' = 내 알림 신청 페이지, 'funding' = 와디즈 펀딩 주소(서버 환경변수)
  landing_path text not null default '/' check (landing_path in ('/', 'funding')),
  source text not null check (source ~ '^[a-z0-9._-]{1,40}$'),
  medium text not null check (medium ~ '^[a-z0-9._-]{1,40}$'),
  campaign text not null check (campaign ~ '^[a-z0-9._-]{1,40}$'),
  content text check (content is null or content ~ '^[a-z0-9._-]{1,40}$'),
  term text check (term is null or term ~ '^[a-z0-9._-]{1,40}$'),
  url text not null,
  short_code text not null unique check (short_code ~ '^[a-z0-9]{4,12}$'),
  label text check (label is null or char_length(label) <= 100),
  clicks bigint not null default 0,
  last_clicked_at timestamptz,
  -- 와디즈 데이터플러스 숫자를 사람이 직접 입력하는 칸 (와디즈 구매는 내 DB로 들어오지 않는다)
  purchases_manual int not null default 0 check (purchases_manual >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- 같은 UTM 조합은 장부에 한 번만
create unique index if not exists blocc_links_combo_uq
  on blocc_links (landing_path, source, medium, campaign, coalesce(content, ''), coalesce(term, ''));
create index if not exists blocc_links_channel_idx on blocc_links (channel_id);

create table if not exists blocc_clicks (
  id bigint generated always as identity primary key,
  link_id bigint not null references blocc_links (id),
  clicked_at timestamptz not null default now(),
  device text not null check (device in ('mobile', 'desktop', 'other')),
  referer_host text
);
create index if not exists blocc_clicks_time_idx on blocc_clicks (clicked_at);
create index if not exists blocc_clicks_link_time_idx on blocc_clicks (link_id, clicked_at);

-- 손님 한 명이 한 줄. 전화번호가 같으면 같은 손님이다.
create table if not exists blocc_customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 40),
  phone text not null unique check (phone ~ '^01[0-9][0-9]{7,8}$'),
  gender text check (gender in ('female', 'male', 'none')),
  q1 text check (q1 in ('commute', 'meeting', 'cafe', 'travel')),
  q2 text check (q2 in ('second-bag', 'shoulder', 'tangled', 'trolley')),
  consent_privacy boolean not null check (consent_privacy),
  consent_privacy_at timestamptz not null default now(),
  consent_marketing boolean not null default false,
  consent_marketing_at timestamptz,
  -- 처음 온 경로: 처음 한 번만 쓰고 절대 덮어쓰지 않는다
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_seen_at timestamptz,
  -- 마지막으로 온 경로: 신청할 때마다 새로 쓴다
  last_utm_source text,
  last_utm_medium text,
  last_utm_campaign text,
  last_utm_content text
);
create index if not exists blocc_customers_created_idx on blocc_customers (created_at);

alter table blocc_channels enable row level security;
alter table blocc_links enable row level security;
alter table blocc_clicks enable row level security;
alter table blocc_customers enable row level security;

-- 클릭 1 올리기 + 로그 남기기를 한 번에(원자적으로). 보관된 링크도 넘기고 센다.
create or replace function blocc_record_click(p_code text, p_device text, p_referer_host text)
returns table (landing_path text, source text, medium text, campaign text, content text, term text)
language plpgsql
security definer
set search_path = public
as $$
declare
  l blocc_links%rowtype;
begin
  update blocc_links
     set clicks = clicks + 1, last_clicked_at = now()
   where short_code = p_code
   returning * into l;
  if not found then
    return;
  end if;
  insert into blocc_clicks (link_id, device, referer_host)
  values (l.id, coalesce(p_device, 'other'), p_referer_host);
  return query select l.landing_path, l.source, l.medium, l.campaign, l.content, l.term;
end;
$$;

-- 대시보드 집계. 숫자는 모두 DB에 실제로 쌓인 값만 센다.
create or replace function blocc_stats(
  p_from timestamptz default '-infinity',
  p_to timestamptz default 'infinity'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
lk as (
  select l.id, l.channel_id, l.landing_path, l.source, l.medium, l.campaign, l.content,
         l.label, l.short_code, l.purchases_manual, l.archived,
         (select count(*) from blocc_clicks c
           where c.link_id = l.id and c.clicked_at >= p_from and c.clicked_at < p_to) as clicks
    from blocc_links l
),
cu as (
  select c.id, c.q1, c.first_utm_source, c.first_utm_medium, c.created_at,
         (select l.id from blocc_links l
           where l.landing_path = '/'
             and l.source = c.first_utm_source
             and l.medium = c.first_utm_medium
             and l.campaign = c.first_utm_campaign
             and coalesce(l.content, '') = coalesce(c.first_utm_content, '')
           order by l.id limit 1) as link_id
    from blocc_customers c
   where c.created_at >= p_from and c.created_at < p_to
)
select jsonb_build_object(
  'links', coalesce((select jsonb_agg(to_jsonb(lk)) from lk), '[]'::jsonb),
  'signups_by_link', coalesce((
    select jsonb_agg(jsonb_build_object('link_id', link_id, 'n', n))
      from (select link_id, count(*) as n from cu where link_id is not null group by link_id) s
  ), '[]'::jsonb),
  'unlinked', coalesce((
    select jsonb_agg(jsonb_build_object('source', first_utm_source, 'medium', first_utm_medium, 'n', n))
      from (select first_utm_source, first_utm_medium, count(*) as n
              from cu where link_id is null group by first_utm_source, first_utm_medium) u
  ), '[]'::jsonb),
  'segments', coalesce((
    select jsonb_agg(jsonb_build_object(
             'q1', q1, 'link_id', link_id, 'source', first_utm_source, 'medium', first_utm_medium, 'n', n))
      from (select q1, link_id, first_utm_source, first_utm_medium, count(*) as n
              from cu group by q1, link_id, first_utm_source, first_utm_medium) s
  ), '[]'::jsonb),
  'daily', coalesce((
    select jsonb_agg(jsonb_build_object('day', d, 'clicks', clicks, 'signups', signups) order by d)
      from (
        select d, sum(clicks) as clicks, sum(signups) as signups
          from (
            select (clicked_at at time zone 'Asia/Seoul')::date as d, 1 as clicks, 0 as signups
              from blocc_clicks where clicked_at >= p_from and clicked_at < p_to
            union all
            select (created_at at time zone 'Asia/Seoul')::date, 0, 1 from cu
          ) x group by d
      ) y
  ), '[]'::jsonb),
  'customers', (select count(*) from cu)
);
$$;

-- 브라우저용 역할(anon, authenticated)에는 아무 권한도 주지 않는다.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table blocc_channels, blocc_links, blocc_clicks, blocc_customers from anon;
    revoke execute on function blocc_record_click(text, text, text) from anon;
    revoke execute on function blocc_stats(timestamptz, timestamptz) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table blocc_channels, blocc_links, blocc_clicks, blocc_customers from authenticated;
    revoke execute on function blocc_record_click(text, text, text) from authenticated;
    revoke execute on function blocc_stats(timestamptz, timestamptz) from authenticated;
  end if;
end $$;
revoke execute on function blocc_record_click(text, text, text) from public;
revoke execute on function blocc_stats(timestamptz, timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function blocc_record_click(text, text, text) to service_role;
    grant execute on function blocc_stats(timestamptz, timestamptz) to service_role;
  end if;
end $$;
