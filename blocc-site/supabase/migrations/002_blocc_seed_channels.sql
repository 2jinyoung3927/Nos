-- 처음 채널 9개 (brand/utm-naming.md 의 링크 대장 기준). 이미 있으면 건너뛴다.
insert into blocc_channels (code, name, source, medium, content_mode, content_prefix, note, sort) values
  ('ig-bio-brand',   '인스타 프로필 (브랜드)',  'instagram',      'social',      'none',   'bio-brand',  '프로필 링크 한 곳. 소재 코드 고정', 10),
  ('ig-bio-stark',   '인스타 프로필 (stark.m0de)', 'instagram',  'social',      'none',   'bio-stark',  '프로필 링크 한 곳. 소재 코드 고정', 20),
  ('ig-story',       '인스타 스토리 링크',      'instagram',      'social',      'date',   'story-',     '월일 4자리 (예: story-1103)', 30),
  ('ig-ad',          '인스타 광고',             'instagram',      'paid-social', 'free',   'ad-',        '소재 이름을 직접 입력 (예: ad-a-commute)', 40),
  ('threads-post',   '스레드 게시물',           'threads',        'social',      'date',   'post-',      '월일 4자리 (예: post-1103)', 50),
  ('blog-faq',       '블로그 FAQ 글',           'naver-blog',     'blog',        'serial', 'faq-',       '글 번호 (예: faq-01)', 60),
  ('openchat-notice','오픈채팅방 공지',         'kakao-openchat', 'chat',        'none',   'notice-pin', '고정 공지 한 곳', 70),
  ('kakao-channel',  '카카오 채널 메시지',      'kakao-channel',  'message',     'date',   'msg-',       '월일 4자리 (예: msg-1103). D-3 예고는 free 로 바꿔 d-3 입력', 80),
  ('sms',            '문자',                    'sms',            'sms',         'free',   'q1-',        '오픈 문자는 q1-commute, q1-meeting, q1-cafe, q1-travel, q1-none', 90)
on conflict (code) do nothing;
