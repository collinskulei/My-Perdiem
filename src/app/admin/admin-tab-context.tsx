/**
 * @file Shared "which admin tab is active" state, provided above both the
 * sidebar (admin-sidebar-navigation.tsx) and the dashboard content
 * (admin-dashboard.tsx) in admin-layout.tsx - the nearest common ancestor.
 *
 * Why this exists: the dashboard routes are all `force-dynamic` Server
 * Components reading `searchParams.tab` (see admin/page.tsx and its
 * client-admin/master-admin/super-admin siblings). Before this file, the
 * sidebar's plain `<Link href="...?tab=X">` was the only way tabs changed,
 * which meant every click waited on a full server round-trip (new
 * searchParams -> page.tsx re-renders -> new `currentTab` prop -> a
 * useEffect -> setState) before the content switched - a real, noticeable
 * delay that didn't exist when a horizontal TabsList's `onValueChange` used
 * to update local state synchronously on click. This context restores that
 * instant switch: the sidebar calls `setActiveTab` directly in its `onClick`
 * (no network wait), while the `<Link>`'s normal navigation still updates
 * the URL in the background for bookmarking/back-forward support.
 */
"use client";

import { createContext, useContext, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";

type AdminTabContextValue = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const AdminTabContext = createContext<AdminTabContextValue | null>(null);

export function AdminTabProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  // Initial value only - after mount, setActiveTab (sidebar clicks) and the
  // admin-dashboard.tsx currentTab-prop sync (browser back/forward, direct
  // URL visits) are what keep this current, not re-reading searchParams
  // continuously.
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "requests");

  const value = useMemo(() => ({ activeTab, setActiveTab }), [activeTab]);

  return <AdminTabContext.Provider value={value}>{children}</AdminTabContext.Provider>;
}

export function useAdminTab(): AdminTabContextValue {
  const ctx = useContext(AdminTabContext);
  if (!ctx) {
    throw new Error("useAdminTab must be used within an AdminTabProvider (see admin-layout.tsx)");
  }
  return ctx;
}
