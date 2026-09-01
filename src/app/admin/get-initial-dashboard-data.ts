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

/**
 * Returns null on failure so callers fall back to AdminDashboard's existing
 * client-side fetch-on-mount instead of rendering with a known-bad dataset.
 */
export async function getInitialAdminDashboardData(
  client: SupabaseClient
): Promise<InitialAdminDashboardData | null> {
  try {
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
