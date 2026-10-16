'use client';
// 모든 GA 이벤트는 이 함수 하나를 거쳐 보낸다. 측정 ID가 없으면 아무것도 하지 않는다.
export const EVENTS = {
  landing_view: 'landing_view',
  cta_click: 'cta_click',
  form_start: 'form_start',
  prelaunch_signup: 'prelaunch_signup', // 1차 전환: 알림 신청
  funding_click: 'funding_click', // 와디즈로 넘어가는 클릭
};

export function track(name, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch {
    /* 추적 실패가 신청을 막으면 안 된다 */
  }
}
