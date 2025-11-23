/**
 * @file This file contains helper functions for interacting with Firebase Storage.
 */
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import app from './config';

const storage = getStorage(app);

/**
 * Uploads a file to a specified path in Firebase Storage.
 * @param {string} path - The full path in storage where the file should be saved (e.g., 'events/event-123/program.pdf').
 * @param {File} file - The file object to upload.
 * @returns {Promise<string>} A promise that resolves to the public download URL of the uploaded file.
 */
export const uploadFile = async (path: string, file: File): Promise<string> => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

/**
 * Deletes a file from Firebase Storage.
 * @param {string} path - The full path of the file to delete.
 * @returns {Promise<void>}
 */
export const deleteFile = async (path: string): Promise<void> => {
    const storageRef = ref(storage, path);
    try {
        await deleteObject(storageRef);
    } catch (error: any) {
        // It's okay if the file doesn't exist (e.g., trying to delete an old one that failed to upload)
        if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting file from storage:", error);
            throw error;
        }
    }
};
