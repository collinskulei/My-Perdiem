/**
 * @file This file handles the initialization of the browser-side Supabase client.
 * It uses the cookie-backed @supabase/ssr client (rather than localStorage) so that
 * the session is also visible to Server Components and middleware.
 */
import { createBrowserClient } from '@supabase/ssr';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error(
    "Supabase configuration is missing. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file."
  );
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
);
