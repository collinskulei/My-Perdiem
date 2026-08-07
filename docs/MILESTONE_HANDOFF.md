# Milestone Handoff — Multi-Tenant Roles, Documents & Claude for Team

This tracks progress against the approved plan (originally saved at
`C:\Users\user\.claude\plans\serialized-crafting-spindle.md` on the machine that
planned it). Use this file to pick up work from any workspace/session.

## Current repo state

- Branch `main`, in sync with `origin/main`.
- Latest commits: `caf1583` ("adin dash borad done") on top of `325db22`
  ("commit 003 retrieval and refactor of the heirachy and workflow") on top of
  `43b84c3` ("Revert \"commit 002\"").
- Working tree was clean as of the last check. Always run `git status` and
  `git pull` before starting, in case another workspace pushed more since.

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

## Milestone 3 — Admin-management console + first server-side Supabase code — ⬜ NOT STARTED

Per the plan: `src/lib/supabase/admin-server.ts` (service-role client, needs
`SUPABASE_SERVICE_ROLE_KEY` added to `.env` - not there yet), Route Handlers
under `src/app/api/admin/invite-*` using `supabase.auth.admin.inviteUserByEmail()`,
and console UI where Master Admin adds Super Admins and Super Admin adds/
manages Clients, Client Admins, and each client's "work types" (the config
surface Milestone 5 depends on). No `src/app/api/` directory exists yet at all.

## Milestone 4 — Bulk historical-data upload (infrastructure only) — ⬜ NOT STARTED

Generalizes the existing XLSX/CSV parser in `admin-dashboard.tsx`
(`handleParticipantFileUpload`) from "participants for one event" to full
historical events + perdiem_requests, via a new atomic
`import_historical_events(client_id, payload)` RPC. Explicitly infrastructure
only — no real historical data gets imported as part of this milestone.

## Milestone 5 — Document submission portal — ⬜ NOT STARTED

New `work_types`, `documents`, `document_reports` tables; new private Storage
bucket `documents` (not public, unlike the existing `event-files` bucket);
generalize `src/lib/supabase/storage.ts` to support signed URLs + MIME
validation.

## Milestone 6 — Claude for Team MCP integration — ⬜ NOT STARTED

Read-mostly MCP server (`list_clients`, `list_work_types`, `list_documents`,
`get_document_content`, `save_draft_report`). Auth: `mcp_api_keys` table +
short-lived self-signed HS256 JWT minted per-request from a personal access
token (confirmed workable - see the JWT signing note above). Needs
`SUPABASE_JWT_SECRET` added to `.env`. Depends on Milestone 5.

## Suggested next session prompt

"Start Milestone 3: admin-management console + first server-side Supabase
code. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`, create
`src/lib/supabase/admin-server.ts` (service-role client, server-only), add
Route Handlers under `src/app/api/admin/invite-*` using
`supabase.auth.admin.inviteUserByEmail()`, and build the console UI for
Master Admin → add Super Admins, Super Admin → add/manage Clients and
Client Admins. This is also the natural point to exercise the tier hierarchy
for real (a second/third account finally exists to test `set_access_tier()`
cross-tier rules against) and to click through `/admin` as a logged-in
non-`client_user` in a real browser, closing the one manual check Milestone 2
left unexercised."
