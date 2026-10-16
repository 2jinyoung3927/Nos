import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUtm, isValidUtm, pickValidUtm, suggestContent } from '../lib/utm.js';
import { buildTargetUrl, unknownCodeUrl, shortUrl } from '../lib/links.js';
import { isBot, deviceOf, refererHost } from '../lib/bots.js';
import { createSessionToken, verifySessionToken, passwordMatches } from '../lib/auth.js';
import { composeStats } from '../lib/statsCompose.js';
import { rangeFor } from '../lib/range.js';

const env = { SITE_URL: 'https://blocc.example', WADIZ_FUNDING_URL: 'https://www.wadiz.kr/web/campaign/detail/1' };

test('UTM 값은 규칙에 맞게 고쳐진다', () => {
  assert.equal(normalizeUtm('  AD A  Commute '), 'ad-a-commute');
  assert.equal(normalizeUtm('인스타그램'), '');
  assert.equal(normalizeUtm('a--b'), 'a-b');
  assert.ok(isValidUtm('story-1103'));
  assert.ok(!isValidUtm('Story'));
  assert.ok(!isValidUtm('스토리'));
});

test('주소로 받은 UTM 은 규칙에 맞는 것만 남기고, source 가 없으면 버린다', () => {
  assert.deepEqual(pickValidUtm({ source: 'instagram', medium: 'Social', content: 'bio-brand' }), { source: 'instagram', content: 'bio-brand' });
  assert.equal(pickValidUtm({ medium: 'social' }), null);
  assert.equal(pickValidUtm({ source: '<script>' }), null);
});

test('소재 코드 제안: 고정 / 날짜 / 순번', () => {
  assert.equal(suggestContent({ content_mode: 'none', content_prefix: 'bio-brand' }, []), 'bio-brand');
  assert.equal(suggestContent({ content_mode: 'date', content_prefix: 'story-' }, [], new Date('2026-11-02T16:00:00Z')), 'story-1103'); // KST 11월 3일
  assert.equal(suggestContent({ content_mode: 'serial', content_prefix: 'faq-' }, ['faq-01', 'faq-09', null]), 'faq-10');
  assert.equal(suggestContent({ content_mode: 'serial', content_prefix: 'faq-' }, []), 'faq-01');
});

test('짧은 링크는 허용된 도착지(내 사이트, 와디즈)로만 간다', () => {
  const link = { landing_path: '/', source: 'instagram', medium: 'social', campaign: 'prelaunch', content: 'bio-brand', term: null };
  assert.equal(buildTargetUrl(link, env), 'https://blocc.example/?utm_source=instagram&utm_medium=social&utm_campaign=prelaunch&utm_content=bio-brand');
  assert.ok(buildTargetUrl({ ...link, landing_path: 'funding' }, env).startsWith('https://www.wadiz.kr/web/campaign/detail/1?utm_source=instagram'));
  // 허용 목록 밖의 값(외부 주소 등)은 도착지가 되지 못한다
  assert.ok(buildTargetUrl({ ...link, landing_path: 'https://evil.example' }, env).startsWith('https://blocc.example/'));
  assert.equal(buildTargetUrl({ ...link, landing_path: 'funding' }, { SITE_URL: env.SITE_URL }), null);
  assert.equal(unknownCodeUrl(env), 'https://blocc.example/?utm_source=short-link&utm_medium=unknown');
  assert.equal(shortUrl('abc123', env), 'https://blocc.example/l/abc123');
});

test('링크 미리보기 봇은 클릭으로 세지 않는다', () => {
  for (const ua of ['facebookexternalhit/1.1', 'kakaotalk-scrap/1.0', 'Twitterbot/1.0', 'Slackbot-LinkExpanding 1.0', 'Mozilla/5.0 (compatible; Discordbot/2.0)', 'Mozilla/5.0 (compatible; Yeti/1.1)', 'Googlebot/2.1', 'some-crawler', null]) {
    assert.ok(isBot(ua), String(ua));
  }
  const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram';
  assert.ok(!isBot(phone));
  assert.equal(deviceOf(phone), 'mobile');
  assert.equal(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'), 'desktop');
  assert.equal(refererHost('https://l.instagram.com/?u=x'), 'l.instagram.com');
  assert.equal(refererHost('not a url'), null);
});

test('어드민 로그인 쿠키는 서명이 맞고 기한 안일 때만 통과한다', async () => {
  const token = await createSessionToken('secret-1', 1000);
  assert.ok(await verifySessionToken('secret-1', token, 2000));
  assert.ok(!(await verifySessionToken('secret-2', token, 2000)));
  assert.ok(!(await verifySessionToken('secret-1', token, 1000 + 8 * 24 * 3600 * 1000)));
  assert.ok(!(await verifySessionToken('secret-1', 'abc.def', 2000)));
  assert.ok(!(await verifySessionToken('', token, 2000)));
  assert.ok(await passwordMatches('pw', 'pw'));
  assert.ok(!(await passwordMatches('pw ', 'pw')));
  assert.ok(!(await passwordMatches('pw', '')));
});

test('기간 계산은 한국 시간 기준이다', () => {
  const now = new Date('2026-10-16T20:00:00Z'); // KST 10월 17일 05시
  assert.equal(rangeFor('today', null, now).from, '2026-10-16T15:00:00.000Z');
  assert.equal(rangeFor('7d', null, now).from, '2026-10-10T15:00:00.000Z');
  assert.deepEqual(rangeFor('all', null, now), { from: null, to: null });
  assert.equal(rangeFor('custom', { from: '2026-10-01', to: '2026-10-03' }, now).to, '2026-10-03T15:00:00.000Z');
});

test('대시보드 집계: 채널 줄, 장부에 없는 링크, 세그먼트', () => {
  const channels = [{ id: 1, name: '인스타 프로필', source: 'instagram', medium: 'social', active: true }, { id: 2, name: '문자', source: 'sms', medium: 'sms', active: true }];
  const raw = {
    links: [
      { id: 10, channel_id: 1, landing_path: '/', clicks: 4, purchases_manual: 0, content: 'bio-brand', campaign: 'prelaunch', short_code: 'a' },
      { id: 11, channel_id: 2, landing_path: 'funding', clicks: 5, purchases_manual: 3, content: 'q1-commute', campaign: 'funding-open', short_code: 'b' },
    ],
    signups_by_link: [{ link_id: 10, n: 2 }],
    unlinked: [{ source: null, medium: null, n: 1 }],
    segments: [{ q1: 'commute', link_id: 10, source: 'instagram', medium: 'social', n: 1 }, { q1: null, link_id: 10, source: 'instagram', medium: 'social', n: 1 }],
    daily: [], customers: 3,
  };
  const r = composeStats(raw, channels);
  assert.deepEqual(r.summary, { clicks: 9, signups: 3, purchases: 3, rate: 0.5 });
  const ig = r.channels.find((c) => c.name === '인스타 프로필');
  assert.equal(ig.signups, 2);
  const sms = r.channels.find((c) => c.name === '문자');
  assert.equal(sms.funding_clicks, 5);
  assert.equal(sms.purchases, 3);
  assert.equal(sms.signups, 0);
  assert.ok(r.channels.some((c) => c.name.startsWith('(직접 방문')));
  assert.deepEqual(r.segments[0].q1, { commute: 1, meeting: 0, cafe: 0, travel: 0, none: 1 });
});
