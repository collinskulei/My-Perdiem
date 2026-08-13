-- One-off cleanup: removes 3 clients created by repeated "Add Client"
-- clicks during the Clients-tab empty-grid bug (fixed by applying migration
-- 0009 - see docs/MILESTONE_HANDOFF.md's Milestone 5 section), including the
-- original "apeiro" client per explicit user confirmation (a clean slate -
-- work types and historical-import prep done against it this session will
-- need to be redone against whatever client is added next).
-- NOT a numbered migration - run manually in the Supabase SQL Editor.

-- Step 1: Diagnostic - review before deleting. If "participants" is
-- non-zero for any of these, Step 4 will fail on a foreign-key error rather
-- than silently orphaning an account - that's expected; review who those
-- participants are (likely a Client Admin invited against the wrong
-- duplicate) before deciding whether to reassign or remove them.
select c.slug, c.name,
  (select count(*) from participants p where p.client_id = c.id) as participants,
  (select count(*) from events e where e.client_id = c.id) as events,
  (select count(*) from perdiem_requests r where r.client_id = c.id) as perdiem_requests,
  (select count(*) from work_types w where w.client_id = c.id) as work_types,
  (select count(*) from documents d where d.client_id = c.id) as documents
from clients c
where c.slug in ('apeiro', 'apeiro-2', 'apeiro-digital-2');

-- Step 2: Remove dependent rows (child tables before parent "clients").
delete from perdiem_requests where client_id in (
  select id from clients where slug in ('apeiro', 'apeiro-2', 'apeiro-digital-2')
);
delete from events where client_id in (
  select id from clients where slug in ('apeiro', 'apeiro-2', 'apeiro-digital-2')
);
delete from work_types where client_id in (
  select id from clients where slug in ('apeiro', 'apeiro-2', 'apeiro-digital-2')
);
delete from documents where client_id in (
  select id from clients where slug in ('apeiro', 'apeiro-2', 'apeiro-digital-2')
);

-- Step 3: NOT included here on purpose - if Step 1 showed any participants
-- (e.g. a Client Admin invited for one of these), decide what to do with
-- that account manually before Step 4 (reassign to the real client via
-- set_access_tier(), or deactivate/remove it) rather than deleting it blind.

-- Step 4: Delete the client rows themselves. Fails loudly with a
-- foreign-key error if any participants still reference them - that's
-- Postgres protecting you, not a bug to work around.
delete from clients where slug in ('apeiro', 'apeiro-2', 'apeiro-digital-2');
