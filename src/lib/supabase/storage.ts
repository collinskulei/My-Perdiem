/**
 * @file This file contains helper functions for interacting with Supabase Storage.
 */
import { supabase } from './client';

const BUCKET = 'event-files';

/**
 * Uploads a file to a specified path in the public 'event-files' Supabase Storage bucket.
 * @param {string} path - The full path in storage where the file should be saved (e.g., 'events/event-123/program.pdf').
 * @param {File} file - The file object to upload.
 * @returns {Promise<string>} A promise that resolves to the public download URL of the uploaded file.
 */
export const uploadFile = async (path: string, file: File): Promise<string> => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) {
    throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Deletes a file from the 'event-files' Supabase Storage bucket.
 * @param {string} path - The full path of the file to delete.
 * @returns {Promise<void>}
 */
export const deleteFile = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("Error deleting file from storage:", error);
    throw error;
  }
};
