-- Targeted cleanup for the 2 events created by testing the in-app
-- Historical Import before it was fully hardened (see
-- docs/MILESTONE_HANDOFF.md's importer-hardening follow-up) - both have
-- messy/inconsistent event_dates ("20/1/2025" text, one raw "45931" serial
-- number). These correspond to events already present in the properly
-- prepared perdiem-import-ready/import-Q1-2025.xlsx, so cleaning them up
-- here avoids ending up with duplicate/messy versions once that clean file
-- is uploaded (or the in-app uploader is retried with the fix in place).

-- Step 1: Diagnostic - see exactly what's attached to these 2 events
-- before deleting anything.
select id, participant_name, event_name, date, imported_at
from perdiem_requests
where event_id in ('c0ffe899-6432-4f98-b8e8-c2e8ff963408', 'aa492ac1-ee9a-4abe-b3bd-a25dc823d05e');

-- Step 2: Delete the per-diem requests tied to these 2 events (child
-- before parent, respecting the foreign key to events).
delete from perdiem_requests
where event_id in ('c0ffe899-6432-4f98-b8e8-c2e8ff963408', 'aa492ac1-ee9a-4abe-b3bd-a25dc823d05e');

-- Step 3: Delete the 2 events themselves.
delete from events
where id in ('c0ffe899-6432-4f98-b8e8-c2e8ff963408', 'aa492ac1-ee9a-4abe-b3bd-a25dc823d05e');

-- Step 4: Re-run the general diagnostic to confirm nothing else with a bad
-- date is still lurking (should now return zero rows in both queries).
select id, participant_name, event_name, date, imported_at
from perdiem_requests
where date !~ '^\d{4}-\d{2}-\d{2}$';

select id, name, event_dates, created_at
from events
where exists (
  select 1 from unnest(event_dates) d where d !~ '^\d{4}-\d{2}-\d{2}$'
);
