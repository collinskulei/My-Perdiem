# Milestone Handoff — Multi-Tenant Roles, Documents & Claude for Team

This tracks progress against the approved plan (originally saved at
`C:\Users\user\.claude\plans\serialized-crafting-spindle.md` on the machine that
planned it). Use this file to pick up work from any workspace/session.

## Current repo state

- Branch `main`, in sync with `origin/main` as of this commit.
- Milestones 0–3 done. Next up: Milestone 4.
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

## Milestone 4 — Bulk historical-data upload (infrastructure only) — ⬜ NOT STARTED

Generalizes the existing XLSX/CSV parser in `admin-dashboard.tsx`
(`handleParticipantFileUpload`) from "participants for one event" to full
historical events + perdiem_requests, via a new atomic
`import_historical_events(client_id, payload)` RPC. Explicitly infrastructure
only — no real historical data gets imported as part of this milestone.

## Milestone 5 — Document submission portal — ⬜ NOT STARTED

The minimal `work_types` table (`id, client_id, name, archived_at`) already
exists as of Milestone 3 - this milestone extends it rather than creating it.
Still to build: `documents`, `document_reports` tables; new private Storage
bucket `documents` (not public, unlike the existing `event-files` bucket);
generalize `src/lib/supabase/storage.ts` to support signed URLs + MIME
validation; `client_user` read access to `work_types` (deliberately deferred
in the 0004 migration until this milestone defines the real access pattern).

## Milestone 6 — Claude for Team MCP integration — ⬜ NOT STARTED

Read-mostly MCP server (`list_clients`, `list_work_types`, `list_documents`,
`get_document_content`, `save_draft_report`). Auth: `mcp_api_keys` table +
short-lived self-signed HS256 JWT minted per-request from a personal access
token (confirmed workable - see the JWT signing note above). Needs
`SUPABASE_JWT_SECRET` added to `.env`. Depends on Milestone 5.

## Suggested next session prompt

"Start Milestone 4: generalize the existing XLSX/CSV participant-upload
parser in `admin-dashboard.tsx` (`handleParticipantFileUpload`) into a full
historical events + perdiem_requests importer, via a new atomic
`import_historical_events(client_id, payload)` RPC. Infrastructure only - no
real historical data gets imported as part of this milestone. If a browser
tool is available, first spend five minutes closing the manual
click-through gap noted in Milestones 2 and 3 (invite an account, click the
real email link, confirm it lands on `/reset-password` and then the right
dashboard) since every session so far has had to verify that flow indirectly
via the API instead."
