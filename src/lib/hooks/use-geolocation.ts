/**
 * @file This file defines a custom React hook `useGeolocation` for accessing the user's
 * geographical location using the browser's Geolocation API.
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Defines the shape of the state object managed by the `useGeolocation` hook.
 */
type GeolocationState = {
  loading: boolean;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  timestamp: number | null;
  error: GeolocationPositionError | null;
};

/**
 * A custom hook to get the user's current geolocation.
 * @param {PositionOptions} [options={}] - Optional configuration for the Geolocation API.
 * @returns {{...GeolocationState, getPosition: () => void}} An object containing the geolocation state and a function to manually trigger a position update.
 */
export const useGeolocation = (options: PositionOptions = {}) => {
  const [state, setState] = useState<GeolocationState>({
    loading: true,
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    latitude: null,
    longitude: null,
    speed: null,
    timestamp: Date.now(),
    error: null,
  });
  const optionsRef = useRef(options);

  // Keep the options ref updated if the options prop changes.
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Callback function to handle successful geolocation events.
   * Updates the state with the new position data.
   */
  const onEvent = useCallback((event: GeolocationPosition) => {
    setState({
      loading: false,
      accuracy: event.coords.accuracy,
      altitude: event.coords.altitude,
      altitudeAccuracy: event.coords.altitudeAccuracy,
      heading: event.coords.heading,
      latitude: event.coords.latitude,
      longitude: event.coords.longitude,
      speed: event.coords.speed,
      timestamp: event.timestamp,
      error: null,
    });
  }, []);

  /**
   * Callback function to handle geolocation errors.
   * Updates the state with the error information.
   */
  const onEventError = useCallback((error: GeolocationPositionError) => {
    setState((s) => ({
      ...s,
      loading: false,
      error,
    }));
  }, []);

  /**
   * Manually triggers a request for the user's current position.
   */
  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      onEventError({
        code: 0,
        message: "Geolocation is not supported.",
      } as GeolocationPositionError);
      return;
    }

    setState((s) => ({ ...s, loading: true }));
    navigator.geolocation.getCurrentPosition(
      onEvent,
      onEventError,
      optionsRef.current
    );
  }, [onEvent, onEventError]);

  return { ...state, getPosition };
};
