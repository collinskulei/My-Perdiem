
/**
 * @file This file contains helper functions for interacting with Cloud Firestore.
 * It abstracts the logic for common database operations like getting and adding documents.
 */
import { getFirestore, collection, getDocs, addDoc, query, where, doc, setDoc, getDoc, updateDoc, arrayUnion, limit } from 'firebase/firestore';
import app from './config';
import type { Venue, PerdiemRequest, Participant, AppEvent } from '../data';

// Get a Firestore instance from the initialized Firebase app.
const db = getFirestore(app);

// --- VENUES COLLECTION ---

/**
 * Fetches all venues from the 'venues' collection in Firestore.
 * @returns {Promise<Venue[]>} A promise that resolves to an array of venue objects.
 */
export const getVenues = async (): Promise<Venue[]> => {
    try {
        const venuesCol = collection(db, 'venues');
        const venueSnapshot = await getDocs(venuesCol);
        const venueList = venueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venue));
        return venueList;
    } catch (error) {
        console.error("Error fetching venues: ", error);
        return [];
    }
};

/**
 * Fetches a single venue by its ID.
 * @param {string} id - The document ID of the venue.
 * @returns {Promise<Venue | null>} A promise that resolves to the venue object or null if not found.
 */
export const getVenueById = async (id: string): Promise<Venue | null> => {
    try {
        const venueDocRef = doc(db, 'venues', id);
        const venueSnapshot = await getDoc(venueDocRef);
        if (venueSnapshot.exists()) {
            return { id: venueSnapshot.id, ...venueSnapshot.data() } as Venue;
        }
        return null;
    } catch (error) {
        console.error("Error fetching venue by ID: ", error);
        return null;
    }
};


/**
 * The data required to create a new venue, excluding the auto-generated ID.
 */
export type VenueData = Omit<Venue, 'id'>;

/**
 * Adds a new venue document to the 'venues' collection.
 * @param {VenueData} venue - The venue data to add.
 * @returns {Promise<string>} A promise that resolves to the new document's ID.
 */
export const addVenue = async (venue: VenueData): Promise<string> => {
    const venuesCol = collection(db, 'venues');
    const docRef = await addDoc(venuesCol, venue);
    return docRef.id;
};


// --- PARTICIPANTS COLLECTION ---

/**
 * Fetches all participants from the 'participants' collection in Firestore.
 * @returns {Promise<Participant[]>} A promise that resolves to an array of participant objects.
 */
export const getParticipants = async (): Promise<Participant[]> => {
    try {
        const participantsCol = collection(db, 'participants');
        const participantSnapshot = await getDocs(participantsCol);
        const participantList = participantSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
        return participantList;
    } catch (error) {
        console.error("Error fetching participants: ", error);
        return [];
    }
};

/**
 * Fetches a single participant from the 'participants' collection by their ID (UID).
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<Participant | null>} A promise that resolves to the participant object or null if not found.
 */
export const getParticipantById = async (uid: string): Promise<Participant | null> => {
    try {
        const userDocRef = doc(db, 'participants', uid);
        const userSnapshot = await getDoc(userDocRef);
        if (userSnapshot.exists()) {
            return { id: userSnapshot.id, ...userSnapshot.data() } as Participant;
        }
        return null;
    } catch (error) {
        console.error("Error fetching participant by ID: ", error);
        return null;
    }
};


/**
 * The data required to create a new participant, excluding the auto-generated ID.
 */
export type ParticipantData = Omit<Participant, 'id' | 'avatarUrl'>;


/**
 * Adds a new participant or admin document to the 'participants' collection.
 * The document ID is set to the user's UID from Firebase Authentication.
 * @param {object} userData - The user data to add.
 * @param {string} uid - The user's unique ID from Firebase Auth.
 * @returns {Promise<void>} A promise that resolves when the document is successfully created.
 */
export const addParticipant = async (userData: any, uid: string): Promise<void> => {
    const participantsCol = collection(db, 'participants');
    // Add avatarUrl placeholder
    const userWithAvatar = {
        ...userData,
        avatarUrl: `https://picsum.photos/seed/${uid}/100/100`,
    };
    // Use the uid from Auth as the document ID
    await setDoc(doc(participantsCol, uid), userWithAvatar);
};


/**
 * Updates an participant's document in the 'participants' collection.
 * @param {string} uid - The user's unique ID.
 * @param {Partial<Participant>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the document is successfully updated.
 */
export const updateParticipant = async (uid: string, dataToUpdate: Partial<Participant>): Promise<void> => {
    const userDocRef = doc(db, 'participants', uid);
    await updateDoc(userDocRef, dataToUpdate);
};

// --- UNIQUENESS CHECKS ---

/**
 * Checks if an email is unique in the 'participants' collection.
 * @param {string} email - The email to check.
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
export const isEmailUnique = async (email: string): Promise<boolean> => {
    const q = query(collection(db, 'participants'), where("email", "==", email), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
};

/**
 * Checks if an ID number is unique in the 'participants' collection.
 * @param {string} idNumber - The ID number to check.
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
export const isIdNumberUnique = async (idNumber: string): Promise<boolean> => {
    const q = query(collection(db, 'participants'), where("idNumber", "==", idNumber), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
};

/**
 * Checks if a phone number is unique in the 'participants' collection.
 * @param {string} phoneNumber - The phone number to check.
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
export const isPhoneNumberUnique = async (phoneNumber: string): Promise<boolean> => {
    const q = query(collection(db, 'participants'), where("phoneNumber", "==", phoneNumber), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
};


// --- EVENTS COLLECTION ---

/**
 * The data required to create a new event, excluding the auto-generated ID.
 */
export type EventData = Omit<AppEvent, 'id'>;

/**
 * Adds a new event document to the 'events' collection.
 * @param {EventData} event - The event data to add.
 * @returns {Promise<string>} A promise that resolves to the new document's ID.
 */
export const addEvent = async (event: EventData): Promise<string> => {
    const eventsCol = collection(db, 'events');
    const docRef = await addDoc(eventsCol, event);
    return docRef.id;
};

/**
 * Fetches all events from the 'events' collection.
 * @returns {Promise<AppEvent[]>}
 */
export const getEvents = async (): Promise<AppEvent[]> => {
    try {
        const eventsCol = collection(db, 'events');
        const eventSnapshot = await getDocs(eventsCol);
        return eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppEvent));
    } catch (error) {
        console.error("Error fetching events: ", error);
        return [];
    }
};

/**
 * Fetches events allocated to a specific participant.
 * @param {string} participantId - The ID of the participant.
 * @returns {Promise<AppEvent[]>}
 */
export const getEventsByParticipant = async (participantId: string): Promise<AppEvent[]> => {
    try {
        const eventsCol = collection(db, 'events');
        const q = query(eventsCol, where("allocatedParticipants", "array-contains", participantId));
        const eventSnapshot = await getDocs(q);
        return eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppEvent));
    } catch (error) {
        console.error("Error fetching events for participant: ", error);
        return [];
    }
};

/**
 * Fetches a single event by its ID.
 * @param {string} eventId - The document ID of the event.
 * @returns {Promise<AppEvent | null>} A promise that resolves to the event object or null if not found.
 */
export const getEventById = async (eventId: string): Promise<AppEvent | null> => {
    try {
        const eventDocRef = doc(db, 'events', eventId);
        const eventSnapshot = await getDoc(eventDocRef);
        if (eventSnapshot.exists()) {
            return { id: eventSnapshot.id, ...eventSnapshot.data() } as AppEvent;
        }
        return null;
    } catch (error) {
        console.error("Error fetching event by ID: ", error);
        return null;
    }
};

/**
 * Updates an event's document in the 'events' collection.
 * @param {string} eventId - The event's unique ID.
 * @param {Partial<AppEvent>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the document is successfully updated.
 */
export const updateEvent = async (eventId: string, dataToUpdate: Partial<AppEvent>): Promise<void> => {
    const eventDocRef = doc(db, 'events', eventId);
    await updateDoc(eventDocRef, dataToUpdate);
};


/**
 * Records an participant's check-in for a specific event on a specific date.
 * @param {string} eventId - The ID of the event.
 * @param {string} participantId - The ID of the participant checking in.
 * @param {string} dateString - The date of the check-in in 'yyyy-MM-dd' format.
 * @returns {Promise<void>}
 */
export const checkInToEvent = async (eventId: string, participantId: string, dateString: string): Promise<void> => {
    const eventRef = doc(db, 'events', eventId);
    // Use dot notation to update a nested field
    const updateData = {
        [`checkedInParticipants.${participantId}.${dateString}`]: Date.now()
    };
    await updateDoc(eventRef, updateData, { merge: true }); // Use merge to avoid overwriting the whole checkedInParticipants map
};


// --- PER DIEM REQUESTS COLLECTION ---

/**
 * Fetches all per diem requests from the 'perdiemRequests' collection in Firestore.
 * @returns {Promise<PerdiemRequest[]>} A promise that resolves to an array of per diem request objects.
 */
export const getPerDiemRequests = async (): Promise<PerdiemRequest[]> => {
    try {
        const requestsCol = collection(db, 'perdiemRequests');
        const requestSnapshot = await getDocs(requestsCol);
        const requestList = requestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerdiemRequest));
        return requestList;
    } catch (error) {
        console.error("Error fetching per diem requests: ", error);
        return [];
    }
};

/**
 * Fetches per diem requests for a specific participant.
 * @param {string} participantId - The ID of the participant whose requests are to be fetched.
 * @returns {Promise<PerdiemRequest[]>} A promise that resolves to an array of per diem request objects.
 */
export const getPerDiemRequestsByParticipant = async (participantId: string): Promise<PerdiemRequest[]> => {
    try {
        const requestsCol = collection(db, 'perdiemRequests');
        const q = query(requestsCol, where("participantId", "==", participantId));
        const requestSnapshot = await getDocs(q);
        const requestList = requestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerdiemRequest));
        return requestList;
    } catch (error) {
        console.error("Error fetching participant per diem requests: ", error);
        return [];
    }
}


/**
 * The data required to create a new per diem request, excluding the auto-generated ID.
 */
export type PerDiemRequestData = Omit<PerdiemRequest, 'id'>;

/**
 * Adds a new per diem request document to the 'perdiemRequests' collection.
 * @param {PerDiemRequestData} request - The request data to add.
 * @returns {Promise<string>} A promise that resolves to the new document's ID.
 */
export const addPerDiemRequest = async (request: PerDiemRequestData): Promise<string> => {
    const requestsCol = collection(db, 'perdiemRequests');
    const docRef = await addDoc(requestsCol, request);
    return docRef.id;
};

/**
 * Updates a per diem request document in the 'perdiemRequests' collection.
 * @param {string} requestId - The request's unique ID.
 * @param {Partial<PerdiemRequest>} dataToUpdate - An object containing the fields to update.
 * @returns {Promise<void>} A promise that resolves when the document is successfully updated.
 */
export const updatePerDiemRequest = async (requestId: string, dataToUpdate: Partial<PerdiemRequest>): Promise<void> => {
    const requestDocRef = doc(db, 'perdiemRequests', requestId);
    await updateDoc(requestDocRef, dataToUpdate);
};
