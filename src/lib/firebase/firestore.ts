/**
 * @file This file contains helper functions for interacting with Cloud Firestore.
 * It abstracts the logic for common database operations like getting and adding documents.
 */
import { getFirestore, collection, getDocs, addDoc, query, where, doc, setDoc } from 'firebase/firestore';
import app from './config';
import type { Venue, PerdiemRequest, Employee } from '../data';

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
 * The data required to create a new venue, excluding the auto-generated ID.
 */
type VenueData = Omit<Venue, 'id'>;

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


// --- EMPLOYEES COLLECTION ---

/**
 * Fetches all employees from the 'users' collection in Firestore.
 * @returns {Promise<Employee[]>} A promise that resolves to an array of employee objects.
 */
export const getEmployees = async (): Promise<Employee[]> => {
    try {
        const usersCol = collection(db, 'users');
        const userSnapshot = await getDocs(usersCol);
        const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        return userList;
    } catch (error) {
        console.error("Error fetching employees: ", error);
        return [];
    }
};

/**
 * The data required to create a new employee, excluding the auto-generated ID.
 */
export type EmployeeData = Omit<Employee, 'id' | 'avatarUrl'>;


/**
 * Adds a new employee or admin document to the 'users' collection.
 * The document ID is set to the user's UID from Firebase Authentication.
 * @param {object} userData - The user data to add.
 * @param {string} uid - The user's unique ID from Firebase Auth.
 * @returns {Promise<void>} A promise that resolves when the document is successfully created.
 */
export const addEmployee = async (userData: any, uid: string): Promise<void> => {
    const usersCol = collection(db, 'users');
    // Add avatarUrl placeholder
    const userWithAvatar = {
        ...userData,
        avatarUrl: `https://picsum.photos/seed/${uid}/100/100`,
    };
    // Use the uid from Auth as the document ID
    await setDoc(doc(usersCol, uid), userWithAvatar);
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
 * Fetches per diem requests for a specific employee.
 * @param {string} employeeId - The ID of the employee whose requests are to be fetched.
 * @returns {Promise<PerdiemRequest[]>} A promise that resolves to an array of per diem request objects.
 */
export const getPerDiemRequestsByEmployee = async (employeeId: string): Promise<PerdiemRequest[]> => {
    try {
        const requestsCol = collection(db, 'perdiemRequests');
        const q = query(requestsCol, where("employeeId", "==", employeeId));
        const requestSnapshot = await getDocs(q);
        const requestList = requestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerdiemRequest));
        return requestList;
    } catch (error) {
        console.error("Error fetching employee per diem requests: ", error);
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
