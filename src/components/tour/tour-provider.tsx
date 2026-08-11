/**
 * @file Bridges "Guide me" (in the account-menu dropdown, a sibling of the
 * page content) to the currently-active dashboard's own tour definition (a
 * descendant of {children}). Each dashboard registers its own tour builder
 * on mount, since only it knows its own tab-switch function and (for admin)
 * which tabs the current tier can see; the header just calls startTour().
 */
"use client";

import { createContext, useCallback, useContext, useRef } from "react";

type TourFn = () => void;

type TourContextValue = {
  registerTour: (fn: TourFn | null) => void;
  startTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const tourRef = useRef<TourFn | null>(null);

  const registerTour = useCallback((fn: TourFn | null) => {
    tourRef.current = fn;
  }, []);

  const startTour = useCallback(() => {
    tourRef.current?.();
  }, []);

  return (
    <TourContext.Provider value={{ registerTour, startTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return ctx;
}
