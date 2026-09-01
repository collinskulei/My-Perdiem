

/**
 * @file This file contains type definitions for the application's core domain objects.
 */

/**
 * The 4-tier access hierarchy: master_admin (the firm's developer) > super_admin
 * (firm staff) > client_admin (scoped to one client) > client_user (a client's
 * end participant, unaffected by the admin hierarchy).
 */
export type AccessTier = 'master_admin' | 'super_admin' | 'client_admin' | 'client_user';

/**
 * Represents a client organization the firm serves. Master/Super Admins are
 * firm-wide (clientId is null); Client Admins/Users belong to exactly one client.
 */
export type Client = {
  id: string;
  name: string;
  slug: string;
  onedriveDriveId?: string | null;
  onedriveFolderId?: string | null;
  onedriveFolderLink?: string | null;
};

/**
 * A named category of document a client's users submit against (e.g.
 * "Site Visit Report"). Minimal, unchanged since Milestone 3 - Milestone 5
 * turned out not to need this after all (see the Document type below and
 * docs/MILESTONE_HANDOFF.md's Milestone 5 section): the real workflow is a
 * Client Admin -> Super Admin submission inbox, not participants submitting
 * against work types, so client_user read access here is still deferred
 * with no milestone currently planning to add it.
 */
export type WorkType = {
  id: string;
  clientId: string;
  name: string;
};

/**
 * A tracked OneDrive submission: a Client Admin uploads a raw payment-list
 * document directly in OneDrive (never through this app - see the Milestone
 * 5 section of docs/MILESTONE_HANDOFF.md), and this row is how the app
 * knows the file exists and how far a Super Admin has gotten processing it.
 * The file's bytes always stay in OneDrive; this is metadata only.
 */
export type Document = {
  id: string;
  clientId: string;
  onedriveItemId: string;
  onedriveFileName: string;
  onedriveWebUrl: string | null;
  status: "submitted" | "processing" | "done";
  onedriveModifiedAt: string | null;
  firstSeenAt: string;
  processedAt: string | null;
  processedBy: string | null;
  notes: string | null;
};

/**
 * Represents an participant in the system.
 */
export type Participant = {
  id: string;
  name: string;
  phoneNumber: string;
  idNumber: string;
  participantNumber?: string;
  designation: string; // Job title, set at registration; distinct from accessTier
  accessTier: AccessTier;
  clientId: string | null; // null for master_admin/super_admin, set for client_admin/client_user
  disabledAt?: string; // set = account is banned from signing in; only via the deactivate API route
  dutyStation?: string;
  avatarUrl: string;
  email: string;
  jobGroup?: string;
  organizationName?: string;
};

/**
 * Represents a venue where an event can take place.
 */
export type Venue = {
  id: string;
  name: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
};

/**
 * Represents an event created by an admin.
 */
export type AppEvent = {
  id: string;
  clientId: string;
  name: string;
  createdAt: string; // ISO date string
  eventDates: string[]; // Array of 'yyyy-MM-dd' strings
  venueId: string;
  venueName: string;
  venueCity: string;
  facilitator: string;
  checkinStartTime?: string; // e.g., "10:00"
  checkinEndTime?: string; // e.g., "17:00"
  jobGroupAllowances?: { [key: string]: number }; // New field for event-specific allowances
  allocatedParticipants: string[]; // Array of participant IDs for registered users
  unregisteredParticipants?: { name: string, phoneNumber: string }[]; // For bulk uploads
  checkedInParticipants?: { [participantId: string]: { [date: string]: number } }; // participantId: { date: checkInTimestamp }
  programUrl?: string; // URL to the program file in Supabase Storage
  letterUrl?: string; // URL to the letter file in Supabase Storage
  // From historical import (see docs/MILESTONE_HANDOFF.md) - 'yyyy-MM-dd'
  // strings, distinct from eventDates (individual dates attended/paid).
  trainingStartDate?: string;
  trainingEndDate?: string;
  numberOfTrainingDays?: number;
};


/**
 * Represents a single per diem request submitted by an participant.
 */
export type PerdiemRequest = {
  id: string;
  clientId: string;
  // Null for historical imports of people with no app account - see
  // participantPhone/participantIdNumber, a name/contact snapshot kept for
  // those rows instead. Always set for requests made through the live app.
  participantId: string | null;
  participantName: string;
  participantPhone?: string;
  participantIdNumber?: string;
  importedAt?: string;
  notes?: string;
  // Set by the historical importer when this row is a repeat payment (same
  // participant/event/date/phone as another record, different amount) -
  // kept as its own record rather than merged, but called out for review.
  flagReason?: string;
  eventId: string;
  eventName: string;
  location: string;
  date: string;
  status: 'Approved' | 'Pending' | 'Rejected' | 'Paid' | 'Confirmed' | 'Amended';
  transactionCode?: string;
  rejectionReason?: string;
  amendmentReason?: string;
  originalTotal?: number;

  // Detailed financial breakdown from the wizard
  mileageKm?: number;
  mileageTotal?: number;
  airTicketCost?: number;
  boardingPassUrl?: string;
  boardingPassFilename?: string;
  groundTransferCost?: number;
  airTicketUrl?: string;
  airTicketFilename?: string;
  groundTransferUrl?: string;
  groundTransferFilename?: string;
  accommodationNights?: number;
  accommodationTotal?: number;
  outOfOfficeAllowance?: number;
  totalPerdiem: number;

  // From historical import (see docs/MILESTONE_HANDOFF.md).
  transportAllowance?: number;
  dsaAllowance?: number;
  employer?: string;
  // Yes/blank in the source sheet - true when indicated, undefined
  // (never false) when not, so a later, more complete upload can still
  // fill it in without a stored `false` blocking the gap-fill.
  dhaStaff?: boolean;
  mohStaff?: boolean;
  knhStaff?: boolean;
  shaStaff?: boolean;
  otherStaff?: boolean;
};


/**
 * Geographical coordinates for various duty stations. Used for mileage calculation.
 * This remains as static data as it's unlikely to change frequently.
 */
export const dutyStationCoordinates: { [key: string]: { latitude: number, longitude: number } } = {
  "Nairobi": { latitude: -1.286389, longitude: 36.817223 },
  "Mombasa": { latitude: -4.043477, longitude: 39.668205 },
  "Kisumu": { latitude: -0.091702, longitude: 34.767956 },
  "Nakuru": { latitude: -0.303099, longitude: 36.080025 },
};

// Constants for calculations
export const MILEAGE_RATE_KSH = 45;
export const OUT_OF_OFFICE_RATES: { [key: string]: number } = {
  "A": 3000, "B1": 3500, "B2": 3500, "B3": 3500, "B4": 3500, "B5": 3500,
  "C1": 4000, "C2": 4000, "C3": 4000, "C4": 4000, "C5": 4000,
  "D1": 5000, "D2": 5000, "D3": 5000, "D4": 5000, "D5": 5000,
  "E1": 6000, "E2": 6000, "E4": 6000,
  "H": 7000, "J": 8000, "K": 9000, "L": 10000, "M": 11000, "N": 12000,
  "P": 13000, "Q": 14000, "R": 15000, "S": 16000
};

// Sorts by date descending, newest first. Shared between the admin
// dashboard's client-side fetch (after mutations) and the server-side
// initial-data prefetch (see admin/get-initial-dashboard-data.ts) so both
// produce identically-ordered lists. Decorate-sort-undecorate: the sort key
// is computed once per row up front instead of re-parsing a Date on every
// comparison inside sort() itself - with 9,000+ requests that difference is
// the dominant cost of a naive sort.
export function sortRequestsByDateDesc(requests: PerdiemRequest[]): PerdiemRequest[] {
  return requests
    .map((r) => ({ r, t: new Date(r.date).getTime() }))
    .sort((a, b) => b.t - a.t)
    .map(({ r }) => r);
}

export function sortEventsByDateDesc(events: AppEvent[]): AppEvent[] {
  return events
    .map((e) => ({ e, t: new Date(e.createdAt || e.eventDates[0]).getTime() }))
    .sort((a, b) => b.t - a.t)
    .map(({ e }) => e);
}

