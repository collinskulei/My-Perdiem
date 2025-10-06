/**
 * @file This file defines the PlacesAutocomplete component.
 * It uses the Google Maps Places API to provide a location search input
 * that autocompletes and returns detailed place information.
 */
"use client";

import { useRef, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Define the shape of the data that will be passed back on place selection
export type Place = {
  name: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
};

interface PlacesAutocompleteProps {
  onPlaceSelect: (place: Place | null) => void;
}

export function PlacesAutocomplete({ onPlaceSelect }: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      console.error("Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.");
      return;
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      if (inputRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['name', 'address_components', 'geometry.location'],
          types: ['establishment'],
        });

        autocomplete.addListener('place_changed', () => {
          const placeResult = autocomplete.getPlace();

          if (placeResult.geometry && placeResult.address_components) {
            let city = '';
            let county = '';

            for (const component of placeResult.address_components) {
              if (component.types.includes('locality')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                county = component.long_name.replace(' County', '');
              }
            }
            
            // If locality is not found, use administrative_area_level_2 as city
            if (!city) {
                 for (const component of placeResult.address_components) {
                    if (component.types.includes('administrative_area_level_2')) {
                        city = component.long_name.replace(' County', '');
                        break;
                    }
                 }
            }


            const place: Place = {
              name: placeResult.name || '',
              city: city,
              county: county,
              latitude: placeResult.geometry.location.lat(),
              longitude: placeResult.geometry.location.lng(),
            };
            onPlaceSelect(place);
          } else {
            onPlaceSelect(null);
          }
        });
      }
    });

    // Cleanup function to remove the Google Maps script and its side effects
    return () => {
      // Find and remove all Google Maps script tags
      const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
      scripts.forEach(script => script.remove());
      
      // Google Maps API adds a 'pac-container' div to the body for the autocomplete dropdown.
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => container.remove());
    };
  }, [apiKey, onPlaceSelect]);

  if (!apiKey) {
    return (
        <div>
            <Label>Search Venue Name</Label>
            <Input disabled placeholder="Google Maps API Key is missing..." />
            <p className="text-xs text-destructive mt-1">Please provide the Google Maps API key in your environment variables.</p>
        </div>
    );
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      placeholder="Start typing a venue name..."
    />
  );
}
