 # Per Diem Pro Application

Welcome to Per Diem Pro, a streamlined application designed to simplify how participants request and manage per diem allowances for work-related events. This document provides a comprehensive overview of the application's features and workflows for both Participant and Admin users.
npm run bu
## Table of Contents
1.  [Core Features](#core-features)
2.  [Test Mode](#test-mode)
3.  [User Roles & Workflows](#user-roles--workflows)
    *   [Participant Workflow](#participant-workflow)
    *   [Admin Workflow](#admin-workflow)
4.  [Getting Started](#getting-started)

---

## Core Features

*   **Role-Based Access Control**: Separate, secure login and dashboard experiences for Participants and Administrators.
*   **Event Management (Admin)**: Admins can create, view, and manage events, including assigning specific participants to them.
*   **Venue Management (Admin)**: Admins can create and manage a list of venues where events are held.
*   **Participant Management (Admin)**: Admins have a central view of all registered participants in the system.
*   **Daily Event Check-in (Participant)**: Participants can check-in daily for multi-day events they are assigned to, verifying their attendance. This uses geolocation in the live app to ensure the participant is at the event venue.
*   **Attendance Tracking (Both)**:
    *   **Participants** see a color-coded progress bar for each event, showing their attendance percentage.
    *   **Admins** see a high-level count of total check-ins per event and a detailed daily check-in grid for active events.
*   **Automated Per Diem Requests (Participant)**: After successfully checking in for all days of an event, participants can access a multi-step wizard to request their per diem, with many calculations automated based on their job group and travel distance.
*   **Request Management (Admin)**: Admins can review, approve, mark as paid, or reject per diem requests submitted by participants.
*   **Reporting (Admin)**: Admins can generate and download filtered reports of all per diem requests in both PDF and CSV formats.

---

## Test Mode

The application includes a **Test Mode** to allow for easy testing and demonstration without needing real user accounts, live database connections, or physical location data.

### How to Enable Test Mode
On the login page, simply toggle the **"Test Mode"** switch. The page will reload, and you can then log in as a test user without needing an email or password.

### What Test Mode Does
*   **Uses Mock Data**: The app uses pre-populated, in-memory data (via `localStorage`) instead of connecting to the live Firestore database.
*   **Bypasses Authentication**: You can log in as a pre-configured test participant or admin with a single click.
*   **Disables Geolocation**: The event check-in feature bypasses the real-world location check, allowing you to simulate check-ins from anywhere. A "Check-in Successful!" message provides positive feedback instantly.

---

## User Roles & Workflows

### Participant Workflow

1.  **Login**: On the login page, select the "Participant" tab.
    *   In **Live Mode**, enter your registered email and password.
    *   In **Test Mode**, simply click "Login as Participant".
2.  **View Dashboard**: The dashboard displays a welcome message and two main sections:
    *   **My Upcoming Events**: A list of events you are allocated to.
    *   **Recent Per Diem Requests**: A history of your submitted requests and their status (Pending, Approved, Paid, Rejected).
3.  **Event Check-in**:
    *   For each active event, you will see a series of check-in buttons, one for each day of the event.
    *   Buttons for future dates are visible but disabled.
    *   The button for the **current date** will be active. Click it to record your attendance for the day.
    *   As you check-in, the **Attendance** progress bar will update. The color indicates your progress:
        *   **Red**: 0% attendance.
        *   **Orange**: > 0% and < 100% attendance.
        *   **Green**: 100% attendance.
4.  **Request Per Diem**:
    *   Once you have checked in for **all** required days of an event (the progress bar is 100% green), a **"Request Per Diem"** button will appear.
    *   Clicking this button opens a multi-step wizard that guides you through submitting your claim, with transport and allowance costs automatically calculated.
5.  **View Profile**: You can navigate to your profile page to view and update your personal information.

### Admin Workflow

1.  **Login**: On the login page, select the "Admin" tab.
    *   In **Live Mode**, enter your registered admin email and password.
    *   In **Test Mode**, simply click "Login as Admin".
2.  **View Dashboard**: The admin dashboard is organized into a series of tabs for managing different aspects of the system.
3.  **Manage Per Diem Requests**:
    *   In the **"Perdiem Requests"** tab, view a list of all submitted requests.
    *   Use the "Actions" menu on each request to **Approve**, **Mark as Paid**, or **Reject** a claim.
4.  **Manage Events**:
    *   In the **"Events"** tab, you can view all created events.
    *   Click the **"Add Event"** button to open a dialog where you can define a new event, set its date range, assign a venue, and allocate participants.
    *   The **"Attendance"** column shows the total number of check-ins recorded for each event.
5.  **Monitor Event Check-ins**:
    *   Navigate to the **"Event Check-ins"** tab.
    *   This section contains sub-tabs for each **currently active event**.
    *   Within each sub-tab, you'll find a detailed grid showing which participants have checked in on which specific days.
6.  **Manage Participants & Venues**:
    *   Use the **"Participants"** and **"Venues"** tabs to view all registered participants and venues.
    *   In the "Venues" tab, you can add new venues, which become available for selection when creating events.
7.  **Generate Reports**:
    *   Click the **"Download Report"** button.
    *   In the dialog, you can filter per diem requests by date range and/or venue.
    *   You can then generate a comprehensive report in either **PDF** or **CSV** format.
8.  **View Profile**: Admins can also view and edit their own profile information.

---

## Development & Deployment

This app runs on [Supabase](https://supabase.com) (Postgres database, Auth, and Storage) and deploys to [Vercel](https://vercel.com).

### Set up Supabase

1.  Create a new project at [supabase.com](https://supabase.com).
2.  Run the SQL in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the Supabase SQL Editor to create the tables, `is_admin()` helper, and Row Level Security policies. Optionally also run [`supabase/seed.sql`](supabase/seed.sql) to seed a few sample venues.
3.  Create a public Storage bucket named `event-files` (Storage -> New bucket -> toggle "Public bucket"). This is where admin-uploaded event program/letter files are stored.
4.  Under Authentication -> Providers -> Email, turn **off** "Confirm email". Registration in this app creates the account and logs the user in immediately (matching the previous Firebase Auth behavior), so email confirmation must stay disabled.
5.  Copy your Project URL and `anon` public key from Settings -> API into `.env`:
    ```
    NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

### Deploy to Vercel

This is a standard Next.js app, so Vercel needs no special configuration:

1.  Import the repository into Vercel.
2.  Add the environment variables from your `.env` file (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) in the Vercel project settings.
3.  Deploy. Vercel auto-detects the Next.js build (`next build`) and run (`next start`) commands.

---

## Getting Started

1.  **Register an Account**: New users can navigate to the registration page from the login screen. The form dynamically adapts based on whether you are registering as a Participant or an Admin.
2.  **Login**: Once registered, log in to your respective dashboard.
3.  **Explore**: Use this guide and the in-app "Test Mode" to explore the features and workflows.
