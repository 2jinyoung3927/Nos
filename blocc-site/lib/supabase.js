import { createClient } from '@supabase/supabase-js';

// 서버 전용. service_role 키는 브라우저로 나가는 코드(클라이언트 컴포넌트)에서 절대 가져오지 않는다.
let client;
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
