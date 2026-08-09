

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
};

/**
 * A named category of document a client's users submit against (e.g.
 * "Site Visit Report"). Minimal for now - Milestone 5 extends this
 * alongside the documents/document_reports tables it's built to support.
 */
export type WorkType = {
  id: string;
  clientId: string;
  name: string;
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
    

    
