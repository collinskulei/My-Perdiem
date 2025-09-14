/**
 * @file This file contains helper functions for interacting with Cloud Firestore.
 * It abstracts the logic for common database operations like getting and adding documents.
 */
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import app from './config';
import type { Venue } from '../data';

// Get a Firestore instance from the initialized Firebase app.
const db = getFirestore(app);

// --- VENUES COLLECTION ---

/**
 * Fetches all venues from the 'venues' collection in Firestore.
 * @returns {Promise<Venue[]>} A promise that resolves to an array of venue objects.
 */
export const getVenues = async (): Promise<Venue[]> => {
    const venuesCol = collection(db, 'venues');
    const venueSnapshot = await getDocs(venuesCol);
    const venueList = venueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venue));
    return venueList;
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
