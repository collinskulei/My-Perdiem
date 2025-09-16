/**
 * @file This file provides a mock data implementation that uses localStorage
 * to simulate a database. It's used when the application is in "Test Mode".
 * It includes logic to initialize and expire the mock data.
 */

import type { Venue, PerdiemRequest, Employee, AppEvent } from './data';
import type { VenueData, EmployeeData, EventData, PerDiemRequestData } from './firebase/firestore';

const MOCK_DATA_KEY = 'perdiem-pro-mock-data';
const TIMESTAMP_KEY = 'perdiem-pro-mock-timestamp';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// --- Data Structures ---

type MockDatabase = {
  venues: Venue[];
  employees: Employee[];
  events: AppEvent[];
  perdiemRequests: PerdiemRequest[];
};

// --- Initial Mock Data ---

const initialVenues: Venue[] = [
  { id: "venue-test-001", name: "Test Venue (for Check-in)", city: "Test City", county: "Test County", latitude: 0, longitude: 0 },
  { id: "venue-nrb-001", name: "Sarova Stanley", city: "Nairobi", county: "Nairobi", latitude: -1.2833, longitude: 36.8219 },
  { id: "venue-nrb-002", name: "Villa Rosa Kempinski", city: "Nairobi", county: "Nairobi", latitude: -1.2721, longitude: 36.8095 },
];

const initialEmployees: Employee[] = [
    {
        id: "auth-uid-admin",
        name: "Admin User",
        email: "admin@example.com",
        role: "Admin",
        avatarUrl: `https://picsum.photos/seed/auth-uid-admin/100/100`,
        phoneNumber: "+254700000000",
        idNumber: "00000000",
        gender: "male",
        organizationName: "PerdiemPro Inc."
    },
    {
        id: "auth-uid-employee-1",
        name: "John Doe",
        email: "employee1@example.com",
        role: "Registered Nurse",
        avatarUrl: `https://picsum.photos/seed/auth-uid-employee-1/100/100`,
        phoneNumber: "+254711111111",
        idNumber: "11111111",
        gender: "male",
        employeeNumber: "EMP001",
        dutyStation: "Nairobi",
        jobGroup: "C3"
    },
];

const initialEvents: AppEvent[] = [];
const initialPerDiemRequests: PerdiemRequest[] = [];


// --- Database Initialization and Management ---

let db: MockDatabase;

const initializeDb = (): MockDatabase => {
  const now = Date.now();
  const storedTimestamp = localStorage.getItem(TIMESTAMP_KEY);
  const storedData = localStorage.getItem(MOCK_DATA_KEY);

  if (storedData && storedTimestamp && (now - parseInt(storedTimestamp, 10) < ONE_WEEK_MS)) {
    // Data exists and is not expired
    return JSON.parse(storedData);
  } else {
    // Data is expired or doesn't exist, reset to initial state
    const initialDb: MockDatabase = {
      venues: initialVenues,
      employees: initialEmployees,
      events: initialEvents,
      perdiemRequests: initialPerDiemRequests,
    };
    localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(initialDb));
    localStorage.setItem(TIMESTAMP_KEY, now.toString());
    return initialDb;
  }
};

const saveDb = () => {
  localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(db));
};

// Initialize the DB on module load
db = initializeDb();


// --- Mock API Implementation ---

const generateId = () => `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const getVenues = async (): Promise<Venue[]> => {
  return [...db.venues];
};

export const addVenue = async (venue: VenueData): Promise<string> => {
  const newVenue: Venue = { id: generateId(), ...venue };
  db.venues.push(newVenue);
  saveDb();
  return newVenue.id;
};

export const getEmployees = async (): Promise<Employee[]> => {
  return [...db.employees];
};

export const getEmployeeById = async (uid: string): Promise<Employee | null> => {
    const employee = db.employees.find(emp => emp.id === uid) || null;
    return employee ? {...employee} : null;
};

export const addEmployee = async (userData: any, uid: string): Promise<void> => {
  const newEmployee: Employee = {
    id: uid,
    avatarUrl: `https://picsum.photos/seed/${uid}/100/100`,
    ...userData,
  };
  db.employees.push(newEmployee);
  saveDb();
};

export const updateEmployee = async (uid: string, dataToUpdate: Partial<Employee>): Promise<void> => {
  const index = db.employees.findIndex(emp => emp.id === uid);
  if (index !== -1) {
    db.employees[index] = { ...db.employees[index], ...dataToUpdate };
    saveDb();
  } else {
    throw new Error("Employee not found");
  }
};

export const addEvent = async (event: EventData): Promise<string> => {
    const newEvent: AppEvent = { id: generateId(), ...event };
    db.events.push(newEvent);
    saveDb();
    return newEvent.id;
};

export const getEvents = async (): Promise<AppEvent[]> => {
    return [...db.events];
};

export const getEventsByEmployee = async (employeeId: string): Promise<AppEvent[]> => {
    const employeeEvents = db.events.filter(event => event.allocatedEmployees.includes(employeeId));
    return JSON.parse(JSON.stringify(employeeEvents)); // Deep copy
};

export const checkInToEvent = async (eventId: string, employeeId: string): Promise<void> => {
    const eventIndex = db.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
        if (!db.events[eventIndex].checkedInEmployees) {
            db.events[eventIndex].checkedInEmployees = {};
        }
        db.events[eventIndex].checkedInEmployees![employeeId] = Date.now();
        saveDb();
    } else {
        throw new Error("Event not found");
    }
};

export const getPerDiemRequests = async (): Promise<PerdiemRequest[]> => {
    return [...db.perdiemRequests];
};

export const getPerDiemRequestsByEmployee = async (employeeId: string): Promise<PerdiemRequest[]> => {
    const requests = db.perdiemRequests.filter(req => req.employeeId === employeeId);
    return JSON.parse(JSON.stringify(requests));
};

export const addPerDiemRequest = async (request: PerDiemRequestData): Promise<string> => {
    const newRequest: PerdiemRequest = { id: generateId(), ...request };
    db.perdiemRequests.push(newRequest);
    saveDb();
    return newRequest.id;
};
