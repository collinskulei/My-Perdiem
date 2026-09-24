/**
 * @file This file contains helper functions for interacting with the Postgres
 * tables in Supabase. It abstracts the logic for common database operations
 * like getting and adding rows, and maps between the app's camelCase types
 * (see ../data.ts) and the database's snake_case columns.
 */
import { supabase } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Venue, PerdiemRequest, Participant, AppEvent, AccessTier, Client, WorkType, Document } from '../data';

// --- Generic camelCase <-> snake_case row mapping ---

type FieldMap = Record<string, string>;

function toRow<T extends Record<string, any>>(obj: Partial<T>, fieldMap: FieldMap): Record<string, any> {
  const row: Record<string, any> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (obj[camel] !== undefined) {
      row[snake] = obj[camel];
    }
  }
  return row;
}

function fromRow<T>(row: Record<string, any>, fieldMap: FieldMap): T {
  const obj: Record<string, any> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    obj[camel] = row[snake] ?? undefined;
  }
  return obj as T;
}

// PostgREST caps an unpaginated `select('*')` at 1000 rows by default, so
// any table that can grow past that (perdiem_requests, events, participants)
// needs to page through with .range() or silently truncates - see
// MILESTONE_HANDOFF.md's note on the Insights dashboard undercount this caused.
const FETCH_ALL_PAGE_SIZE = 1000;

// Caps how many 1000-row pages fetchAllRows requests at once - see that
// function's comment for the real incident (~29 pages fired in a single
// Promise.all overloading Supabase, individual pages taking up to 16.5s
// under that load instead of ~2-3s in isolation) that this guards against.
const PAGE_FETCH_CONCURRENCY = 6;

async function fetchAllRows(table: string, applyFilter?: (query: any) => any, client: SupabaseClient = supabase): Promise<Record<string, any>[]> {
  // Gets a row count first so every page can be requested concurrently
  // below instead of one-at-a-time - with ~9,000+ rows in perdiem_requests
  // that's ~9 pages, and awaiting them sequentially was the dominant cost
  // in every admin dashboard tab's initial load (they all wait on the same
  // fetchAllData() call regardless of which tab is actually being viewed),
  // not just Insights.
  //
  // Uses `count: 'estimated'`, not `'exact'` - an exact count under RLS has
  // to evaluate the row policy (which calls security-definer functions like
  // can_access_client()) for every single row just to produce a number, and
  // on perdiem_requests once it grew past ~11,000 rows that alone exceeded
  // Supabase's statement timeout, throwing before a single row was fetched
  // (silently emptying every admin dashboard tab, with the real error only
  // visible in Vercel's runtime logs, not the browser). 'estimated' uses the
  // planner's statistics instead of a real scan, so it's always fast, but
  // can be stale - especially right after a large bulk import, before an
  // autovacuum has re-analyzed the table. So it's only trusted as a
  // starting guess for how many pages to request in the first parallel
  // batch below, never as the final word: the loop keeps requesting
  // further pages for as long as the last one came back completely full,
  // and only stops once a genuinely short (or empty) page proves there's
  // nothing left - a stale underestimate can slow the first batch down by
  // one extra round trip, but can never silently drop rows.
  //
  // `client` defaults to the browser singleton but can be swapped for a
  // per-request server client (see supabase/server.ts) so the same
  // pagination/mapping logic can run during the initial server render - see
  // admin/get-initial-dashboard-data.ts.
  let countQuery = client.from(table).select('*', { count: 'estimated', head: true });
  if (applyFilter) {
    countQuery = applyFilter(countQuery);
  }
  const { count, error: countError } = await countQuery;
  if (countError) {
    throw countError;
  }

  // Real incident (perdiem_requests at ~28,000 rows, ~29 pages): firing
  // every page in one Promise.all overloads Supabase under concurrent
  // RLS-evaluated queries - individual pages that took ~2-3s in isolation
  // were independently measured taking up to 16.5s each under that load,
  // and Promise.all rejects the instant *any single* page fails or times
  // out, discarding every already-fetched page with it. The caller's own
  // try/catch (see getPerDiemRequests etc.) then silently turns that
  // rejection into an empty array - which is what "dashboard loads fine,
  // shows nothing, no error" actually was; nothing wrong with the data.
  //
  // Fixed two ways: pages are requested in small concurrent waves (bounded
  // by PAGE_FETCH_CONCURRENCY, not "every page at once"), which is both far
  // gentler on Supabase and closer to what a browser does anyway (~6
  // concurrent connections per origin); and a single page that still fails
  // gets a couple of short retries before giving up, since the failures
  // observed were transient contention, not a permanent error.
  const fetchPage = async (from: number): Promise<Record<string, any>[]> => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let query = client.from(table).select('*').range(from, from + FETCH_ALL_PAGE_SIZE - 1);
      if (applyFilter) {
        query = applyFilter(query);
      }
      const { data, error } = await query;
      if (!error) {
        return data ?? [];
      }
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    return []; // unreachable - satisfies TypeScript's control-flow analysis
  };

  const estimatedTotal = count ?? 0;
  let pageStarts = Array.from(
    { length: Math.max(1, Math.ceil(estimatedTotal / FETCH_ALL_PAGE_SIZE)) },
    (_, i) => i * FETCH_ALL_PAGE_SIZE
  );

  const allRows: Record<string, any>[] = [];
  while (pageStarts.length > 0) {
    const pages: Record<string, any>[][] = [];
    for (let i = 0; i < pageStarts.length; i += PAGE_FETCH_CONCURRENCY) {
      const wave = pageStarts.slice(i, i + PAGE_FETCH_CONCURRENCY);
      pages.push(...(await Promise.all(wave.map(fetchPage))));
    }
    for (const page of pages) {
      allRows.push(...page);
    }
    const lastPage = pages[pages.length - 1];
    pageStarts = lastPage.length === FETCH_ALL_PAGE_SIZE
      ? [pageStarts[pageStarts.length - 1] + FETCH_ALL_PAGE_SIZE]
      : [];
  }

  return allRows;
}

const PARTICIPANT_FIELDS: FieldMap = {
  id: 'id',
  name: 'name',
  phoneNumber: 'phone_number',
  idNumber: 'id_number',
  participantNumber: 'participant_number',
  designation: 'designation',
  accessTier: 'access_tier',
  clientId: 'client_id',
  disabledAt: 'disabled_at',
  dutyStation: 'duty_station',
  avatarUrl: 'avatar_url',
  email: 'email',
  jobGroup: 'job_group',
  organizationName: 'organization_name',
};

const EVENT_FIELDS: FieldMap = {
  id: 'id',
  clientId: 'client_id',
  name: 'name',
  createdAt: 'created_at',
  eventDates: 'event_dates',
  eventType: 'event_type',
  venueId: 'venue_id',
  venueName: 'venue_name',
  venueCity: 'venue_city',
  facilitator: 'facilitator',
  checkinStartTime: 'checkin_start_time',
  checkinEndTime: 'checkin_end_time',
  jobGroupAllowances: 'job_group_allowances',
  allocatedParticipants: 'allocated_participants',
  unregisteredParticipants: 'unregistered_participants',
  checkedInParticipants: 'checked_in_participants',
  programUrl: 'program_url',
  letterUrl: 'letter_url',
  trainingStartDate: 'training_start_date',
  trainingEndDate: 'training_end_date',
  numberOfTrainingDays: 'number_of_training_days',
};

const REQUEST_FIELDS: FieldMap = {
  id: 'id',
  clientId: 'client_id',
  participantId: 'participant_id',
  participantName: 'participant_name',
  participantPhone: 'participant_phone',
  participantIdNumber: 'participant_id_number',
  importedAt: 'imported_at',
  notes: 'notes',
  flagReason: 'flag_reason',
  eventId: 'event_id',
  eventName: 'event_name',
  location: 'location',
  date: 'date',
  status: 'status',
  transactionCode: 'transaction_code',
  rejectionReason: 'rejection_reason',
  amendmentReason: 'amendment_reason',
  originalTotal: 'original_total',
  recoveredAmount: 'recovered_amount',
  isOverpayment: 'is_overpayment',
  mileageKm: 'mileage_km',
  mileageTotal: 'mileage_total',
  airTicketCost: 'air_ticket_cost',
  boardingPassUrl: 'boarding_pass_url',
  boardingPassFilename: 'boarding_pass_filename',
  groundTransferCost: 'ground_transfer_cost',
  airTicketUrl: 'air_ticket_url',
  airTicketFilename: 'air_ticket_filename',
  groundTransferUrl: 'ground_transfer_url',
  groundTransferFilename: 'ground_transfer_filename',
  accommodationNights: 'accommodation_nights',
  accommodationTotal: 'accommodation_total',
  outOfOfficeAllowance: 'out_of_office_allowance',
  totalPerdiem: 'total_perdiem',
  transportAllowance: 'transport_allowance',
  dsaAllowance: 'dsa_allowance',
  employer: 'employer',
  dhaStaff: 'dha_staff',
  mohStaff: 'moh_staff',
  knhStaff: 'knh_staff',
  shaStaff: 'sha_staff',
  otherStaff: 'other_staff',
};

// --- VENUES TABLE ---
// (Venue field names already match their column names, so no mapping is needed.)

/**
 * Fetches all venues from the 'venues' table.
 * @returns {Promise<Venue[]>} A promise that resolves to an array of venue objects.
 */
export const getVenues = async (client: SupabaseClient = supabase): Promise<Venue[]> => {
  const { data, error } = await client.from('venues').select('*');
  if (error) {
    console.error("Error fetching venues: ", error);
    return [];
  }
  return (data ?? []) as Venue[];
};

/**
 * Fetches a single venue by its ID.
 * @param {string} id - The row ID of the venue.
 * @returns {Promise<Venue | null>} A promise that resolves to the venue object or null if not found.
 */
export const getVenueById = async (id: string): Promise<Venue | null> => {
  const { data, error } = await supabase.from('venues').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error("Error fetching venue by ID: ", error);
    return null;
  }
  return (data as Venue) ?? null;
};

/**
 * The data required to create a new venue, excluding the auto-generated ID.
 */
export type VenueData = Omit<Venue, 'id'>;

/**
 * Adds a new venue row to the 'venues' table.
 * @param {VenueData} venue - The venue data to add.
 * @returns {Promise<string>} A promise that resolves to the new row's ID.
 */
export const addVenue = async (venue: VenueData): Promise<string> => {
  const { data, error } = await supabase.from('venues').insert(venue).select('id').single();
  if (error || !data) {
    throw error ?? new Error('Failed to add venue');
  }
  return data.id;
};

/**
 * Updates a venue's row in the 'venues' table.
 * @param {string} venueId - The venue's unique ID.
 * @param {Partial<VenueData>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the row is successfully updated.
 */
export const updateVenue = async (venueId: string, dataToUpdate: Partial<VenueData>): Promise<void> => {
  const { error } = await supabase.from('venues').update(dataToUpdate).eq('id', venueId);
  if (error) {
    throw error;
  }
};

// --- PARTICIPANTS TABLE ---

/**
 * Fetches all participants from the 'participants' table.
 * @returns {Promise<Participant[]>} A promise that resolves to an array of participant objects.
 */
export const getParticipants = async (client: SupabaseClient = supabase): Promise<Participant[]> => {
  try {
    const data = await fetchAllRows('participants', undefined, client);
    return data.map((row) => fromRow<Participant>(row, PARTICIPANT_FIELDS));
  } catch (error) {
    // Re-thrown, not swallowed into [] - see fetchAllRows' comment for the
    // real incident this caused: a genuine fetch failure silently looked
    // exactly like "zero participants", no error shown anywhere in the
    // browser. Callers (fetchAllData in admin-dashboard.tsx,
    // getInitialAdminDashboardData) already have their own error handling
    // that surfaces this properly instead.
    console.error("Error fetching participants: ", error);
    throw error;
  }
};

/**
 * Fetches a single participant from the 'participants' table by their ID (auth UID).
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<Participant | null>} A promise that resolves to the participant object or null if not found.
 */
export const getParticipantById = async (uid: string): Promise<Participant | null> => {
  const { data, error } = await supabase.from('participants').select('*').eq('id', uid).maybeSingle();
  if (error) {
    console.error("Error fetching participant by ID: ", error);
    return null;
  }
  return data ? fromRow<Participant>(data, PARTICIPANT_FIELDS) : null;
};

/**
 * The data required to create a new participant, excluding the auto-generated ID.
 * `accessTier` is optional - self-registration always creates a `client_user` (the
 * database default and the only value the insert policy allows for a self-signup).
 */
export type ParticipantData = Omit<Participant, 'id' | 'avatarUrl' | 'accessTier'> & {
  accessTier?: AccessTier;
};

/**
 * Adds a new participant or admin row to the 'participants' table.
 * The row ID is set to the user's UID from Supabase Auth.
 * After creation, it retroactively allocates the user to events they were pre-assigned to.
 * @param {ParticipantData} userData - The user data to add.
 * @param {string} uid - The user's unique ID from Supabase Auth.
 * @returns {Promise<void>} A promise that resolves when the row is successfully created.
 */
export const addParticipant = async (userData: ParticipantData, uid: string): Promise<void> => {
  const row = toRow<Participant>({ ...userData, id: uid } as Participant, PARTICIPANT_FIELDS);
  row.avatar_url = `https://picsum.photos/seed/${uid}/100/100`;

  // 1. Save the new participant's data
  const { error } = await supabase.from('participants').insert(row);
  if (error) {
    throw error;
  }

  // 2. Retroactively allocate to events
  try {
    const shortPhoneNumber = userData.phoneNumber.slice(-9); // e.g., 712345678
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, allocated_participants, unregistered_participants')
      .contains('unregistered_participants', [{ name: userData.name, phoneNumber: shortPhoneNumber }]);

    if (eventsError) {
      throw eventsError;
    }

    for (const event of events ?? []) {
      const allocated = new Set<string>(event.allocated_participants ?? []);
      allocated.add(uid);
      const unregistered = (event.unregistered_participants ?? []).filter(
        (up: { name: string; phoneNumber: string }) =>
          !(up.name === userData.name && up.phoneNumber === shortPhoneNumber)
      );

      const { error: updateError } = await supabase
        .from('events')
        .update({ allocated_participants: Array.from(allocated), unregistered_participants: unregistered })
        .eq('id', event.id);
      if (updateError) {
        throw updateError;
      }
    }
  } catch (error) {
    console.error("Error during retroactive event allocation: ", error);
    // We don't re-throw the error, as the main registration was successful.
    // This process can be considered a best-effort enhancement.
  }
};

/**
 * Updates a participant's row in the 'participants' table.
 * @param {string} uid - The user's unique ID.
 * @param {Partial<Participant>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the row is successfully updated.
 */
export const updateParticipant = async (uid: string, dataToUpdate: Partial<Participant>): Promise<void> => {
  const row = toRow(dataToUpdate, PARTICIPANT_FIELDS);
  const { error } = await supabase.from('participants').update(row).eq('id', uid);
  if (error) {
    throw error;
  }
};

// --- UNIQUENESS CHECKS ---

/**
 * Checks if an email is unique in the 'participants' table.
 * @param {string} email - The email to check.
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
export const isEmailUnique = async (email: string): Promise<boolean> => {
  const { data, error } = await supabase.from('participants').select('id').eq('email', email).limit(1);
  if (error) {
    throw error;
  }
  return (data ?? []).length === 0;
};

/**
 * Checks if an ID number is unique in the 'participants' table.
 * @param {string} idNumber - The ID number to check.
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
export const isIdNumberUnique = async (idNumber: string): Promise<boolean> => {
  const { data, error } = await supabase.from('participants').select('id').eq('id_number', idNumber).limit(1);
  if (error) {
    throw error;
  }
  return (data ?? []).length === 0;
};

/**
 * Checks if a phone number is unique in the 'participants' table.
 * @param {string} phoneNumber - The phone number to check.
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
export const isPhoneNumberUnique = async (phoneNumber: string): Promise<boolean> => {
  const { data, error } = await supabase.from('participants').select('id').eq('phone_number', phoneNumber).limit(1);
  if (error) {
    throw error;
  }
  return (data ?? []).length === 0;
};

// --- EVENTS TABLE ---

/**
 * The data required to create a new event, excluding the auto-generated ID.
 */
export type EventData = Omit<AppEvent, 'id'>;

/**
 * Adds a new event row to the 'events' table.
 * @param {Partial<AppEvent>} event - The event data to add.
 * @returns {Promise<string>} A promise that resolves to the new row's ID.
 */
export const addEvent = async (event: Partial<AppEvent>): Promise<string> => {
  const row = toRow(event, EVENT_FIELDS);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from('events').insert(row).select('id').single();
  if (error || !data) {
    throw error ?? new Error('Failed to add event');
  }
  return data.id;
};

/**
 * Adds a new event row to the 'events' table with a specific ID.
 * @param {string} eventId - The custom ID for the event row.
 * @param {Partial<AppEvent>} event - The event data to add.
 * @returns {Promise<void>}
 */
export const addEventWithId = async (eventId: string, event: Partial<AppEvent>): Promise<void> => {
  const row = toRow(event, EVENT_FIELDS);
  row.id = eventId;
  const { error } = await supabase.from('events').insert(row);
  if (error) {
    throw error;
  }
};

/**
 * Fetches all events from the 'events' table.
 * @returns {Promise<AppEvent[]>}
 */
export const getEvents = async (client: SupabaseClient = supabase): Promise<AppEvent[]> => {
  try {
    const data = await fetchAllRows('events', undefined, client);
    return data.map((row) => fromRow<AppEvent>(row, EVENT_FIELDS));
  } catch (error) {
    // Re-thrown, not swallowed - see getParticipants above and
    // fetchAllRows' comment for why.
    console.error("Error fetching events: ", error);
    throw error;
  }
};

/**
 * Fetches events allocated to a specific participant.
 * @param {string} participantId - The ID of the participant.
 * @returns {Promise<AppEvent[]>}
 */
export const getEventsByParticipant = async (participantId: string): Promise<AppEvent[]> => {
  const { data, error } = await supabase.from('events').select('*').contains('allocated_participants', [participantId]);
  if (error) {
    console.error("Error fetching events for participant: ", error);
    return [];
  }
  return (data ?? []).map((row) => fromRow<AppEvent>(row, EVENT_FIELDS));
};

/**
 * Fetches a single event by its ID.
 * @param {string} eventId - The row ID of the event.
 * @returns {Promise<AppEvent | null>} A promise that resolves to the event object or null if not found.
 */
export const getEventById = async (eventId: string): Promise<AppEvent | null> => {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) {
    console.error("Error fetching event by ID: ", error);
    return null;
  }
  return data ? fromRow<AppEvent>(data, EVENT_FIELDS) : null;
};

/**
 * Updates an event's row in the 'events' table.
 * @param {string} eventId - The event's unique ID.
 * @param {Partial<AppEvent>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the row is successfully updated.
 */
export const updateEvent = async (eventId: string, dataToUpdate: Partial<AppEvent>): Promise<void> => {
  const row = toRow(dataToUpdate, EVENT_FIELDS);
  const { error } = await supabase.from('events').update(row).eq('id', eventId);
  if (error) {
    throw error;
  }
};

/**
 * Deletes an event from the 'events' table.
 * @param {string} eventId - The ID of the event to delete.
 * @returns {Promise<void>}
 */
export const deleteEvent = async (eventId: string): Promise<void> => {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) {
    throw error;
  }
};

/**
 * Records the current session's own check-in for a specific event on a
 * specific date, via the check_in_to_event RPC (see
 * 0017_fix_event_update_rls_gap.sql) - always the caller's own auth.uid(),
 * never an arbitrary participant, and restricted server-side to events
 * they're actually allocated to. Deliberately not a plain table update:
 * events RLS only allows admins to update the row directly, so a
 * participant checking themselves in has to go through this
 * SECURITY DEFINER RPC instead.
 * @param {string} eventId - The ID of the event.
 * @param {string} dateString - The date of the check-in in 'yyyy-MM-dd' format.
 * @returns {Promise<void>}
 */
export const checkInToEvent = async (eventId: string, dateString: string): Promise<void> => {
  const { error } = await supabase.rpc('check_in_to_event', { p_event_id: eventId, p_check_in_date: dateString });
  if (error) {
    throw error;
  }
};

// --- PER DIEM REQUESTS TABLE ---

/**
 * A fast, standalone row-count estimate (same `count: 'estimated'` PostgREST
 * query fetchAllRows uses internally to size its first page batch - see that
 * function's comment for why 'estimated', not 'exact'). Used by
 * get-initial-dashboard-data.ts to decide, before fetching anything, whether
 * a full server-side prefetch of this table is still cheap enough to be
 * worth doing - see that file's comment for the real incident (28,000+ rows,
 * ~2-3s per 1,000-row page) this guards against.
 */
export const getPerDiemRequestsCountEstimate = async (client: SupabaseClient = supabase): Promise<number> => {
  const { count, error } = await client.from('perdiem_requests').select('*', { count: 'estimated', head: true });
  if (error) {
    throw error;
  }
  return count ?? 0;
};

export type PerdiemOverviewStats = {
  totalRequests: number;
  pendingRequests: number;
  totalPaidOut: number;
};

/**
 * Total/pending request counts and total paid out, aggregated inside
 * Postgres (see migration 0025_overview_stats_rpc.sql) instead of by
 * fetching every row and summing client-side - what admin-overview-tab.tsx
 * uses instead of getPerDiemRequests() for its three requests-table-derived
 * stat cards, so the landing page doesn't wait on the full (29,000+ row)
 * table fetch just to show three numbers. clientId null asks for every
 * client this caller's RLS allows (Super/Master Admin); the RPC itself is
 * `security invoker`, so a Client Admin's own tenant scoping applies
 * automatically either way - no separate access check needed here.
 */
export const getPerdiemOverviewStats = async (clientId: string | null = null, client: SupabaseClient = supabase): Promise<PerdiemOverviewStats> => {
  const { data, error } = await client
    .rpc('get_perdiem_overview_stats', { target_client_id: clientId })
    .single<{ total_requests: number; pending_requests: number; total_paid_out: number }>();
  if (error || !data) {
    console.error("Error fetching perdiem overview stats: ", error);
    throw error ?? new Error('get_perdiem_overview_stats did not return a result');
  }
  return {
    totalRequests: Number(data.total_requests),
    pendingRequests: Number(data.pending_requests),
    totalPaidOut: Number(data.total_paid_out),
  };
};

/**
 * Insights tab filters, as the RPCs in 0026_insights_stats_rpc.sql take
 * them: eventIds null = no event filter (an empty array matches nothing),
 * dates as inclusive 'YYYY-MM-DD' strings.
 */
export type InsightsFilters = {
  eventIds: string[] | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export type InsightsAmendedRow = {
  id: string;
  clientId: string;
  participantName: string;
  eventName: string;
  date: string;
  amendmentReason?: string;
  totalPerdiem: number;
  originalTotal?: number;
  recoveredAmount: number;
  isOverpayment: boolean;
};

export type InsightsStats = {
  totals: { requestCount: number; totalPerdiem: number; totalPaidOut: number; amendmentDelta: number };
  byStatus: { status: string; count: number; amount: number }[];
  byClient: { clientId: string | null; requestCount: number; totalPaid: number }[];
  monthlyByClient: { clientId: string | null; month: string; count: number; amount: number }[];
  daily: { day: string; count: number }[];
  allowances: { mileage: number; accommodation: number; outOfOffice: number; airTicket: number; groundTransfer: number; transport: number; dsa: number };
  /** Counts per bucket, same order as AMOUNT_BUCKETS in insights/financial.tsx. */
  histogram: number[];
  amendedRows: InsightsAmendedRow[];
  staffByStatus: { category: string; status: string; count: number }[];
  topEmployers: { name: string; value: number }[];
  trainingPoints: { days: number; amount: number }[];
  eventIdsInRange: string[] | null;
  years: string[];
};

/**
 * Every requests-derived number the Insights tab shows, aggregated inside
 * Postgres (see migration 0026_insights_stats_rpc.sql) instead of by
 * summing the full perdiem_requests array in the browser. `security
 * invoker`, so RLS scoping applies exactly as it does to getPerDiemRequests().
 */
export const getInsightsStats = async (filters: InsightsFilters, trendFrom: string, client: SupabaseClient = supabase): Promise<InsightsStats> => {
  const { data, error } = await client.rpc('get_insights_stats', {
    p_event_ids: filters.eventIds,
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_trend_from: trendFrom,
  });
  if (error || !data) {
    console.error("Error fetching insights stats: ", error);
    throw error ?? new Error('get_insights_stats did not return a result');
  }
  const d = data as Record<string, any>;
  return {
    totals: {
      requestCount: Number(d.totals.request_count),
      totalPerdiem: Number(d.totals.total_perdiem),
      totalPaidOut: Number(d.totals.total_paid_out),
      amendmentDelta: Number(d.totals.amendment_delta),
    },
    byStatus: d.by_status.map((s: any) => ({ status: s.status, count: Number(s.count), amount: Number(s.amount) })),
    byClient: d.by_client.map((c: any) => ({ clientId: c.client_id, requestCount: Number(c.request_count), totalPaid: Number(c.total_paid) })),
    monthlyByClient: d.monthly_by_client.map((m: any) => ({ clientId: m.client_id, month: m.month, count: Number(m.count), amount: Number(m.amount) })),
    daily: d.daily.map((x: any) => ({ day: x.day, count: Number(x.count) })),
    allowances: {
      mileage: Number(d.allowances.mileage),
      accommodation: Number(d.allowances.accommodation),
      outOfOffice: Number(d.allowances.out_of_office),
      airTicket: Number(d.allowances.air_ticket),
      groundTransfer: Number(d.allowances.ground_transfer),
      transport: Number(d.allowances.transport),
      dsa: Number(d.allowances.dsa),
    },
    histogram: d.histogram.map(Number),
    amendedRows: d.amended_rows.map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      participantName: r.participant_name,
      eventName: r.event_name,
      date: r.date,
      amendmentReason: r.amendment_reason ?? undefined,
      totalPerdiem: Number(r.total_perdiem),
      originalTotal: r.original_total == null ? undefined : Number(r.original_total),
      recoveredAmount: Number(r.recovered_amount ?? 0),
      isOverpayment: !!r.is_overpayment,
    })),
    staffByStatus: d.staff_by_status.map((s: any) => ({ category: s.category, status: s.status, count: Number(s.count) })),
    topEmployers: d.top_employers.map((e: any) => ({ name: e.name, value: Number(e.value) })),
    trainingPoints: d.training_points.map((p: any) => ({ days: Number(p.days), amount: Number(p.amount) })),
    eventIdsInRange: d.event_ids_in_range ?? null,
    years: d.years,
  };
};

export type InsightsSearchResult = {
  matchCount: number;
  totalPaid: number;
  totalAll: number;
  rows: Pick<PerdiemRequest, 'id' | 'clientId' | 'participantName' | 'participantPhone' | 'eventName' | 'date' | 'status' | 'totalPerdiem'>[];
};

/**
 * Participant Lookup's name/phone search, run in Postgres (see
 * search_insights_requests in 0026_insights_stats_rpc.sql) - matchCount and
 * the totals cover every match, rows only the first `limit` (newest first).
 */
export const searchInsightsRequests = async (
  query: string,
  filters: InsightsFilters | null,
  limit: number,
  client: SupabaseClient = supabase
): Promise<InsightsSearchResult> => {
  const { data, error } = await client.rpc('search_insights_requests', {
    p_query: query,
    p_event_ids: filters?.eventIds ?? null,
    p_date_from: filters?.dateFrom ?? null,
    p_date_to: filters?.dateTo ?? null,
    p_limit: limit,
  });
  if (error || !data) {
    console.error("Error searching insights requests: ", error);
    throw error ?? new Error('search_insights_requests did not return a result');
  }
  const d = data as Record<string, any>;
  return {
    matchCount: Number(d.match_count),
    totalPaid: Number(d.total_paid),
    totalAll: Number(d.total_all),
    rows: d.rows.map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      participantName: r.participant_name,
      participantPhone: r.participant_phone ?? undefined,
      eventName: r.event_name,
      date: r.date,
      status: r.status,
      totalPerdiem: Number(r.total_perdiem),
    })),
  };
};

/**
 * Fetches all per diem requests from the 'perdiem_requests' table.
 * @returns {Promise<PerdiemRequest[]>} A promise that resolves to an array of per diem request objects.
 */
export const getPerDiemRequests = async (client: SupabaseClient = supabase): Promise<PerdiemRequest[]> => {
  try {
    const data = await fetchAllRows('perdiem_requests', undefined, client);
    return data.map((row) => fromRow<PerdiemRequest>(row, REQUEST_FIELDS));
  } catch (error) {
    // Re-thrown, not swallowed - this is the exact function behind the
    // "dashboard loads fine but shows zero per-diem data, no error" incident
    // (see fetchAllRows' comment). Swallowing it into [] made a real fetch
    // failure indistinguishable from "this client genuinely has no data".
    console.error("Error fetching per diem requests: ", error);
    throw error;
  }
};

/**
 * Fetches every per diem request for one client - used by the historical
 * import dialog's Preview step to detect repeat payments (same
 * participant/event/date, different amount) against records already in the
 * database, not just other rows in the file being uploaded, before asking
 * the admin to resolve each one (see HistoricalImportRow.mergeDecision).
 * @param {string} clientId
 * @returns {Promise<PerdiemRequest[]>}
 */
export const getPerDiemRequestsByClient = async (clientId: string): Promise<PerdiemRequest[]> => {
  try {
    const data = await fetchAllRows('perdiem_requests', (q) => q.eq('client_id', clientId));
    return data.map((row) => fromRow<PerdiemRequest>(row, REQUEST_FIELDS));
  } catch (error) {
    console.error("Error fetching per diem requests for client: ", error);
    return [];
  }
};

/**
 * Fetches per diem requests for a specific participant.
 * @param {string} participantId - The ID of the participant whose requests are to be fetched.
 * @returns {Promise<PerdiemRequest[]>} A promise that resolves to an array of per diem request objects.
 */
export const getPerDiemRequestsByParticipant = async (participantId: string): Promise<PerdiemRequest[]> => {
  const { data, error } = await supabase.from('perdiem_requests').select('*').eq('participant_id', participantId);
  if (error) {
    console.error("Error fetching participant per diem requests: ", error);
    return [];
  }
  return (data ?? []).map((row) => fromRow<PerdiemRequest>(row, REQUEST_FIELDS));
};

/**
 * The data required to create a new per diem request, excluding the auto-generated ID.
 */
export type PerDiemRequestData = Omit<PerdiemRequest, 'id'>;

/**
 * Adds a new per diem request row to the 'perdiem_requests' table.
 * @param {PerDiemRequestData} request - The request data to add.
 * @returns {Promise<string>} A promise that resolves to the new row's ID.
 */
export const addPerDiemRequest = async (request: PerDiemRequestData): Promise<string> => {
  const row = toRow(request, REQUEST_FIELDS);
  const { data, error } = await supabase.from('perdiem_requests').insert(row).select('id').single();
  if (error || !data) {
    throw error ?? new Error('Failed to add per diem request');
  }
  return data.id;
};

/**
 * Updates a per diem request row in the 'perdiem_requests' table.
 * @param {string} requestId - The request's unique ID.
 * @param {Partial<PerdiemRequest>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the row is successfully updated.
 */
export const updatePerDiemRequest = async (requestId: string, dataToUpdate: Partial<PerdiemRequest>): Promise<void> => {
  const row = toRow(dataToUpdate, REQUEST_FIELDS);
  const { error } = await supabase.from('perdiem_requests').update(row).eq('id', requestId);
  if (error) {
    throw error;
  }
};

/**
 * Marks all "Approved" per diem requests for a specific event as "Paid" in a single update.
 * @param {string} eventId - The ID of the event to process.
 * @param {string} transactionCode - The transaction code for the bulk payment.
 * @returns {Promise<void>}
 */
export const markEventAsPaid = async (eventId: string, transactionCode: string): Promise<void> => {
  const { error } = await supabase
    .from('perdiem_requests')
    .update({ status: 'Paid', transaction_code: transactionCode })
    .eq('event_id', eventId)
    .eq('status', 'Approved');
  if (error) {
    throw error;
  }
};

// --- CLIENTS TABLE ---

/**
 * Fetches all clients visible to the caller (Master/Super Admins see all;
 * RLS returns nothing for Client Admins/Users, who don't need this list).
 * @returns {Promise<Client[]>}
 */
export const getClients = async (client: SupabaseClient = supabase): Promise<Client[]> => {
  const { data, error } = await client
    .from('clients')
    .select('id, name, slug, onedrive_drive_id, onedrive_folder_id, onedrive_folder_link')
    .order('name');
  if (error) {
    console.error("Error fetching clients: ", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    onedriveDriveId: row.onedrive_drive_id,
    onedriveFolderId: row.onedrive_folder_id,
    onedriveFolderLink: row.onedrive_folder_link,
  }));
};

/**
 * Looks up a client's display name by ID without requiring an authenticated
 * session or client-membership - used to validate a registration invite link
 * before the user has signed up. Backed by a SECURITY DEFINER RPC.
 * @param {string} clientId - The client ID from the registration link.
 * @returns {Promise<string | null>} The client's name, or null if the ID is invalid/archived.
 */
export const getPublicClientName = async (clientId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('get_public_client_name', { target_client: clientId });
  if (error) {
    console.error("Error looking up client: ", error);
    return null;
  }
  return data ?? null;
};

/**
 * Resolves a client-admin portal's URL slug (e.g. "apeiro" from
 * /apeiro-admin) to the client's ID and name, without requiring an
 * authenticated session - used by the portal's login page to display the
 * client's name and, post-auth, to confirm the signed-in Client Admin
 * belongs to this client. Backed by a SECURITY DEFINER RPC.
 * @param {string} slug - The slug segment from the portal URL.
 * @returns {Promise<{ id: string; name: string } | null>} The matching client, or null if the slug is unknown/archived.
 */
export const getClientBySlug = async (slug: string): Promise<{ id: string; name: string } | null> => {
  const { data, error } = await supabase.rpc('get_client_by_slug', { target_slug: slug });
  if (error) {
    console.error("Error looking up client by slug: ", error);
    return null;
  }
  return data?.[0] ?? null;
};

/**
 * Creates a new client (tenant). RLS already restricts this to Super Admin
 * and above, so - unlike the admin-invite flow - no service-role API route
 * is needed here.
 * @param {string} name - The new client's display name.
 * @returns {Promise<string>} The new client's ID.
 */
export const addClient = async (name: string): Promise<string> => {
  const { data, error } = await supabase.from('clients').insert({ name }).select('id').single();
  if (error || !data) {
    throw error ?? new Error('Failed to add client');
  }
  return data.id;
};

/**
 * Permanently deletes a client. RLS restricts this to Super Admin and above.
 * Only succeeds if nothing (participants, events, per-diem requests, work
 * types, documents) still references this client - the database's own
 * foreign-key constraints are the real safety net here, not an
 * application-level check, so a client with any real data attached will
 * reject this with a foreign-key-violation error (Postgres code 23503)
 * instead of silently cascading. Callers should catch that and suggest
 * archiving instead for clients that actually have data.
 * @param {string} clientId - The client to delete.
 * @returns {Promise<void>}
 */
export const deleteClient = async (clientId: string): Promise<void> => {
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) {
    if (error.code === '23503') {
      throw new Error('This client still has participants, events, or other data attached - archive it instead of deleting.');
    }
    throw error;
  }
};

// --- WORK TYPES TABLE ---

/**
 * Fetches the (non-archived) work types for a client.
 * @param {string} clientId - The client to fetch work types for.
 * @returns {Promise<WorkType[]>}
 */
export const getWorkTypesByClient = async (clientId: string): Promise<WorkType[]> => {
  const { data, error } = await supabase
    .from('work_types')
    .select('id, client_id, name')
    .eq('client_id', clientId)
    .is('archived_at', null)
    .order('name');
  if (error) {
    console.error("Error fetching work types: ", error);
    return [];
  }
  return (data ?? []).map((row) => ({ id: row.id, clientId: row.client_id, name: row.name }));
};

/**
 * Adds a new work type for a client. RLS restricts this to Super Admin and above.
 * @param {string} clientId - The client this work type belongs to.
 * @param {string} name - The work type's display name.
 * @returns {Promise<string>} The new work type's ID.
 */
export const addWorkType = async (clientId: string, name: string): Promise<string> => {
  const { data, error } = await supabase
    .from('work_types')
    .insert({ client_id: clientId, name })
    .select('id')
    .single();
  if (error || !data) {
    throw error ?? new Error('Failed to add work type');
  }
  return data.id;
};

/**
 * Archives a work type (soft delete, matching the clients table's pattern).
 * RLS restricts this to Super Admin and above.
 * @param {string} workTypeId - The work type to archive.
 * @returns {Promise<void>}
 */
export const archiveWorkType = async (workTypeId: string): Promise<void> => {
  const { error } = await supabase
    .from('work_types')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', workTypeId);
  if (error) {
    throw error;
  }
};

// --- DOCUMENTS (Milestone 5: OneDrive submission inbox) ---

const mapDocumentRow = (row: any): Document => ({
  id: row.id,
  clientId: row.client_id,
  onedriveItemId: row.onedrive_item_id,
  onedriveFileName: row.onedrive_file_name,
  onedriveWebUrl: row.onedrive_web_url,
  status: row.status,
  onedriveModifiedAt: row.onedrive_modified_at,
  firstSeenAt: row.first_seen_at,
  processedAt: row.processed_at,
  processedBy: row.processed_by,
  notes: row.notes,
});

/**
 * Fetches all documents visible to the caller under RLS (Client Admin sees
 * their own client's submissions; Super/Master Admin see every client's).
 * @returns {Promise<Document[]>}
 */
export const getDocuments = async (client: SupabaseClient = supabase): Promise<Document[]> => {
  const { data, error } = await client
    .from('documents')
    .select('*')
    .order('first_seen_at', { ascending: false });
  if (error) {
    console.error("Error fetching documents: ", error);
    return [];
  }
  return (data ?? []).map(mapDocumentRow);
};

/**
 * Calls the server-only sync route to pull a client's OneDrive folder
 * listing into the documents table. Client Admin callers may only sync
 * their own client - the server ignores/overrides clientId for them.
 * @param {string} [clientId] - The client to sync (required for Super/Master Admin, ignored for Client Admin).
 * @returns {Promise<{ success: boolean; error?: string; count?: number }>}
 */
export const syncClientDocuments = async (
  clientId?: string
): Promise<{ success: boolean; error?: string; count?: number }> => {
  const res = await fetch('/api/admin/documents/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
  const body = await res.json();
  if (!res.ok) {
    return { success: false, error: body.error ?? 'Failed to sync documents' };
  }
  return { success: true, count: body.count };
};

/**
 * Marks a document Processing or Done. RLS restricts this to Super Admin
 * and above - a Client Admin can see status but never update it.
 * @param {string} documentId - The document to update.
 * @param {'processing' | 'done'} status - The new status.
 * @param {string} processedBy - The acting admin's participant ID, recorded when marking Done.
 * @returns {Promise<void>}
 */
export const setDocumentStatus = async (
  documentId: string,
  status: 'processing' | 'done',
  processedBy: string
): Promise<void> => {
  const { error } = await supabase
    .from('documents')
    .update({
      status,
      ...(status === 'done' ? { processed_at: new Date().toISOString(), processed_by: processedBy } : {}),
    })
    .eq('id', documentId);
  if (error) {
    throw error;
  }
};

/**
 * Records a client's existing OneDrive folder (drive ID + folder ID, both
 * from an existing org OneDrive/SharePoint structure - this app never
 * creates OneDrive folders itself). RLS restricts client updates to Super
 * Admin and above, same as other client-management fields.
 * @param {string} clientId - The client to update.
 * @param {string} driveId - The OneDrive/SharePoint drive ID.
 * @param {string} folderId - The folder's item ID within that drive.
 * @param {string} [link] - A browser-openable link to the folder, shown to the Client Admin.
 * @returns {Promise<void>}
 */
export const setClientOneDriveFolder = async (
  clientId: string,
  driveId: string,
  folderId: string,
  link?: string
): Promise<void> => {
  const { error } = await supabase
    .from('clients')
    .update({ onedrive_drive_id: driveId, onedrive_folder_id: folderId, onedrive_folder_link: link ?? null })
    .eq('id', clientId);
  if (error) {
    throw error;
  }
};

// --- ACCESS TIER RPC ---

/**
 * Changes a participant's access tier (and, for client-scoped tiers, their
 * client). This is the only legal way to change either column - direct
 * INSERT/UPDATE of `access_tier`/`client_id` is blocked by a database trigger.
 * The database RPC itself enforces who can assign what (see 0003_tenancy_and_tiers.sql).
 * @param {string} targetParticipantId - The participant whose tier is changing.
 * @param {AccessTier} newTier - The tier to assign.
 * @param {string} [newClientId] - Required when assigning client_admin/client_user.
 * @returns {Promise<void>}
 */
export const setAccessTier = async (
  targetParticipantId: string,
  newTier: AccessTier,
  newClientId?: string
): Promise<void> => {
  const { error } = await supabase.rpc('set_access_tier', {
    target_participant: targetParticipantId,
    new_tier: newTier,
    new_client_id: newClientId ?? null,
  });
  if (error) {
    throw error;
  }
};

// --- HISTORICAL IMPORT (Milestone 4) ---

/**
 * One row of historical per-diem payment data, parsed from an uploaded
 * spreadsheet - matches the shape import_historical_events() expects.
 */
export type HistoricalImportRow = {
  eventName: string;
  // The controlled category (see EVENT_TYPE_CATEGORIES in lib/data.ts) - set
  // explicitly by the import wizard's required batch default, not guessed
  // from eventName. Optional here only so an older/direct caller doesn't hard
  // fail - the RPC itself falls back to a keyword guess when it's blank.
  eventType?: string;
  venueName?: string;
  venueCity?: string;
  venueCounty?: string;
  eventDates?: string[];
  trainingStartDate?: string;
  trainingEndDate?: string;
  numberOfTrainingDays?: number;
  participantName: string;
  participantPhone?: string;
  participantIdNumber?: string;
  status?: string;
  transactionCode?: string;
  notes?: string;
  employer?: string;
  // true when indicated, omitted (never false) when not - see PerdiemRequest
  // in data.ts for why this matters to the importer's gap-filling sync.
  dhaStaff?: boolean;
  mohStaff?: boolean;
  knhStaff?: boolean;
  shaStaff?: boolean;
  otherStaff?: boolean;
  totalPerdiem: number;
  mileageKm?: number;
  mileageTotal?: number;
  accommodationNights?: number;
  accommodationTotal?: number;
  outOfOfficeAllowance?: number;
  airTicketCost?: number;
  groundTransferCost?: number;
  transportAllowance?: number;
  dsaAllowance?: number;
  // Set by the import dialog's Preview step when this row identity-matches
  // (same participant/event/date/phone) another payment at a different
  // amount, and the admin was asked to resolve it explicitly instead of the
  // RPC's default heuristic (flag + insert separate) deciding silently -
  // 'merge' forces a gap-fill merge into the matching record even though
  // amounts differ, 'separate' forces its own row (and gets flag_reason
  // set) even if an automatic amount-match would otherwise have merged it.
  // Omitted (the common case, no conflict detected) leaves the RPC's
  // existing automatic amount-based decision untouched.
  mergeDecision?: 'merge' | 'separate';
  // Optional - most templates won't have these. When a row maps a Payable
  // Amount column and it comes out lower than totalPerdiem, the RPC inserts
  // the row already flagged (status='Amended', originalTotal=payableAmount,
  // isOverpayment=true - see supabase/migrations/0024) instead of the
  // ordinary 'Paid' status, so a file like a finance team's overpayment
  // reconciliation sheet imports pre-flagged instead of needing the Flag
  // Overpayment action run by hand afterward for every row.
  payableAmount?: number;
  overpaymentReason?: string;
  recoveredAmount?: number;
};

/**
 * Imports one batch of historical events + per-diem payments for a client
 * in one atomic call - this batch commits or none of it does. Restricted
 * to Super Admin and above (enforced by the RPC itself, not just the UI).
 * Rows matching an existing payment record (same event + payment date +
 * phone/name + amount, where amount only counts as a mismatch if both
 * sides are non-blank and differ) fill in blanks on that record instead of
 * duplicating it - see updatedCount vs importedCount in the result. A real
 * second payment (same event/date/phone but a different amount) inserts as
 * a new row instead of silently absorbing the second amount into the first
 * record - both that new row and the original get `flagReason` set so it
 * surfaces for manual review instead of looking like an ordinary import.
 *
 * Callers with more than a few hundred rows should split into multiple
 * calls (see admin-historical-import.tsx's BATCH_SIZE) rather than pass
 * everything at once - the whole call is one database transaction doing
 * several queries per row, and a large-enough single call will exceed
 * Supabase's statement timeout and fail with nothing committed. Splitting
 * into batches is safe: the gap-filling sync means retrying/re-running any
 * batch (or the whole import) never duplicates rows already committed by
 * an earlier batch.
 *
 * Returns eventIds (not a pre-summed count) specifically so a caller
 * batching multiple calls can union them into an accurate total - summing
 * per-batch counts would double-count any event touched by more than one
 * batch.
 * @param {string} clientId - The client this historical data belongs to.
 * @param {HistoricalImportRow[]} rows - The parsed, validated rows to import (one batch).
 * @returns {Promise<{ importedCount: number; updatedCount: number; eventIds: string[] }>}
 */
export const importHistoricalEvents = async (
  clientId: string,
  rows: HistoricalImportRow[]
): Promise<{ importedCount: number; updatedCount: number; eventIds: string[] }> => {
  const { data, error } = await supabase
    .rpc('import_historical_events', { target_client_id: clientId, rows })
    .single<{ imported_count: number; updated_count: number; event_ids: string[] }>();
  if (error || !data) {
    throw error ?? new Error('Import did not return a result');
  }
  return { importedCount: data.imported_count, updatedCount: data.updated_count, eventIds: data.event_ids ?? [] };
};
