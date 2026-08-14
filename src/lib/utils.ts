/**
 * @file This file provides utility functions for the application.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"

/**
 * A utility function to conditionally join class names together.
 * It uses `clsx` to handle conditional classes and `tailwind-merge` to
 * intelligently merge Tailwind CSS classes, avoiding style conflicts.
 *
 * @param {...ClassValue[]} inputs - A list of class values to be merged.
 *   These can be strings, objects, or arrays.
 * @returns {string} A single string of combined and merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the Haversine distance between two points on the Earth.
 * @param lat1 - Latitude of the first point.
 * @param lon1 - Longitude of the first point.
 * @param lat2 - Latitude of the second point.
 * @param lon2 - Longitude of the second point.
 * @returns The distance in meters.
 */
export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius of the Earth in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}


/**
 * Formats a number as Kenyan Shillings.
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
    }).format(amount);
};

/**
 * Formats a date string for display, tolerating bad data instead of
 * throwing. `date-fns`'s format() throws RangeError: Invalid time value on
 * an unparseable string (e.g. a raw Excel serial number like "45931" that
 * leaked through from a historical import) - one bad record's date should
 * never be able to crash an entire dashboard page for every viewer, so this
 * shows the raw value instead of the crashing on it.
 * @param {string | null | undefined} dateStr - An ISO-ish date string.
 * @param {string} formatStr - A date-fns format string, e.g. 'PPP'.
 * @returns {string} The formatted date, the raw input, or "—" if empty.
 */
export const formatDateSafe = (dateStr: string | null | undefined, formatStr: string = "PPP"): string => {
  if (!dateStr) return "—";
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) return String(dateStr);
  return format(parsed, formatStr);
};
