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
 * Represents a single per diem request submitted by an employee.
 */
export type PerdiemRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  eventName: string;
  location: string;
  date: string;
  totalPerdiem: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  checkInTimestamp?: number;
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
