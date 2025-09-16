/**
 * @file This file defines the content for the onboarding tutorials.
 * It separates the tutorial steps from the component logic for easier management.
 */

/**
 * Defines the structure for a single step in the onboarding tutorial.
 */
export type OnboardingStep = {
  /** The title of the step. */
  title: string;
  /** The descriptive text for the step. */
  description: string;
  /** The URL of the image to display for the step. */
  imageUrl: string;
  /** A hint for AI image generation, typically one or two keywords. */
  imageHint: string;
};

/**
 * Onboarding steps for the Admin Dashboard.
 */
export const adminOnboardingSteps: OnboardingStep[] = [
  {
    title: "Manage Per Diem Requests",
    description: "Review, approve, reject, or mark requests as paid directly from the main table. Use the actions menu on each row.",
    imageUrl: "https://picsum.photos/seed/onboard-admin-1/600/400",
    imageHint: "dashboard table",
  },
  {
    title: "Create and Manage Events",
    description: "Use the 'Events' tab to see all events. Click 'Add Event' to create a new one and assign employees to it.",
    imageUrl: "https://picsum.photos/seed/onboard-admin-2/600/400",
    imageHint: "event calendar",
  },
  {
    title: "Oversee Employees and Venues",
    description: "The 'Employees' and 'Venues' tabs allow you to view all registered personnel and event locations.",
    imageUrl: "https://picsum.photos/seed/onboard-admin-3/600/400",
    imageHint: "team members",
  },
  {
    title: "Generate Detailed Reports",
    description: "Click the 'Download Report' button to generate filtered PDF or CSV reports for per diem requests.",
    imageUrl: "https://picsum.photos/seed/onboard-admin-4/600/400",
    imageHint: "financial report",
  },
];


/**
 * Onboarding steps for the Employee Dashboard.
 */
export const employeeOnboardingSteps: OnboardingStep[] = [
  {
    title: "Your Event Hub",
    description: "The 'My Upcoming Events' table shows all events you're assigned to. This is where your per diem process begins.",
    imageUrl: "https://picsum.photos/seed/onboard-emp-1/600/400",
    imageHint: "dashboard list",
  },
  {
    title: "Check-in to Activate",
    description: "On the day of the event, a 'Check-in' button will become active. You must check in to be able to request a per diem.",
    imageUrl: "https://picsum.photos/seed/onboard-emp-2/600/400",
    imageHint: "location pin",
  },
  {
    title: "Request Your Per Diem",
    description: "After checking in, the 'Request Per Diem' button will appear. This will take you to a wizard to fill out your claim.",
    imageUrl: "https://picsum.photos/seed/onboard-emp-3/600/400",
    imageHint: "request form",
  },
    {
    title: "Track Your Requests",
    description: "The 'Recent Per Diem Requests' table shows the status of all your submissions, from 'Pending' to 'Paid'.",
    imageUrl: "https://picsum.photos/seed/onboard-emp-4/600/400",
    imageHint: "status history",
  },
];
