/**
 * @file Prefetches the admin dashboard's shared dataset (venues, participants,
 * clients, documents, requests, events) during the server render, using the
 * request's own Supabase server client so RLS applies exactly as it would
 * client-side. Called from each portal's dashboard page.tsx
 * (admin/super-admin/master-admin/client-admin) so AdminDashboard can render
 * with data already in hand instead of showing a loading state on first paint.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import * as db from '@/lib/supabase/database';
import { sortRequestsByDateDesc, sortEventsByDateDesc } from '@/lib/data';
import type { Venue, Participant, Client, Document, PerdiemRequest, AppEvent } from '@/lib/data';

export interface InitialAdminDashboardData {
  venues: Venue[];
  participants: Participant[];
  clients: Client[];
  documents: Document[];
  perdiemRequests: PerdiemRequest[];
  events: AppEvent[];
}

// Above this many perdiem_requests rows, prefetching the whole table here
// stops being a UX win. Real incident: this table reached 27,893 rows
// (fetchAllRows needs ~28 sequential-estimate-then-parallel pages of 1,000),
// and a single 1,000-row page was independently measured at 2-3.5s - meaning
// the very first byte of the dashboard's HTML response, for every admin tier
// (there's only one client today, so every tier sees the same volume), was
// blocked on several seconds of Supabase round-trips before Next.js could
// even start streaming the page. That's what "login is slow" actually was -
// not the Supabase Auth sign-in itself, which is unrelated and fast.
//
// Below this threshold, eager server-side prefetch is still a real
// improvement (skips a loading-skeleton flash on first paint), so it stays
// the default - this only kicks in once a table has genuinely outgrown it.
const MAX_EAGER_PERDIEM_REQUESTS = 5000;

/**
 * Returns null on failure (including "too large to prefetch cheaply", see
 * MAX_EAGER_PERDIEM_REQUESTS above) so callers fall back to AdminDashboard's
 * existing client-side fetch-on-mount (a loading skeleton, then the same
 * data filled in from the browser) instead of blocking the server response
 * on a known-slow fetch, or rendering with a known-bad dataset.
 */
export async function getInitialAdminDashboardData(
  client: SupabaseClient
): Promise<InitialAdminDashboardData | null> {
  try {
    const estimatedRequestCount = await db.getPerDiemRequestsCountEstimate(client);
    if (estimatedRequestCount > MAX_EAGER_PERDIEM_REQUESTS) {
      return null;
    }

    const [venues, participants, requests, events, clients, documents] = await Promise.all([
      db.getVenues(client),
      db.getParticipants(client),
      db.getPerDiemRequests(client),
      db.getEvents(client),
      db.getClients(client),
      db.getDocuments(client),
    ]);

    return {
      venues,
      participants,
      clients,
      documents,
      perdiemRequests: sortRequestsByDateDesc(requests),
      events: sortEventsByDateDesc(events),
    };
  } catch (error) {
    console.error('Failed to prefetch admin dashboard data on the server:', error);
    return null;
  }
}
