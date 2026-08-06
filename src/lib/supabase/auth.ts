/**
 * @file This file contains helper functions for interacting with Supabase Auth.
 */
import { supabase } from './client';

const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

/**
 * Signs the current user out of both Live Mode (Supabase session) and Test Mode
 * (the locally stored test user id), then lets the caller redirect.
 * @returns {Promise<void>}
 */
export const signOutEverywhere = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TEST_USER_ID_KEY);
  }
  await supabase.auth.signOut();
};
