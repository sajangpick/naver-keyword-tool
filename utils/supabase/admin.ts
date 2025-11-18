import 'server-only';
import { createClient } from '@supabase/supabase-js';

// 서버 전용(Admin 권한) 작업에서만 사용하세요. 브라우저에 노출 금지
export const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );


