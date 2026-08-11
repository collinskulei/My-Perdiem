/**
 * @file Step definitions for the admin "Guide me" tour, shared by all three
 * admin tiers (client_admin/super_admin/master_admin) since they all render
 * the same src/app/admin/admin-dashboard.tsx. Steps target the TabsTrigger
 * buttons via data-tour attributes (always mounted regardless of the active
 * tab - see participant-tour.ts's file comment for why that avoids any
 * render-timing issues), and the "management"/"clients" steps are only
 * included for the tiers that can actually see those tabs, matching the
 * same gates admin-dashboard.tsx itself uses.
 */
import type { DriveStep } from "driver.js";
import type { AccessTier } from "@/lib/data";

function tabStep(tab: string, title: string, description: string, setActiveTab: (tab: string) => void): DriveStep {
  return {
    element: `[data-tour="tab-${tab}"]`,
    onHighlightStarted: () => setActiveTab(tab),
    popover: { title, description, side: "bottom", align: "start" },
  };
}

export function buildAdminTourSteps({
  setActiveTab,
  accessTier,
}: {
  setActiveTab: (tab: string) => void;
  accessTier: AccessTier;
}): DriveStep[] {
  const canManage = accessTier !== "client_user";
  const isMultiClientAdmin = accessTier === "super_admin" || accessTier === "master_admin";

  const steps: DriveStep[] = [
    {
      popover: {
        title: "Welcome to your dashboard",
        description: "A quick tour of everything you can do here. Use Next/Back to move around, or Esc to stop anytime.",
      },
    },
    tabStep("requests", "Per Diem Requests", "Review, approve, reject, or mark per diem requests as paid.", setActiveTab),
    tabStep("events", "Events", "Create and manage events, including participant allocation.", setActiveTab),
    tabStep("checkins", "Event Check-ins", "See who has checked in to each event.", setActiveTab),
    tabStep("participants", "Participants", "Manage participant accounts - add, deactivate, or reactivate.", setActiveTab),
    tabStep("venues", "Venues", "Manage the venue list events can be held at.", setActiveTab),
    tabStep("reports", "Reports", "Filter and export per diem data.", setActiveTab),
    tabStep("analytics", "Analytics", "Platform-wide per diem trends and summaries.", setActiveTab),
  ];

  if (canManage) {
    steps.push(
      tabStep(
        "management",
        "Manage",
        accessTier === "master_admin"
          ? "Invite Super Admins and manage every admin-tier account."
          : accessTier === "super_admin"
          ? "See admin accounts across the platform."
          : "Invite and manage your organization's Client Admins.",
        setActiveTab
      )
    );
  }

  if (isMultiClientAdmin) {
    steps.push(
      tabStep(
        "clients",
        "Clients",
        "Every client on the platform, with live admin/participant counts, work types, and quick actions to manage each one.",
        setActiveTab
      )
    );
  }

  steps.push({
    element: '[data-tour="account-menu"]',
    popover: {
      title: "Profile & Settings",
      description: "Update your personal details under Profile, and switch between light/dark mode under Settings. You can restart this guide anytime from here.",
      side: "left",
      align: "start",
    },
  });

  return steps;
}
