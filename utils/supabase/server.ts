import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server Components / Route Handlers에서 사용하는 Supabase 클라이언트
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 컨텍스트에서는 setAll이 무시될 수 있음
          }
        },
      },
    }
  );
}


