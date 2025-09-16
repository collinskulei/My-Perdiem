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
  { id: "venue-msa-001", name: "Serena Beach Resort & Spa", city: "Mombasa", county: "Mombasa", latitude: -4.0435, longitude: 39.6682 },
  { id: "venue-ksm-001", name: "Acacia Premier Hotel", city: "Kisumu", county: "Kisumu", latitude: -0.1022, longitude: 34.7575 },
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
    {
        id: "auth-uid-employee-2",
        name: "Jane Smith",
        email: "employee2@example.com",
        role: "Clinical Officer",
        avatarUrl: `https://picsum.photos/seed/auth-uid-employee-2/100/100`,
        phoneNumber: "+254722222222",
        idNumber: "22222222",
        gender: "female",
        employeeNumber: "EMP002",
        dutyStation: "Mombasa",
        jobGroup: "D1"
    },
    {
        id: "auth-uid-employee-3",
        name: "Peter Jones",
        email: "employee3@example.com",
        role: "Laboratory Technologist",
        avatarUrl: `https://picsum.photos/seed/auth-uid-employee-3/100/100`,
        phoneNumber: "+254733333333",
        idNumber: "33333333",
        gender: "male",
        employeeNumber: "EMP003",
        dutyStation: "Kisumu",
        jobGroup: "B5"
    },
     {
        id: "auth-uid-employee-4",
        name: "Maryanne Wangari",
        email: "employee4@example.com",
        role: "Pharmacist",
        avatarUrl: `https://picsum.photos/seed/auth-uid-employee-4/100/100`,
        phoneNumber: "+254744444444",
        idNumber: "44444444",
        gender: "female",
        employeeNumber: "EMP004",
        dutyStation: "Nairobi",
        jobGroup: "K"
    },
];

const today = new Date();
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const initialEvents: AppEvent[] = [
    {
        id: 'event-001',
        name: 'Annual Health Conference (Past Event)',
        startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10)),
        endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8)),
        venueId: 'venue-nrb-001',
        venueName: 'Sarova Stanley',
        venueCity: 'Nairobi',
        facilitator: 'Dr. Emily Carter',
        allocatedEmployees: ['auth-uid-employee-1', 'auth-uid-employee-4'],
        checkedInEmployees: { 
            'auth-uid-employee-1': { 
                [formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10))]: Date.now(),
                [formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9))]: Date.now(),
            } 
        },
    },
    {
        id: 'event-002',
        name: 'Maternal Health Workshop (Active Event)',
        startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
        endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
        venueId: 'venue-msa-001',
        venueName: 'Serena Beach Resort & Spa',
        venueCity: 'Mombasa',
        facilitator: 'Prof. David Chen',
        allocatedEmployees: ['auth-uid-employee-2', 'auth-uid-employee-1'],
        checkedInEmployees: {
             'auth-uid-employee-2': { 
                [formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))]: Date.now(),
            } 
        },
    },
    {
        id: 'event-003',
        name: 'Lab Technology Symposium (Active Event)',
        startDate: formatDate(today),
        endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
        venueId: 'venue-ksm-001',
        venueName: 'Acacia Premier Hotel',
        venueCity: 'Kisumu',
        facilitator: 'Aisha Khan',
        allocatedEmployees: ['auth-uid-employee-3'],
        checkedInEmployees: {},
    },
    {
        id: 'event-004',
        name: 'Pharmaceutical Best Practices (Upcoming Event)',
        startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5)),
        endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)),
        venueId: 'venue-nrb-002',
        venueName: 'Villa Rosa Kempinski',
        venueCity: 'Nairobi',
        facilitator: 'Dr. Benard Omondi',
        allocatedEmployees: ['auth-uid-employee-4', 'auth-uid-employee-1'],
        checkedInEmployees: {},
    },
];
const initialPerDiemRequests: PerdiemRequest[] = [
    {
        id: 'req-001',
        employeeId: 'auth-uid-employee-1',
        employeeName: 'John Doe',
        eventId: 'event-001',
        eventName: 'Annual Health Conference (Past Event)',
        location: 'Nairobi',
        date: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9)),
        status: 'Paid',
        accommodationNights: 2,
        accommodationTotal: 10000,
        outOfOfficeAllowance: 8000,
        mileageKm: 50,
        mileageTotal: 2250,
        totalPerdiem: 20250,
    },
    {
        id: 'req-002',
        employeeId: 'auth-uid-employee-2',
        employeeName: 'Jane Smith',
        eventId: 'event-002',
        eventName: 'Maternal Health Workshop (Active Event)',
        location: 'Mombasa',
        date: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
        status: 'Pending',
        accommodationNights: 2,
        accommodationTotal: 10000,
        outOfOfficeAllowance: 10000,
        mileageKm: 970,
        mileageTotal: 43650,
        totalPerdiem: 63650,
    }
];


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
        try {
            const parsedData = JSON.parse(storedData);
             // Basic validation
            if (parsedData.venues && parsedData.employees) {
                 db = parsedData;
            } else {
                throw new Error("Invalid mock data structure");
            }
        } catch (e) {
            console.error("Failed to parse mock data, re-initializing.", e);
            db = initializeDb();
        }
    } else {
        db = initializeDb();
    }
    return db;
};

const initializeDb = (): MockDatabase => {
    if (typeof window === 'undefined') {
        return { venues: [], employees: [], events: [], perdiemRequests: [] };
    }
    const initialDb: MockDatabase = {
        venues: initialVenues,
        employees: initialEmployees,
        events: initialEvents,
        perdiemRequests: initialPerDiemRequests,
    };
    localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(initialDb));
    localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    return initialDb;
}


const saveDb = () => {
    if (typeof window !== 'undefined' && db) {
        localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(db));
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


export const checkInToEvent = async (eventId: string, employeeId: string, dateString: string): Promise<void> => {
    const dbInstance = getDb();
    const eventIndex = dbInstance.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
        const event = dbInstance.events[eventIndex];
        if (!event.checkedInEmployees) {
            event.checkedInEmployees = {};
        }
        if (!event.checkedInEmployees[employeeId]) {
            event.checkedInEmployees[employeeId] = {};
        }
        event.checkedInEmployees[employeeId][dateString] = Date.now();
        saveDb();
    } else {
        throw new Error("Event not found");
    }
};


export const getPerDiemRequests = async (): Promise<PerdiemRequest[]> => {
    return [...getDb().perdiemRequests];
};

export const getPerDiemRequestsByEmployee = async (employeeId: string): Promise<PerDiemRequest[]> => {
    const requests = getDb().perdiemRequests.filter(req => req.employeeId === employeeId);
    return JSON.parse(JSON.stringify(requests));
};

export const addPerDiemRequest = async (request: PerDiemRequestData): Promise<string> => {
    const newRequest: PerdiemRequest = { id: generateId(), ...request };
    getDb().perdiemRequests.push(newRequest);
    saveDb();
    return newRequest.id;
};

export const updatePerDiemRequest = async (requestId: string, dataToUpdate: Partial<PerdiemRequest>): Promise<void> => {
    const dbInstance = getDb();
    const index = dbInstance.perdiemRequests.findIndex(req => req.id === requestId);
    if (index !== -1) {
        dbInstance.perdiemRequests[index] = { ...dbInstance.perdiemRequests[index], ...dataToUpdate };
        saveDb();
    } else {
        throw new Error("Request not found");
    }
};

    