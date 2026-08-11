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
3. Fill in batch details (event name required) → preview step flags rows
   with missing name or non-numeric amount, excludes them from the import.
4. Confirm import → event/venue created if new, phone numbers normalized to
   `+254XXXXXXXXX`, rows with no matching participant show
   `participant_id: null` with the name/phone snapshot kept.
5. Re-import a second batch for the **same** event name at the same client
   → confirm it appends rows to the existing event rather than duplicating
   it (this path was previously only verified by code review, not real
   data - see `docs/MILESTONE_HANDOFF.md` Milestone 4).

**Expected:** Import is atomic (all rows or none), never silently drops a
row without flagging it first.

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

## 9. Regression basics (run before considering any change done)

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
- §7: Milestone 4 (historical import).
- §3-6, §8: off-plan tier-portal + theme work (see
  `docs/MILESTONE_HANDOFF.md`'s "Off-plan" section).
- §9: general project convention, not tied to one milestone.
