# Manual Test Guide

A living checklist for manually verifying MyPerdiem's features. This is not
an automated test suite (none exists in this repo yet - no Jest/Playwright)
- it's a click-through guide for a human (or a browser-automation session)
to confirm things still work.

## How to use / maintain this guide

- **Update this file whenever a feature is added or changed.** Add a new
  section (or extend an existing one) with concrete steps and expected
  results - don't just note "add tests later." This is a standing project
  convention, not a one-off request.
- Each section lists **Prerequisites**, numbered **Steps**, and **Expected**
  results. Keep steps concrete (exact URLs, button labels, field values) so
  anyone can follow them without reading the code first.
- Mark a section `[Verified live: YYYY-MM-DD]` once someone has actually run
  it against the live Supabase project in a real browser. Until then, leave
  it unmarked - "written" and "verified" are different states, and
  `docs/MILESTONE_HANDOFF.md` has repeatedly noted sessions with no browser
  tool available. Don't mark a section verified from code review alone.
- If a feature is removed or replaced, remove or rewrite its section instead
  of leaving stale steps behind.
- For DB/RLS-level checks that don't need a browser (role hierarchy, RLS
  denials), a `curl`/PostREST check counts as verification too - note it as
  `[Verified via API: YYYY-MM-DD]` instead.

---

## 1. Participant login and core flows

**Prerequisites:** A registered `client_user` account for an existing client.

1. Visit `/` (landing page). Confirm it shows a single participant login
   form - no "Admin" tab (removed; admins use their own portals, see §3-5).
2. Log in with valid participant credentials → redirected to `/dashboard`.
3. Log in with wrong password → error toast, stays on `/`.
4. From `/dashboard`, submit a per-diem request, check in to an event via QR
   code, and confirm the "Forgot Password?" link on `/` sends a reset email.
5. Open the account menu (top right) → **Settings** → confirm it links to
   `/settings` (not dead) and **Profile** → `/profile`.

**Expected:** Only participants can use `/`; wrong tier or wrong password is
rejected with a clear toast; Settings/Profile links both work.

---

## 2. Registration (invite-link based)

**Prerequisites:** A valid client ID for the `?client=` link.

1. Visit `/register?client=<validClientId>` → shows the client's name and
   lets registration proceed.
2. Visit `/register?client=<bogusUuid>` or `/register` with no `client`
   param → shows an invalid-link state, registration blocked.
3. Complete registration → new account is `access_tier = client_user` for
   that client, can log in at `/`.

**Expected:** Self-registration always requires a valid, unarchived client
link and always creates a `client_user` - never an admin tier.

---

## 3. Client Admin portal (`/<clientname>-admin`)

**Prerequisites:** A client with a known slug (check `clients.slug` in
Supabase, or the client's row in Master/Super Admin's Clients tab) and an
existing Client Admin account for it.

1. Visit `/<slug>-admin` (e.g. `/apeiro-admin`) → shows a login form titled
   with that client's name (confirms the slug resolved via
   `get_client_by_slug`). An unknown slug shows "This admin portal doesn't
   exist."
2. Log in with that client's Client Admin credentials → redirected to
   `/<slug>-admin/dashboard`.
3. Log in with a **different** client's Client Admin credentials at this
   same URL → rejected ("You do not have access to this portal."), signed
   back out.
4. Log in with a Super Admin's credentials at this URL → rejected (tier
   mismatch). Master Admin's credentials currently succeed for any client
   slug - ⚠️ TEMPORARY testing-only bypass, see
   `docs/MILESTONE_HANDOFF.md`'s "Current repo state"; re-test this as
   "rejected" once that bypass is revoked.
5. On the dashboard, confirm the sidebar's internal links all stay under
   `/<slug>-admin/dashboard?tab=...` (check the URL bar when switching
   tabs) - not `/admin`.
6. Confirm the account-menu shows "Client Admin" as the portal label, and
   **Logout** sends you back to `/<slug>-admin` (this client's own login),
   not the generic `/`.
7. While signed out, visit `/<slug>-admin/dashboard` directly → redirected
   to `/<slug>-admin` (server-side guard, not just a client-side check).

**Expected:** Each client's portal only accepts that client's Client Admin;
tab navigation and logout stay scoped to that portal.

---

## 4. Super Admin portal (`/super-admin`)

**Prerequisites:** A Super Admin account.

1. Visit `/super-admin` → login form titled "Super Admin".
2. Log in with a Client Admin's credentials → rejected. Master Admin's
   credentials currently succeed too - see the ⚠️ TEMPORARY testing-only
   note in `docs/MILESTONE_HANDOFF.md`'s "Current repo state"; re-test this
   as "rejected" once that bypass is revoked.
3. Log in with valid Super Admin credentials → redirected to
   `/super-admin/dashboard`.
4. Sidebar shows a **Clients** item (not shown to Client Admins). Open it →
   `?tab=clients` shows a grid of client cards, each with:
   - Live admin/participant counts.
   - **Invite Client Admin** dialog (sends an email invite; new account
     lands as `client_admin` for that card's client only).
   - **View Participants** → jumps to the Participants tab pre-filtered to
     that client via the new client `Select` filter (only visible to
     Super/Master Admin).
   - Work Types expand/collapse: add one, then remove it via the trash icon.
5. Add a brand-new client from the top of the Clients tab → appears in the
   grid immediately, gets an auto-generated slug (check its portal login
   works at `/<newslug>-admin`).
6. Sidebar's **Manage** tab shows only the Admins table (no client list
   here anymore - that moved to Clients).
7. Signed out, visit `/super-admin/dashboard` directly → redirected to
   `/super-admin`.

**Expected:** Super Admin sees all clients platform-wide with working
per-client actions; a brand-new client is immediately usable end-to-end.

---

## 5. Master Admin portal (`/master-admin`)

**Prerequisites:** A Master Admin account (seed: `collins.kulei@iacentre.co.ke`
in the original migration - confirm the real one in use) and at least one
Super Admin and one Client Admin account to act on.

1. Visit `/master-admin` → login form titled "Master Admin". Wrong-tier
   credentials rejected, same as §3-4.
2. Log in → `/master-admin/dashboard`. Confirm the **Clients** tab (same
   widget grid as §4) and **Manage** tab (Admins table) are both present.
3. In the Admins table, invite a new Super Admin.
4. **Demote** an existing Super Admin (not the one you just invited, to
   avoid emptying the tier if only one exists) → confirm the AlertDialog
   warning, confirm → their row disappears from the admin list and they
   become a plain participant. This was previously impossible from the UI
   (Master Admin could only invite/view) - confirm it now works.
5. Demote a Client Admin the same way.
6. Confirm you **cannot** demote yourself (no Demote button on your own
   row) and cannot demote another Master Admin (no Demote button on
   Master Admin rows, even though the underlying RPC would technically
   allow it).

**Expected:** Master Admin can invite Super Admins and demote any Super or
Client Admin; self and peer-Master-Admin targets are protected in the UI.

---

## 6. Cross-portal isolation (do this after §3-5 all pass individually)

1. While logged in as Client A's Client Admin, try navigating directly to
   `/<clientB-slug>-admin/dashboard` → redirected to Client B's login
   (server-side guard checks the session's `client_id` against the URL's
   slug, not just tier).
2. Try `/super-admin/dashboard` and `/master-admin/dashboard` while logged
   in as any Client Admin → both redirect away.
3. Try `/<any-slug>-admin` while logged in as a Super Admin → tier mismatch,
   rejected.
4. **Skip while the ⚠️ TEMPORARY testing bypass is active** (see
   `docs/MILESTONE_HANDOFF.md`): Master Admin can currently reach every
   portal by design for testing. Once revoked, add back "Master Admin is
   rejected from `/<any-slug>-admin` and `/super-admin`" as a step here.

**Expected (once the temporary bypass is revoked):** No account can reach a
dashboard outside its own tier/client, regardless of which URL is typed
directly.

---

## 7. Historical data import

**Prerequisites:** Super Admin or above; a sample bulk-payment spreadsheet
(NAME, PHONE NUMBER, AMOUNT, DESCRIPTION columns).

1. From a client's card in the Clients tab, open **Import Historical Data**.
2. Upload the file → confirm column auto-mapping guesses correctly, but is
   editable.
3. Batch Details step: everything is now optional (event name is no longer
   required to proceed) → click Next straight away if the sheet already has
   its own Event Name column mapped in the next step. Preview still flags
   any row with neither a mapped column nor a default event name.
4. Confirm import → event/venue created if new, phone numbers normalized to
   `+254XXXXXXXXX`, rows with no matching participant show
   `participant_id: null` with the name/phone snapshot kept.
5. Re-import a second batch for the **same** event name at the same client
   → confirm it appends rows to the existing event rather than duplicating
   it (this path was previously only verified by code review, not real
   data - see `docs/MILESTONE_HANDOFF.md` Milestone 4).
6. Upload a **multi-sheet** workbook (e.g. one tab per quarter/month) →
   confirm a sheet picker appears listing only sheets that actually have
   data (title-only/empty sheets excluded), and that a single-sheet file
   still skips the picker entirely and auto-advances.
7. Upload a sheet with a few title/note rows before the real header row →
   confirm the app finds the real header row on its own (check the Map
   Columns step lands on the right columns, not on "No." style row-number
   junk).
8. Upload a sheet containing `"<Event> — EVENT TOTAL"` / `"GRAND TOTAL"`
   -style summary rows (real column position: same column as participant
   name, with a real number in the amount column) → confirm these show up
   in preview as excluded ("Looks like a total/summary row, not a
   participant"), not as extra "participants" worth suspiciously large
   amounts. This was a real risk found and fixed this session - worth
   never regressing.
9. Map a real date column (one containing actual Excel dates, not text) →
   confirm the imported request's date renders correctly on the Requests
   tab afterward, not as a raw number like "45931". This actually broke
   production once already this session - reached live via this exact
   path (see `docs/MILESTONE_HANDOFF.md`'s importer-hardening follow-up) -
   before the fix, this crashed the *entire* dashboard page for every
   viewer, not just the one bad cell. Also worth confirming a deliberately
   bad/unmapped date doesn't crash the page either way, on both the admin
   dashboard's Requests/Events tabs and the participant dashboard's "My Per
   Diem Requests" tab - it should show the raw value instead, never throw.

**Expected:** Import is atomic (all rows or none), never silently drops a
row without flagging it first, summary/title rows never get mistaken for
real payment records, and a malformed date can never crash a whole
dashboard page for every viewer - at worst it displays oddly for that one
row.

---

## 8. Settings > Preferences (dark/light theme)

**Prerequisites:** Any logged-in account (participant or any admin tier).

1. Visit `/settings` (via the account-menu "Settings" link from any
   header - participant, Client/Super/Master Admin all point here).
2. Toggle **Light/Dark mode** → page repaints immediately, `<html>` gets/
   loses the `dark` class.
3. Reload the page → theme choice persisted (next-themes' own storage).
4. Visit a few different areas in the toggled theme - `/dashboard`,
   `/admin` (or any tier dashboard), `/profile` - confirm text stays
   readable and no element is invisible (white-on-white, etc.) in dark
   mode. This palette existed before but was never reachable in the UI
   until this feature, so it hasn't had a real visual pass yet.

**Expected:** Toggle is instant, persists across reload, and both palettes
are usable everywhere, not just on the settings page itself.

---

## 9. "Guide me" interactive walkthrough

**Prerequisites:** One account per tier if possible (participant, Client
Admin, Super Admin, Master Admin) - the tour's content differs by tier.

1. As a **participant**, open the account menu (top right of `/dashboard`)
   → **Guide me** (compass icon, above Logout). Confirm it starts a
   spotlight tour: a welcome step with no highlight, then in order **My
   Events → My Check-ins → My Per Diem Requests → My Analytics**, then a
   final step on the account-menu button itself.
2. As a **Client Admin**, on `/<slug>-admin/dashboard`, run **Guide me** →
   confirm it covers all seven base tabs (Perdiem Requests, Events, Event
   Check-ins, Participants, Venues, Reports, Analytics) plus **Manage**, but
   **not** a Clients step (Client Admins don't have that tab).
3. As a **Super Admin** or **Master Admin**, on their own `/dashboard`, run
   **Guide me** → confirm the same base tabs plus both **Manage** and
   **Clients** steps, and that the Manage step's description differs by
   tier (matches what `src/lib/tours/admin-tour.ts` says for each).
4. While a step is highlighted, confirm the actual dashboard tab behind the
   dimmed overlay switches to match (e.g. during the "Participants" step,
   the Participants table is the one rendered underneath) - the tour drives
   the same tab state a manual click would, just without pushing a new URL
   for every step.
5. Click **Next**/**Back** through the whole tour, then restart it and
   press **Esc** partway through → tour closes cleanly, page is usable
   immediately after (no leftover dimmed overlay).
6. Toggle dark mode (`/settings`, see §8) and re-run **Guide me** → popover
   background/text/buttons should read naturally in dark mode too, not the
   library's default hardcoded white.

**Expected:** Every tier sees a complete, accurate tour of everything *they*
can access - no tier ever sees a step for a tab they don't have, and no
tab they do have is missing a step.

---

## 10. OneDrive submission inbox (Milestone 5)

**Prerequisites:** `MICROSOFT_TENANT_ID`/`MICROSOFT_CLIENT_ID`/
`MICROSOFT_CLIENT_SECRET` in `.env` (Entra ID app registration with Graph
`Files.Read.All`, admin-consented); a real client's OneDrive Drive ID and
Folder ID for an existing folder with at least one file in it. None of this
exists yet as of this write-up - see `docs/MILESTONE_HANDOFF.md`'s
Milestone 5 section for exactly what's blocked and why.

1. As Super/Master Admin, open **Clients** → a client's card → **OneDrive
   Submission Folder** → enter that client's real Drive ID/Folder ID (and
   optionally a folder link) → **Save**. Reload → values persisted.
2. As that client's **Client Admin**, open the new **Documents** tab →
   confirm the "Open OneDrive Folder" button appears (if a link was saved)
   and **Sync** is enabled (not greyed out - it's disabled until a folder
   is configured).
3. Click **Sync** → confirm every file actually in that OneDrive folder
   appears in the table with status **Submitted**, filename linking
   straight to the file in OneDrive.
4. As **Super Admin** (or Master Admin), open the new **Submissions** tab →
   confirm the same file appears, labeled with the correct client name.
   Pick the client from the "Sync a client..." dropdown and Sync again →
   confirm re-syncing doesn't duplicate the row or reset its status.
5. Click **Mark Processing** → confirm the badge updates immediately and,
   as the Client Admin, reloading their Documents tab shows **Processing**
   too (not stuck on Submitted).
6. Click **Mark Done** → confirm the badge updates to **Done**, and that
   the Client Admin's own Documents tab shows **Done** but has no
   Processing/Done buttons anywhere on their side - only Super/Master ever
   see those actions (confirm this is enforced server-side too: a direct
   PostREST `PATCH` to `documents` as the Client Admin's session should be
   rejected by RLS, not just hidden by the UI).
7. Add a second, new file to the same OneDrive folder directly in
   OneDrive's website (not through the app) → Sync again → confirm only
   the new file appears as Submitted, and the already-Done file's status
   is untouched (a sync must never regress an existing row's status).
8. Run the "Guide me" tour as a Client Admin and as a Super/Master Admin →
   confirm the **Documents** step appears only for Client Admin and the
   **Submissions** step only for Super/Master (see §9).

**Expected:** the app never touches a file's bytes at any point - only
Microsoft Graph's folder listing and each row's processing status. A
Client Admin can always see status but never change it.

---

## 11. Delete Client (Super/Master Admin only)

**Prerequisites:** Super Admin or Master Admin; ideally one throwaway empty
client to actually delete, plus the real client (e.g. Apeiro) to confirm
the block behavior against.

1. On an **empty** client (no participants, events, requests, work types,
   or documents) → its card in the Clients tab → **Delete Client** → type a
   name that does **not** match exactly → confirm the **Delete** button
   stays disabled.
2. Type the exact client name (case-sensitive) → **Delete** enables →
   confirm → client disappears from the grid immediately.
3. On a client **with** data attached (e.g. one with a work type or a
   participant) → **Delete Client** → type its name correctly → **Delete**
   → confirm you get a friendly error like "This client still has
   participants, events, or other data attached - archive it instead of
   deleting," not a raw Postgres/foreign-key error message, and that the
   client is still there afterward.
4. Confirm a Client Admin (logged into their own client's dashboard) never
   sees a "Delete Client" option anywhere - this is Super/Master only.

**Expected:** deletion is only ever possible for a genuinely empty client;
anything with real data attached is protected and explained clearly, never
silently cascaded away.

---

## 12. Quarter filter (Reports tab, all admin tiers)

**Prerequisites:** Any admin tier (Client/Super/Master) with some per diem
requests spanning more than one calendar quarter.

1. Admin dashboard → **Reports** tab → confirm a new **Quarter** dropdown
   appears to the left of **Date Range**, defaulted to "All / Custom".
2. Pick a quarter that has data (e.g. "2025 Q1") → confirm the **Date
   Range** control updates to show that quarter's exact start/end dates
   (Jan 1 - Mar 31 for Q1, etc.) and the Approved/Paid/Rejected/Amended
   tables + downloads below only include requests dated inside that
   quarter.
3. Pick a quarter with no data → confirm all report tables show their
   empty state, not an error.
4. Manually pick a custom range in the **Date Range** calendar afterward →
   confirm the **Quarter** dropdown resets to "All / Custom" (it should
   never silently disagree with the actual applied range).
5. Select "All / Custom" from the **Quarter** dropdown → confirm the date
   filter clears back to unfiltered.

**Expected:** the Quarter dropdown is a convenience shortcut into the
existing Date Range filter (not a separate filter dimension) - both stay
in sync, and every download/report already wired to `filters.date`
respects it automatically.

---

## 13. Historical import: full field set, dedicated filters, and gap-filling sync

**Prerequisites:** Super/Master Admin; a small test spreadsheet matching the
client's new format (Payment Date, Name, Phone, Training Start/End Date,
Number of Training Days, Event Venue, Training Description, Employer, DHA/
MOH/KNH/SHA/Other Staff, Transport Allowance, DSA Allowance, Total Amount -
see docs/MILESTONE_HANDOFF.md for the full column list this maps to).

**A. Header auto-guess correctness (the collision this hardening fixes)**
1. Upload a sheet with headers in this order: `..., Training Start Date,
   Training End date, Number of Training Days, Event Venue, Training
   description, ...` → Map Columns step → confirm **Event Name** maps to
   "Training description", NOT "Training Start Date" (the bug found and
   fixed this round - the old broad `/event|training/` pattern matched the
   wrong column here).
2. Confirm **Training Start Date**, **Training End Date**, **Number of
   Training Days** each auto-map to their own columns, not to Event Name.
3. Confirm **Transport Allowance** and **DSA Allowance** each auto-map to
   their own columns, not to the generic Amount/Total field (the old
   catch-all pattern used to include a bare "dsa" match).
4. Confirm **Employer** auto-maps from a "County/Employer" combined header,
   and the five staff columns (DHA/MOH/KNH/SHA/Other) each auto-map
   correctly.

**B. Long-format dates**
5. Use a Payment Date (or Training Start/End Date) column with spelled-out
   values like "17 August 2026" or "Monday, August 17, 2026" → confirm the
   Preview step shows a clean `yyyy-MM-dd` date, not a red "doesn't look
   like a date" flag.

**C. Name handling**
6. Include one row with a title-prefixed name ("Mr John Doe") → confirm it
   imports with the name exactly as typed (title kept, not stripped).
7. Include one row with two names in one cell ("John Doe and Jane Smith") →
   confirm the Preview step flags it with a visible warning badge, and that
   the row can still be force-imported as-is (not blocked) - the warning is
   for manual review, not a hard stop.

**D. Sync / gap-filling across repeated uploads**
8. Import a row with several blank cells (e.g. missing Employer, missing
   DHA/MOH staff flags) → confirm it imports as 1 new record.
9. Re-upload the **same** row (same event, payment date, and phone/name),
   this time with the previously-blank cells filled in → confirm the result
   shows it as an **updated** record (not a new one), and check the
   dashboard afterward: the previously-blank fields are now filled in, and
   nothing that was already set got overwritten or blanked.
10. Re-upload the same row a third time with a *different* value in an
    already-filled field (e.g. a different Employer) → confirm the existing
    value is **kept**, not replaced (gap-fill only fills blanks, never
    overwrites).
11. Known limitation to confirm, not a bug: if Payment Date itself was blank
    on the first upload and filled in on a later one, expect a **new**
    record, not a merge - Payment Date is part of the matching key.

**E. New Reports tab filters**
12. Reports tab → confirm **Training Date Range**, **Employer**, **Staff
    Category**, and **Transport/DSA Allowance min-max** filters all appear
    and narrow the Approved/Paid/Rejected/Amended tables + CSV export
    correctly, independent of each other and of the existing filters.
13. Download a CSV → confirm it includes Employer, Staff Category, Training
    Start/End, Number of Training Days, Transport Allowance, and DSA
    Allowance columns.

**Expected:** every new column from the client's format is captured,
correctly separated from existing fields (no header-guess collisions),
filterable on the Reports tab, and re-uploading the same data to fill in
gaps never creates a duplicate or silently overwrites a real value.

---

## 14. Insights tab (Super/Master Admin only)

**Prerequisites:** Super or Master Admin login. Apeiro's test data from
§13's historical-import test rounds (`apeiro-test-import-round1.xlsx` /
`-round2-v2.xlsx`, 10 participants across 3 events) is enough for most of
this section - re-run those uploads (after re-wiping per the standing
convention) if the data isn't currently loaded.

1. Log in as Super/Master Admin → confirm a new **Insights** tab appears
   between Analytics and Manage. Log in as a Client Admin → confirm
   **Insights** does NOT appear (only the existing simple Analytics tab
   does) - this tab is Super/Master-only by design, not a replacement.
2. Click through all 5 sub-tabs (Overview / Financial / Staff & Employer /
   Training / Cross-Client) → confirm every chart renders with real data,
   no blank/broken charts, and empty-state messages show instead of a
   crash for any sub-section with no matching data.
3. On any chart, click **PDF** → confirm a readable PDF downloads with the
   chart image and a title.
4. Toggle dark/light mode (Settings > Preferences) → re-open Insights →
   confirm the glass/gradient card styling and all chart colors still look
   correct in both themes → download the same chart's PDF in both themes →
   confirm the exported image's background matches the current theme
   (not a hardcoded white background) - this is the specific bug this
   tab's PDF export was built to avoid, unlike the older Analytics tab's
   JPEG export which still hardcodes white.
5. On each sub-tab, click **Download Section (PDF)** → confirms a
   multi-page PDF downloads with one chart per page.
6. **Cross-Client section specifically needs 2+ clients with data** to be
   meaningful - a single-client comparison is a degenerate case. Create one
   throwaway test client via the Clients tab, run a small historical import
   against it too (2-3 rows is enough), then confirm the Cross-Client
   table/Bar/Radar/Line charts show both clients side by side. Delete the
   throwaway client afterward via the existing self-service Delete Client
   feature once done.
7. Resize the browser narrow (or check on mobile, including the 320-375px
   phone-width range specifically, not just tablet width) → confirm: charts
   collapse to a single column rather than overflowing; stat card numbers
   (e.g. "Total Paid Out") shrink and wrap rather than spilling past the
   card edge, especially at the 5-per-row breakpoint (~1024-1280px, right
   where Overview's stat row goes from 2 to 5 columns and each card is
   briefly at its narrowest); every chart card's title + "PDF" button wrap
   onto two lines instead of squeezing/overlapping; the Cross-Client rollup
   table scrolls horizontally inside its own container rather than
   widening the page. This same check applies to the older "Analytics"
   tab's two chart cards and stat cards too - both got the same wrap/shrink
   treatment in this pass.

**Expected:** Insights is additive and Super/Master-only - it doesn't
change anything about the existing Analytics tab or any other tab, doesn't
affect Client Admins at all, and every chart degrades gracefully (empty
state, not a crash) when its underlying data doesn't exist yet.

---

## 15. Sidebar regrouping, dropped tab strip, phone search

**Prerequisites:** Any admin tier - repeat for Client Admin, Super Admin,
and Master Admin to check the tier-specific gating differences.

1. Open any admin portal → confirm the horizontal tab strip that used to
   sit above the page content is gone, and a page heading matching the
   current section ("Perdiem Requests", "Events", "Event Check-ins", etc.)
   appears where it used to be.
2. In the sidebar, confirm three collapsible sections exist and **start
   expanded**: **Events** (Events, Event Check-ins), **Reports** (Reports,
   Analytics, Insights - Insights only for Super/Master Admin, previously
   missing from the sidebar entirely), **Manage** (Manage, Clients,
   Submissions - Clients/Submissions only for Super/Master Admin, Manage
   itself for every tier except client_user).
3. Click each section's header → confirm it collapses/expands independently
   of the other two, and that the header itself does **not** navigate (it's
   a pure toggle - the group's own page is one of the items listed inside
   it once expanded).
4. Click every sub-item → confirm it navigates to the correct tab and the
   sidebar highlights the right item as active.
5. From the Clients tab, click "View Participants" (or equivalent) for a
   specific client → confirm the `?tab=participants&clientId=...` deep
   link still pre-filters the Participants list correctly (this link is
   unrelated to the sidebar change but depends on the `participants` tab
   value staying the same, which it does).
6. Run the "Guide me" walkthrough end to end → confirm every step still
   highlights the correct sidebar item (including the now-nested
   Checkins/Analytics/Insights/Clients/Submissions steps) with no missing
   targets.
7. On the Participants tab, search by a participant's **phone number**
   (not just name or ID number) → confirm they show up in the results.

**Expected:** navigation is now sidebar-only with no loss of functionality
- every tab/deep-link/tour step still works, Insights is finally reachable
from the sidebar, and participant search covers phone number too.

---

## 16. Regression basics (run before considering any change done)

1. `npm run typecheck` - compare the error list to the known pre-existing
   ones (Badge `variant="success"` typing, `checkbox.tsx`/`sidebar.tsx`
   shadcn quirks, `request-per-diem` null/undefined mismatch, Next 15
   async-params `.next/types` noise). Any error **not** on this list is a
   real regression to fix before shipping.
2. `npm run build` - must succeed. Needs a real `.env` with
   `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (this repo's
   `.gitignore` excludes `.env*`, so it's not committed - if a session has
   none, a temporary placeholder `.env` can validate the build structurally
   but not against real data; delete it afterward).
3. Grep for stray references after any rename/removal (e.g.
   `grep -rn "OldComponentName" src/`) - zero hits expected.

---

## Appendix: which milestone/change introduced each section

- §1-2: Milestones 0-2 (core app, tenancy/roles).
- §7: Milestone 4 (historical import); steps 6-8 are off-plan hardening
  added later for real multi-sheet/multi-event files - see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §3-6, §8: off-plan tier-portal + theme work (see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section).
- §9: off-plan "Guide me" walkthrough (driver.js), see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §10: Milestone 5, re-scoped to a Microsoft OneDrive submission inbox - see
  `docs/MILESTONE_HANDOFF.md`'s Milestone 5 section.
- §11: off-plan self-service Delete Client, see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §12: off-plan Quarter filter (Reports tab), see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §13: off-plan historical import field-set expansion + gap-filling sync,
  see `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §14: off-plan Super/Master Admin "Insights" analytics dashboard, see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §15: off-plan sidebar regrouping (Events/Reports/Manage sub-items),
  dropped horizontal tab strip, and participant phone search, see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section.
- §16: general project convention, not tied to one milestone.
