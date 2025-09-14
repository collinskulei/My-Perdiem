/**
 * @file This file provides utility functions for the application.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
