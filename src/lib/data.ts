/**
 * @file This file contains mock data and type definitions for the application.
 * It serves as a temporary in-memory database for employees, venues, and per diem requests.
 */

/**
 * Represents an employee in the system.
 */
export type Employee = {
  id: string;
  name: string;
  phoneNumber: string;
  idNumber: string;
  employeeNumber?: string;
  role: string; // This corresponds to 'designation' in the registration form
  dutyStation?: string;
  avatarUrl: string;
  email: string;
  gender: string;
  dateOfBirth?: string;
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
  name: string;
  eventDates: string[]; // Array of 'yyyy-MM-dd' strings
  venueId: string;
  venueName: string;
  venueCity: string;
  facilitator: string;
  allocatedEmployees: string[]; // Array of employee IDs
  checkedInEmployees?: { [employeeId: string]: { [date: string]: number } }; // employeeId: { date: checkInTimestamp }
};


/**
 * Represents a single per diem request submitted by an employee.
 */
export type PerdiemRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  eventId: string;
  eventName: string;
  location: string;
  date: string;
  status: 'Approved' | 'Pending' | 'Rejected' | 'Paid' | 'Confirmed';
  mpesaTransactionCode?: string;

  // Detailed financial breakdown from the wizard
  mileageKm?: number;
  mileageTotal?: number;
  airTicketCost?: number;
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

/**
 * Mock data for venues. Includes a special "Test Venue" for easy check-in during development.
 * This data should be seeded into the Firestore 'venues' collection.
 */
export const venues: Venue[] = [
  { id: "venue-test-001", name: "Test Venue (for Check-in)", city: "Test City", county: "Test County", latitude: 0, longitude: 0 },
  { id: "venue-nrb-001", name: "Sarova Stanley", city: "Nairobi", county: "Nairobi", latitude: -1.2833, longitude: 36.8219 },
  { id: "venue-nrb-002", name: "Villa Rosa Kempinski", city: "Nairobi", county: "Nairobi", latitude: -1.2721, longitude: 36.8095 },
  { id: "venue-nrb-003", name: "Nairobi Serena Hotel", city: "Nairobi", county: "Nairobi", latitude: -1.2882, longitude: 36.8166 },
  { id: "venue-nrb-004", name: "Sankara Nairobi, Autograph Collection", city: "Nairobi", county: "Nairobi", latitude: -1.2652, longitude: 36.8078 },
];


// Constants for calculations
export const MILEAGE_RATE_KSH = 45;
export const DAILY_ALLOWANCE = 5000;
export const OUT_OF_OFFICE_RATES: { [key: string]: number } = {
  "A": 3000, "B1": 3500, "B2": 3500, "B3": 3500, "B4": 3500, "B5": 3500,
  "C1": 4000, "C2": 4000, "C3": 4000, "C4": 4000, "C5": 4000,
  "D1": 5000, "D2": 5000, "D3": 5000, "D4": 5000, "D5": 5000,
  "E1": 6000, "E2": 6000, "E4": 6000,
  "H": 7000, "J": 8000, "K": 9000, "L": 10000, "M": 11000, "N": 12000,
  "P": 13000, "Q": 14000, "R": 15000, "S": 16000
};
