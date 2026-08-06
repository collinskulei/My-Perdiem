/**
 * @file This file contains helper functions for interacting with Supabase Auth.
 */
import { supabase } from './client';

/**
 * Signs the current user out of their Supabase session, then lets the caller redirect.
 * @returns {Promise<void>}
 */
export const signOutEverywhere = async (): Promise<void> => {
  await supabase.auth.signOut();
};
