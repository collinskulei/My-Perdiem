/**
 * @file Refreshes the Supabase session cookie on every request so Server Components
 * (e.g. the /admin route guard) always see an up-to-date session. Also rewrites the
 * pretty client-admin portal URLs (/<slug>-admin, /<slug>-admin/dashboard) onto the
 * /client-admin/[clientSlug] implementation folder - Next.js doesn't support mixing
 * literal text with a dynamic segment in one folder name, so this is the only way to
 * serve /<slug>-admin without a physical folder per client. (A leading-underscore
 * "private folder" was tried first to also block direct /client-admin/<slug> access,
 * but Next.js excludes private folders from routing entirely, which breaks the
 * rewrite target too - confirmed via a build that silently dropped the route.)
 * "super"/"master" are excluded since those are their own static top-level routes.
 */
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const CLIENT_ADMIN_SLUG_PATTERN = /^\/([a-z0-9][a-z0-9-]*)-admin(\/.*)?$/;
const RESERVED_ADMIN_SLUGS = new Set(['super', 'master']);

export async function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(CLIENT_ADMIN_SLUG_PATTERN);
  let rewriteUrl: URL | null = null;
  if (match && !RESERVED_ADMIN_SLUGS.has(match[1])) {
    rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/client-admin/${match[1]}${match[2] ?? ''}`;
  }
  const freshResponse = () =>
    rewriteUrl ? NextResponse.rewrite(rewriteUrl!, { request }) : NextResponse.next({ request });

  let response = freshResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = freshResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Refreshing the session touches Supabase Auth and must not be removed -
  // it's what keeps the cookie (and therefore server-side reads of it) valid.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
