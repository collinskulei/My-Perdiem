# Milestone Handoff — Multi-Tenant Roles, Documents & Claude for Team

This tracks progress against the approved plan (originally saved at
`C:\Users\user\.claude\plans\serialized-crafting-spindle.md` on the machine that
planned it). Use this file to pick up work from any workspace/session.

## Current repo state

- Branch `main`, in sync with `origin/main` as of this commit.
- Milestones 0–4 done. Since then, two off-plan features (tier-specific
  admin portals + dark/light theme toggle, and a "Guide me" interactive
  walkthrough) were built at the user's direct request, and Milestone 5
  itself was completed this session (re-scoped to a Microsoft OneDrive
  submission inbox - see that milestone's section below). Its schema
  migration (`0009_documents.sql`) is confirmed applied live - the Clients
  tab widget grid works correctly now. The OneDrive sync itself (Documents/
  Submissions tabs' actual functionality) is still **blocked on real
  Microsoft credentials**, not yet exercised live.
- Working tree was clean as of the last check. Always run `git status` and
  `git pull` before starting, in case another workspace pushed more since.
- **Live data cleanup done by the user this session**, ahead of a real bulk
  historical-data upload for Apeiro, via a one-off script (not a numbered
  migration - `supabase/one-off-apeiro-cleanup.sql`, kept in the repo for
  reference but not meant to be replayed):
  - Added 4 work types for Apeiro: TOT - Training of Trainers, EUT - End
    User Training, Leadership Training/Workshop, CHP - County Health
    Promoters Event.
  - Deleted Apeiro's existing events/per-diem requests, including
    Milestone 4's sample import (see that milestone's section for the
    updated note) - a clean slate for the incoming bulk upload.
  - Permanently deleted the placeholder "Default Client (migrated)" row
    (`00000000-0000-0000-0000-000000000001` from Milestone 2's tenancy
    migration) - confirmed by the user as done; not independently
    re-verified from outside this session.
- **⚠️ TEMPORARY, TESTING-ONLY, MUST BE REVOKED BEFORE LAUNCH:** `master_admin`
  can currently log into and pass the server-side guard on *every* portal -
  `/super-admin`, `/<any-slug>-admin`, and `/master-admin` - not just its own,
  so one account can exercise all three dashboards without provisioning
  separate Super Admin / Client Admin test accounts. Landing on a
  Client/Super Admin portal as `master_admin` shows the master-level global
  view (its `client_id` is still null), not a true client-scoped experience -
  it's a login/guard bypass for testing, not real impersonation. Marked with
  `// TEMPORARY (testing only, revoke before launch)` comments in three
  places - `grep -rn "TEMPORARY (testing only" src/` finds all of them:
  `src/components/admin-login-form.tsx`,
  `src/app/super-admin/dashboard/layout.tsx`, and
  `src/app/client-admin/[clientSlug]/dashboard/layout.tsx`. Revoke by
  reverting each marked block to its plain equality check.
- `0008_client_slug.sql` (adds `clients.slug` + the `get_client_by_slug` RPC)
  has been applied to the live project (per the user, this session - not
  independently re-verified from outside since this workspace has no `.env`/
  Supabase credentials to probe with). Worth a quick outside check next time
  credentials are available: confirm existing clients (`Apeiro`, `Default
  Client (migrated)`) got a non-null `slug`, and that `get_client_by_slug`
  resolves one of them - same style of verification Milestone 2 did for its
  migration.

## Milestone 0 — Recover deleted code — ✅ DONE

`commit 002` (`bed5a9f`) had accidentally deleted the entire `src/` tree and
all Supabase SQL. Fixed via `git revert bed5a9f` (commit `43b84c3`). Verified:
`npm install` + `npm run dev` boots, login page renders HTTP 200.

## Milestone 1 — Remove Test Mode — ✅ DONE

Deleted `src/lib/test-mode.ts`, `src/lib/mock-data.ts`, `src/lib/data-provider.ts`.
Stripped every `isTestMode()`/mock/`TEST_USER_ID_KEY` branch from `page.tsx`,
`register/page.tsx`, `employee-dashboard.tsx`, `admin-dashboard.tsx`,
`profile/page.tsx`, `request-per-diem/page.tsx`, `checkin/page.tsx`.
Repurposed `health/page.tsx` into a plain Supabase diagnostics page (no more
Test/Live mode toggle). Verified no `testmode|mock-data|TEST_USER_ID` strings
remain anywhere in `src/` or `supabase/`.

## Milestone 2 — Multi-tenant schema, 4-tier roles, self-promotion hardening — ✅ DONE

**Locked-in decisions (don't re-litigate):**
- 4 tiers: `master_admin` > `super_admin` > `client_admin` > `client_user`.
- Master Admin seed account: **collins.kulei@iacentre.co.ke**.
- Placeholder/legacy client UUID used by the migration's backfill:
  `00000000-0000-0000-0000-000000000001` ("Default Client (migrated)").
- This Supabase project uses legacy shared-secret **HS256** JWT signing
  (confirmed by decoding the anon key's JWT header) — relevant later for
  Milestone 6's MCP auth design, no fallback needed.

**What's done:**
- `supabase/migrations/0003_tenancy_and_tiers.sql` — full migration: `clients`
  table, `access_tier` enum, renames `participants.role` → `designation`,
  adds `access_tier`/`client_id` to `participants`, adds `client_id` (NOT
  NULL) to `events`/`perdiem_requests`, one-time backfill + master-admin seed,
  helper functions (`current_tier`, `current_client_id`,
  `is_super_admin_or_above`, `can_access_client`, `client_exists`,
  `get_public_client_name`), the `guard_participant_privilege_columns`
  trigger + `set_access_tier()` RPC (the structural self-promotion fix — direct
  writes to `access_tier`/`client_id` are blocked; only this RPC, which
  enforces the tier hierarchy and forbids self-targeting, can change them),
  and a full RLS policy rewrite for `participants`/`clients`/`venues`/
  `events`/`perdiem_requests` around `can_access_client()`. Also tightened two
  real cross-tenant holes found while rewriting: the old "any authenticated
  user can update any event" policy, and a missing `client_id` check on the
  per-diem-request insert policy.
- `@supabase/ssr` installed. `src/lib/supabase/client.ts` switched from
  `createClient` to `createBrowserClient` (cookie-backed session instead of
  localStorage, so Server Components can read it — API surface unchanged, no
  ripple to callers). Added `src/lib/supabase/server.ts`
  (`createSupabaseServerClient`) and `src/middleware.ts` (session refresh).
- `src/lib/data.ts`: added `AccessTier`, `Client` types; `Participant` now has
  `designation`/`accessTier`/`clientId`; `AppEvent`/`PerdiemRequest` now have
  `clientId`. Removed a dead mock `venues` const that still had a leftover
  "Test Venue" entry.
- `src/lib/supabase/database.ts`: field maps updated for the renamed/new
  columns; added `getClients`, `getPublicClientName` (anon-callable RPC
  wrapper, used pre-signup), `setAccessTier` (RPC wrapper).
- App code updated to match: `register/page.tsx` (registration now requires
  a `?client=<clientId>` invite-link param, validated via
  `getPublicClientName` before allowing submission - self-signup always
  creates a `client_user`); `page.tsx` login check now uses
  `accessTier !== 'client_user'`; `profile/page.tsx` and
  `admin-dashboard.tsx` all switched from the old `role === 'Admin'` checks to
  `accessTier`; `admin-dashboard.tsx` now tracks the logged-in admin
  (`currentAdmin`) and stamps `clientId` on new events (blocks event creation
  from this dashboard if the logged-in admin has no single `clientId`, i.e. a
  Super/Master Admin — that's expected until Milestone 3's multi-client
  console exists); `request-per-diem/page.tsx` now stamps `clientId` from the
  submitting participant.
- Confirmed via grep: zero remaining `.role`/`role === 'Admin'` references
  anywhere in `src/`.

**Both remaining items closed out on 2026-08-08:**

1. **Migration confirmed applied to the live project.** Verified from outside
   via PostgREST probes with the anon key: `public.clients` resolves (was
   `PGRST205` before), `participants.access_tier`/`designation`/`client_id`
   resolve (were `42703` before), old `participants.role` column is gone
   (rename confirmed). Before applying it, the master-admin account
   (`collins.kulei@iacentre.co.ke`) didn't exist yet in `auth.users` or
   `participants` — created it directly via the Auth REST API
   (`/auth/v1/signup`) plus a matching `participants` insert (old-schema
   shape, since this was pre-migration), since the deployed app's
   register page already assumed the new schema and would not have worked.
   One hiccup: the chosen `id_number` collided with a stray pre-existing
   participants row (unrelated email) — deleted that row manually via the
   SQL Editor before the insert succeeded. After running the migration,
   confirmed via an authenticated REST call as that user:
   `access_tier = 'master_admin'`, `client_id = null`, and it can read the
   `clients` table (proves the RLS tier check, not just the column value).
2. **`src/app/admin/layout.tsx` now has the server-side guard.** Converted to
   an async Server Component: calls `createSupabaseServerClient()`, uses
   `supabase.auth.getUser()` (not `getSession()` — revalidates against the
   auth server rather than trusting a locally-decoded JWT), looks up
   `access_tier` for that user's `participants` row, and `redirect('/')` if
   there's no user or `access_tier === 'client_user'`. Verified with
   `npm run typecheck` (clean — only pre-existing, unrelated errors remain:
   a couple of shadcn component type quirks, one loose `null`/`undefined`
   mismatch in the per-diem submit payload, Next 15's async-`searchParams`
   `.next/types` noise — none block `next build`, which still succeeds) and
   `npm run build`. Manually verified end-to-end:
   - Unauthenticated `curl` to `/admin` → `307` to `/`, confirmed at the HTTP
     level before any client JS runs.
   - A direct `PATCH .../participants?id=eq.<self>` setting `access_tier`
     → rejected by the `guard_participant_privilege_columns` trigger
     (`P0001: access_tier/client_id can only change via
     public.set_access_tier()`).
   - `set_access_tier()` targeting yourself → rejected
     (`P0001: Cannot change your own access tier`).
   - **Not yet exercised for real** (no browser tool was available this
     session, and there's only one participant account to test with so far):
     a logged-in non-`client_user` actually loading `/admin` past the guard
     in a real browser session, and the full tier hierarchy
     (`super_admin` blocked from touching `master_admin`/`super_admin` rows,
     restricted to assigning `client_admin`/`client_user` only) — this needs
     more than one account to exercise meaningfully, which Milestone 3's
     invite flow will naturally create. Worth a quick manual click-through
     once you're at a machine with a browser, but not considered blocking.

## Milestone 3 — Admin-management console + first server-side Supabase code — ✅ DONE

Went beyond the plan's original scope (invite-only for Master/Super Admin) -
the user directed an expansion mid-milestone to also cover Client Admin
delegation and participant lifecycle management. All of it is built, migrated
live, and manually verified end-to-end (see below).

**Schema** (two migrations, both applied to the live project):
- `0004_admin_invites_and_work_types.sql` - `participants.phone_number`/
  `id_number` made nullable (admin-tier accounts are invited, not
  self-registered, so they have neither at creation time; NULL is safe under
  the existing unique indexes). New minimal `work_types` table
  (`id, client_id, name, archived_at`) - readable by any admin tier with
  access to the client, writable by Super Admin and above only.
- `0005_admin_delegation_and_deactivation.sql` - new `participants.disabled_at`
  column, added to the same trigger guard that protects `access_tier`/
  `client_id` (only the deactivate route or `set_access_tier()` can touch it -
  never a direct write, so the DB flag and the real Auth ban below can never
  drift apart). Extended `set_access_tier()` with a fourth caller branch:
  Client Admin may demote (only) a peer Client Admin (only) at their own
  client (only) down to Client User.

**Server-only code** (first in the app):
- `src/lib/supabase/admin-server.ts` - service-role client (`server-only`
  import guard so accidental client-bundle inclusion is a build error).
  `SUPABASE_SERVICE_ROLE_KEY` is in `.env` (not committed).
- `src/app/api/admin/invite-admin/route.ts` - invites a Super Admin, Client
  Admin, or Client User by email (`inviteUserByEmail`, `redirectTo` pointed at
  `/reset-password`) and inserts the matching `participants` row. Authorization
  mirrors `set_access_tier()`'s hierarchy: Master Admin invites any tier;
  Super Admin invites Client Admin/Client User for any client; **Client Admin
  invites Client Admin/Client User for their own client only - `clientId` in
  the request body is ignored/overridden for Client Admin callers, never
  trusted** (verified: passing a different client's ID gets silently forced
  back to the caller's own client, not rejected-but-still-wrong).
- `src/app/api/admin/participants/[id]/set-disabled/route.ts` - deactivates by
  calling `auth.admin.updateUserById(id, { ban_duration })`, a real Auth ban
  (blocks sign-in outright, not a cosmetic flag the app just checks), plus
  sets `disabled_at` for display. Client Admin scope: Client Users at their
  own client only (never a peer Client Admin - that's `set_access_tier()`'s
  demote path instead). Super/Master Admin: any Client Admin or Client User,
  any client. Nobody can target Master/Super Admin via this route.
- `src/lib/admin-api-client.ts` - shared client-side fetch wrappers
  (`inviteAdmin`, `setParticipantDisabled`) used by both the console UI and
  the Participants tab, so the two don't duplicate the fetch logic.

**Console UI** (`src/app/admin/admin-management.tsx`, new "Manage" tab in
`AdminDashboard`, gated by tier in both the tab and the sidebar):
- Master Admin: invite Super Admins, see every admin-tier account platform-wide.
- Client Admin: invite peer Client Admins for their own client, see and
  demote them (not shown to Master Admin - different scope, same component).
- Super/Master Admin: Clients list + create, per-client work types
  (add/archive), invite a Client Admin from a client's row.

**Participant management** (`admin-dashboard.tsx`'s existing Participants
tab): "Add Participant" button (invites a Client User the same way, wired to
the Client Admin's own `clientId`); the previously-dead "Delete" menu item is
now a working Deactivate/Reactivate toggle with a Status column.

**Other fixes bundled into this round:**
- `src/app/reset-password/page.tsx` now looks up the signed-in user's
  `access_tier` after setting their password and routes to `/admin` or
  `/dashboard` accordingly, instead of always back to `/` - this page is also
  how invited users accept their invite and set their first password, not
  just the forgot-password flow.
- `src/app/profile/page.tsx` shows a tier badge next to the name (was
  previously invisible anywhere in the UI).
- Editing the actual invite-email template content is a Supabase dashboard
  setting (Authentication → Email Templates → "Invite user"), not app code -
  not built, flagged here so it isn't mistaken for an oversight.

**Verified live** (test fixtures created and cleaned up afterward - the
project's participants/clients tables are back to just the master admin +
the default migrated client): every one of the following was exercised for
real against the live Supabase project, not just reasoned through -
- Client Admin invite of Super Admin → `403`.
- Client Admin invite of Client Admin/Client User with no `clientId` in the
  body → succeeds, lands in their own client.
- Same, but with a *different* client's ID in the body → still lands in the
  caller's own client (confirms the override, not just a rejection).
- Client Admin demotes a peer Client Admin at their own client → succeeds.
- Client Admin attempts to demote a Client Admin at a *different* client →
  rejected (`Client Admins may only manage their own client`).
- Deactivate → sign-in immediately fails with Supabase's own `user_banned`
  error (not an app-level check that a stolen token could bypass).
- Client Admin attempts to deactivate a peer Client Admin → rejected (right
  error message, confirms the client_user-only scope).
- Client Admin attempts to deactivate a different client's participant →
  `404` (RLS hides it before the tier check even runs).
- Reactivate → sign-in works again.
- `npm run typecheck` (clean of new errors) and `npm run build` (succeeds).

**Not exercised** (carried over from Milestone 2, still true): a real
browser click-through of the invite-accept-password-reset flow end-to-end,
and the full Super Admin hierarchy checks from Milestone 2's note. No browser
tool was available either session so far - worth doing once someone's at a
machine with one, not blocking.

## Milestone 4 — Bulk historical-data upload — ✅ DONE (turned out not to be infrastructure-only)

The plan assumed this would generalize the existing per-event participant
XLSX parser. A real sample file from the user changed that: historical
per-diem data comes as standalone bulk-payment-list spreadsheets (NAME,
PHONE NUMBER, AMOUNT, DESCRIPTION - no event/venue/date columns at all,
since one file is one payment batch for one event by convention, e.g.
filename "BULK TO PAY EMBU CHP 40k_20250908"). Built against that real shape
instead of the assumed one, and - at the user's explicit direction, after
confirming which client and that it should be a real write, not a dry run -
actually imported that sample's 2 rows for the real "Apeiro" client. This
milestone is **not** infrastructure-only after all; real historical data now
lives in the live database.

**Schema decision found while building this:** the existing schema required
every `perdiem_requests` row to reference a real `auth.users`-backed
participant. Historical payment records are routinely for people who never
had an app account and may never need one. Two migrations:
- `0006_historical_import.sql` - `perdiem_requests.participant_id` made
  nullable; added `participant_phone`/`participant_id_number` snapshot
  columns (same pattern as `events.unregisteredParticipants` already used for
  the live pre-registration flow) and `imported_at`. Added
  `import_historical_events(target_client_id, rows)` - one atomic call per
  upload, restricted to Super Admin and above, all rows commit or none do.
  Per row: finds-or-creates the venue (shared/global, matched by name) and
  the event (matched by `client_id` + name, `event_dates` unioned in if the
  event already exists from an earlier row/import); best-effort matches an
  existing participant and backfills `events.allocated_participants` if
  found, otherwise leaves `participant_id` null with the name/phone snapshot
  kept on the row.
- `0007_historical_import_fixes.sql` - two bugs found by testing against the
  real sample before it was ever run for real: (1) the participant-matching
  join was an exact string comparison, but real phone numbers show up as
  `07XXXXXXXX`/`7XXXXXXXX`/`2547XXXXXXXX`/`+2547XXXXXXXX` interchangeably
  while registered participants always store `+254XXXXXXXXX` - switched to
  comparing the last 9 digits, matching the convention the rest of the app
  already uses (`addParticipant`'s retroactive event-allocation logic). (2)
  Added a `notes` column so a per-row description/purpose column (like the
  sample's DESCRIPTION) isn't silently discarded.

**UI** (`src/app/admin/admin-historical-import.tsx`, an "Import Historical
Data" button on each client's row in Manage → Clients, Super Admin+ only):
upload → **batch details** (Event Name required, Venue/Date/Status/batch
Transaction Code - entered once per upload since real files don't carry
these as columns; a row can still override via its own mapped column if a
future file does mix events) → **column mapping** (headers auto-guessed by
regex, always user-confirmed/editable - nothing is trusted blindly, since the
real header names turned out nothing like what the plan assumed) →
**preview** (invalid rows - missing name, missing/non-numeric amount - are
flagged and excluded from the batch rather than failing the whole import or
silently importing garbage) → confirm, one `importHistoricalEvents()` call.
Phone numbers are normalized to `+254XXXXXXXXX` client-side before sending,
matching what the RPC's matching logic expects.

**Verified against the real file, not a synthetic one:** traced the header-
matching regexes by hand against the actual sample's headers (`NAME`,
`PHONE NUMBER`, `AMOUNT`, `DESCRIPTION`) and confirmed the guesses land
correctly (`participantName`/`participantPhone`/`totalPerdiem`/`notes`, no
false-positive date column) before ever running it - then ran the real
import for Apeiro (client already existed) and confirmed live: the event
"MOH Per Diem - Embu CHP" was created with the right venue/city/date; the
venue "Embu CHP"/"Embu" was created since it didn't exist; both per-diem
rows show `participant_id: null` (correct - neither Cecilia Njeru nor Paul
Ngari has an app account) with the phone numbers normalized to
`+254725159829` / `+254722930887`; `notes` holds "MOH Per Diem" per row.

**Known limitation, not addressed:** this small sample only exercised one
event with two never-before-seen participants - the "match an existing
participant by phone and backfill `allocated_participants`" path, and
"append more rows to an event that already exists from a prior import"
path, are correct by code review but not yet exercised against real data.
Worth confirming once a fuller historical file (repeat participants,
multiple events) comes through.

**Update:** this sample import (the "MOH Per Diem - Embu CHP" event and its
two rows for Cecilia Njeru/Paul Ngari) was deleted from the live project by
the user ahead of a real bulk historical-data upload, via
`supabase/one-off-apeiro-cleanup.sql` (see "Current repo state" above) - it
no longer exists live. The venue "Embu CHP" was left untouched. The
"known limitation" above is still unaddressed either way - the real bulk
upload replacing this sample is exactly the opportunity to confirm it.

## Off-plan: tier-specific admin portals + dark/light theme toggle — ✅ DONE (code + migration applied live)

Not part of the original plan - the user asked for this directly, ahead of
Milestone 5. Summary: every admin tier used to share one login tab on the
landing page and one dashboard at `/admin`, tab-gated internally by
`accessTier`. Now each tier has its own login URL and its own guarded
dashboard route, and there's a personal dark/light preference.

**Locked-in decision (don't re-litigate):** "dedicated dashboard per tier"
was implemented as separate URLs + separate server-side guards per tier, not
three independently-maintained forks of the ~2,300-line dashboard. The
existing `AdminDashboard`/`AdminSidebarNavigation`/`AdminHeader`/
`AdminLayoutClient` components (`src/app/admin/*`) are still the single
shared implementation - already correctly tab-gated by `accessTier` - now
parameterized with a `basePath` (and `loginPath`/`portalLabel`) prop instead
of hardcoding `/admin`, and mounted under three new route trees. `/admin`
itself is untouched and still works standalone.

**Client slug (DB):** `supabase/migrations/0008_client_slug.sql` adds
`clients.slug` (auto-generated from `name` via a `before insert/update`
trigger, collision-suffixed, with `super`/`master` reserved so no client can
ever collide with the Super/Master Admin routes), plus a
`get_client_by_slug(text)` RPC (anon+authenticated, mirrors the existing
`get_public_client_name`). **Applied to the live project this session** (per
the user; not independently re-verified from outside, see "Current repo
state" above). `src/lib/data.ts`'s `Client` type and
`getClients()`/new `getClientBySlug()` in `src/lib/supabase/database.ts` were
updated to match.

**Pretty URLs via middleware rewrite:** Next.js can't mix literal text with a
dynamic segment in one route folder (no `[clientname]-admin` folder is
possible), so `src/middleware.ts` now also rewrites `/<slug>-admin` and
`/<slug>-admin/dashboard` onto `src/app/client-admin/[clientSlug]/...`
(regex-matched, "super"/"master" excluded since those are their own static
routes). **Implementation note for future sessions:** a leading-underscore
"private folder" (`_client-admin`) was tried first to also block direct
`/client-admin/<slug>` access, but Next.js excludes private folders from
routing entirely - the rewrite target itself silently vanished from the
build's route list. Renamed to the plain `client-admin` folder; it's a real,
directly-reachable route now too, alongside the pretty URL, but every guard
is independent of which URL got you there, so this is cosmetic only.

**Three portals**, each a public login page + a `dashboard` route guarded by
a server-component layout (same pattern as `src/app/admin/layout.tsx`):
- `src/app/super-admin/` (login) + `super-admin/dashboard/` (guard requires
  `access_tier = 'super_admin'` exactly).
- `src/app/master-admin/` + `master-admin/dashboard/` (`master_admin` exactly).
- `src/app/client-admin/[clientSlug]/` + `.../dashboard/` (`client_admin`
  exactly, AND the participant's `client_id` must resolve to a client whose
  `slug` matches the URL segment - checked server-side against the `clients`
  table, not just trusted from the URL).
- Shared login UI extracted from the landing page's old "Admin" tab into
  `src/components/admin-login-form.tsx` (`expectedTier`/`expectedClientId`/
  `redirectTo` props). `src/app/page.tsx` (landing page) is now
  participant-only - the Admin tab is gone.
- Logout now routes back to the portal's own login page (`loginPath` prop
  threaded through `AdminLayoutClient`/`AdminHeader`), not the generic `/`,
  since `/` no longer has an admin path.

**Super/Master Admin "Clients" tab** (`src/app/admin/admin-clients-overview.tsx`,
new): a widget grid, one card per client, replacing the old plain-table
client list that used to live inside admin-management.tsx's `ClientsSection`
(removed - fully absorbed into the new file). Each card shows live admin/
participant counts (computed client-side from data `admin-dashboard.tsx`
already fetches - no new query), invite-a-Client-Admin, work types
(unchanged logic, just restyled), and a "View Participants" link that
deep-links into the Participants tab with `?clientId=`. The Participants tab
itself gained a client-filter `Select`, shown only to Super/Master Admin.

**Master Admin can now manage Super Admins** (admin-management.tsx's
`AdminsSection`): the DB-side `set_access_tier()` RPC's `master_admin` branch
was already unrestricted (confirmed in migrations 0003/0005) - the gap was
purely that the UI hid the Demote button for Master Admin. Fixed; Master
Admin can now demote any Super Admin or Client Admin to Participant (not
another Master Admin, by UI choice, even though the RPC would allow it - kept
out to avoid accidentally locking out all Master Admins).

**Dark/light theme:** `next-themes` added; `src/app/layout.tsx` wraps
children in a class-based `ThemeProvider` (`globals.css`'s `.dark` palette
and `tailwind.config.ts`'s `darkMode: ['class']` already existed and needed
no changes - this is the first time either was actually reachable in the
UI). New `src/components/theme-toggle.tsx` (simple Light/Dark switch, no
System option - matches what was explicitly asked for) lives on the new
`src/app/settings/page.tsx` ("Settings > Preferences"), linked from the
previously-dead "Settings" item in both `admin-header.tsx` and
`employee-header.tsx`.

**Verified this session:** `npm run build` succeeds (confirmed with a
temporary local-only placeholder `.env` - none exists in this workspace, so
this environment can't build against real Supabase data; delete any such
file before committing) and lists all new routes
(`/super-admin`, `/super-admin/dashboard`, `/master-admin`,
`/master-admin/dashboard`, `/client-admin/[clientSlug]`,
`/client-admin/[clientSlug]/dashboard`, `/settings`). `npm run typecheck`
shows only pre-existing errors (the same ones noted in Milestone 2's
verification, plus the same class of Next-15-async-params `.next/types`
noise already present on `/admin/page.tsx` before this work) - none block
`next build` (`typescript.ignoreBuildErrors: true` in `next.config.ts`).

**Not yet verified** (no browser tool available this session, same caveat as
every milestone before this one): an actual login through each portal in a
browser, the middleware rewrite serving a real `/<slug>-admin` URL end to
end, and the Clients-tab widget stats/actions against live data. Migration
`0008` is applied, so this is now just waiting on a browser/credentialed
session to click through.

## Off-plan: "Guide me" interactive walkthrough — ✅ DONE (code, not browser-tested)

Also user-requested, off-plan, built right after the tier-portal work above.
A "Guide me" item in the account-menu dropdown starts a spotlight-style tour
(via `driver.js`, a new small dependency - no tour library existed before)
covering everything the logged-in user's tier can see. Only two files have
an account-menu dropdown in the whole app -
`src/app/dashboard/employee-header.tsx` (participants) and
`src/app/admin/admin-header.tsx` (shared by all three admin tiers) - so
adding "Guide me" there covers every tier with two small edits.

**How it's wired:** a tour is a list of `driver.js` steps targeting
`data-tour="tab-<value>"` attributes added to each dashboard's existing
`TabsTrigger` elements (`src/app/dashboard/employee-dashboard.tsx`,
`src/app/admin/admin-dashboard.tsx`) - not the sidebar, since the in-page
Tabs are co-located with the tab-switching state and, importantly, Radix
keeps every `TabsTrigger` mounted in the DOM regardless of which tab is
active, so there's no render-timing/waiting concern when the tour switches
tabs mid-sequence. Each step's `onHighlightStarted` calls the dashboard's
own `setActiveTab` (not the URL-pushing `handleTabChange` - deliberately, to
avoid stacking ~9 browser-history entries for one tour run) so the real tab
content visibly changes behind the dimmed overlay as the tour progresses.

Because "Guide me" lives in the **header** (a sibling of the dashboard
content, not a descendant) and only the dashboard itself knows its own
tab-switch function and (for admin) which tabs the current tier can see, a
small React Context bridges the two:
`src/components/tour/tour-provider.tsx` (`TourProvider`/`useTour`, mounted
in `src/app/layout.tsx` inside the existing `ThemeProvider`) exposes
`registerTour(fn)` (called by each dashboard on mount) and `startTour()`
(called by the header's "Guide me" click).

Tour content lives in `src/lib/tours/participant-tour.ts` (4 tabs: My
Events/Check-ins/Requests/Analytics) and `src/lib/tours/admin-tour.ts`
(7 base tabs for every admin tier, plus a `management` step gated the same
way the existing "Manage" tab already is, plus a `clients` step gated to
super/master only, matching `isMultiClientAdmin` exactly) - both end on a
step highlighting the account-menu button itself, mentioning Profile/
Settings/re-running the guide. `src/app/globals.css` has a theme-override
block (driver.js ships hardcoded light-mode CSS by default) mapping its
popover to the app's own HSL tokens, so it matches both the light and the
newly-added dark theme instead of always rendering white.

**Verified this session:** `npm run typecheck`/`npm run build` (temporary
placeholder `.env`, deleted after) show no new errors beyond the same
pre-existing ones noted throughout this doc, and the built bundle size for
each dashboard route grew by driver.js's footprint as expected.

**Not yet verified** (no browser tool this session, same caveat as
everything else): actually running the tour in a browser per tier - confirm
step order, that Client Admin never sees a `clients` step, that Next/Back/
Esc/close all work, and that the popover renders correctly in dark mode.
Added as `docs/TEST_GUIDE.md` §9.

## Milestone 5 — OneDrive submission inbox — ✅ CODE DONE, ⬜ BLOCKED ON REAL MICROSOFT CREDENTIALS

**Re-scoped twice at the user's direction this session**: originally a
Supabase Storage-backed "document submission portal", then briefly Zoho
WorkDrive, then corrected to **Microsoft OneDrive**. Clarifying questions
also revealed the real workflow is much narrower than any storage-backed
plan first assumed - it's a **Client Admin → Super Admin payment-processing
inbox**, not a participant-facing upload feature:

1. Each client already has a dedicated folder inside the org's **existing**
   OneDrive/SharePoint structure - the app plugs into it, it never creates
   folders itself.
2. A **Client Admin** uploads a raw document there (a list of people to be
   paid, often scanned/handwritten/typed) **directly in OneDrive's own
   website** - never through this app.
3. A **Super/Master Admin** sees it in a queue, opens it straight in
   OneDrive, cleans the data and pays offline (optionally with Claude's
   informal help - not a new in-app feature), then imports the resulting
   clean sheet through the **existing Historical Import feature (Milestone
   4, unchanged)**.
4. The imported `perdiem_requests` rows are **already visible to the Client
   Admin today** via existing RLS - confirmed by the user as exactly the
   "payment records" visibility they wanted. No new payment-tracking table
   was needed for that part.
5. The Super/Master Admin marks the submission **Done** in the new inbox
   once finished.

**Confirmed explicitly not needed, and not built:** no `document_reports`
table, no in-app upload proxy, no new payment-record feature. `work_types`
was left untouched - this milestone turned out not to need it after all
(see the corrected comment on `WorkType` in `src/lib/data.ts`); its
`client_user` read access is still deferred, now with no milestone actively
planning to add it.

**What was built:**
- `supabase/migrations/0009_documents.sql` - `clients.onedrive_drive_id`/
  `onedrive_folder_id`/`onedrive_folder_link` (nullable, set manually per
  client - never auto-created); new `documents` table (`client_id`,
  `onedrive_item_id`, `onedrive_file_name`, `onedrive_web_url`, `status`
  `submitted|processing|done`, `onedrive_modified_at`, `first_seen_at`,
  `processed_at`, `processed_by`). RLS: SELECT via the same
  `can_access_client()` shape `work_types` already uses; UPDATE restricted
  to `is_super_admin_or_above()` only - a Client Admin can see status but
  never marks their own submission done; no authenticated-role INSERT
  policy at all - rows only ever come from the sync route below.
- `src/lib/microsoft/graph.ts` - read-only Graph client mirroring
  `src/lib/supabase/admin-server.ts`'s pattern exactly (`server-only`,
  throw on missing env, no exported singleton). Uses the OAuth2
  client-credentials grant (`POST
  https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, scope
  `https://graph.microsoft.com/.default`) - simpler than a refresh-token
  flow, just three static credentials, access token cached in memory and
  re-requested near expiry. One function: `listFolderChildren(driveId,
  folderId)`.
- `src/app/api/admin/documents/sync/route.ts` - mirrors
  `invite-admin/route.ts`'s auth shape (request-scoped client
  authenticates, manual per-tier authorization, Client Admin's `clientId`
  forced from their own row not trusted from the body, only then drops to
  the service-role client) - calls Graph, upserts into `documents`, never
  regresses an existing `processing`/`done` row back to `submitted`.
- UI: Clients tab widget (`admin-clients-overview.tsx`) gained a collapsible
  "OneDrive Submission Folder" section per client (Drive ID/Folder ID/Link,
  Super/Master only); new "Documents" tab (`admin-documents-tab.tsx`,
  Client Admin only) - open-in-OneDrive link, manual Sync button, status
  table; new "Submissions" tab (`admin-submissions-tab.tsx`, Super/Master
  only) - cross-client queue, per-client Sync, Mark Processing/Done. Both
  new tabs got sidebar nav entries and "Guide me" tour steps
  (`src/lib/tours/admin-tour.ts`), gated identically to how the dashboard
  itself gates them.

**`supabase/migrations/0009_documents.sql` is now applied live** (confirmed
by the user). Note this migration slipped through without being explicitly
tracked as applied when it was first written, unlike `0008` - it caused a
real bug in the meantime: `getClients()` (`src/lib/supabase/database.ts`)
selects the new `onedrive_*` columns unconditionally, so before this
migration was applied that query failed outright (column doesn't exist) and
its error handler silently returned an empty array - the Super Admin
Clients tab showed "No clients yet." even though Apeiro (and anything else)
still existed. Now fixed. **Lesson for future migrations:** always
explicitly confirm and record live application in this doc the same
session a migration is written, not just when something breaks later.

**Still blocked on, not yet provided:** a Microsoft Entra ID (Azure AD) app
registration with Graph **Application permission** `Files.Read.All`
(admin-consented) - same category of blocker Supabase `.env` credentials
were in earlier milestones. Needs `MICROSOFT_TENANT_ID`,
`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` in `.env`, plus each
client's real OneDrive Drive ID/Folder ID recorded once the org's existing
folder structure is confirmed. The exact Graph "list folder children"
response shape (`GET /v1.0/drives/{id}/items/{id}/children`) was built
against Microsoft's public, well-documented API reference but has not been
exercised against a real call yet - worth a live smoke test as soon as
credentials exist, before trusting it against real client data. This part
(the "Documents"/"Submissions" tabs' actual sync functionality) is what
remains non-functional - the Clients tab widget grid itself is now fixed
and doesn't depend on Microsoft credentials at all.

**Verified this session:** `npm run typecheck`/`npm run build` (temporary
placeholder `.env` including placeholder Microsoft vars, deleted after)
show no new errors beyond the same pre-existing ones tracked throughout
this doc, `/api/admin/documents/sync` registers correctly as a route, and
migration `0009` is now confirmed applied live, fixing the Clients-tab
empty-grid bug.

**Not yet verified** (blocked on real Microsoft credentials + no browser
tool this session): an actual OneDrive sync against a real folder, RLS
confirmed via direct PostREST call (Client Admin never able to update a
document's status, only Super/Master), and the full click-through per
tier. Added as `docs/TEST_GUIDE.md` §10.

## Off-plan: self-service Delete Client — ✅ DONE (code, not browser-tested)

Prompted by real friction this session: applying migration `0009` late
caused the Clients tab to silently show an empty grid (see Milestone 5
above), which led to several duplicate clients getting created by repeated
"Add Client" clicks while troubleshooting. Cleaning those up required
hand-written one-off SQL scripts (`supabase/one-off-remove-duplicate-apeiro-clients.sql`,
`supabase/one-off-diagnose-blocking-participant.sql`) run manually in the
Supabase SQL Editor - the user asked for this to be self-service instead.

**What was built:**
- `supabase/migrations/0010_client_delete.sql` - adds a DELETE RLS policy on
  `clients` for `is_super_admin_or_above()`. Previously there was no DELETE
  policy at all, so no one (not even Super Admin) could delete a client row
  through the app - only direct SQL Editor access (service-role, bypasses
  RLS) could, which is exactly what forced the manual-script workaround.
- `src/lib/supabase/database.ts`'s new `deleteClient(clientId)` - deliberately
  has **no application-level "is this client empty?" check**. The existing
  foreign-key references from `participants`/`events`/`perdiem_requests`/
  `work_types`/`documents` to `clients` are the real safety mechanism - a
  client with anything attached rejects the delete outright (Postgres error
  code `23503`, mapped to a friendly "archive instead" message) rather than
  silently cascading real data away. This mirrors exactly the safety
  behavior the manual SQL scripts already relied on.
- UI: `src/app/admin/admin-clients-overview.tsx`'s `ClientWidget` gained a
  "Delete Client" button in a visually-separated destructive footer,
  opening an `AlertDialog` that requires typing the client's exact name
  before the Delete action enables - the type-to-confirm pattern the user
  asked for.

**Verified this session:** `npm run typecheck`/`npm run build` (temporary
placeholder `.env`, deleted after) - no new errors.

**Not yet verified** (no browser tool this session): an actual delete
against a real empty client, and confirming a client with attached data
gets the friendly "archive instead" message rather than a raw Postgres
error. Worth adding to `docs/TEST_GUIDE.md` once click-tested.

## Off-plan: Historical Import hardening for real multi-sheet/multi-event files — ✅ DONE (code, not browser-tested)

Prompted by two real bulk per-diem files this session ("Payment Analysis
from Jan 2025 to May 2026" and "2026 Apeiro Taifacare Payment Analysis") -
both far messier than the original Milestone 4 sample: multiple sheets
(one per quarter/month), several title/note rows before the real header
row (position varies even between sheets in the *same* workbook), and -
critically - rows like `"<Event> — EVENT TOTAL"` / `"GRAND TOTAL — PAYMENTS
TO DATE"` with the summary text sitting in the same column as the
participant's name and a real number in the amount column. Uploaded as-is
before this work, those summary rows would have silently imported as
payments to a fake "participant," worth several million KES combined
across the two 2026 sheets alone (63 such rows found and confirmed
excluded, zero false positives on real names).

**What changed in `src/app/admin/admin-historical-import.tsx`:**
- **Multi-sheet support**: `handleFile` now filters to non-empty sheets
  (`sheetHasData` - a sheet needs at least one row with 2+ non-blank cells)
  and shows a sheet picker only when more than one qualifies; a single
  non-empty sheet still auto-advances exactly like before, so simple files
  see no new friction.
- **Header-row auto-detection**: `detectHeaderRow` scores the first 20 rows
  by how many fields `guessMapping()` recognizes and picks the best-scoring
  one (falling back to row 0 if nothing scores >=2), instead of always
  assuming row 1 - title/note rows above the real header are skipped
  automatically, computed independently per sheet since header position
  varies within the same file.
- **Summary-row exclusion**: `buildRows` now flags any row whose mapped
  participant-name cell matches `/\btotal\b/i` as invalid ("Looks like a
  total/summary row, not a participant - excluded") rather than importing
  it - verified against real data that this only ever matches actual
  summary rows (all had a blank "No." column), never a real name.
- **Sharper auto-guessing** (`HEADER_GUESSES`): added `training` as an
  `eventName` synonym for `event`; added an early, more specific
  `totalPerdiem` pattern (`total.*amount|grand.*total|net.*pay`) tried
  *before* the old broad `perdiem|per.diem|dsa|total|amount` fallback, so a
  sheet with both "DSA Allowance" and "Total Amount" columns picks the real
  total instead of whichever appears first left-to-right; `venueCounty`'s
  `county` pattern now excludes headers that also say "employer" (a
  participant's own org/county, not the event venue's); `outOfOfficeAllowance`
  narrowed from a bare `allowance` match (which false-positived on
  "Transport Allowance"/"DSA Allowance") to specifically `out.of.office`.
  Verified: the real files' header row now auto-maps with **zero manual
  corrections** (previously needed 3 manual fixes per upload), and the
  original Milestone 4 sample header's mapping is unchanged (no regression).
- **Batch Details step no longer requires an Event Name** to proceed - it's
  now framed as a fallback default only, since real multi-event files map
  their own per-row Event Name column instead. The real safety net (a row
  with neither a mapped column nor a default gets flagged "Missing event
  name" and excluded) already existed in the preview step and is untouched.

**Explicitly decided against building:** parsing the repeated
`EVENT:`/`Place:`/`Payment Date:` note-blocks that appear *between* data
sections in some sheets to auto-populate Venue Name/City per event - the
existing per-row Event Name column (e.g. "Training") already carries
enough identifying text, and correlating multi-row context blocks to the
data rows that follow them is a meaningfully bigger parsing problem than
the flat one-row-per-record model this feature is built around. Venue
Name/City stay a manual per-upload fallback default (usually left blank)
for files shaped like this.

**Data-quality checks done manually this session, not built into the
tool:** near-duplicate event-name detection (Levenshtein + word-overlap
clustering) was run ad hoc against both real files to catch typo'd venue
names before import (found and merged 2 real groups in the Jan2025-May2026
file - see the one-off `perdiem-import-ready/*.xlsx` files prepared for
Q1-Q3 2025; found zero real duplicates in the 2026 file, where superficial
clustering matches turned out to be genuinely different locations sharing
template wording like "County Leadership Forum"). This stayed a one-off
manual analysis, not a new importer feature - worth reconsidering if a
third messy file shows the same need.

**Verified this session:** `npm run typecheck`/`npm run build` (temporary
placeholder `.env`, deleted after) - no new errors. Auto-guess and
total-row-exclusion logic verified against the real files' actual data via
standalone Node scripts replicating the exact regex/logic
(`sheetHasData`/`detectHeaderRow`/`guessMapping`/the `\btotal\b` check),
not just reasoned through.

**Not yet verified** (no browser tool this session): an actual upload
through the real dialog UI - sheet picker rendering, the Details step
proceeding with everything blank, and the corrected auto-mapped columns
showing up right in the Map step - all reasoned through and logic-tested
outside the component, not click-tested inside it.

## Milestone 6 — Claude for Team MCP integration — ⬜ NOT STARTED

Read-mostly MCP server (`list_clients`, `list_work_types`, `list_documents`,
`get_document_content`, `save_draft_report`). Auth: `mcp_api_keys` table +
short-lived self-signed HS256 JWT minted per-request from a personal access
token (confirmed workable - see the JWT signing note above). Needs
`SUPABASE_JWT_SECRET` added to `.env`. Depends on Milestone 5.

**Tool set needs re-checking against Milestone 5's actual final shape**
before building this - it was designed around the original Supabase
Storage plan and hasn't been revisited since Milestone 5 turned out to be a
much narrower OneDrive submission inbox (see that section above): `
get_document_content` would now mean fetching a file's bytes via Microsoft
Graph (`GET /v1.0/drives/{id}/items/{id}/content`) rather than Supabase
Storage or Zoho; `save_draft_report` presumed a `document_reports`
table that was explicitly decided against and never built - Milestone 5's
"cleaning the data" step is a human (optionally Claude-assisted ad hoc,
outside any formal tool) exporting a clean sheet and running it through
the existing Historical Import feature, not a draft-report artifact this
MCP server would store. Worth deciding at Milestone 6 planning time whether
`save_draft_report` still makes sense at all, or whether the real
Claude-for-Team value here is just `list_documents`/`get_document_content`
(surface what's in the Submissions queue and let Claude read a raw
document to help with the cleaning step) plus perhaps a new tool wrapping
the existing `import_historical_events()` RPC.

## Suggested next session prompt

"Milestone 5 is code-complete (Microsoft OneDrive submission inbox - see
that section above) but entirely unverified live, since it's blocked on a
Microsoft Entra ID app registration that doesn't exist yet. First: get
`MICROSOFT_TENANT_ID`/`MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` from
the user (Entra ID → App registrations → new app → Graph API permission
`Files.Read.All`, admin-consented → Certificates & secrets → new secret),
add them to `.env`, then record a real client's OneDrive Drive ID/Folder ID
via the Clients tab's new 'OneDrive Submission Folder' field and run an
actual sync (`/api/admin/documents/sync`) against it - confirm files appear
as `submitted`, and only Super/Master can move them to
`processing`/`done` (RLS-enforced, not just hidden in the UI - test via a
direct PostREST call too).

If a browser tool is available, also close the still-open click-through gap
on everything built across the last few sessions, none of which has been
tested in a real browser yet: the tier-specific admin portals (log in as
the existing Apeiro Client Admin at `/apeiro-admin`, confirm it lands on
`/apeiro-admin/dashboard` and rejects other clients' slugs; same for
`/super-admin`/`/master-admin`; click through the Clients-tab widgets); the
dark/light toggle at `/settings`; the 'Guide me' tour per tier (confirm
step order, and that a Client Admin never sees the `clients`/`submissions`
steps while a Super/Master Admin does); and the new Documents/Submissions
tabs once real OneDrive data exists.

Also still pending, lower priority: revoke the ⚠️ TEMPORARY master_admin
all-portals-access testing bypass before any real launch (see 'Current repo
state' above for the exact three spots); independently re-verify migration
`0008`'s live application; close the original Milestones 2-4 email-invite
click-through gap; and once a fuller historical import file shows up,
confirm `import_historical_events()`'s participant-matching/repeat-event
paths against real data (Milestone 4's noted limitation - correct by code
review only so far).

Once OneDrive is verified live, revisit Milestone 6's planned MCP tool set
against Milestone 5's actual final shape before building it - see the note
under Milestone 6 above (`save_draft_report` in particular presumed a
`document_reports` table that was explicitly decided against)."
