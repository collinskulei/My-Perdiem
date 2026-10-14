/**
 * @file The per-client modules a Super Admin can switch on for a client
 * (client_modules, 0030_client_modules.sql - keep MODULE_KEYS in sync with
 * that table's check constraint). Each module has its own dashboard under
 * a portal's base path:
 *
 *   <portal>/home       overall Insights across every enabled module
 *   <portal>/dashboard  Per Diem Payments (the app's original dashboard -
 *                       its URL is unchanged so bookmarks, tours and links
 *                       keep working)
 *   <portal>/salary     Salary Payments
 *   <portal>/hotels     Hotel Bookings
 *   <portal>/funding    Funding & Refunds (money received - never added
 *                       into a spend total, see `direction`)
 *
 * where <portal> is /super-admin, /master-admin or /<slug>-admin.
 */
import type { ComponentType } from "react";
import { Wallet, Banknote, Hotel, HandCoins } from "lucide-react";

export type ModuleKey = "perdiem" | "salary" | "hotels" | "funding";

export const MODULE_KEYS: ModuleKey[] = ["perdiem", "salary", "hotels", "funding"];

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Chart/series color, from the Insights palette (insights/shared.tsx). */
  color: string;
  /** Path segment under the portal base. */
  segment: string;
  /** "out" = money paid out (counts towards spend totals); "in" = money
   * received (shown on its own, never summed with spend). */
  direction: "out" | "in";
};

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  perdiem: {
    key: "perdiem",
    label: "Per Diem Payments",
    description: "Events, check-ins, per diem requests and payments.",
    icon: Wallet,
    color: "#3b82f6",
    segment: "dashboard",
    direction: "out",
  },
  salary: {
    key: "salary",
    label: "Salary Payments",
    description: "Monthly payroll records per employer, with historical uploads.",
    icon: Banknote,
    color: "#10b981",
    segment: "salary",
    direction: "out",
  },
  hotels: {
    key: "hotels",
    label: "Hotel Bookings",
    description: "Payments to hotels for events and staff accommodation.",
    icon: Hotel,
    color: "#f59e0b",
    segment: "hotels",
    direction: "out",
  },
  funding: {
    key: "funding",
    label: "Funding & Refunds",
    description: "Money received - reimbursements from funders, reconciled against what was paid out.",
    icon: HandCoins,
    color: "#8b5cf6",
    segment: "funding",
    direction: "in",
  },
};

/** Modules whose amounts are money paid out. */
export const isSpendModule = (key: ModuleKey) => MODULES[key].direction === "out";

export function modulePath(portalBase: string, key: ModuleKey): string {
  return `${portalBase}/${MODULES[key].segment}`;
}

export function homePath(portalBase: string): string {
  return `${portalBase}/home`;
}
