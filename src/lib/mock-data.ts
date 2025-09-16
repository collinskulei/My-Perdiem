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
        id: "auth-uid-admin2",
        name: "Admin Two",
        email: "admin2@example.com",
        role: "Admin",
        avatarUrl: `https://picsum.photos/seed/auth-uid-admin2/100/100`,
        phoneNumber: "+254700000002",
        idNumber: "00000002",
        gender: "female",
        organizationName: "HealthOrg LLC"
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

let db: MockDatabase | null = null;

const getDb = (): MockDatabase => {
    if (typeof window === 'undefined') {
        // Return a temporary, empty structure on the server
        return { venues: [], employees: [], events: [], perdiemRequests: [] };
    }

    if (db) {
        return db;
    }

    const now = Date.now();
    const storedTimestamp = localStorage.getItem(TIMESTAMP_KEY);
    const storedData = localStorage.getItem(MOCK_DATA_KEY);

    if (storedData && storedTimestamp && (now - parseInt(storedTimestamp, 10) < ONE_WEEK_MS)) {
        db = JSON.parse(storedData);
    } else {
        const initialDb: MockDatabase = {
            venues: initialVenues,
            employees: initialEmployees,
            events: initialEvents,
            perdiemRequests: initialPerDiemRequests,
        };
        localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(initialDb));
        localStorage.setItem(TIMESTAMP_KEY, now.toString());
        db = initialDb;
    }
    return db;
};


const saveDb = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(getDb()));
    }
};

// --- Mock API Implementation ---

const generateId = () => `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const getVenues = async (): Promise<Venue[]> => {
  return [...getDb().venues];
};

export const getVenueById = async (id: string): Promise<Venue | null> => {
    const venue = getDb().venues.find(v => v.id === id) || null;
    return venue ? {...venue} : null;
};

export const addVenue = async (venue: VenueData): Promise<string> => {
  const newVenue: Venue = { id: generateId(), ...venue };
  getDb().venues.push(newVenue);
  saveDb();
  return newVenue.id;
};

export const getEmployees = async (): Promise<Employee[]> => {
  return [...getDb().employees];
};

export const getEmployeeById = async (uid: string): Promise<Employee | null> => {
    const employee = getDb().employees.find(emp => emp.id === uid) || null;
    return employee ? {...employee} : null;
};

export const addEmployee = async (userData: any, uid: string): Promise<void> => {
  const newEmployee: Employee = {
    id: uid,
    avatarUrl: `https://picsum.photos/seed/${uid}/100/100`,
    ...userData,
  };
  getDb().employees.push(newEmployee);
  saveDb();
};

export const updateEmployee = async (uid: string, dataToUpdate: Partial<Employee>): Promise<void> => {
  const dbInstance = getDb();
  const index = dbInstance.employees.findIndex(emp => emp.id === uid);
  if (index !== -1) {
    dbInstance.employees[index] = { ...dbInstance.employees[index], ...dataToUpdate };
    saveDb();
  } else {
    throw new Error("Employee not found");
  }
};

export const addEvent = async (event: EventData): Promise<string> => {
    const newEvent: AppEvent = { id: generateId(), ...event };
    getDb().events.push(newEvent);
    saveDb();
    return newEvent.id;
};

export const getEvents = async (): Promise<AppEvent[]> => {
    return [...getDb().events];
};

export const getEventsByEmployee = async (employeeId: string): Promise<AppEvent[]> => {
    const employeeEvents = getDb().events.filter(event => event.allocatedEmployees.includes(employeeId));
    return JSON.parse(JSON.stringify(employeeEvents)); // Deep copy
};

export const getEventById = async (eventId: string): Promise<AppEvent | null> => {
    const event = getDb().events.find(e => e.id === eventId) || null;
    return event ? {...event} : null;
};


export const checkInToEvent = async (eventId: string, employeeId: string): Promise<void> => {
    const dbInstance = getDb();
    const eventIndex = dbInstance.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
        if (!dbInstance.events[eventIndex].checkedInEmployees) {
            dbInstance.events[eventIndex].checkedInEmployees = {};
        }
        dbInstance.events[eventIndex].checkedInEmployees![employeeId] = Date.now();
        saveDb();
    } else {
        throw new Error("Event not found");
    }
};

export const getPerDiemRequests = async (): Promise<PerdiemRequest[]> => {
    return [...getDb().perdiemRequests];
};

export const getPerDiemRequestsByEmployee = async (employeeId: string): Promise<PerdiemRequest[]> => {
    const requests = getDb().perdiemRequests.filter(req => req.employeeId === employeeId);
    return JSON.parse(JSON.stringify(requests));
};

export const addPerDiemRequest = async (request: PerDiemRequestData): Promise<string> => {
    const newRequest: PerdiemRequest = { id: generateId(), ...request };
    getDb().perdiemRequests.push(newRequest);
    saveDb();
    return newRequest.id;
};
