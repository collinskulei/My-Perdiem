-- Diagnostic: finds perdiem_requests/events with a malformed date - the
-- root cause of the "Application error: a client-side exception" crash on
-- /apeiro-admin/dashboard (a raw Excel serial number like "45931" leaking
-- through as literal text from a historical-import test upload before the
-- date-handling fix - see docs/MILESTONE_HANDOFF.md's importer-hardening
-- off-plan section). Run this first and review before deciding what to do
-- with what it finds - delete if this was just a test upload, or fix the
-- date value directly if the rest of the row is real data worth keeping.

select id, participant_name, event_name, date, imported_at
from perdiem_requests
where date !~ '^\d{4}-\d{2}-\d{2}$';

select id, name, event_dates, created_at
from events
where exists (
  select 1 from unnest(event_dates) d where d !~ '^\d{4}-\d{2}-\d{2}$'
);

-- If the rows above turn out to be just a test upload with nothing worth
-- keeping, delete them (perdiem_requests before events, respecting the
-- foreign key):
-- delete from perdiem_requests where date !~ '^\d{4}-\d{2}-\d{2}$';
-- delete from events where id in (
--   select id from events where exists (
--     select 1 from unnest(event_dates) d where d !~ '^\d{4}-\d{2}-\d{2}$'
--   )
-- );
