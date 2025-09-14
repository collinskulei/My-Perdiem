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
  employeeNumber: string;
  role: string;
  dutyStation: string;
  avatarUrl: string;
};

/**
 * Represents a venue where an event can take place.
 */
export type Venue = {
  id: string;
  name: string;
  city: string;
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
 * Mock data for employees.
 */
export const employees: Employee[] = [
  {
    id: '1',
    name: 'John Doe',
    phoneNumber: '555-0101',
    idNumber: '12345678',
    employeeNumber: 'EMP123',
    role: 'Facilitator',
    dutyStation: 'Nairobi',
    avatarUrl: 'https://picsum.photos/seed/10/100/100',
  },
  {
    id: '2',
    name: 'Jane Smith',
    phoneNumber: '555-0102',
    idNumber: '87654321',
    employeeNumber: 'EMP124',
    role: 'Sales Executive',
    dutyStation: 'Mombasa',
    avatarUrl: 'https://picsum.photos/seed/11/100/100',
  },
  {
    id: '3',
    name: 'Alex Johnson',
    phoneNumber: '555-0103',
    idNumber: '13579246',
    employeeNumber: 'EMP125',
    role: 'Developer',
    dutyStation: 'Kisumu',
    avatarUrl: 'https://picsum.photos/seed/12/100/100',
  },
  {
    id: '4',
    name: 'Emily White',
    phoneNumber: '555-0104',
    idNumber: '24681357',
    employeeNumber: 'EMP126',
    role: 'Project Manager',
    dutyStation: 'Nairobi',
    avatarUrl: 'https://picsum.photos/seed/13/100/100',
  },
  {
    id: '5',
    name: 'Michael Brown',
    phoneNumber: '555-0105',
    idNumber: '97531864',
    employeeNumber: 'EMP127',
    role: 'HR Officer',
    dutyStation: 'Nakuru',
    avatarUrl: 'https://picsum.photos/seed/14/100/100',
  },
];

/**
 * Geographical coordinates for various duty stations. Used for mileage calculation.
 */
export const dutyStationCoordinates: { [key: string]: { latitude: number, longitude: number } } = {
  "Nairobi": { latitude: -1.286389, longitude: 36.817223 },
  "Mombasa": { latitude: -4.043477, longitude: 39.668205 },
  "Kisumu": { latitude: -0.091702, longitude: 34.767956 },
  "Nakuru": { latitude: -0.303099, longitude: 36.080025 },
};

/**
 * Mock data for per diem requests.
 */
export const perdiemRequests: PerdiemRequest[] = [
  {
    id: 'REQ001',
    employeeId: '2',
    employeeName: 'Jane Smith',
    eventName: 'Annual Sales Conference',
    location: 'Mombasa',
    date: '2024-08-15',
    totalPerdiem: 45000,
    status: 'Approved',
    checkInTimestamp: 1692086400000,
  },
  {
    id: 'REQ002',
    employeeId: '1',
    employeeName: 'John Doe',
    eventName: 'Leadership Training',
    location: 'Naivasha',
    date: '2024-08-20',
    totalPerdiem: 32000,
    status: 'Pending',
  },
  {
    id: 'REQ003',
    employeeId: '3',
    employeeName: 'Alex Johnson',
    eventName: 'Tech Summit 2024',
    location: 'Kisumu',
    date: '2024-09-01',
    totalPerdiem: 28500,
    status: 'Pending',
  },
  {
    id: 'REQ004',
    employeeId: '4',
    employeeName: 'Emily White',
    eventName: 'Project Kick-off',
    location: 'Nairobi',
    date: '2024-09-05',
    totalPerdiem: 15000,
    status: 'Approved',
    checkInTimestamp: 1693891200000,
  },
  {
    id: 'REQ005',
    employeeId: '2',
    employeeName: 'Jane Smith',
    eventName: 'Client Meeting',
    location: 'Nakuru',
    date: '2024-09-10',
    totalPerdiem: 18000,
    status: 'Rejected',
  },
];

/**
 * Mock data for venues. Includes a special "Test Venue" for easy check-in during development.
 */
export const venues: Venue[] = [
  { id: "venue-test-001", name: "Test Venue (for Check-in)", city: "Test City", latitude: 0, longitude: 0 },
  { id: "venue-nrb-001", name: "Sarova Stanley", city: "Nairobi", latitude: -1.2833, longitude: 36.8219 },
  { id: "venue-nrb-002", name: "Villa Rosa Kempinski", city: "Nairobi", latitude: -1.2721, longitude: 36.8095 },
  { id: "venue-nrb-003", name: "Nairobi Serena Hotel", city: "Nairobi", latitude: -1.2882, longitude: 36.8166 },
  { id: "venue-nrb-004", name: "Sankara Nairobi, Autograph Collection", city: "Nairobi", latitude: -1.2652, longitude: 36.8078 },
];
