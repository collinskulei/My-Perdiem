"use client";

import { useState, useCallback } from "react";

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
    loading: false,
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    latitude: null,
    longitude: null,
    speed: null,
    timestamp: null,
    error: null,
  });

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        error: {
          code: 0,
          message: "Geolocation is not supported.",
        } as GeolocationPositionError,
      }));
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          loading: false,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
          timestamp: position.timestamp,
          error: null,
        });
      },
      (error) => {
        setState((s) => ({ ...s, loading: false, error }));
      },
      options
    );
  }, [options]);

  return { ...state, getPosition };
};
