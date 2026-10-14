/**
 * @file The per-client modules a Super Admin can switch on for a client
 * (client_modules, 0030_client_modules.sql - keep MODULE_KEYS in sync with
 * that table's check constraint). Each module has its own dashboard under
 * a portal's base path:
 *
 *   <portal>/home            overall Insights across every enabled module
 *   <portal>/dashboard       Per Diem Payments (the app's original
 *                            dashboard - its URL is unchanged so
 *                            bookmarks, tours and links keep working)
 *   <portal>/salary          Salary Payments
 *   <portal>/facilitations   Other Project Facilitations - a group, not a
 *                            module: a combined overview of its submodules
 *     <portal>/hotels        Hotel Bookings            (submodule)
 *     <portal>/travel        Travel & Ground Transfers (submodule)
 *   <portal>/funding         Refunds
 *
 * where <portal> is /super-admin, /master-admin or /<slug>-admin. Each
 * submodule is switched on per client like any module; its group shows
 * whenever at least one of them is on.
 */
import type { ComponentType } from "react";
import { Wallet, Banknote, Hotel, HandCoins, Plane, Briefcase } from "lucide-react";

export type ModuleKey = "perdiem" | "salary" | "hotels" | "travel" | "funding";

export const MODULE_KEYS: ModuleKey[] = ["perdiem", "salary", "hotels", "travel", "funding"];

export type GroupKey = "facilitations";

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Chart/series color, from the Insights palette (insights/shared.tsx). */
  color: string;
  /** Path segment under the portal base. */
  segment: string;
  /** The group this module is a submodule of, if any. */
  group?: GroupKey;
};

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  perdiem: {
    key: "perdiem",
    label: "Per Diem Payments",
    description: "Events, check-ins, per diem requests and payments.",
    icon: Wallet,
    color: "#3b82f6",
    segment: "dashboard",
  },
  salary: {
    key: "salary",
    label: "Salary Payments",
    description: "Monthly payroll records per employer, with historical uploads.",
    icon: Banknote,
    color: "#10b981",
    segment: "salary",
  },
  hotels: {
    key: "hotels",
    label: "Hotel Bookings",
    description: "Payments to hotels for events and staff accommodation.",
    icon: Hotel,
    color: "#f59e0b",
    segment: "hotels",
    group: "facilitations",
  },
  travel: {
    key: "travel",
    label: "Travel & Ground Transfers",
    description: "Flight bookings, rescheduling and ground transport for events.",
    icon: Plane,
    color: "#06b6d4",
    segment: "travel",
    group: "facilitations",
  },
  funding: {
    key: "funding",
    label: "Refunds",
    description: "Refund payments made, recorded per invoice.",
    icon: HandCoins,
    color: "#8b5cf6",
    segment: "funding",
  },
};

export type GroupInfo = {
  key: GroupKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  segment: string;
  modules: ModuleKey[];
};

export const GROUPS: Record<GroupKey, GroupInfo> = {
  facilitations: {
    key: "facilitations",
    label: "Other Project Facilitations",
    description: "Hotel bookings, flights and ground transfers paid for project events.",
    icon: Briefcase,
    color: "#f97316",
    segment: "facilitations",
    modules: ["hotels", "travel"],
  },
};

/** A top-level entry in the sidebar / on Home: a standalone module, or a
 * group with its enabled submodules. */
export type ModuleEntry =
  | { kind: "module"; key: ModuleKey }
  | { kind: "group"; key: GroupKey; modules: ModuleKey[] };

/** The enabled modules as top-level entries, in MODULE_KEYS order; a group
 * takes the place of its first enabled submodule. */
export function moduleEntries(enabled: ModuleKey[]): ModuleEntry[] {
  const out: ModuleEntry[] = [];
  for (const key of MODULE_KEYS) {
    if (!enabled.includes(key)) continue;
    const group = MODULES[key].group;
    if (!group) {
      out.push({ kind: "module", key });
    } else if (!out.some((e) => e.kind === "group" && e.key === group)) {
      out.push({ kind: "group", key: group, modules: GROUPS[group].modules.filter((m) => enabled.includes(m)) });
    }
  }
  return out;
}

export function modulePath(portalBase: string, key: ModuleKey): string {
  return `${portalBase}/${MODULES[key].segment}`;
}

export function groupPath(portalBase: string, key: GroupKey): string {
  return `${portalBase}/${GROUPS[key].segment}`;
}

export function homePath(portalBase: string): string {
  return `${portalBase}/home`;
}
