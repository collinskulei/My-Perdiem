/**
 * @file This file imports placeholder image data from a JSON file and exports it for use in the application.
 * It provides a structured way to manage and access placeholder images.
 */
import data from './placeholder-images.json';

/**
 * Defines the structure for a single placeholder image object.
 */
export type ImagePlaceholder = {
  /** A unique identifier for the image. */
  id: string;
  /** A brief description of the image's purpose or content. */
  description: string;
  /** The URL of the placeholder image. */
  imageUrl: string;
  /** A hint for AI image generation, typically one or two keywords. */
  imageHint: string;
};

/**
 * An array of placeholder image objects, imported from the JSON file.
 */
export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;
