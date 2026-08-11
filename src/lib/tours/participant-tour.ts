/**
 * @file Step definitions for the participant "Guide me" tour. Targets the
 * TabsTrigger buttons in src/app/dashboard/employee-dashboard.tsx (always
 * present in the DOM regardless of which tab is active, since Radix Tabs
 * keeps every trigger mounted - only the content panel toggles) via
 * data-tour attributes, so there's no need to wait for a tab to render
 * before highlighting the next step.
 */
import type { DriveStep } from "driver.js";

function tabStep(tab: string, title: string, description: string, setActiveTab: (tab: string) => void): DriveStep {
  return {
    element: `[data-tour="tab-${tab}"]`,
    onHighlightStarted: () => setActiveTab(tab),
    popover: { title, description, side: "bottom", align: "start" },
  };
}

export function buildParticipantTourSteps({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}): DriveStep[] {
  return [
    {
      popover: {
        title: "Welcome to MyPerdiem",
        description: "A quick tour of everything on your dashboard. Use Next/Back to move around, or Esc to stop anytime.",
      },
    },
    tabStep("events", "My Events", "Events you're registered for or invited to attend show up here.", setActiveTab),
    tabStep("checkins", "My Check-ins", "Check in to an event (usually by scanning its QR code) and see your check-in history.", setActiveTab),
    tabStep("requests", "My Per Diem Requests", "Submit a new per diem request for an event and track its approval status.", setActiveTab),
    tabStep("analytics", "My Analytics", "A summary of your per diem history over time.", setActiveTab),
    {
      element: '[data-tour="account-menu"]',
      popover: {
        title: "Profile & Settings",
        description: "Update your personal details under Profile, and switch between light/dark mode under Settings. You can restart this guide anytime from here.",
        side: "left",
        align: "start",
      },
    },
  ];
}
