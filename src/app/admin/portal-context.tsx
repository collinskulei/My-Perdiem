/**
 * @file Which portal (super/master/client) and client the admin UI is
 * rendering for, and that client's enabled modules - resolved once on the
 * server by resolvePortal() (portal-access.ts) and handed down from each
 * layout, so the sidebar's module switcher and the module dashboards
 * don't each re-derive it. null under the legacy generic /admin portal,
 * which predates modules and only ever shows Per Diem.
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PortalInfo } from "./portal-access";

const PortalContext = createContext<PortalInfo | null>(null);

export function PortalProvider({ portal, children }: { portal: PortalInfo | null; children: ReactNode }) {
  return <PortalContext.Provider value={portal}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalInfo | null {
  return useContext(PortalContext);
}
