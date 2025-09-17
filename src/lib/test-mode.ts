/**
 * @file This file contains utility functions for managing the application's "Test Mode".
 * It provides a simple API to check if test mode is active and to set its state,
 * using the browser's localStorage for persistence.
 */

// The key used to store the test mode flag in localStorage.
const TEST_MODE_KEY = 'perdiem-pro-test-mode';

/**
 * Checks if "Test Mode" is currently active.
 * It reads the value from localStorage. If the value is not present, it defaults to `false`.
 * @returns {boolean} `true` if test mode is enabled, otherwise `false`.
 */
export const isTestMode = (): boolean => {
  // Ensure this code only runs on the client-side
  if (typeof window === 'undefined') {
    return false;
  }
  const storedValue = window.localStorage.getItem(TEST_MODE_KEY);
  return storedValue === 'true';
};

/**
 * Enables or disables "Test Mode".
 * This function saves the desired state to localStorage.
 * @param {boolean} enabled - The desired state for test mode. `true` to enable, `false` to disable.
 */
export const setTestMode = (enabled: boolean): void => {
  // Ensure this code only runs on the client-side
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TEST_MODE_KEY, String(enabled));
  }
};

    