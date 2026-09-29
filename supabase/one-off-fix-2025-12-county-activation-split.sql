-- One-off fix: County Activation (CS Delegation DSA), Sep 2025, paid 6 Dec 2025.
-- Sources: "Kakamega County Activation Q4_2025 (1).xlsx" (25 / 657,300, trip 2-5 Sep 2025) and
-- "Uasin Gishu CS DSA Q4 2025 (1).xlsx" (25 / 630,000, trip 8-11 Sep 2025) = 50 / 1,287,300.
-- The system holds 29 "County Activation" records (749,700), dated 2025-12-05 (importer one day early):
-- the 21 people who went on BOTH trips were collapsed into one record each.
-- Built from "County Activation Sep 2025 - System Corrections.xlsx" and
-- "Uasin Gishu County Activation Q4 2025 - Upload Ready (missing 21).xlsx", matched to the live
-- records by phone + amount on 29 Sep 2026 (29 / 29 matched, names identical):
--   1. Renames the existing event to "Kakamega County — County Activation (CS Delegation DSA)", training 2-5 Sep 2025 (3 days), paid 6 Dec;
--      its 25 Kakamega records move to the true payment date 2025-12-06. Amounts unchanged.
--   2. Creates "Uasin Gishu County — County Activation (CS Delegation DSA)" (Workshop, training 8-11 Sep 2025, 3 days, paid 6 Dec) and moves the
--      4 Uasin Gishu-only records into it (Rachel Kendi, Allan Odhiambo, Janet Moturi, Joseph Mambo).
--   3. Adds the 21 missing Uasin Gishu payments (537,600) with the TRUE date 2025-12-06 - done here
--      INSTEAD of uploading the "missing 21" file in the app (the app would store them one day early).
-- The separate "County Activations" (21-23 Jul) and "Cabinet Secretary Delegation DSA - Nyandarua"
-- events are NOT touched.
-- All dates here are TRUE dates - these rows must be EXCLUDED from the later +1 day importer-bug
-- backfill; they are listed in perdiem_requests_backup_2025_12_county_activation.
-- Expected after: December 2025 = 470 rows / KES 10,371,100 (was 449 / 9,833,500).
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table ca_rows (id text primary key, trip text, amount double precision) on commit drop;
insert into ca_rows values
    ('5e3d85c6-0336-4a09-a6d8-073d162a18e0', 'KK', 42000),
    ('e2ba94e1-c2e1-4f8b-ba29-5becc73ca942', 'KK', 33600),
    ('47fc6011-5517-4d35-84af-de3bddc34405', 'KK', 33600),
    ('adbe4848-ac9b-4769-a8cc-5a28dba11116', 'KK', 33600),
    ('29d1b048-7c7c-472b-9dc9-4a70443c9afe', 'KK', 33600),
    ('3fb91475-d7d9-4848-8ba1-8c275877ea69', 'KK', 33600),
    ('bc5db3f4-2b89-4397-9a30-eadd0d935fdf', 'KK', 18900),
    ('df57a8c7-32e8-4c59-abd9-a7a9e11667e0', 'KK', 33600),
    ('4af2e1e2-2871-4e04-b8a1-f9b3d19520b6', 'KK', 18900),
    ('4dbf8317-8a7f-4647-ba06-d06eb1d815c4', 'KK', 18900),
    ('d772f289-c0e6-464c-9fba-034072241c7e', 'KK', 18900),
    ('be37bbf1-8943-43c0-82f0-f8c5a8e54023', 'KK', 18900),
    ('2f0ea7e6-ff44-43ee-99af-3c9ccc245227', 'KK', 18900),
    ('c4298611-83da-41f4-8c1f-8122da8f4bf1', 'KK', 18900),
    ('b2d3ca72-52fe-4c28-bdef-171ca1f89f28', 'KK', 33600),
    ('28fb0483-874e-42c8-9160-423e66ec7583', 'KK', 18900),
    ('17cffea0-7f5d-4757-9e50-4a5e4ddde0bb', 'KK', 18900),
    ('fa335d33-d7cc-4f35-ba28-cf659052bd5e', 'KK', 33600),
    ('0400f4e0-3a87-4cd8-876a-7cc0309673ac', 'KK', 18900),
    ('1c03710c-9a72-4371-8408-8082aadb2e61', 'KK', 33600),
    ('734fd452-ce73-4609-9e9b-cd8465a082ac', 'KK', 18900),
    ('a615f2d1-1ba5-4210-bae4-c20afc44161c', 'KK', 33600),
    ('c39aabdb-c6b1-418e-a3fa-91ca42ba3a9c', 'KK', 33600),
    ('e4588cd1-7434-4009-8db5-447e885bb051', 'KK', 18900),
    ('51349db5-7fee-4771-9f7e-15b3fd90e9fc', 'KK', 18900),
    ('abde6e24-9f32-4ade-a7a4-08d702f3f267', 'UG', 42000),
    ('c1541b2e-5c62-40cc-9e3a-3cc61b6748d7', 'UG', 12600),
    ('4eebf3c7-e788-414f-84c3-af3ec9962776', 'UG', 18900),
    ('94c352bc-8889-49b4-b307-47840f261041', 'UG', 18900);

create temp table ug_new (id text primary key, participant_name text, participant_phone text, total double precision) on commit drop;
insert into ug_new values
    ('46b6e71d-642d-4cb1-9b7c-4c0f6c319250', 'Dr. Nasri Omar', '+254724648357', 42000),
    ('269208e4-01fc-48b5-8d2f-13dc3ddfe37f', 'Hassan Mugambi', '+254724576612', 33600),
    ('c8b59721-23c4-4016-91e3-757836d3039a', 'Maureen Ntari', '+254726633435', 33600),
    ('f6b0d026-d4df-4526-bec6-6ae4a3a7439d', 'Hassan Muhumed', '+254720473557', 33600),
    ('8a0ba200-0e4d-4581-96fc-eb8da6b44c89', 'Rodgers Luganje', '+254704479088', 18900),
    ('6f7d32ea-d8e5-4435-8b46-f8c69ce215c3', 'Ayub Odhiambo', '+254725396525', 33600),
    ('b27cc45e-55e6-4017-8809-39ae8e276c39', 'Micah Chege', '+254721358843', 18900),
    ('3aee781b-94d8-4acf-a04a-72234b7ff4b4', 'Douglas Moriasi', '+254742010518', 18900),
    ('2ba80d13-4ecb-48bc-b3c2-0600ae30cd71', 'Edwin Rono', '+254722145712', 18900),
    ('63da1e27-25e5-4310-a565-2b314c63a891', 'Peter Lolosoli', '+254768237013', 18900),
    ('35f6e67f-b229-46a6-936c-882f570d3fea', 'Victor Narengo', '+254704078607', 18900),
    ('1894d9db-80ef-4fcc-a6ab-834268a8f189', 'Chrisantos Eshitoli', '+254797732633', 18900),
    ('7bfecfba-dab2-4670-bc4b-e5ef109bd936', 'David Balesa', '+254721293263', 33600),
    ('7f55b9ac-121a-4bab-b52d-41e4d7f87a5f', 'Athanus Mutuku', '+254725961007', 18900),
    ('428432c6-a954-4419-8038-c028dad225ad', 'Meltus Wandera', '+254719230651', 18900),
    ('46330062-533a-44bb-b256-659a1f9f8377', 'Nicholas Mutua', '+254720651703', 33600),
    ('755422e2-3c83-4140-8d1d-0445deac7f4f', 'Royan Wachira', '+254727908829', 18900),
    ('c0f409d5-7e44-401e-a05b-f14f844f8499', 'Margot Washiali', '+254700681385', 33600),
    ('aba923c6-fa32-488a-9156-f5762ac84ada', 'David Kamande', '+254715114402', 33600),
    ('f2c3824b-3168-434e-83c5-b211c2e91dc7', 'John Wawire', '+254722360928', 18900),
    ('3e635a19-50dc-4d4e-92d6-4f5970cda3ea', 'James Muthee', '+254722366444', 18900);

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-12-01' and '2025-12-31';
  if n <> 449 or s <> 9833500 then
    raise exception 'December is not in the expected state: % rows / KES % (expected 449 / 9833500)', n, s;
  end if;
  if (select count(*) from events where id = '53d53504-bc67-40e7-a260-41d4cb3b74fa' and name = 'County Activation') <> 1 then
    raise exception 'The County Activation event is not as expected - already fixed?';
  end if;
  if (select count(*) from perdiem_requests p join ca_rows c on c.id = p.id and p.total_perdiem = c.amount
      where p.event_id = '53d53504-bc67-40e7-a260-41d4cb3b74fa' and p.date = '2025-12-05') <> 29 then
    raise exception 'The 29 County Activation records are not all in place with the expected amounts';
  end if;
  if (select count(*) from perdiem_requests where event_id = '53d53504-bc67-40e7-a260-41d4cb3b74fa') <> 29 then
    raise exception 'The County Activation event holds more than the 29 expected records';
  end if;
  if (select count(*) from ug_new) <> 21 or (select sum(total) from ug_new) <> 537600 then raise exception 'New row list is not 21 / 537600'; end if;
  if exists (select 1 from events where name in ('Kakamega County — County Activation (CS Delegation DSA)', 'Uasin Gishu County — County Activation (CS Delegation DSA)')) then raise exception 'A Kakamega/Uasin Gishu County Activation event already exists'; end if;
  if exists (select 1 from perdiem_requests p join ug_new u on p.id = u.id) then raise exception 'An id already exists'; end if;
  -- each new Uasin Gishu payment must be the twin of a Kakamega record (same phone + amount)
  if (select count(*) from ug_new u join perdiem_requests p on right(p.participant_phone, 9) = right(u.participant_phone, 9) and p.total_perdiem = u.total
      join ca_rows c on c.id = p.id and c.trip = 'KK') <> 21 then
    raise exception 'Not all 21 new payments match a Kakamega record by phone + amount';
  end if;
end $$;

-- Step 2: Backup / undo list. Undo with:
--   update perdiem_requests p set date = b.old_date, event_id = b.old_event_id, event_name = b.old_event_name
--     from perdiem_requests_backup_2025_12_county_activation b where b.kind = 'moved' and p.id = b.id;
--   delete from perdiem_requests where id in (select id from perdiem_requests_backup_2025_12_county_activation where kind = 'inserted');
--   update events set name = 'County Activation', event_dates = array['2025-12-05'], training_start_date = '2025-09-01',
--     training_end_date = '2025-09-10' where id = '53d53504-bc67-40e7-a260-41d4cb3b74fa';
--   delete from events where id in (select id from perdiem_requests_backup_2025_12_county_activation where kind = 'event');
create table perdiem_requests_backup_2025_12_county_activation as
  select p.id, 'moved'::text as kind, p.date as old_date, p.event_id as old_event_id, p.event_name as old_event_name, now() as backed_up_at
  from perdiem_requests p join ca_rows c on c.id = p.id
  union all select id, 'inserted', null, null, null, now() from ug_new
  union all select '9d80e3a1-75bf-4fd6-9efc-4fa052c25247', 'event', null, null, null, now();

-- Step 3: Kakamega trip - rename the event, set its true dates, move its 25 records to 6 Dec.
update events set name = 'Kakamega County — County Activation (CS Delegation DSA)', event_dates = array['2025-12-06'],
  training_start_date = '2025-09-02', training_end_date = '2025-09-05', number_of_training_days = 3
where id = '53d53504-bc67-40e7-a260-41d4cb3b74fa';
update perdiem_requests set date = '2025-12-06', event_name = 'Kakamega County — County Activation (CS Delegation DSA)'
where id in (select id from ca_rows where trip = 'KK');

-- Step 4: Uasin Gishu trip - new event, move the 4 Uasin Gishu-only records into it.
insert into events (id, client_id, name, created_at, event_dates, event_type, venue_id, venue_name, venue_city, facilitator,
                    training_start_date, training_end_date, number_of_training_days)
select '9d80e3a1-75bf-4fd6-9efc-4fa052c25247', client_id, 'Uasin Gishu County — County Activation (CS Delegation DSA)', now(), array['2025-12-06'], 'Workshop', venue_id, venue_name, venue_city, 'Imported (historical)',
       '2025-09-08', '2025-09-11', 3
from events where id = '53d53504-bc67-40e7-a260-41d4cb3b74fa';
update perdiem_requests set date = '2025-12-06', event_id = '9d80e3a1-75bf-4fd6-9efc-4fa052c25247', event_name = 'Uasin Gishu County — County Activation (CS Delegation DSA)'
where id in (select id from ca_rows where trip = 'UG');

-- Step 5: The 21 missing Uasin Gishu payments (people who were on both trips).
insert into perdiem_requests (
  id, client_id, participant_id, participant_name, participant_phone, event_id, event_name, location, date, status,
  notes, employer, moh_staff, transport_allowance, dsa_allowance, total_perdiem, imported_at, flag_reason, is_overpayment, recovered_amount)
select u.id, '87283dbf-d590-4f66-b28d-ffe8023a1f54', null, u.participant_name, u.participant_phone, '9d80e3a1-75bf-4fd6-9efc-4fa052c25247', 'Uasin Gishu County — County Activation (CS Delegation DSA)', '', '2025-12-06', 'Paid',
  'County Activation - Uasin Gishu trip (CS Delegation DSA), 8-11 Sep 2025; also on the Kakamega trip (2-5 Sep) - separate payment (added 29 Sep 2026).',
  'MOH', true, 0, u.total, u.total, now(), null, false, 0
from ug_new u;

-- Step 6: Check before committing.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-12-01' and '2025-12-31';
  if n <> 470 or s <> 10371100 then raise exception 'December after the fix is % rows / KES % (expected 470 / 10371100)', n, s; end if;
  if (select count(*) from perdiem_requests where event_name = 'Kakamega County — County Activation (CS Delegation DSA)') <> 25 then raise exception 'Kakamega trip should have 25 payments'; end if;
  if (select count(*) from perdiem_requests where event_name = 'Uasin Gishu County — County Activation (CS Delegation DSA)') <> 25 then raise exception 'Uasin Gishu trip should have 25 payments'; end if;
  if (select sum(total_perdiem) from perdiem_requests where event_name in ('Kakamega County — County Activation (CS Delegation DSA)', 'Uasin Gishu County — County Activation (CS Delegation DSA)')) <> 1287300 then raise exception 'The two trips should total 1287300'; end if;
end $$;

commit;

-- Step 7: Verify - expect 2025-12 = 470 / 10371100; Kakamega 25 / 657,300; Uasin Gishu 25 / 630,000.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-12-01' and '2025-12-31' group by 1;
select e.name, e.training_start_date, e.training_end_date, count(*), sum(p.total_perdiem)
from perdiem_requests p join events e on e.id = p.event_id
where e.name in ('Kakamega County — County Activation (CS Delegation DSA)', 'Uasin Gishu County — County Activation (CS Delegation DSA)') group by 1, 2, 3 order by 1;
