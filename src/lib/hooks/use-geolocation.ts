"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

export const useGeolocation = (options: PositionOptions = {}) => {
  const [state, setState] = useState<GeolocationState>({
    loading: true,
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    latitude: 0,
    longitude: 0,
    speed: null,
    timestamp: Date.now(),
    error: null,
  });
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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

  const onEventError = useCallback((error: GeolocationPositionError) => {
    setState((s) => ({
      ...s,
      loading: false,
      error,
    }));
  }, []);

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
