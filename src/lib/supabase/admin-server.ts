/**
 * @file Service-role Supabase client. Bypasses Row Level Security entirely -
 * only ever call this from Route Handlers/Server Actions, never from a
 * Server Component that renders based on user input, and never export it
 * (or anything built from it) to client code. The `server-only` import
 * makes any accidental client-bundle inclusion a build error instead of a
 * runtime leak.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not set - refusing to create an unauthenticated admin client.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
