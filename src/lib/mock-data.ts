

/**
 * @file This file provides a mock data implementation that uses localStorage
 * to simulate a database. It's used when the application is in "Test Mode".
 * It includes logic to initialize and expire the mock data.
 */

import type { Venue, PerdiemRequest, Participant, AppEvent } from './data';
import { OUT_OF_OFFICE_RATES } from './data';
import type { VenueData, ParticipantData, EventData, PerDiemRequestData } from './supabase/database';

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
        organizationName: "PerdiemPro Inc."
    },
];

const today = new Date();
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const initialEvents: AppEvent[] = [
    {
        id: 'event-001',
        name: 'Annual Health Conference (Past Event)',
        createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15).toISOString(),
        eventDates: [
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8)),
        ],
        venueId: 'venue-nrb-001',
        venueName: 'Sarova Stanley',
        venueCity: 'Nairobi',
        facilitator: 'Dr. Emily Carter',
        jobGroupAllowances: OUT_OF_OFFICE_RATES,
        allocatedParticipants: [],
        checkinStartTime: '09:00',
        checkinEndTime: '18:00',
        checkedInParticipants: {},
        letterUrl: 'https://example.com/letter.pdf',
        programUrl: 'https://example.com/program.pdf'
    },
    {
        id: 'event-002',
        name: 'Maternal Health Workshop (Active Event)',
        createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString(),
        eventDates: [
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
            formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
        ],
        venueId: 'venue-msa-001',
        venueName: 'Serena Beach Resort & Spa',
        venueCity: 'Mombasa',
        facilitator: 'Prof. David Chen',
        jobGroupAllowances: OUT_OF_OFFICE_RATES,
        checkinStartTime: '08:30',
        checkinEndTime: '16:00',
        allocatedParticipants: [],
        checkedInParticipants: {},
        letterUrl: 'https://example.com/letter.pdf'
    },
];
const initialPerDiemRequests: PerdiemRequest[] = [];


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
  
  // After adding, check for event allocations for this new participant
  const dbInstance = getDb();
  dbInstance.events.forEach(event => {
    if (event.unregisteredParticipants && event.unregisteredParticipants.length > 0) {
      const shortPhoneNumber = newParticipant.phoneNumber.slice(-9);
      const matchIndex = event.unregisteredParticipants.findIndex(up => up.phoneNumber === shortPhoneNumber);
      
      if (matchIndex > -1) {
        // Add to allocated
        if (!event.allocatedParticipants.includes(uid)) {
          event.allocatedParticipants.push(uid);
        }
        // Remove from unregistered
        event.unregisteredParticipants.splice(matchIndex, 1);
      }
    }
  });

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


export const addEvent = async (event: Partial<AppEvent>): Promise<string> => {
    const newEvent: AppEvent = { 
        id: generateId(), 
        createdAt: new Date().toISOString(),
        ...event 
    } as AppEvent;
    getDb().events.push(newEvent);
    saveDb();
    return newEvent.id;
};

export const addEventWithId = async (eventId: string, event: Partial<AppEvent>): Promise<void> => {
    const newEvent: AppEvent = {
        id: eventId,
        ...event,
    } as AppEvent;
    getDb().events.push(newEvent);
    saveDb();
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

export const deleteEvent = async (eventId: string): Promise<void> => {
    const dbInstance = getDb();
    const index = dbInstance.events.findIndex(e => e.id === eventId);
    if (index !== -1) {
        dbInstance.events.splice(index, 1);
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
    const newRequest: PerdiemRequest = { id: generateId(), ...request, status: 'Pending' };
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

export const markEventAsPaid = async (eventId: string, transactionCode: string): Promise<void> => {
    const dbInstance = getDb();
    let updated = false;
    dbInstance.perdiemRequests.forEach(req => {
        if (req.eventId === eventId && req.status === 'Approved') {
            req.status = 'Paid';
            req.transactionCode = transactionCode;
            updated = true;
        }
    });

    if (updated) {
        saveDb();
    }
};

