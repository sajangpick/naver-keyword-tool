'use client';

import { createBrowserClient } from '@supabase/ssr';

// 브라우저(Client Components)에서 사용하는 Supabase 클라이언트
export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );


