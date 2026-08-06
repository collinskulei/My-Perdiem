/**
 * @file This file contains helper functions for interacting with the Postgres
 * tables in Supabase. It abstracts the logic for common database operations
 * like getting and adding rows, and maps between the app's camelCase types
 * (see ../data.ts) and the database's snake_case columns.
 */
import { supabase } from './client';
import type { Venue, PerdiemRequest, Participant, AppEvent, AccessTier, Client } from '../data';

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

const PARTICIPANT_FIELDS: FieldMap = {
  id: 'id',
  name: 'name',
  phoneNumber: 'phone_number',
  idNumber: 'id_number',
  participantNumber: 'participant_number',
  designation: 'designation',
  accessTier: 'access_tier',
  clientId: 'client_id',
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
};

const REQUEST_FIELDS: FieldMap = {
  id: 'id',
  clientId: 'client_id',
  participantId: 'participant_id',
  participantName: 'participant_name',
  eventId: 'event_id',
  eventName: 'event_name',
  location: 'location',
  date: 'date',
  status: 'status',
  transactionCode: 'transaction_code',
  rejectionReason: 'rejection_reason',
  amendmentReason: 'amendment_reason',
  originalTotal: 'original_total',
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
};

// --- VENUES TABLE ---
// (Venue field names already match their column names, so no mapping is needed.)

/**
 * Fetches all venues from the 'venues' table.
 * @returns {Promise<Venue[]>} A promise that resolves to an array of venue objects.
 */
export const getVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase.from('venues').select('*');
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

// --- PARTICIPANTS TABLE ---

/**
 * Fetches all participants from the 'participants' table.
 * @returns {Promise<Participant[]>} A promise that resolves to an array of participant objects.
 */
export const getParticipants = async (): Promise<Participant[]> => {
  const { data, error } = await supabase.from('participants').select('*');
  if (error) {
    console.error("Error fetching participants: ", error);
    return [];
  }
  return (data ?? []).map((row) => fromRow<Participant>(row, PARTICIPANT_FIELDS));
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
export const getEvents = async (): Promise<AppEvent[]> => {
  const { data, error } = await supabase.from('events').select('*');
  if (error) {
    console.error("Error fetching events: ", error);
    return [];
  }
  return (data ?? []).map((row) => fromRow<AppEvent>(row, EVENT_FIELDS));
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
 * Records a participant's check-in for a specific event on a specific date.
 * @param {string} eventId - The ID of the event.
 * @param {string} participantId - The ID of the participant checking in.
 * @param {string} dateString - The date of the check-in in 'yyyy-MM-dd' format.
 * @returns {Promise<void>}
 */
export const checkInToEvent = async (eventId: string, participantId: string, dateString: string): Promise<void> => {
  const { data, error } = await supabase
    .from('events')
    .select('checked_in_participants')
    .eq('id', eventId)
    .single();
  if (error || !data) {
    throw error ?? new Error('Event not found');
  }

  const checkedInParticipants = { ...(data.checked_in_participants ?? {}) };
  checkedInParticipants[participantId] = {
    ...(checkedInParticipants[participantId] ?? {}),
    [dateString]: Date.now(),
  };

  const { error: updateError } = await supabase
    .from('events')
    .update({ checked_in_participants: checkedInParticipants })
    .eq('id', eventId);
  if (updateError) {
    throw updateError;
  }
};

// --- PER DIEM REQUESTS TABLE ---

/**
 * Fetches all per diem requests from the 'perdiem_requests' table.
 * @returns {Promise<PerdiemRequest[]>} A promise that resolves to an array of per diem request objects.
 */
export const getPerDiemRequests = async (): Promise<PerdiemRequest[]> => {
  const { data, error } = await supabase.from('perdiem_requests').select('*');
  if (error) {
    console.error("Error fetching per diem requests: ", error);
    return [];
  }
  return (data ?? []).map((row) => fromRow<PerdiemRequest>(row, REQUEST_FIELDS));
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
export const getClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase.from('clients').select('id, name').order('name');
  if (error) {
    console.error("Error fetching clients: ", error);
    return [];
  }
  return (data ?? []) as Client[];
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
