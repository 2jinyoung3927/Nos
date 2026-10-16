// 링크 미리보기 봇과 크롤러는 클릭으로 세지 않는다.
const BOT_PATTERN =
  /facebookexternalhit|facebot|kakaotalk-scrap|twitterbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|yeti|naver|daum|googlebot|bingbot|applebot|bot\b|crawler|spider|preview|headless/i;

export function isBot(userAgent) {
  if (!userAgent) return true; // UA 가 없으면 사람 브라우저가 아니라고 본다
  return BOT_PATTERN.test(userAgent);
}

export function deviceOf(userAgent) {
  const ua = userAgent || '';
  if (/iphone|ipod|android.+mobile|mobile/i.test(ua)) return 'mobile';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop';
  return 'other';
}

export function refererHost(referer) {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.slice(0, 100) || null;
  } catch {
    return null;
  }
}
