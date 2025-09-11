import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import app from './config';
import type { Venue } from '../data';

const db = getFirestore(app);

// VENUES
export const getVenues = async (): Promise<Venue[]> => {
    const venuesCol = collection(db, 'venues');
    const venueSnapshot = await getDocs(venuesCol);
    const venueList = venueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venue));
    return venueList;
};

type VenueData = Omit<Venue, 'id'>;

export const addVenue = async (venue: VenueData) => {
    const venuesCol = collection(db, 'venues');
    const docRef = await addDoc(venuesCol, venue);
    return docRef.id;
};
