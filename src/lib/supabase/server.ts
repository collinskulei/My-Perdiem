/**
 * @file This file handles initialization of the server-side Supabase client, used in
 * Server Components, Route Handlers, and middleware to read the cookie-backed session.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client bound to the current request's cookies.
 * Must be called fresh per-request (Server Components can't share a singleton here).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component that can't set cookies (e.g. a page
            // render without a surrounding middleware refresh) - safe to ignore,
            // since the middleware below keeps the session cookie fresh.
          }
        },
      },
    }
  );
}
