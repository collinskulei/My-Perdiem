/**
 * @file Carries the admin dashboard's server-prefetched initial dataset (see
 * get-initial-dashboard-data.ts) from each portal's layout.tsx down to
 * AdminDashboard via context, instead of a prop passed through page.tsx.
 *
 * This has to be layout-level, not page-level: page.tsx receives searchParams
 * and Next.js re-renders it on every ?tab= change, so a page.tsx-level fetch
 * re-ran the full dataset fetch on every sidebar click. Layouts don't receive
 * searchParams and Next.js reuses the existing layout render across
 * searchParams-only navigation, so fetching here means it only runs once per
 * real page load, not per tab switch.
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { InitialAdminDashboardData } from "./get-initial-dashboard-data";

const AdminDashboardDataContext = createContext<InitialAdminDashboardData | null>(null);

export function AdminDashboardDataProvider({
  data,
  children,
}: {
  data: InitialAdminDashboardData | null;
  children: ReactNode;
}) {
  return (
    <AdminDashboardDataContext.Provider value={data}>
      {children}
    </AdminDashboardDataContext.Provider>
  );
}

export function useInitialAdminDashboardData(): InitialAdminDashboardData | null {
  return useContext(AdminDashboardDataContext);
}
