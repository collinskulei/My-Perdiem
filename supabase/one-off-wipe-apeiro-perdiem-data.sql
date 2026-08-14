-- Full wipe of Apeiro's per-diem requests and events, ahead of a completely
-- fresh re-import now that the historical importer's date handling is
-- fixed. Does NOT touch clients, participants, or work_types - only the
-- payment/event data itself.

-- Step 1: Diagnostic - see what's about to be removed.
select
  (select count(*) from perdiem_requests where client_id = (select id from clients where name = 'Apeiro')) as perdiem_requests,
  (select count(*) from events where client_id = (select id from clients where name = 'Apeiro')) as events;

-- Step 2: Delete requests before events (respecting the foreign key).
delete from perdiem_requests where client_id = (select id from clients where name = 'Apeiro');
delete from events where client_id = (select id from clients where name = 'Apeiro');

-- Step 3: Confirm - both should now be 0.
select
  (select count(*) from perdiem_requests where client_id = (select id from clients where name = 'Apeiro')) as perdiem_requests,
  (select count(*) from events where client_id = (select id from clients where name = 'Apeiro')) as events;
