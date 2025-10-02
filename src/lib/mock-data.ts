
/**
 * @file This file provides a mock data implementation that uses localStorage
 * to simulate a database. It's used when the application is in "Test Mode".
 * It includes logic to initialize and expire the mock data.
 */

import type { Venue, PerdiemRequest, Participant, AppEvent } from './data';
import type { VenueData, ParticipantData, EventData, PerDiemRequestData } from './firebase/firestore';

const MOCK_DATA_KEY = 'perdiem-pro-mock-data';
const TIMESTAMP_KEY = 'perdiem-pro-mock-timestamp';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// --- Data Structures ---

type MockDatabase = {
  venues: Venue[];
  participants: Participant[];
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

const initialParticipants: Participant[] = [
    {
        id: "auth-uid-admin",
        name: "Test Mode Admin",
        email: "admin@example.com",
        role: "Admin",
        avatarUrl: `https://picsum.photos/seed/auth-uid-admin/100/100`,
        phoneNumber: "+254700000000",
        idNumber: "00000000",
        dateOfBirth: "1980-01-01",
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
        dateOfBirth: "1985-05-10",
        organizationName: "HealthOrg LLC"
    },
    {
        id: "auth-uid-participant-1",
        name: "Test Mode Participant",
        email: "participant1@example.com",
        role: "Registered Nurse",
        avatarUrl: `https://picsum.photos/seed/auth-uid-participant-1/100/100`,
        phoneNumber: "+254711111111",
        idNumber: "11111111",
        dateOfBirth: "1990-03-15",
        participantNumber: "EMP001",
        dutyStation: "Nairobi",
        jobGroup: "C3"
    },
    {
        id: "auth-uid-participant-2",
        name: "Jane Smith",
        email: "participant2@example.com",
        role: "Clinical Officer",
        avatarUrl: `https://picsum.photos/seed/auth-uid-participant-2/100/100`,
        phoneNumber: "+254722222222",
        idNumber: "22222222",
        dateOfBirth: "1992-07-20",
        participantNumber: "EMP002",
        dutyStation: "Mombasa",
        jobGroup: "D1"
    },
    {
        id: "auth-uid-participant-3",
        name: "Peter Jones",
        email: "participant3@example.com",
        role: "Laboratory Technologist",
        avatarUrl: `https://picsum.photos/seed/auth-uid-participant-3/100/100`,
        phoneNumber: "+254733333333",
        idNumber: "33333333",
        dateOfBirth: "1988-11-30",
        participantNumber: "EMP003",
        dutyStation: "Kisumu",
        jobGroup: "B5"
    },
     {
        id: "auth-uid-participant-4",
        name: "Maryanne Wangari",
        email: "participant4@example.com",
        role: "Pharmacist",
        avatarUrl: `https://picsum.photos/seed/auth-uid-participant-4/100/100`,
        phoneNumber: "+254744444444",
        idNumber: "44444444",
        dateOfBirth: "1995-02-25",
        participantNumber: "EMP004",
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
        eventDates: [
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8)),
        ],
        venueId: 'venue-nrb-001',
        venueName: 'Sarova Stanley',
        venueCity: 'Nairobi',
        facilitator: 'Dr. Emily Carter',
        allocatedParticipants: ['auth-uid-participant-1', 'auth-uid-participant-4'],
        checkedInParticipants: { 
            'auth-uid-participant-1': { 
                [formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10))]: Date.now(),
                [formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9))]: Date.now(),
            } 
        },
    },
    {
        id: 'event-002',
        name: 'Maternal Health Workshop (Active Event)',
        eventDates: [
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
        ],
        venueId: 'venue-msa-001',
        venueName: 'Serena Beach Resort & Spa',
        venueCity: 'Mombasa',
        facilitator: 'Prof. David Chen',
        allocatedParticipants: ['auth-uid-participant-2', 'auth-uid-participant-1'],
        checkedInParticipants: {
             'auth-uid-participant-2': { 
                [formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))]: Date.now(),
            } 
        },
    },
    {
        id: 'event-003',
        name: 'Lab Technology Symposium (Active Event)',
        eventDates: [
            formatDate(today),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
        ],
        venueId: 'venue-ksm-001',
        venueName: 'Acacia Premier Hotel',
        venueCity: 'Kisumu',
        facilitator: 'Aisha Khan',
        allocatedParticipants: ['auth-uid-participant-3'],
        checkedInParticipants: {},
    },
    {
        id: 'event-004',
        name: 'Pharmaceutical Best Practices (Upcoming Event)',
        eventDates: [
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)),
        ],
        venueId: 'venue-nrb-002',
        venueName: 'Villa Rosa Kempinski',
        venueCity: 'Nairobi',
        facilitator: 'Dr. Benard Omondi',
        allocatedParticipants: ['auth-uid-participant-4', 'auth-uid-participant-1'],
        checkedInParticipants: {},
    },
];
const initialPerDiemRequests: PerdiemRequest[] = [
    {
        id: 'req-001',
        participantId: 'auth-uid-participant-1',
        participantName: 'Test Mode Participant',
        eventId: 'event-001',
        eventName: 'Annual Health Conference (Past Event)',
        location: 'Nairobi',
        date: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9)),
        status: 'Paid',
        mpesaTransactionCode: 'ABC123XYZ',
        accommodationNights: 2,
        accommodationTotal: 10000,
        outOfOfficeAllowance: 8000,
        mileageKm: 50,
        mileageTotal: 2250,
        totalPerdiem: 20250,
    },
    {
        id: 'req-002',
        participantId: 'auth-uid-participant-2',
        participantName: 'Jane Smith',
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
        return { venues: [], participants: [], events: [], perdiemRequests: [] };
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
             // Basic validation to ensure all expected keys are present
            if (parsedData.venues && parsedData.participants && parsedData.events && parsedData.perdiemRequests) {
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
        return { venues: [], participants: [], events: [], perdiemRequests: [] };
    }
    const initialDb: MockDatabase = {
        venues: initialVenues,
        participants: initialParticipants,
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

export const getParticipants = async (): Promise<Participant[]> => {
  return [...getDb().participants];
};

export const getParticipantById = async (uid: string): Promise<Participant | null> => {
    const participant = getDb().participants.find(p => p.id === uid) || null;
    return participant ? {...participant} : null;
};

export const addParticipant = async (userData: any, uid: string): Promise<void> => {
  const newParticipant: Participant = {
    id: uid,
    avatarUrl: `https://picsum.photos/seed/${uid}/100/100`,
    ...userData,
  };
  getDb().participants.push(newParticipant);
  saveDb();
};

export const updateParticipant = async (uid: string, dataToUpdate: Partial<Participant>): Promise<void> => {
  const dbInstance = getDb();
  const index = dbInstance.participants.findIndex(p => p.id === uid);
  if (index !== -1) {
    dbInstance.participants[index] = { ...dbInstance.participants[index], ...dataToUpdate };
    saveDb();
  } else {
    throw new Error("Participant not found");
  }
};

export const isEmailUnique = async (email: string): Promise<boolean> => {
    return !getDb().participants.some(p => p.email === email);
};

export const isIdNumberUnique = async (idNumber: string): Promise<boolean> => {
    return !getDb().participants.some(p => p.idNumber === idNumber);
};

export const isPhoneNumberUnique = async (phoneNumber: string): Promise<boolean> => {
    return !getDb().participants.some(p => p.phoneNumber === phoneNumber);
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

export const getEventsByParticipant = async (participantId: string): Promise<AppEvent[]> => {
    const participantEvents = getDb().events.filter(event => event.allocatedParticipants.includes(participantId));
    return JSON.parse(JSON.stringify(participantEvents)); // Deep copy
};

export const getEventById = async (eventId: string): Promise<AppEvent | null> => {
    const event = getDb().events.find(e => e.id === eventId) || null;
    return event ? {...event} : null;
};

export const updateEvent = async (eventId: string, dataToUpdate: Partial<AppEvent>): Promise<void> => {
  const dbInstance = getDb();
  const index = dbInstance.events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    dbInstance.events[index] = { ...dbInstance.events[index], ...dataToUpdate };
    saveDb();
  } else {
    throw new Error("Event not found");
  }
};


export const checkInToEvent = async (eventId: string, participantId: string, dateString: string): Promise<void> => {
    const dbInstance = getDb();
    const eventIndex = dbInstance.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
        const event = dbInstance.events[eventIndex];
        
        // Ensure checkedInParticipants is an object
        if (!event.checkedInParticipants) {
            event.checkedInParticipants = {};
        }

        // Ensure the record for the participantId is an object
        if (typeof event.checkedInParticipants[participantId] !== 'object' || event.checkedInParticipants[participantId] === null) {
            event.checkedInParticipants[participantId] = {};
        }

        // Now it's safe to set the property
        event.checkedInParticipants[participantId][dateString] = Date.now();
        
        saveDb();
    } else {
        throw new Error("Event not found");
    }
};


export const getPerDiemRequests = async (): Promise<PerdiemRequest[]> => {
    return [...getDb().perdiemRequests];
};

export const getPerDiemRequestsByParticipant = async (participantId: string): Promise<PerdiemRequest[]> => {
    const requests = getDb().perdiemRequests.filter(req => req.participantId === participantId);
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
