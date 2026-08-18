/**
 * @file Step definitions for the admin "Guide me" tour, shared by all three
 * admin tiers (client_admin/super_admin/master_admin) since they all render
 * the same src/app/admin/admin-dashboard.tsx. The horizontal TabsList that
 * used to carry these data-tour attributes was removed in favor of the
 * sidebar as the single navigation surface (see admin-sidebar-navigation.tsx)
 * - steps now target the sidebar's links/buttons via the same data-tour
 * attributes, unchanged by that move since the tab value strings didn't
 * change. Each sidebar group (Events, Reports, Manage) defaults open so
 * every target stays queryable without first expanding anything. The
 * "management"/"clients"/"documents"/"submissions"/"insights" steps are
 * only included for the tiers that can actually see those items, matching
 * the same gates admin-sidebar-navigation.tsx itself uses.
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

  if (isMultiClientAdmin) {
    steps.push(
      tabStep(
        "insights",
        "Insights",
        "A full analytics view across every client - financials, staff/employer breakdowns, training trends, and cross-client comparisons, all exportable as PDF.",
        setActiveTab
      )
    );
  }

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

  if (accessTier === "client_admin") {
    steps.push(
      tabStep(
        "documents",
        "Documents",
        "Upload payment-list documents directly in your OneDrive folder, then sync here to track their status.",
        setActiveTab
      )
    );
  }

  if (isMultiClientAdmin) {
    steps.push(
      tabStep(
        "submissions",
        "Submissions",
        "Every client's uploaded documents in one queue - open a file in OneDrive, then mark it Processing/Done once you've cleaned the data and paid.",
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
