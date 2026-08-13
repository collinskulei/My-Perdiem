-- One-off cleanup ahead of a fresh bulk historical-data upload for Apeiro.
-- NOT a numbered migration (supabase/migrations/) - this is a point-in-time
-- data operation, not a reconstructable schema step. Run manually in the
-- Supabase SQL Editor, reviewing Step 1's output before Step 4.

-- Step 1: Diagnostic - confirm nothing still references the placeholder
-- "Default Client (migrated)" row before attempting to delete it in Step 4.
-- If any of these are non-zero, resolve them first (reassign or remove the
-- dependent rows) - Step 4's DELETE will otherwise fail on a foreign-key
-- constraint rather than silently cascading, but better to know why up front.
select
  (select count(*) from participants where client_id = '00000000-0000-0000-0000-000000000001') as participants,
  (select count(*) from events where client_id = '00000000-0000-0000-0000-000000000001') as events,
  (select count(*) from perdiem_requests where client_id = '00000000-0000-0000-0000-000000000001') as perdiem_requests,
  (select count(*) from work_types where client_id = '00000000-0000-0000-0000-000000000001') as work_types;

-- Step 2: Add the 4 activity types as work types for Apeiro.
insert into work_types (client_id, name)
select c.id, activity
from clients c
cross join unnest(array[
  'TOT - Training of Trainers',
  'EUT - End User Training',
  'Leadership Training/Workshop',
  'CHP - County Health Promoters Event'
]) as activity
where c.name = 'Apeiro';

-- Step 3: Remove Apeiro's existing historical per-diem/event data, since the
-- upcoming bulk upload replaces it. perdiem_requests deleted before events
-- (perdiem_requests.event_id references events - child before parent).
-- Venues are left untouched (shared/global directory, not Apeiro-specific).
delete from perdiem_requests where client_id = (select id from clients where name = 'Apeiro');
delete from events where client_id = (select id from clients where name = 'Apeiro');

-- Step 4: Permanently delete the placeholder "Default Client (migrated)" row.
-- Fails loudly with a foreign-key error if Step 1 showed any dependents -
-- that's Postgres protecting you from orphaning data, not a bug to work around.
delete from clients where id = '00000000-0000-0000-0000-000000000001';
